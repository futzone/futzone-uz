import type { PrismaService } from '../prisma/prisma.service';
import type { MatchStateService } from '../matches/match-state.service';
import type { AttendanceQueueService } from './attendance-queue.service';
import type { MatchQueueService } from '../matches/match-queue.service';
import type { StatsQueueService } from '../stats/stats-queue.service';
import { AttendanceService } from './attendance.service';
import { isFinalizedRecordEligibleForStats, shouldCreateEarlyCancellation } from './attendance-rules';

const markedAt = new Date('2026-07-20T00:00:00.000Z');
const base = { id: 'r', matchId: 'm', participantId: 'p', status: 'NO_SHOW', guestNoShowCount: 0, markedById: 'owner', markedAt, disputeStatus: null, disputeNote: null, disputeResolvedById: null, finalizedAt: null };
const matchQueue = { scheduleRatingWindowClose: jest.fn(async () => undefined) } as unknown as MatchQueueService;
const statsQueue = { attendanceFinalized: jest.fn(async () => undefined) } as unknown as StatsQueueService;
const notifications = { notify: jest.fn(async () => undefined), notifyMany: jest.fn(async () => undefined) } as unknown as import('../notifications/notifications.service').NotificationsService;

describe('attendance trust boundaries', () => {
  it('treats exactly N hours as early enough to create no record', () => {
    const startsAt = new Date('2026-07-23T12:00:00.000Z');
    // The penalty interval is open at the cutoff: exactly six hours creates no record.
    expect(shouldCreateEarlyCancellation(startsAt, new Date('2026-07-23T06:00:00.000Z'), 6)).toBe(false);
    expect(shouldCreateEarlyCancellation(startsAt, new Date('2026-07-23T06:00:00.001Z'), 6)).toBe(true);
  });

  it('accepts a dispute just inside 72h and rejects one just outside', async () => {
    const tx = { attendanceRecord: {
      findUnique: jest.fn(async () => ({ ...base, participant: { userId: 'user' } })),
      update: jest.fn(async () => ({ ...base, disputeStatus: 'OPEN', disputeNote: 'wrong' })),
    }, notification: { create: jest.fn() } };
    const prisma = { $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)) };
    const service = new AttendanceService(prisma as unknown as PrismaService, {} as MatchStateService, {} as AttendanceQueueService, matchQueue, statsQueue, notifications);
    await expect(service.dispute('r', 'user', 'wrong', new Date(markedAt.getTime() + 72 * 60 * 60_000 - 1))).resolves.toMatchObject({ disputeStatus: 'OPEN' });
    await expect(service.dispute('r', 'user', 'wrong', new Date(markedAt.getTime() + 72 * 60 * 60_000 + 1))).rejects.toMatchObject({ code: 'DISPUTE_WINDOW_CLOSED' });
  });

  it('does not allow a non-participant to dispute', async () => {
    const tx = { attendanceRecord: { findUnique: jest.fn(async () => ({ ...base, participant: { userId: 'user' } })) } };
    const prisma = { $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)) };
    const service = new AttendanceService(prisma as unknown as PrismaService, {} as MatchStateService, {} as AttendanceQueueService, matchQueue, statsQueue, notifications);
    await expect(service.dispute('r', 'outsider', 'wrong')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('makes only finalized records eligible for stats', () => {
    expect(isFinalizedRecordEligibleForStats({ finalizedAt: null, status: 'ON_TIME' })).toBe(false);
    expect(isFinalizedRecordEligibleForStats({ finalizedAt: new Date(), status: 'ON_TIME' })).toBe(true);
  });

  it('fallback is idempotent and defaults unmarked participants to ON_TIME, never NO_SHOW', async () => {
    let status = 'ATTENDANCE_PENDING';
    const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...base, ...data }));
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: 'm', status, ownerId: 'owner' }]),
      matchParticipant: {
        findMany: jest.fn(async () => status === 'ATTENDANCE_PENDING' ? [{ id: 'p1', userId: 'u1' }, { id: 'p2', userId: 'u2' }] : []),
        count: jest.fn(async () => 2),
      },
      attendanceRecord: { create, count: jest.fn(async () => 2) },
      notification: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
      match: { findUnique: jest.fn(async () => ({ startsAt: new Date('2035-01-15T10:00:00.000Z'), durationMin: 90 })) },
    };
    const states = { transition: jest.fn(async () => { status = 'RATING_PENDING'; }) };
    const queue = { scheduleFinalization: jest.fn(async () => undefined) };
    const service = new AttendanceService(prisma as unknown as PrismaService, states as unknown as MatchStateService, queue as unknown as AttendanceQueueService, matchQueue, statsQueue, notifications);
    await service.fallback('m'); await service.fallback('m');
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.every(([call]) => call.data.status === 'ON_TIME')).toBe(true);
    expect(states.transition).toHaveBeenCalledTimes(1);
  });

  it('finalization job mutates once, then is idempotent after the record has moved on', async () => {
    const now = new Date(markedAt.getTime() + 72 * 60 * 60_000);
    let current = { ...base, finalizedAt: null as Date | null, disputeStatus: null as 'OPEN' | null };
    const update = jest.fn(async () => {
      current = { ...current, finalizedAt: now };
      return current;
    });
    const tx = {
      attendanceRecord: { findUnique: jest.fn(async () => current), update },
      matchParticipant: { findUnique: jest.fn(async () => ({ userId: 'user' })) },
      notification: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)) };
    const service = new AttendanceService(prisma as unknown as PrismaService, {} as MatchStateService, {} as AttendanceQueueService, matchQueue, statsQueue, notifications);
    await service.finalize('r', now);
    await service.finalize('r', now);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('admin overturn of a finalized disputed record emits a stats recompute event', async () => {
    const queue = { cancelFinalization: jest.fn(async () => undefined) };
    const stats = { attendanceFinalized: jest.fn(async () => undefined) };
    const tx = {
      attendanceRecord: {
        findUnique: jest.fn(async () => ({
          ...base,
          finalizedAt: new Date(),
          disputeStatus: 'OPEN',
          match: { ownerId: 'owner' },
          participant: { userId: 'user' },
        })),
        update: jest.fn(async () => ({ ...base, status: 'EXCUSED', finalizedAt: new Date(), disputeStatus: 'OVERTURNED' })),
      },
      auditLog: { create: jest.fn(async () => undefined) },
      notification: { create: jest.fn(async () => undefined) },
    };
    const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
    const service = new AttendanceService(
      prisma as unknown as PrismaService,
      {} as MatchStateService,
      queue as unknown as AttendanceQueueService,
      matchQueue,
      stats as unknown as StatsQueueService,
      notifications,
    );
    await service.resolve('r', { id: 'admin', role: 'ADMIN' }, { status: 'EXCUSED' });
    expect(stats.attendanceFinalized).toHaveBeenCalledWith('user');
    expect(tx.attendanceRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'EXCUSED', disputeStatus: 'OVERTURNED' }),
    }));
  });
});
