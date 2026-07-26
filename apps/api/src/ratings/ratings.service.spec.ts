import type { PrismaService } from '../prisma/prisma.service';
import { RatingsService } from './ratings.service';
import type { StatsQueueService } from '../stats/stats-queue.service';

describe('rating reports', () => {
  it('auto-hides at exactly three distinct reporters and rejects a repeat reporter', async () => {
    const createdAt = new Date('2035-01-20T00:00:00.000Z');
    const reports = new Map<string, { id: string; ratingId: string; reporterId: string; reason: string; createdAt: Date }>();
    let hidden = false;
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: '019830ba-7d00-7000-8000-000000000901' }]),
      report: {
        findUnique: jest.fn(async ({ where }: { where: { ratingId_reporterId: { reporterId: string } } }) =>
          reports.get(where.ratingId_reporterId.reporterId) ?? null),
        create: jest.fn(async ({ data }: { data: { id: string; ratingId: string; reporterId: string; reason: string } }) => {
          const report = { ...data, createdAt };
          reports.set(data.reporterId, report);
          return report;
        }),
        count: jest.fn(async () => reports.size),
      },
      rating: {
        updateMany: jest.fn(async () => {
          hidden = true;
          return { count: 1 };
        }),
        findUnique: jest.fn(async () => ({ rateeId: 'rated-user' })),
      },
    };
    const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
    const service = new RatingsService(
      prisma as unknown as PrismaService,
      { ratingChanged: jest.fn(async () => undefined) } as unknown as StatsQueueService,
    );

    await service.report('019830ba-7d00-7000-8000-000000000901', 'reporter-1', 'reason');
    await expect(service.report('019830ba-7d00-7000-8000-000000000901', 'reporter-1', 'again'))
      .rejects.toMatchObject({ code: 'DUPLICATE_REPORT' });
    expect(hidden).toBe(false);
    await service.report('019830ba-7d00-7000-8000-000000000901', 'reporter-2', 'reason');
    expect(hidden).toBe(false);
    await service.report('019830ba-7d00-7000-8000-000000000901', 'reporter-3', 'reason');
    expect(hidden).toBe(true);
    expect(tx.rating.updateMany).toHaveBeenCalledTimes(1);
  });
});
