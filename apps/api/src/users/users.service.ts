import { HttpStatus, Injectable } from '@nestjs/common';
import type { City, Locale, MeProfile, MeSettings, PublicProfile, UpdateMeBody } from '@futzone/contracts';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { UsernameChangePolicy } from './username-change.policy';

type CityRow = { id: string; slug: string; nameUz: string; nameUzCyrl: string; nameRu: string; nameEn: string };

@Injectable()
export class UsersService {
  public constructor(private readonly prisma: PrismaService, private readonly usernamePolicy: UsernameChangePolicy) {}

  public async publicProfile(username: string, locale: Locale, commentsPage: number): Promise<PublicProfile> {
    const pageSize = 5;
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null, status: { not: 'BANNED' } },
      include: {
        city: true, stats: true, badges: { orderBy: { awardedAt: 'desc' }, select: { badgeCode: true } },
        matchParticipants: {
          where: { match: { joinMode: { not: 'INVITE_ONLY' }, status: { in: ['FINISHED', 'ATTENDANCE_PENDING', 'RATING_PENDING', 'COMPLETED'] }, deletedAt: null } },
          orderBy: { match: { startsAt: 'desc' } }, take: 5,
          select: { match: { select: { id: true, slug: true, title: true, startsAt: true, status: true } } },
        },
      },
    });
    if (!user) throw new AppException('NOT_FOUND', 'User not found', HttpStatus.NOT_FOUND);
    const commentWhere = { rateeId: user.id, status: 'ACTIVE' as const, deletedAt: null, comment: { not: null } };
    const [comments, commentCount] = await Promise.all([
      this.prisma.rating.findMany({
        where: commentWhere, orderBy: { createdAt: 'desc' }, skip: (commentsPage - 1) * pageSize, take: pageSize,
        select: { id: true, overall: true, comment: true, createdAt: true, rater: { select: { username: true, firstName: true, lastName: true } } },
      }),
      this.prisma.rating.count({ where: commentWhere }),
    ]);
    const stats = user.stats;
    return {
      avatarUrl: user.avatarUrl, firstName: user.firstName, lastName: user.lastName, username: user.username,
      bio: user.bio, city: user.city ? this.city(user.city, locale) : null, position: user.position,
      joinedAt: user.createdAt.toISOString(), verified: user.phoneVerifiedAt !== null,
      stats: {
        matchesPlayed: stats?.matchesPlayed ?? 0, matchesOrganized: stats?.matchesOrganized ?? 0,
        onTime: stats?.onTime ?? 0, late: stats?.late ?? 0, noShow: stats?.noShow ?? 0,
        cancelledEarly: stats?.cancelledEarly ?? 0, excused: stats?.excused ?? 0,
        attendancePct: stats?.attendancePct == null ? null : Number(stats.attendancePct),
        bayesAvg: stats?.ratingCount && stats.ratingCount >= 3 && stats.bayesAvg != null ? Number(stats.bayesAvg) : null,
        ratingCount: stats?.ratingCount ?? 0,
        lastFiveAvg: stats?.lastFiveAvg == null ? null : Number(stats.lastFiveAvg),
      },
      badges: user.badges.map(({ badgeCode }) => badgeCode),
      recentMatches: user.matchParticipants.map(({ match }) => ({ ...match, startsAt: match.startsAt.toISOString() })),
      comments: {
        items: comments.flatMap((rating) => rating.comment === null ? [] : [{
          id: rating.id, overall: rating.overall, comment: rating.comment, createdAt: rating.createdAt.toISOString(), author: rating.rater,
        }]),
        page: commentsPage, pageSize, total: commentCount, totalPages: Math.ceil(commentCount / pageSize),
      },
    };
  }

  public async updateMe(userId: string, body: UpdateMeBody): Promise<MeProfile> {
    if (body.cityId) {
      const city = await this.prisma.city.findFirst({ where: { id: body.cityId, isActive: true }, select: { id: true } });
      if (!city) throw new AppException('NOT_FOUND', 'City not found', HttpStatus.NOT_FOUND);
    }
    const user = await this.prisma.user.update({ where: { id: userId }, data: body });
    return this.meProfile(user);
  }

  public async changeUsername(userId: string, username: string, now = new Date()): Promise<MeProfile> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.usernamePolicy.assertAllowed(user.usernameChangedAt, now);
    const taken = await this.prisma.user.findFirst({ where: { username, id: { not: userId } }, select: { id: true } });
    if (taken) throw new AppException('USERNAME_TAKEN', 'Username is already taken', HttpStatus.CONFLICT);
    try {
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
      const changed = await this.prisma.user.updateMany({ where: { id: userId, OR: [{ usernameChangedAt: null }, { usernameChangedAt: { lte: cutoff } }] }, data: { username, usernameChangedAt: now } });
      if (changed.count === 0) {
        const current = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { usernameChangedAt: true } });
        this.usernamePolicy.assertAllowed(current.usernameChangedAt, now);
        throw new AppException('USERNAME_CHANGE_TOO_SOON', 'Username can only be changed once every 30 days', HttpStatus.TOO_MANY_REQUESTS);
      }
      const updated = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      return this.meProfile(updated);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new AppException('USERNAME_TAKEN', 'Username is already taken', HttpStatus.CONFLICT);
      throw error;
    }
  }

  public async settings(userId: string): Promise<MeSettings> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true, locale: true } });
    return { phone: user.phone, locale: user.locale as Locale };
  }

  public async cities(locale: Locale): Promise<City[]> {
    const rows = await this.prisma.city.findMany({ where: { isActive: true }, orderBy: { slug: 'asc' } });
    return rows.map((row) => this.city(row, locale));
  }

  private city(row: CityRow, locale: Locale): City {
    const names = { uz: row.nameUz, 'uz-Cyrl': row.nameUzCyrl, ru: row.nameRu, en: row.nameEn };
    return { id: row.id, slug: row.slug, name: names[locale] };
  }
  private meProfile(user: { id: string; firstName: string; lastName: string; username: string; avatarUrl: string | null; bio: string | null; cityId: string | null; position: 'GK'|'DEF'|'MID'|'FWD'|'UNIVERSAL'|null; locale: string }): MeProfile {
    return { id: user.id, firstName: user.firstName, lastName: user.lastName, username: user.username, avatarUrl: user.avatarUrl, bio: user.bio, cityId: user.cityId, position: user.position, locale: user.locale as Locale };
  }
}
