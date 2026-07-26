import { Injectable } from '@nestjs/common';
import { Prisma, type AttendanceStatus } from '../generated/prisma';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '../config/config.service';
import { ratingsThatCountWhere } from '../ratings/ratings.service';
import { attendancePercentage, bayesianAverage, roundAggregate } from './stats-calculator';
import { BADGE_CATALOG, earnedBadgeCodes } from './badge-rules';

@Injectable()
export class StatsService {
  private readonly globalMeanKey: string;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.globalMeanKey = `${config.get('BULLMQ_PREFIX')}:stats:global-mean`;
  }

  public async globalMean(forceRefresh = false): Promise<Prisma.Decimal> {
    if (!forceRefresh) {
      const cached = await this.redis.client.get(this.globalMeanKey);
      if (cached !== null) return new Prisma.Decimal(cached);
    }
    const ratings = await this.prisma.rating.findMany({
      where: ratingsThatCountWhere,
      select: { overall: true },
    });
    const mean = ratings.length === 0
      ? new Prisma.Decimal(0)
      : ratings.reduce((sum, rating) => sum.plus(rating.overall), new Prisma.Decimal(0)).div(ratings.length);
    await this.redis.client.set(this.globalMeanKey, mean.toString());
    return mean;
  }

  public async recomputeUser(userId: string, suppliedGlobalMean?: Prisma.Decimal): Promise<void> {
    const globalMean = suppliedGlobalMean ?? await this.globalMean();
    const [records, ratings, organized] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { participant: { userId }, finalizedAt: { not: null } },
        select: { status: true, finalizedAt: true, guestNoShowCount: true },
      }),
      this.prisma.rating.findMany({
        where: { rateeId: userId, ...ratingsThatCountWhere },
        select: {
          overall: true,
          fairPlay: true,
          status: true,
          deletedAt: true,
          createdAt: true,
          rater: { select: { status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.match.groupBy({
        by: ['status'],
        where: { ownerId: userId, deletedAt: null, status: { not: 'DRAFT' } },
        _count: { _all: true },
      }),
    ]);
    const statusCounts = this.attendanceCounts(records);
    const countedRatings = ratings.map((rating) => ({
      overall: rating.overall,
      status: rating.status,
      deletedAt: rating.deletedAt,
      raterStatus: rating.rater.status,
    }));
    const attendancePct = roundAggregate(attendancePercentage(records));
    const bayesAvg = roundAggregate(bayesianAverage(countedRatings, globalMean));
    const lastFive = ratings.slice(0, 5);
    const lastFiveAvg = roundAggregate(lastFive.length === 0 ? null : lastFive
      .reduce((sum, rating) => sum.plus(rating.overall), new Prisma.Decimal(0))
      .div(lastFive.length));
    const fairPlayAvg = ratings.length === 0 ? null : ratings
      .reduce((sum, rating) => sum.plus(rating.fairPlay), new Prisma.Decimal(0))
      .div(ratings.length);
    const matchesOrganized = organized.reduce((sum, row) => sum + row._count._all, 0);
    const cancelledOrganized = organized.find((row) => row.status === 'CANCELLED')?._count._all ?? 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.userStats.upsert({
        where: { userId },
        create: {
          userId,
          matchesPlayed: records.length,
          matchesOrganized,
          ...statusCounts,
          attendancePct,
          bayesAvg,
          ratingCount: ratings.length,
          lastFiveAvg,
        },
        update: {
          matchesPlayed: records.length,
          matchesOrganized,
          ...statusCounts,
          attendancePct,
          bayesAvg,
          ratingCount: ratings.length,
          lastFiveAvg,
        },
      });
      for (const badge of BADGE_CATALOG) {
        await tx.badge.upsert({
          where: { code: badge.code },
          create: { id: uuidv7(), ...badge },
          update: { name: badge.name, description: badge.description },
        });
      }
      const earned = earnedBadgeCodes({
        matchesPlayed: records.length,
        matchesOrganized,
        cancelledOrganized,
        noShow: statusCounts.noShow,
        attendancePct,
        fairPlayAvg,
        fairPlayRatingCount: ratings.length,
      });
      for (const badgeCode of earned) {
        await tx.userBadge.upsert({
          where: { userId_badgeCode: { userId, badgeCode } },
          create: { userId, badgeCode },
          update: {},
        });
      }
      // MVP badges are intentionally monotonic: no delete path runs when facts fall.
    });
  }

  public async reconcileAll(): Promise<void> {
    const globalMean = await this.globalMean(true);
    const users = await this.prisma.user.findMany({ where: { deletedAt: null }, select: { id: true } });
    for (const user of users) await this.recomputeUser(user.id, globalMean);
  }

  private attendanceCounts(records: readonly { status: AttendanceStatus; guestNoShowCount: number }[]): {
    onTime: number; late: number; noShow: number; cancelledEarly: number; excused: number;
  } {
    return {
      onTime: records.filter((record) => record.status === 'ON_TIME').length,
      late: records.filter((record) => record.status === 'LATE').length,
      noShow: records.filter((record) => record.status === 'NO_SHOW').length
        + records.reduce((sum, record) => sum + record.guestNoShowCount, 0),
      cancelledEarly: records.filter((record) => record.status === 'CANCELLED_EARLY').length,
      excused: records.filter((record) => record.status === 'EXCUSED').length,
    };
  }
}
