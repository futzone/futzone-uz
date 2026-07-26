import { MatchJobProcessorService } from './match-job-processor.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { MatchParticipationService } from './match-participation.service';
import type { MatchStateService } from './match-state.service';
import type { AttendanceService } from '../attendance/attendance.service';
import type { AttendanceQueueService } from '../attendance/attendance-queue.service';

describe('MatchJobProcessorService', () => {
  function setup(initialStatus: string): {
    service: MatchJobProcessorService;
    states: { transition: jest.Mock<Promise<void>, [unknown, string, string, string]> };
    attendanceQueue: { scheduleFallback: jest.Mock<Promise<void>, [string]> };
    status: () => string;
  } {
    let status = initialStatus;
    const tx = { $queryRaw: jest.fn(async () => [{ status }]) };
    const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)) };
    const states = { transition: jest.fn(async (_client: unknown, _id: string, _from: string, to: string): Promise<void> => { status = to; }) };
    const attendanceQueue = { scheduleFallback: jest.fn(async (_matchId: string) => undefined) };
    const service = new MatchJobProcessorService(
      prisma as unknown as PrismaService,
      states as unknown as MatchStateService,
      { expirePromotion: jest.fn() } as unknown as MatchParticipationService,
      { fallback: jest.fn(), finalize: jest.fn() } as unknown as AttendanceService,
      attendanceQueue as unknown as AttendanceQueueService,
    );
    return { service, states, attendanceQueue, status: () => status };
  }

  it('starts idempotently and no-ops after the match has moved on', async () => {
    const { service, states, status } = setup('PUBLISHED');
    await service.start({ matchId: '019830ba-7d00-7000-8000-000000000001' });
    await service.start({ matchId: '019830ba-7d00-7000-8000-000000000001' });
    expect(status()).toBe('STARTED');
    expect(states.transition).toHaveBeenCalledTimes(1);

    const moved = setup('CANCELLED');
    await expect(moved.service.start({ matchId: '019830ba-7d00-7000-8000-000000000001' })).resolves.toBeUndefined();
    expect(moved.states.transition).not.toHaveBeenCalled();
  });

  it('finishes idempotently and no-ops after the match has moved on', async () => {
    const { service, states, attendanceQueue, status } = setup('STARTED');
    await service.finish({ matchId: '019830ba-7d00-7000-8000-000000000001' });
    await service.finish({ matchId: '019830ba-7d00-7000-8000-000000000001' });
    expect(status()).toBe('ATTENDANCE_PENDING');
    expect(states.transition).toHaveBeenCalledTimes(2);
    // The deterministic job ID makes this repair scheduling idempotent in BullMQ.
    expect(attendanceQueue.scheduleFallback).toHaveBeenCalledTimes(2);

    const moved = setup('ATTENDANCE_PENDING');
    await expect(moved.service.finish({ matchId: '019830ba-7d00-7000-8000-000000000001' })).resolves.toBeUndefined();
    expect(moved.states.transition).not.toHaveBeenCalled();
    expect(moved.attendanceQueue.scheduleFallback).toHaveBeenCalledTimes(1);

    const completed = setup('RATING_PENDING');
    await expect(completed.service.finish({ matchId: '019830ba-7d00-7000-8000-000000000001' })).resolves.toBeUndefined();
    expect(completed.attendanceQueue.scheduleFallback).not.toHaveBeenCalled();
  });

  it('closes the rating window idempotently and only from RATING_PENDING', async () => {
    const closesAt = new Date('2035-01-22T11:30:00.000Z');
    let status = 'RATING_PENDING';
    const tx = { $queryRaw: jest.fn(async () => [{ status, startsAt: new Date('2035-01-15T10:00:00.000Z'), durationMin: 90 }]) };
    const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)) };
    const states = { transition: jest.fn(async () => { status = 'COMPLETED'; }) };
    const service = new MatchJobProcessorService(
      prisma as unknown as PrismaService,
      states as unknown as MatchStateService,
      {} as MatchParticipationService,
      {} as AttendanceService,
      {} as AttendanceQueueService,
    );
    await service.closeRatingWindow({ matchId: '019830ba-7d00-7000-8000-000000000001' }, new Date(closesAt.getTime() - 1));
    expect(states.transition).not.toHaveBeenCalled();
    await service.closeRatingWindow({ matchId: '019830ba-7d00-7000-8000-000000000001' }, closesAt);
    await service.closeRatingWindow({ matchId: '019830ba-7d00-7000-8000-000000000001' }, closesAt);
    expect(states.transition).toHaveBeenCalledTimes(1);

    status = 'ATTENDANCE_PENDING';
    await service.closeRatingWindow({ matchId: '019830ba-7d00-7000-8000-000000000001' }, closesAt);
    expect(states.transition).toHaveBeenCalledTimes(1);
  });
});
