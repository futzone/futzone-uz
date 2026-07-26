import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  JoinMatchBody,
  JoinMatchResponse,
  JoinWaitlistBody,
  JoinRequest as JoinRequestResponse,
  JoinRequestWithSummary,
  MatchParticipant as ParticipantResponse,
  UpdateMyParticipationBody,
} from '@futzone/contracts';
import type { WaitlistPromotionExpiryJobPayload } from '@futzone/contracts';
import { Prisma, type JoinRequest, type Match, type MatchParticipant } from '../generated/prisma';
import { v7 as uuidv7 } from 'uuid';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { assertPartyFits, computeMatchOccupancy } from './occupancy';
import { MatchStateService } from './match-state.service';
import { MatchQueueService } from './match-queue.service';
import { firstFittingWaitlistParty } from './waitlist-selection';
import { buildRequesterSummary } from './requester-summary';
import { ConfigService } from '../config/config.service';
import { AttendanceQueueService } from '../attendance/attendance-queue.service';
import { shouldCreateEarlyCancellation } from '../attendance/attendance-rules';
import { NotificationsService } from '../notifications/notifications.service';

const PROMOTION_TTL_MS = 30 * 60_000;
type Promotion = WaitlistPromotionExpiryJobPayload;

type LockedMatch = Pick<
  Match,
  | 'id'
  | 'ownerId'
  | 'status'
  | 'joinMode'
  | 'totalSlots'
  | 'startsAt'
  | 'durationMin'
  | 'verifiedPhoneOnly'
  | 'allowNewPlayers'
  | 'minRating'
  | 'minAttendancePct'
>;

type JoinRequirementStats = {
  attendancePct: Prisma.Decimal | null;
  bayesAvg: Prisma.Decimal | null;
};

type MissedReputationRequirement =
  | { requirement: 'allowNewPlayers' }
  | { requirement: 'minRating'; minimum: number; actual: number }
  | { requirement: 'minAttendancePct'; minimum: number; actual: number };

export function missedReputationRequirement(
  match: Pick<LockedMatch, 'allowNewPlayers' | 'minRating' | 'minAttendancePct'>,
  stats: JoinRequirementStats | null,
): MissedReputationRequirement | null {
  const minimumRating = match.minRating === null ? null : Number(match.minRating);
  const minimumAttendance = match.minAttendancePct;
  const isNewPlayer = stats?.bayesAvg == null;
  const isNewForRequiredStats =
    (minimumRating !== null && stats?.bayesAvg == null) ||
    (minimumAttendance !== null && stats?.attendancePct == null);
  if (isNewPlayer && !match.allowNewPlayers)
    return { requirement: 'allowNewPlayers' };
  if (isNewForRequiredStats)
    return match.allowNewPlayers ? null : { requirement: 'allowNewPlayers' };

  const actualRating = stats?.bayesAvg == null ? null : Number(stats.bayesAvg);
  if (minimumRating !== null && actualRating !== null && actualRating < minimumRating)
    return { requirement: 'minRating', minimum: minimumRating, actual: actualRating };

  const actualAttendance = stats?.attendancePct == null ? null : Number(stats.attendancePct);
  if (minimumAttendance !== null && actualAttendance !== null && actualAttendance < minimumAttendance)
    return {
      requirement: 'minAttendancePct',
      minimum: minimumAttendance,
      actual: actualAttendance,
    };
  return null;
}

@Injectable()
export class MatchParticipationService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly states: MatchStateService,
    private readonly queue: MatchQueueService,
    private readonly config: ConfigService,
    private readonly attendanceQueue: AttendanceQueueService,
    private readonly notifications: NotificationsService,
  ) {}

  public async joinWaitlist(matchId: string, userId: string, body: JoinWaitlistBody): Promise<ParticipantResponse> {
    return this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      if (match.status !== 'PUBLISHED' && match.status !== 'FULL')
        throw new AppException('INVALID_STATE_TRANSITION', 'Waitlisting is only available before the match starts', HttpStatus.CONFLICT);
      await this.assertNotAlreadyJoined(tx, matchId, userId);
      const occupied = await computeMatchOccupancy(tx, matchId);
      if (occupied + 1 + body.guestCount <= match.totalSlots)
        throw new AppException('VALIDATION_ERROR', 'This party currently fits and can join directly');
      const last = await tx.matchParticipant.findFirst({
        where: { matchId, waitlistPosition: { not: null } },
        orderBy: { waitlistPosition: 'desc' },
        select: { waitlistPosition: true },
      });
      const participant = await tx.matchParticipant.upsert({
        where: { matchId_userId: { matchId, userId } },
        create: { id: uuidv7(), matchId, userId, role: 'PLAYER', status: 'WAITLISTED', guestCount: body.guestCount, waitlistPosition: (last?.waitlistPosition ?? 0) + 1 },
        update: { role: 'PLAYER', status: 'WAITLISTED', guestCount: body.guestCount, waitlistPosition: (last?.waitlistPosition ?? 0) + 1, promotionExpiresAt: null, joinedAt: new Date(), leftAt: null },
      });
      return this.participantResponse(participant);
    });
  }

  public async leaveWaitlist(matchId: string, userId: string): Promise<ParticipantResponse> {
    const participant = await this.prisma.$transaction(async (tx) => {
      await this.lockMatch(tx, matchId);
      const current = await tx.matchParticipant.findUnique({ where: { matchId_userId: { matchId, userId } } });
      if (!current || !['WAITLISTED', 'PENDING_CONFIRMATION'].includes(current.status))
        throw new AppException('NOT_PARTICIPANT', 'Waitlist participation not found', HttpStatus.NOT_FOUND);
      return tx.matchParticipant.update({ where: { id: current.id }, data: { status: 'LEFT', leftAt: new Date(), waitlistPosition: null, promotionExpiresAt: null } });
    });
    await this.queue.cancelPromotion(participant.id);
    return this.participantResponse(participant);
  }

  public async confirmPromotion(matchId: string, userId: string): Promise<ParticipantResponse> {
    const participant = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      if (match.status !== 'PUBLISHED' && match.status !== 'FULL')
        throw new AppException('INVALID_STATE_TRANSITION', 'Waitlist offers can only be confirmed before the match starts', HttpStatus.CONFLICT);
      const current = await tx.matchParticipant.findUnique({ where: { matchId_userId: { matchId, userId } } });
      if (!current || current.status !== 'PENDING_CONFIRMATION' || !current.promotionExpiresAt || current.promotionExpiresAt <= new Date())
        throw new AppException('INVALID_STATE_TRANSITION', 'There is no active waitlist offer to confirm', HttpStatus.CONFLICT);
      await this.assertNoOverlap(tx, match, userId);
      await this.assertRequirements(tx, match, userId);
      await this.assertCapacity(tx, match, 1 + current.guestCount);
      const updated = await tx.matchParticipant.update({ where: { id: current.id }, data: { status: 'CONFIRMED', waitlistPosition: null, promotionExpiresAt: null, joinedAt: new Date(), leftAt: null } });
      await this.syncCapacityState(tx, match, await computeMatchOccupancy(tx, matchId));
      // No MVP notification type covers manager awareness of a promoted party confirming; deferred (see DECISIONS.md ADR-037).
      return updated;
    });
    await this.queue.cancelPromotion(participant.id);
    return this.participantResponse(participant);
  }

  public async expirePromotion(payload: WaitlistPromotionExpiryJobPayload): Promise<void> {
    const next = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, payload.matchId);
      const participant = await tx.matchParticipant.findUnique({ where: { id: payload.participantId } });
      if (!participant || participant.matchId !== payload.matchId || participant.status !== 'PENDING_CONFIRMATION' || !participant.promotionExpiresAt || participant.promotionExpiresAt.toISOString() !== payload.expiresAt || participant.promotionExpiresAt > new Date()) return null;
      await tx.matchParticipant.update({ where: { id: participant.id }, data: { status: 'DECLINED', waitlistPosition: null, promotionExpiresAt: null } });
      return this.promoteNextEligible(tx, match);
    });
    if (next) await this.queue.schedulePromotion(next);
  }

  public async join(
    matchId: string,
    userId: string,
    body: JoinMatchBody,
  ): Promise<JoinMatchResponse> {
    return this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      const invitation =
        match.joinMode === 'INVITE_ONLY' || body.invitationToken
          ? await this.resolveInvitation(tx, matchId, userId, body.invitationToken)
          : null;
      this.assertJoinable(match);
      await this.assertNotAlreadyJoined(tx, matchId, userId);
      await this.assertNoOverlap(tx, match, userId);
      await this.assertRequirements(tx, match, userId);
      await this.assertJoinAdmissionCapacity(tx, match, 1 + body.guestCount);

      if (invitation) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'ACCEPTED', inviteeId: invitation.inviteeId ?? userId },
        });
      }
      if (match.joinMode === 'MANUAL') {
        const request = await tx.joinRequest.upsert({
          where: { matchId_userId: { matchId, userId } },
          create: {
            id: uuidv7(),
            matchId,
            userId,
            message: body.message,
            guestCount: body.guestCount,
          },
          update: {
            message: body.message,
            guestCount: body.guestCount,
            status: 'PENDING',
            decidedById: null,
            decidedAt: null,
            createdAt: new Date(),
          },
        });
        await this.notifications.notify(match.ownerId, 'JOIN_REQUEST_RECEIVED', { requestId: request.id, requesterId: userId }, { matchId, tx });
        return { kind: 'request', request: this.requestResponse(request) };
      }

      const participant = await tx.matchParticipant.upsert({
        where: { matchId_userId: { matchId, userId } },
        create: {
          id: uuidv7(),
          matchId,
          userId,
          role: 'PLAYER',
          status: 'CONFIRMED',
          guestCount: body.guestCount,
        },
        update: {
          role: 'PLAYER',
          status: 'CONFIRMED',
          guestCount: body.guestCount,
          joinedAt: new Date(),
          leftAt: null,
          waitlistPosition: null,
        },
      });
      await this.syncCapacityState(tx, match, await computeMatchOccupancy(tx, matchId));
      // No MVP notification type covers manager awareness of a direct AUTO join; deferred (see DECISIONS.md ADR-037).
      return { kind: 'participant', participant: this.participantResponse(participant) };
    });
  }

  public async leave(matchId: string, userId: string): Promise<ParticipantResponse> {
    const result = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      const participant = await tx.matchParticipant.findUnique({
        where: { matchId_userId: { matchId, userId } },
      });
      if (!participant || participant.status !== 'CONFIRMED')
        throw new AppException(
          'NOT_PARTICIPANT',
          'Confirmed participation not found',
          HttpStatus.NOT_FOUND,
        );
      if (participant.role === 'OWNER')
        throw new AppException(
          'FORBIDDEN',
          'The playing owner cannot leave the match',
          HttpStatus.FORBIDDEN,
        );
      await computeMatchOccupancy(tx, matchId); // Locked pre-mutation recomputation; lowering is always allowed.
      const leftAt = new Date();
      const updated = await tx.matchParticipant.update({
        where: { id: participant.id },
        data: { status: 'LEFT', leftAt },
      });
      // Exactly at the cutoff is non-penalizing (ADR-030); only a strictly later departure gets a record.
      let attendance: { id: string; markedAt: Date } | null = null;
      if (shouldCreateEarlyCancellation(match.startsAt, leftAt, this.config.get('ATTENDANCE_EARLY_CANCEL_HOURS'))) {
        attendance = await tx.attendanceRecord.upsert({
          where: { participantId: participant.id },
          create: { id: uuidv7(), matchId, participantId: participant.id, status: 'CANCELLED_EARLY', markedById: userId, markedAt: leftAt },
          update: { status: 'CANCELLED_EARLY', markedById: userId, markedAt: leftAt, finalizedAt: null },
        });
        await this.notifications.notify(userId, 'ATTENDANCE_MARKED', { recordId: attendance.id, status: 'CANCELLED_EARLY' }, { matchId, tx });
      }
      await this.syncCapacityState(tx, match, await computeMatchOccupancy(tx, matchId));
      const promotion = match.status === 'FULL' ? await this.promoteNextEligible(tx, match) : null;
      // No MVP notification type covers manager awareness of a departure; deferred (see DECISIONS.md ADR-037).
      return { participant: this.participantResponse(updated), promotion, attendance };
    });
    if (result.promotion) await this.queue.schedulePromotion(result.promotion);
    if (result.attendance) await this.attendanceQueue.scheduleFinalization(result.attendance.id, result.attendance.markedAt);
    return result.participant;
  }

  public async updateMine(
    matchId: string,
    userId: string,
    body: UpdateMyParticipationBody,
  ): Promise<ParticipantResponse> {
    const result = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      const participant = await tx.matchParticipant.findUnique({
        where: { matchId_userId: { matchId, userId } },
      });
      if (!participant || participant.status !== 'CONFIRMED')
        throw new AppException(
          'NOT_PARTICIPANT',
          'Confirmed participation not found',
          HttpStatus.NOT_FOUND,
        );
      if (body.guestCount > participant.guestCount)
        await this.assertCapacity(tx, match, body.guestCount - participant.guestCount);
      else await computeMatchOccupancy(tx, matchId); // Lowering is always allowed, but still recomputed under the lock.
      const updated = await tx.matchParticipant.update({
        where: { id: participant.id },
        data: { guestCount: body.guestCount },
      });
      await this.syncCapacityState(tx, match, await computeMatchOccupancy(tx, matchId));
      const promotion = match.status === 'FULL' && body.guestCount < participant.guestCount ? await this.promoteNextEligible(tx, match) : null;
      return { participant: this.participantResponse(updated), promotion };
    });
    if (result.promotion) await this.queue.schedulePromotion(result.promotion);
    return result.participant;
  }

  public async remove(
    matchId: string,
    userId: string,
  ): Promise<ParticipantResponse> {
    const result = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      const participant = await tx.matchParticipant.findUnique({
        where: { matchId_userId: { matchId, userId } },
      });
      if (!participant || participant.status !== 'CONFIRMED')
        throw new AppException(
          'NOT_PARTICIPANT',
          'Confirmed participation not found',
          HttpStatus.NOT_FOUND,
        );
      if (participant.role === 'OWNER')
        throw new AppException('FORBIDDEN', 'The owner cannot be removed', HttpStatus.FORBIDDEN);
      await computeMatchOccupancy(tx, matchId); // Locked pre-mutation recomputation; lowering is always allowed.
      const updated = await tx.matchParticipant.update({
        where: { id: participant.id },
        data: { status: 'REMOVED', leftAt: new Date() },
      });
      await this.syncCapacityState(tx, match, await computeMatchOccupancy(tx, matchId));
      const promotion = match.status === 'FULL' ? await this.promoteNextEligible(tx, match) : null;
      // No MVP notification type covers a removed participant; deferred (see DECISIONS.md ADR-037).
      return { participant: this.participantResponse(updated), promotion };
    });
    if (result.promotion) await this.queue.schedulePromotion(result.promotion);
    return result.participant;
  }

  public async decideRequest(
    matchId: string,
    actorId: string,
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
  ): Promise<JoinRequestResponse> {
    return this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      if (!['PUBLISHED', 'FULL'].includes(match.status))
        throw new AppException(
          'INVALID_STATE_TRANSITION',
          'Join requests can only be decided before the match starts',
          HttpStatus.CONFLICT,
          { status: match.status },
        );
      const request = await tx.joinRequest.findFirst({ where: { id: requestId, matchId } });
      if (!request)
        throw new AppException('NOT_FOUND', 'Join request not found', HttpStatus.NOT_FOUND);
      if (request.status !== 'PENDING')
        throw new AppException(
          'INVALID_STATE_TRANSITION',
          'Join request is no longer pending',
          HttpStatus.CONFLICT,
        );
      if (decision === 'APPROVED') {
        await this.assertNoOverlap(tx, match, request.userId);
        await this.assertRequirements(tx, match, request.userId);
        await this.assertCapacity(tx, match, 1 + request.guestCount);
        await tx.matchParticipant.upsert({
          where: { matchId_userId: { matchId, userId: request.userId } },
          create: {
            id: uuidv7(),
            matchId,
            userId: request.userId,
            role: 'PLAYER',
            status: 'CONFIRMED',
            guestCount: request.guestCount,
          },
          update: {
            role: 'PLAYER',
            status: 'CONFIRMED',
            guestCount: request.guestCount,
            joinedAt: new Date(),
            leftAt: null,
            waitlistPosition: null,
          },
        });
      }
      const updated = await tx.joinRequest.update({
        where: { id: request.id },
        data: { status: decision, decidedById: actorId, decidedAt: new Date() },
      });
      if (decision === 'APPROVED')
        await this.syncCapacityState(tx, match, await computeMatchOccupancy(tx, matchId));
      await this.notifications.notify(request.userId, decision === 'APPROVED' ? 'JOIN_APPROVED' : 'JOIN_REJECTED', {}, { matchId, tx });
      return this.requestResponse(updated);
    });
  }

  public async listRequests(matchId: string): Promise<JoinRequestWithSummary[]> {
    const requests = await this.prisma.joinRequest.findMany({
      where: { matchId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            position: true,
            stats: {
              select: {
                attendancePct: true,
                lastFiveAvg: true,
                noShow: true,
                ratingCount: true,
              },
            },
          },
        },
      },
    });
    return requests.map((request) => {
      const { stats, ...requester } = request.user;
      return {
        ...this.requestResponse(request),
        requester,
        summary: buildRequesterSummary({
          attendancePercent: stats?.attendancePct == null ? null : Number(stats.attendancePct),
          lastFiveRatingAverage: stats?.lastFiveAvg == null ? null : Number(stats.lastFiveAvg),
          noShowCount: stats?.noShow ?? null,
          ratingsCount: stats?.ratingCount ?? null,
        }),
      };
    });
  }

  public async assignAssistant(
    matchId: string,
    userId: string,
  ): Promise<ParticipantResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockMatch(tx, matchId);
      const participant = await tx.matchParticipant.findUnique({
        where: { matchId_userId: { matchId, userId } },
      });
      if (!participant || participant.status !== 'CONFIRMED')
        throw new AppException(
          'NOT_PARTICIPANT',
          'Only a confirmed participant can be an assistant',
          HttpStatus.CONFLICT,
        );
      if (participant.role === 'OWNER')
        throw new AppException('FORBIDDEN', 'The owner role cannot be changed', HttpStatus.FORBIDDEN);
      const assistants = await tx.matchParticipant.count({
        where: { matchId, role: 'ASSISTANT', status: 'CONFIRMED', id: { not: participant.id } },
      });
      if (assistants >= 2)
        throw new AppException(
          'VALIDATION_ERROR',
          'A match can have at most two assistants',
          HttpStatus.CONFLICT,
        );
      return this.participantResponse(
        await tx.matchParticipant.update({
          where: { id: participant.id },
          data: { role: 'ASSISTANT' },
        }),
      );
    });
  }

  public async removeAssistant(
    matchId: string,
    userId: string,
  ): Promise<ParticipantResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockMatch(tx, matchId);
      const participant = await tx.matchParticipant.findUnique({
        where: { matchId_userId: { matchId, userId } },
      });
      if (!participant || participant.status !== 'CONFIRMED' || participant.role !== 'ASSISTANT')
        throw new AppException('NOT_FOUND', 'Assistant not found', HttpStatus.NOT_FOUND);
      return this.participantResponse(
        await tx.matchParticipant.update({
          where: { id: participant.id },
          data: { role: 'PLAYER' },
        }),
      );
    });
  }

  private async lockMatch(tx: Prisma.TransactionClient, matchId: string): Promise<LockedMatch> {
    // This row lock is the serialization point for every seat mutation. No participant/capacity read may precede it.
    const rows = await tx.$queryRaw<
      LockedMatch[]
    >(Prisma.sql`SELECT id, owner_id AS "ownerId", status, join_mode AS "joinMode",
      total_slots AS "totalSlots", starts_at AS "startsAt", duration_min AS "durationMin", verified_phone_only AS "verifiedPhoneOnly",
      allow_new_players AS "allowNewPlayers", min_rating AS "minRating", min_attendance_pct AS "minAttendancePct"
      FROM matches WHERE id = ${matchId}::uuid AND deleted_at IS NULL FOR UPDATE`);
    if (!rows[0]) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    return rows[0];
  }

  private assertJoinable(match: LockedMatch): void {
    if (match.status === 'FULL')
      throw new AppException('MATCH_FULL', 'Match capacity is full', HttpStatus.CONFLICT, {
        waitlistAvailable: true,
      });
    if (match.status !== 'PUBLISHED')
      throw new AppException(
        'INVALID_STATE_TRANSITION',
        'Only published matches accept joins',
        HttpStatus.CONFLICT,
        { status: match.status },
      );
  }
  private async assertNotAlreadyJoined(
    tx: Prisma.TransactionClient,
    matchId: string,
    userId: string,
  ): Promise<void> {
    const [participant, request] = await Promise.all([
      tx.matchParticipant.findUnique({
        where: { matchId_userId: { matchId, userId } },
        select: { status: true },
      }),
      tx.joinRequest.findUnique({
        where: { matchId_userId: { matchId, userId } },
        select: { status: true },
      }),
    ]);
    if ((participant && ['CONFIRMED', 'WAITLISTED', 'PENDING_CONFIRMATION'].includes(participant.status)) || request?.status === 'PENDING')
      throw new AppException(
        'ALREADY_JOINED',
        'User already joined or requested to join',
        HttpStatus.CONFLICT,
      );
  }
  private async assertNoOverlap(
    tx: Prisma.TransactionClient,
    match: LockedMatch,
    userId: string,
  ): Promise<void> {
    // Target-match locks differ across matches. This user lock serializes concurrent confirmations for one player.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`);
    // Half-open windows [start, end): touching boundaries are not overlaps (ADR-025).
    const overlap = await tx.$queryRaw<
      Array<{ id: string }>
    >(Prisma.sql`SELECT m.id FROM match_participants p JOIN matches m ON m.id = p.match_id
      WHERE p.user_id = ${userId}::uuid AND p.status = 'CONFIRMED'::"ParticipantStatus" AND m.id <> ${match.id}::uuid
        AND m.deleted_at IS NULL AND m.status <> 'CANCELLED'::"MatchStatus"
        AND m.starts_at < ${match.startsAt} + (${match.durationMin} * interval '1 minute')
        AND ${match.startsAt} < m.starts_at + (m.duration_min * interval '1 minute') LIMIT 1`);
    if (overlap.length)
      throw new AppException(
        'OVERLAPPING_MATCH',
        'User already has an overlapping confirmed match',
        HttpStatus.CONFLICT,
        { matchId: overlap[0]?.id },
      );
  }
  private async assertRequirements(
    tx: Prisma.TransactionClient,
    match: LockedMatch,
    userId: string,
  ): Promise<void> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        phoneVerifiedAt: true,
        stats: { select: { attendancePct: true, bayesAvg: true } },
      },
    });
    if (!user) throw new AppException('NOT_FOUND', 'User not found', HttpStatus.NOT_FOUND);
    if (match.verifiedPhoneOnly && !user.phoneVerifiedAt)
      throw new AppException(
        'REQUIREMENTS_NOT_MET',
        'Verified phone is required',
        HttpStatus.FORBIDDEN,
        { requirement: 'verifiedPhoneOnly' },
      );
    const missed = missedReputationRequirement(match, user.stats);
    if (missed)
      throw new AppException(
        'REQUIREMENTS_NOT_MET',
        missed.requirement === 'minRating'
          ? 'Minimum rating requirement is not met'
          : missed.requirement === 'minAttendancePct'
            ? 'Minimum attendance requirement is not met'
            : 'This match does not accept new players without the required stats',
        HttpStatus.FORBIDDEN,
        missed,
      );
  }
  private async resolveInvitation(
    tx: Prisma.TransactionClient,
    matchId: string,
    userId: string,
    token?: string,
  ): Promise<{ id: string; inviteeId: string | null }> {
    const invitation = token
      ? await tx.invitation.findUnique({ where: { token } })
      : await tx.invitation.findFirst({
          where: { matchId, inviteeId: userId, status: 'PENDING' },
          orderBy: { expiresAt: 'desc' },
        });
    if (!invitation || invitation.matchId !== matchId || (invitation.inviteeId && invitation.inviteeId !== userId))
      throw new AppException(
        'INVITATION_REQUIRED',
        'A valid invitation is required',
        HttpStatus.FORBIDDEN,
      );
    if (invitation.status !== 'PENDING')
      throw new AppException(
        'INVITATION_CONSUMED',
        'Invitation has already been consumed',
        HttpStatus.CONFLICT,
      );
    if (invitation.expiresAt <= new Date()) {
      await tx.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
      throw new AppException(
        'INVITATION_EXPIRED',
        'Invitation has expired',
        HttpStatus.GONE,
      );
    }
    return invitation;
  }
  private async assertCapacity(
    tx: Prisma.TransactionClient,
    match: LockedMatch,
    addedSeats: number,
  ): Promise<void> {
    const occupiedSlots = await computeMatchOccupancy(tx, match.id);
    assertPartyFits(match.totalSlots, occupiedSlots, addedSeats);
  }
  private async assertJoinAdmissionCapacity(
    tx: Prisma.TransactionClient,
    match: LockedMatch,
    addedSeats: number,
  ): Promise<void> {
    const now = new Date();
    const [occupiedSlots, held] = await Promise.all([
      computeMatchOccupancy(tx, match.id),
      tx.matchParticipant.aggregate({
        where: {
          matchId: match.id,
          status: 'PENDING_CONFIRMATION',
          promotionExpiresAt: { gt: now },
        },
        _count: { _all: true },
        _sum: { guestCount: true },
      }),
    ]);
    const heldSlots = held._count._all + (held._sum.guestCount ?? 0);
    assertPartyFits(match.totalSlots, occupiedSlots + heldSlots, addedSeats);
  }
  private async syncCapacityState(
    tx: Prisma.TransactionClient,
    match: LockedMatch,
    occupied: number,
  ): Promise<void> {
    // ADR-026: FULL continues to describe confirmed occupancy only. Active promotion holds
    // constrain new-join admission, but keeping this match PUBLISHED preserves agreement
    // between status and the canonical occupiedSlots/freeSlots values shown to browsers.
    if (match.status === 'PUBLISHED' && occupied === match.totalSlots)
      await this.states.transition(tx, match.id, 'PUBLISHED', 'FULL');
    else if (match.status === 'FULL' && occupied < match.totalSlots)
      await this.states.transition(tx, match.id, 'FULL', 'PUBLISHED');
  }
  private async promoteNextEligible(tx: Prisma.TransactionClient, match: LockedMatch): Promise<Promotion | null> {
    if (match.status !== 'PUBLISHED' && match.status !== 'FULL') return null;
    const occupied = await computeMatchOccupancy(tx, match.id);
    const freeSlots = match.totalSlots - occupied;
    if (freeSlots <= 0) return null;
    const waitlisted = await tx.matchParticipant.findMany({
      where: { matchId: match.id, status: 'WAITLISTED' },
      orderBy: { waitlistPosition: 'asc' },
    });
    const eligible = firstFittingWaitlistParty(waitlisted, freeSlots);
    if (!eligible) return null;
    const expiresAt = new Date(Date.now() + PROMOTION_TTL_MS);
    await tx.matchParticipant.update({ where: { id: eligible.id }, data: { status: 'PENDING_CONFIRMATION', promotionExpiresAt: expiresAt } });
    await this.notifications.notify(eligible.userId, 'WAITLIST_PROMOTED', { expiresAt: expiresAt.toISOString() }, { matchId: match.id, tx });
    return { matchId: match.id, participantId: eligible.id, expiresAt: expiresAt.toISOString() };
  }
  private participantResponse(row: MatchParticipant): ParticipantResponse {
    return {
      id: row.id,
      matchId: row.matchId,
      userId: row.userId,
      role: row.role,
      status: row.status,
      guestCount: row.guestCount,
      waitlistPosition: row.waitlistPosition,
      promotionExpiresAt: row.promotionExpiresAt?.toISOString() ?? null,
      joinedAt: row.joinedAt.toISOString(),
      leftAt: row.leftAt?.toISOString() ?? null,
    };
  }
  private requestResponse(row: JoinRequest): JoinRequestResponse {
    return {
      id: row.id,
      matchId: row.matchId,
      userId: row.userId,
      message: row.message,
      guestCount: row.guestCount,
      status: row.status,
      decidedById: row.decidedById,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
