import { HttpStatus, Injectable } from '@nestjs/common';
import type { AttendanceRecord as AttendanceRecordResponse, AttendanceSheetEntry, MarkAttendanceBody, ResolveAttendanceBody } from '@futzone/contracts';
import { Prisma, type AttendanceRecord, type MatchStatus } from '../generated/prisma';
import { v7 as uuidv7 } from 'uuid';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { MatchStateService } from '../matches/match-state.service';
import { attendanceFinalizesAt, isDisputeWithinWindow } from './attendance-rules';
import { AttendanceQueueService } from './attendance-queue.service';
import { MatchQueueService } from '../matches/match-queue.service';
import { ratingWindowClosesAt } from '../ratings/rating-window';
import { StatsQueueService } from '../stats/stats-queue.service';
import { NotificationsService } from '../notifications/notifications.service';

type LockedAttendanceMatch = { id: string; ownerId: string; status: MatchStatus };

@Injectable()
export class AttendanceService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly states: MatchStateService,
    private readonly queue: AttendanceQueueService,
    private readonly matchQueue: MatchQueueService,
    private readonly statsQueue: StatsQueueService,
    private readonly notifications: NotificationsService,
  ) {}

  public async sheet(matchId: string): Promise<AttendanceSheetEntry[]> {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, deletedAt: null },
      select: {
        status: true,
        participants: {
          where: { OR: [{ status: 'CONFIRMED' }, { attendanceRecord: { isNot: null } }] },
          orderBy: { joinedAt: 'asc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, username: true } },
            attendanceRecord: true,
          },
        },
      },
    });
    if (!match) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    if (!['ATTENDANCE_PENDING', 'RATING_PENDING', 'COMPLETED'].includes(match.status))
      throw new AppException('ATTENDANCE_WINDOW_CLOSED', 'Attendance is not available for this match', HttpStatus.CONFLICT);
    return match.participants.map((participant) => ({
      participantId: participant.id,
      userId: participant.user.id,
      firstName: participant.user.firstName,
      lastName: participant.user.lastName,
      username: participant.user.username,
      role: participant.role,
      guestCount: participant.guestCount,
      record: participant.attendanceRecord ? this.recordResponse(participant.attendanceRecord) : null,
    }));
  }

  public async mark(matchId: string, participantId: string, actorId: string, body: MarkAttendanceBody): Promise<AttendanceRecordResponse> {
    const markedAt = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      if (match.status !== 'ATTENDANCE_PENDING')
        throw new AppException('ATTENDANCE_WINDOW_CLOSED', 'Attendance marking is closed', HttpStatus.CONFLICT);
      const participant = await tx.matchParticipant.findFirst({
        where: { id: participantId, matchId, OR: [{ status: 'CONFIRMED' }, { attendanceRecord: { isNot: null } }] },
        include: { attendanceRecord: true },
      });
      if (!participant) throw new AppException('NOT_PARTICIPANT', 'Participant is not on the attendance sheet', HttpStatus.NOT_FOUND);
      if ((body.guestNoShowCount ?? 0) > participant.guestCount)
        throw new AppException('VALIDATION_ERROR', 'Guest no-show count cannot exceed the participant guest count');
      const saved = await tx.attendanceRecord.upsert({
        where: { participantId },
        create: { id: uuidv7(), matchId, participantId, status: body.status, guestNoShowCount: body.guestNoShowCount ?? 0, markedById: actorId, markedAt },
        update: {
          status: body.status,
          guestNoShowCount: body.guestNoShowCount ?? 0,
          markedById: actorId,
          markedAt,
          disputeStatus: null,
          disputeNote: null,
          disputeResolvedById: null,
          finalizedAt: null,
        },
      });
      await this.notifyRecordChange(tx, participant.userId, matchId, saved);
      const transitioned = await this.transitionWhenComplete(tx, match);
      return { record: saved, transitioned };
    });
    await this.queue.scheduleFinalization(result.record.id, markedAt);
    if (result.transitioned) await this.scheduleRatingClose(matchId);
    return this.recordResponse(result.record);
  }

  public async fallback(matchId: string): Promise<void> {
    const result = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      if (match.status !== 'ATTENDANCE_PENDING') return { records: [], transitioned: false };
      const unmarked = await tx.matchParticipant.findMany({
        where: { matchId, status: 'CONFIRMED', attendanceRecord: { is: null } },
        select: { id: true, userId: true },
      });
      const markedAt = new Date();
      const records: AttendanceRecord[] = [];
      for (const participant of unmarked) {
        const record = await tx.attendanceRecord.create({
          data: { id: uuidv7(), matchId, participantId: participant.id, status: 'ON_TIME', markedById: match.ownerId, markedAt },
        });
        records.push(record);
        await this.notifyRecordChange(tx, participant.userId, matchId, record);
      }
      const transitioned = await this.transitionWhenComplete(tx, match);
      return { records, transitioned };
    });
    await Promise.all(result.records.map((record) => this.queue.scheduleFinalization(record.id, record.markedAt)));
    if (result.transitioned) await this.scheduleRatingClose(matchId);
  }

  public async dispute(recordId: string, userId: string, note: string, now = new Date()): Promise<AttendanceRecordResponse> {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.attendanceRecord.findUnique({
        where: { id: recordId },
        include: { participant: { select: { userId: true } } },
      });
      if (!current) throw new AppException('NOT_FOUND', 'Attendance record not found', HttpStatus.NOT_FOUND);
      if (current.participant.userId !== userId)
        throw new AppException('FORBIDDEN', 'Only the affected participant may dispute', HttpStatus.FORBIDDEN);
      if (current.finalizedAt || !isDisputeWithinWindow(current.markedAt, now))
        throw new AppException('DISPUTE_WINDOW_CLOSED', 'Attendance dispute window is closed', HttpStatus.GONE);
      if (current.disputeStatus === 'OPEN')
        throw new AppException('DISPUTE_ALREADY_OPEN', 'Attendance dispute is already open', HttpStatus.CONFLICT);
      const saved = await tx.attendanceRecord.update({ where: { id: recordId }, data: { disputeStatus: 'OPEN', disputeNote: note } });
      await this.notifyRecordChange(tx, userId, current.matchId, saved);
      return saved;
    });
    return this.recordResponse(result);
  }

  public async resolve(recordId: string, actor: { id: string; role: string }, body: ResolveAttendanceBody): Promise<AttendanceRecordResponse> {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.attendanceRecord.findUnique({
        where: { id: recordId },
        include: { match: { select: { ownerId: true } }, participant: { select: { userId: true } } },
      });
      if (!current) throw new AppException('NOT_FOUND', 'Attendance record not found', HttpStatus.NOT_FOUND);
      const isAdmin = actor.role === 'ADMIN';
      const saved = await tx.attendanceRecord.update({
        where: { id: recordId },
        data: {
          status: body.status,
          disputeStatus: body.status === current.status ? 'UPHELD' : 'OVERTURNED',
          disputeResolvedById: actor.id,
          finalizedAt: now,
        },
      });
      if (isAdmin)
        await tx.auditLog.create({
          data: {
            id: uuidv7(),
            actorId: actor.id,
            action: 'ATTENDANCE_DISPUTE_RESOLVED',
            targetType: 'AttendanceRecord',
            targetId: recordId,
            metadata: { previousStatus: current.status, status: body.status },
          },
        });
      await this.notifyRecordChange(tx, current.participant.userId, current.matchId, saved);
      return { saved, userId: current.participant.userId };
    });
    await this.queue.cancelFinalization(result.saved.id);
    await this.statsQueue.attendanceFinalized(result.userId);
    return this.recordResponse(result.saved);
  }

  public async finalize(recordId: string, now = new Date()): Promise<void> {
    const userId = await this.prisma.$transaction(async (tx) => {
      const current = await tx.attendanceRecord.findUnique({ where: { id: recordId } });
      if (!current || current.finalizedAt || attendanceFinalizesAt(current.markedAt) > now) return null;
      const saved = await tx.attendanceRecord.update({ where: { id: recordId }, data: { finalizedAt: now } });
      const participant = await tx.matchParticipant.findUnique({ where: { id: current.participantId }, select: { userId: true } });
      if (participant) await this.notifyRecordChange(tx, participant.userId, current.matchId, saved);
      return participant?.userId ?? null;
    });
    if (userId) await this.statsQueue.attendanceFinalized(userId);
  }

  private async transitionWhenComplete(tx: Prisma.TransactionClient, match: LockedAttendanceMatch): Promise<boolean> {
    const [eligible, marked] = await Promise.all([
      tx.matchParticipant.count({ where: { matchId: match.id, OR: [{ status: 'CONFIRMED' }, { attendanceRecord: { isNot: null } }] } }),
      tx.attendanceRecord.count({ where: { matchId: match.id } }),
    ]);
    if (eligible !== marked) return false;
    await this.states.transition(tx, match.id, 'ATTENDANCE_PENDING', 'RATING_PENDING');
    return true;
  }

  private async scheduleRatingClose(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { startsAt: true, durationMin: true },
    });
    if (match) await this.matchQueue.scheduleRatingWindowClose(matchId, ratingWindowClosesAt(match.startsAt, match.durationMin));
  }

  private async lockMatch(tx: Prisma.TransactionClient, matchId: string): Promise<LockedAttendanceMatch> {
    const rows = await tx.$queryRaw<LockedAttendanceMatch[]>(
      Prisma.sql`SELECT id, owner_id AS "ownerId", status FROM matches WHERE id = ${matchId}::uuid AND deleted_at IS NULL FOR UPDATE`,
    );
    if (!rows[0]) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    return rows[0];
  }

  private async notifyRecordChange(tx: Prisma.TransactionClient, userId: string, matchId: string, record: AttendanceRecord): Promise<void> {
    await this.notifications.notify(userId, 'ATTENDANCE_MARKED', { recordId: record.id, status: record.status }, { matchId, tx });
  }

  private recordResponse(record: AttendanceRecord): AttendanceRecordResponse {
    return {
      id: record.id,
      matchId: record.matchId,
      participantId: record.participantId,
      status: record.status,
      guestNoShowCount: record.guestNoShowCount,
      markedById: record.markedById,
      markedAt: record.markedAt.toISOString(),
      disputeStatus: record.disputeStatus,
      disputeNote: record.disputeNote,
      disputeResolvedById: record.disputeResolvedById,
      finalizedAt: record.finalizedAt?.toISOString() ?? null,
    };
  }
}
