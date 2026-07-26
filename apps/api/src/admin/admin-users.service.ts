import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  AdminReasonBody,
  AdminSuspendBody,
  AdminUserActionResponse,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserListResponse,
  AdminUserSearchQuery,
  AdminWarnBody,
} from '@futzone/contracts';
import { Prisma, type User } from '../generated/prisma';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from './audit.service';

type ActionUser = Pick<User, 'id' | 'status' | 'role' | 'suspendedUntil' | 'phoneVerifiedAt'>;

@Injectable()
export class AdminUsersService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  public async search(query: AdminUserSearchQuery): Promise<AdminUserListResponse> {
    const q = query.q?.trim();
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (q) {
      const ors: Prisma.UserWhereInput[] = [
        { username: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ];
      if (/^\d{2,}$/.test(q)) ors.push({ phone: { endsWith: q } }); // search by last digits of phone
      where.OR = ors;
    }
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
    ]);
    return {
      items: rows.map((row) => this.toListItem(row)),
      total, page: query.page, pageSize: query.limit, totalPages: Math.ceil(total / query.limit),
    };
  }

  public async detail(userId: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { stats: true, city: { select: { nameUz: true } } },
    });
    if (!user) throw new AppException('NOT_FOUND', 'User not found', HttpStatus.NOT_FOUND);
    const [participations, reports] = await Promise.all([
      this.prisma.matchParticipant.findMany({
        where: { userId }, orderBy: { joinedAt: 'desc' }, take: 10,
        include: { match: { select: { id: true, slug: true, title: true, startsAt: true, status: true } } },
      }),
      this.prisma.report.findMany({
        where: { rating: { rateeId: userId } }, orderBy: { createdAt: 'desc' }, take: 20,
        select: { id: true, ratingId: true, reason: true, createdAt: true },
      }),
    ]);
    return {
      ...this.toListItem(user),
      bio: user.bio,
      cityName: user.city?.nameUz ?? null,
      matchesPlayed: user.stats?.matchesPlayed ?? 0,
      matchesOrganized: user.stats?.matchesOrganized ?? 0,
      attendancePct: user.stats?.attendancePct == null ? null : Number(user.stats.attendancePct),
      ratingAvg: user.stats?.bayesAvg == null ? null : Number(user.stats.bayesAvg),
      ratingCount: user.stats?.ratingCount ?? 0,
      recentMatches: participations.map((p) => ({
        id: p.match.id, slug: p.match.slug, title: p.match.title,
        startsAt: p.match.startsAt.toISOString(), status: p.match.status, role: p.role,
      })),
      reportsAgainst: reports.map((r) => ({ id: r.id, ratingId: r.ratingId, reason: r.reason, createdAt: r.createdAt.toISOString() })),
    };
  }

  public async warn(actorId: string, userId: string, body: AdminWarnBody): Promise<AdminUserActionResponse> {
    return this.mutate(actorId, userId, async (tx, target) => {
      const updated = await tx.user.update({ where: { id: userId }, data: { status: 'WARNED' } });
      await this.audit.record(tx, { actorId, action: 'USER_WARN', targetType: 'User', targetId: userId, before: { status: target.status }, after: { status: 'WARNED' }, reason: body.reason });
      await this.notifications.notify(userId, 'ACCOUNT_WARNING', { message: body.message }, { tx });
      return updated;
    });
  }

  public async suspend(actorId: string, userId: string, body: AdminSuspendBody): Promise<AdminUserActionResponse> {
    const until = new Date(body.until);
    if (until.getTime() <= Date.now()) throw new AppException('VALIDATION_ERROR', 'Suspension end must be in the future');
    return this.mutate(actorId, userId, async (tx, target) => {
      const updated = await tx.user.update({ where: { id: userId }, data: { status: 'SUSPENDED', suspendedUntil: until } });
      await this.audit.record(tx, { actorId, action: 'USER_SUSPEND', targetType: 'User', targetId: userId, before: { status: target.status, suspendedUntil: target.suspendedUntil }, after: { status: 'SUSPENDED', suspendedUntil: until.toISOString() }, reason: body.reason });
      return updated;
    });
  }

  public async ban(actorId: string, userId: string, body: AdminReasonBody): Promise<AdminUserActionResponse> {
    return this.mutate(actorId, userId, async (tx, target) => {
      const updated = await tx.user.update({ where: { id: userId }, data: { status: 'BANNED', suspendedUntil: null } });
      await this.audit.record(tx, { actorId, action: 'USER_BAN', targetType: 'User', targetId: userId, before: { status: target.status }, after: { status: 'BANNED' }, reason: body.reason });
      return updated;
    });
  }

  public async unban(actorId: string, userId: string, body: AdminReasonBody): Promise<AdminUserActionResponse> {
    return this.mutate(actorId, userId, async (tx, target) => {
      const updated = await tx.user.update({ where: { id: userId }, data: { status: 'ACTIVE', suspendedUntil: null } });
      await this.audit.record(tx, { actorId, action: 'USER_UNBAN', targetType: 'User', targetId: userId, before: { status: target.status }, after: { status: 'ACTIVE' }, reason: body.reason });
      return updated;
    });
  }

  public async markVerified(actorId: string, userId: string, body: AdminReasonBody): Promise<AdminUserActionResponse> {
    return this.mutate(actorId, userId, async (tx, target) => {
      const now = new Date();
      const updated = await tx.user.update({ where: { id: userId }, data: { phoneVerifiedAt: target.phoneVerifiedAt ?? now } });
      await this.audit.record(tx, { actorId, action: 'USER_MARK_VERIFIED', targetType: 'User', targetId: userId, before: { verified: target.phoneVerifiedAt != null }, after: { verified: true }, reason: body.reason });
      return updated;
    });
  }

  // Shared guard + transaction wrapper: an admin cannot act on themselves or on another admin.
  private async mutate(
    actorId: string,
    userId: string,
    apply: (tx: Prisma.TransactionClient, target: ActionUser) => Promise<User>,
  ): Promise<AdminUserActionResponse> {
    if (actorId === userId) throw new AppException('FORBIDDEN', 'You cannot perform this action on your own account', HttpStatus.FORBIDDEN);
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, status: true, role: true, suspendedUntil: true, phoneVerifiedAt: true } });
      if (!target) throw new AppException('NOT_FOUND', 'User not found', HttpStatus.NOT_FOUND);
      if (target.role === 'ADMIN') throw new AppException('FORBIDDEN', 'Administrator accounts cannot be moderated', HttpStatus.FORBIDDEN);
      return this.toActionResponse(await apply(tx, target));
    });
  }

  private toListItem(user: User): AdminUserListItem {
    return {
      id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName,
      phoneLast4: user.phone.slice(-4), role: user.role, status: user.status,
      suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
      verified: user.phoneVerifiedAt != null, createdAt: user.createdAt.toISOString(),
    };
  }

  private toActionResponse(user: User): AdminUserActionResponse {
    return { id: user.id, status: user.status, role: user.role, suspendedUntil: user.suspendedUntil?.toISOString() ?? null, verified: user.phoneVerifiedAt != null };
  }
}
