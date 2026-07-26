import type { ConfigService } from '../config/config.service';
import { Prisma } from '../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';
import { StatsService } from './stats.service';

describe('StatsService recompute', () => {
  it('is idempotent and reflects an overturned finalized NO_SHOW as EXCUSED', async () => {
    const finalizedAt = new Date();
    let attendanceStatus: 'NO_SHOW' | 'EXCUSED' = 'NO_SHOW';
    const userStatsUpsert = jest.fn<Promise<void>, [{ create: Record<string, unknown>; update: Record<string, unknown> }]>(
      async () => undefined,
    );
    const userBadgeUpsert = jest.fn<Promise<void>, [unknown]>(async () => undefined);
    const tx = {
      userStats: { upsert: userStatsUpsert },
      badge: { upsert: jest.fn(async () => undefined) },
      userBadge: { upsert: userBadgeUpsert },
    };
    const prisma = {
      attendanceRecord: {
        findMany: jest.fn(async () => [{ status: attendanceStatus, finalizedAt, guestNoShowCount: 0 }]),
      },
      rating: { findMany: jest.fn(async () => []) },
      match: { groupBy: jest.fn(async () => []) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
    };
    const redis = { client: { get: jest.fn(async () => '4.2'), set: jest.fn(async () => 'OK') } };
    const config = { get: jest.fn(() => 'test-prefix') };
    const service = new StatsService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      config as unknown as ConfigService,
    );

    await service.recomputeUser('user');
    await service.recomputeUser('user');
    expect(userStatsUpsert.mock.calls[0]?.[0].update).toEqual(userStatsUpsert.mock.calls[1]?.[0].update);
    expect(userStatsUpsert.mock.calls[1]?.[0].update).toMatchObject({
      matchesPlayed: 1,
      noShow: 1,
      excused: 0,
      attendancePct: new Prisma.Decimal(0),
    });
    expect(userBadgeUpsert).toHaveBeenCalledTimes(0);

    attendanceStatus = 'EXCUSED';
    await service.recomputeUser('user');
    expect(userStatsUpsert.mock.calls[2]?.[0].update).toMatchObject({
      matchesPlayed: 1,
      noShow: 0,
      excused: 1,
      attendancePct: new Prisma.Decimal(100),
    });
  });

  it('recomputes and caches the Decimal global mean using only countable ratings', async () => {
    const prisma = {
      rating: { findMany: jest.fn(async () => [{ overall: 5 }, { overall: 4 }]) },
    };
    const redis = { client: { get: jest.fn(async () => null), set: jest.fn(async () => 'OK') } };
    const service = new StatsService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      { get: jest.fn(() => 'test-prefix') } as unknown as ConfigService,
    );
    await expect(service.globalMean(true)).resolves.toEqual(new Prisma.Decimal('4.5'));
    expect(prisma.rating.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'ACTIVE',
        deletedAt: null,
        rater: { status: { not: 'BANNED' } },
      }),
    }));
    expect(redis.client.set).toHaveBeenCalledWith('test-prefix:stats:global-mean', '4.5');
  });

  it('nightly reconcile refreshes the mean and visits every non-deleted user', async () => {
    const prisma = {
      rating: { findMany: jest.fn(async () => [{ overall: 4 }]) },
      user: { findMany: jest.fn(async () => [{ id: 'u1' }, { id: 'u2' }]) },
    };
    const redis = { client: { get: jest.fn(async () => null), set: jest.fn(async () => 'OK') } };
    const service = new StatsService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      { get: jest.fn(() => 'test-prefix') } as unknown as ConfigService,
    );
    const recompute = jest.spyOn(service, 'recomputeUser').mockResolvedValue(undefined);
    await service.reconcileAll();
    expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { deletedAt: null }, select: { id: true } });
    expect(recompute).toHaveBeenNthCalledWith(1, 'u1', new Prisma.Decimal(4));
    expect(recompute).toHaveBeenNthCalledWith(2, 'u2', new Prisma.Decimal(4));
  });
});
