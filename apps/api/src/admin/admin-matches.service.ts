import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  AdminFlagBody,
  AdminMatchActionResponse,
  AdminMatchDetail,
  AdminMatchListItem,
  AdminMatchListResponse,
  AdminMatchSearchQuery,
  AdminReasonBody,
  UpdateMatchBody,
} from '@futzone/contracts';
import { Prisma, type Match } from '../generated/prisma';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MatchStateService } from '../matches/match-state.service';
import { MatchQueueService } from '../matches/match-queue.service';
import { MatchesService } from '../matches/matches.service';
import { computeMatchOccupancy } from '../matches/occupancy';
import { AuditService } from './audit.service';

const CANCELLABLE = ['DRAFT', 'PUBLISHED', 'FULL'];

@Injectable()
export class AdminMatchesService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly matches: MatchesService,
    private readonly states: MatchStateService,
    private readonly queue: MatchQueueService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  public async search(query: AdminMatchSearchQuery): Promise<AdminMatchListResponse> {
    const where: Prisma.MatchWhereInput = { deletedAt: null };
    if (query.q) where.title = { contains: query.q, mode: 'insensitive' };
    if (query.status) where.status = query.status;
    if (query.flagged !== undefined) where.flaggedAt = query.flagged ? { not: null } : null;
    const [total, rows] = await Promise.all([
      this.prisma.match.count({ where }),
      this.prisma.match.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit,
        include: { owner: { select: { username: true } }, city: { select: { nameUz: true } } },
      }),
    ]);
    return {
      items: rows.map((row) => this.toListItem(row, row.owner.username, row.city?.nameUz ?? null)),
      total, page: query.page, pageSize: query.limit, totalPages: Math.ceil(total / query.limit),
    };
  }

  public async detail(id: string): Promise<AdminMatchDetail> {
    const match = await this.prisma.match.findFirst({
      where: { id, deletedAt: null },
      include: {
        owner: { select: { username: true } },
        city: { select: { nameUz: true } },
        participants: { include: { user: { select: { username: true, firstName: true, lastName: true } } }, orderBy: { joinedAt: 'asc' } },
      },
    });
    if (!match) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    const [occupiedSlots, audits] = await Promise.all([
      this.prisma.$transaction((tx) => computeMatchOccupancy(tx, id)),
      this.prisma.auditLog.findMany({ where: { targetType: 'Match', targetId: id }, orderBy: { createdAt: 'desc' }, take: 50, include: { actor: { select: { username: true } } } }),
    ]);
    return {
      ...this.toListItem(match, match.owner.username, match.city?.nameUz ?? null),
      flaggedReason: match.flaggedReason,
      occupiedSlots,
      durationMin: match.durationMin,
      address: match.address,
      fieldPriceUzs: match.fieldPriceUzs,
      perPlayerFeeUzs: match.perPlayerFeeUzs,
      participants: match.participants.map((p) => ({
        userId: p.userId, username: p.user.username, firstName: p.user.firstName, lastName: p.user.lastName,
        role: p.role, status: p.status, guestCount: p.guestCount,
      })),
      auditTrail: audits.map((a) => {
        const metadata = (a.metadata ?? null) as Record<string, unknown> | null;
        return {
          id: a.id, actorId: a.actorId, actorUsername: a.actor.username, action: a.action,
          targetType: a.targetType, targetId: a.targetId,
          reason: metadata && typeof metadata.reason === 'string' ? metadata.reason : null,
          metadata, createdAt: a.createdAt.toISOString(),
        };
      }),
    };
  }

  public async edit(actorId: string, id: string, body: UpdateMatchBody): Promise<AdminMatchDetail> {
    const before = await this.prisma.match.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!before) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    await this.matches.update(id, actorId, body, (tx) =>
      this.audit.record(tx, { actorId, action: 'MATCH_EDIT', targetType: 'Match', targetId: id, after: body }).then(() => undefined),
    );
    return this.detail(id);
  }

  // Force-cancel: transition via MatchStateService, notify every still-active participant, audit — all
  // in one transaction — then clear the match's scheduled state and reminder jobs.
  public async forceCancel(actorId: string, id: string, body: AdminReasonBody): Promise<AdminMatchActionResponse> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ status: string }>>(Prisma.sql`SELECT status FROM matches WHERE id = ${id}::uuid AND deleted_at IS NULL FOR UPDATE`);
      const status = rows[0]?.status;
      if (!status) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
      if (!CANCELLABLE.includes(status)) throw new AppException('INVALID_STATE_TRANSITION', 'This match can no longer be cancelled', HttpStatus.CONFLICT, { status });
      await this.states.transition(tx, id, status as Match['status'], 'CANCELLED', body.reason);
      const participants = await tx.matchParticipant.findMany({ where: { matchId: id, status: { in: ['CONFIRMED', 'WAITLISTED', 'PENDING_CONFIRMATION'] } }, select: { userId: true } });
      await this.notifications.notifyMany(participants.map((p) => p.userId), 'MATCH_CANCELLED', { reason: body.reason }, { matchId: id, tx });
      await this.audit.record(tx, { actorId, action: 'MATCH_FORCE_CANCEL', targetType: 'Match', targetId: id, before: { status }, after: { status: 'CANCELLED' }, reason: body.reason });
    });
    await this.queue.cancelMatch(id);
    await this.queue.cancelReminders(id);
    return { id, status: 'CANCELLED', flagged: false };
  }

  public async flag(actorId: string, id: string, body: AdminFlagBody): Promise<AdminMatchActionResponse> {
    return this.setFlag(actorId, id, { flaggedAt: new Date(), flaggedReason: body.reason, flaggedById: actorId }, 'MATCH_FLAG_SUSPICIOUS', body.reason);
  }

  public async unflag(actorId: string, id: string, body: AdminReasonBody): Promise<AdminMatchActionResponse> {
    return this.setFlag(actorId, id, { flaggedAt: null, flaggedReason: null, flaggedById: null }, 'MATCH_UNFLAG', body.reason);
  }

  private async setFlag(actorId: string, id: string, data: Prisma.MatchUpdateInput, action: string, reason: string): Promise<AdminMatchActionResponse> {
    return this.prisma.$transaction(async (tx) => {
      const match = await tx.match.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
      if (!match) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
      const updated = await tx.match.update({ where: { id }, data });
      await this.audit.record(tx, { actorId, action, targetType: 'Match', targetId: id, reason });
      return { id, status: updated.status, flagged: updated.flaggedAt != null };
    });
  }

  private toListItem(match: Match, ownerUsername: string, cityName: string | null): AdminMatchListItem {
    return {
      id: match.id, slug: match.slug, title: match.title, status: match.status,
      startsAt: match.startsAt.toISOString(), cityName, ownerUsername,
      totalSlots: match.totalSlots, flagged: match.flaggedAt != null, createdAt: match.createdAt.toISOString(),
    };
  }
}
