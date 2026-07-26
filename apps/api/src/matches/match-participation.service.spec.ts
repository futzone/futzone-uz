import type { PrismaService } from '../prisma/prisma.service';
import type { MatchStateService } from './match-state.service';
import type { MatchQueueService } from './match-queue.service';
import { MatchParticipationService } from './match-participation.service';
import { missedReputationRequirement } from './match-participation.service';
import { AppException } from '../common/errors/app.exception';
import type { ConfigService } from '../config/config.service';
import { Prisma } from '../generated/prisma';
const config = { get: jest.fn(() => 6) } as unknown as ConfigService;
const attendanceQueue = { scheduleFinalization: jest.fn() } as unknown as import('../attendance/attendance-queue.service').AttendanceQueueService;
const notifications = { notify: jest.fn(async () => undefined), notifyMany: jest.fn(async () => undefined) } as unknown as import('../notifications/notifications.service').NotificationsService;

const MATCH_ID = '019830ba-7d00-7000-8000-000000000601';
const OUTSIDER_ID = '019830ba-7d00-7000-8000-000000000602';
const PROMOTED_ID = '019830ba-7d00-7000-8000-000000000603';

function lockedMatch(): { id: string; ownerId: string; status: string; joinMode: string; totalSlots: number; startsAt: Date; durationMin: number; verifiedPhoneOnly: boolean; allowNewPlayers: boolean; minRating: null; minAttendancePct: null } {
  return { id: MATCH_ID, ownerId: '019830ba-7d00-7000-8000-000000000604', status: 'PUBLISHED', joinMode: 'AUTO', totalSlots: 10, startsAt: new Date('2026-07-23T12:00:00Z'), durationMin: 90, verifiedPhoneOnly: false, allowNewPlayers: true, minRating: null, minAttendancePct: null };
}

function joinService(
  promotionExpiresAt: Date,
  matchOverrides: Partial<ReturnType<typeof lockedMatch>> = {},
): MatchParticipationService {
  let rawQueryCount = 0;
  const participant = { id: 'participant-id', matchId: MATCH_ID, userId: OUTSIDER_ID, role: 'PLAYER', status: 'CONFIRMED', guestCount: 0, waitlistPosition: null, promotionExpiresAt: null, joinedAt: new Date(), leftAt: null };
  const tx = {
    $queryRaw: jest.fn(async () => {
      rawQueryCount += 1;
      return rawQueryCount === 1 ? [{ ...lockedMatch(), ...matchOverrides }] : [];
    }),
    matchParticipant: {
      findUnique: jest.fn(async () => null),
      aggregate: jest.fn(async (args: { where: { status: string; promotionExpiresAt?: { gt: Date } } }) => {
        if (args.where.status === 'PENDING_CONFIRMATION') {
          const active = promotionExpiresAt > (args.where.promotionExpiresAt?.gt ?? new Date());
          return { _count: { _all: active ? 1 : 0 }, _sum: { guestCount: 0 } };
        }
        return { _count: { _all: 9 }, _sum: { guestCount: 0 } };
      }),
      upsert: jest.fn(async () => participant),
    },
    joinRequest: { findUnique: jest.fn(async () => null) },
    user: { findUnique: jest.fn(async () => ({ phoneVerifiedAt: new Date(), stats: null })) },
  };
  const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
  return new MatchParticipationService(
    prisma as unknown as PrismaService,
    { transition: jest.fn(async () => undefined) } as unknown as MatchStateService,
    { cancelPromotion: jest.fn(async () => undefined) } as unknown as MatchQueueService,
    config,
    attendanceQueue,
    notifications,
  );
}

describe('MatchParticipationService waitlist expiry', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-22T12:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('expires an unconfirmed offer and hands the seat to the next fitting party', async () => {
    const expiredAt = new Date('2026-07-22T11:59:00.000Z');
    const expired = {
      id: 'expired-id', matchId: 'match-id', userId: 'expired-user', role: 'PLAYER',
      status: 'PENDING_CONFIRMATION', guestCount: 0, waitlistPosition: 1,
      promotionExpiresAt: expiredAt, joinedAt: expiredAt, leftAt: null,
    };
    const large = { ...expired, id: 'large-id', userId: 'large-user', status: 'WAITLISTED', guestCount: 2, waitlistPosition: 2, promotionExpiresAt: null };
    const next = { ...expired, id: 'next-id', userId: 'next-user', status: 'WAITLISTED', guestCount: 0, waitlistPosition: 3, promotionExpiresAt: null };
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: 'match-id', ownerId: 'owner-id', status: 'PUBLISHED', joinMode: 'AUTO', totalSlots: 10, startsAt: new Date('2026-07-23T12:00:00Z'), durationMin: 90, verifiedPhoneOnly: false, allowNewPlayers: true, minRating: null, minAttendancePct: null }]),
      matchParticipant: {
        findUnique: jest.fn(async () => expired),
        update: jest.fn(async () => expired),
        aggregate: jest.fn(async () => ({ _count: { _all: 9 }, _sum: { guestCount: 0 } })),
        findMany: jest.fn(async () => [large, next]),
      },
      notification: { create: jest.fn(async () => undefined) },
    };
    const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
    const queue = { schedulePromotion: jest.fn(async () => undefined) };
    const service = new MatchParticipationService(
      prisma as unknown as PrismaService,
      { transition: jest.fn() } as unknown as MatchStateService,
      queue as unknown as MatchQueueService,
      config,
      attendanceQueue,
      notifications,
    );

    await service.expirePromotion({ matchId: 'match-id', participantId: 'expired-id', expiresAt: expiredAt.toISOString() });

    expect(tx.matchParticipant.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: 'expired-id' }, data: expect.objectContaining({ status: 'DECLINED' }) }));
    expect(tx.matchParticipant.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: 'next-id' }, data: expect.objectContaining({ status: 'PENDING_CONFIRMATION' }) }));
    expect(large.waitlistPosition).toBe(2);
    expect(queue.schedulePromotion).toHaveBeenCalledWith(expect.objectContaining({ matchId: 'match-id', participantId: 'next-id' }));
  });

  it('rejects a new join with MATCH_FULL while an unexpired promotion holds the last seat', async () => {
    const service = joinService(new Date('2026-07-22T12:01:00.000Z'));
    await expect(service.join(MATCH_ID, OUTSIDER_ID, { guestCount: 0 })).rejects.toMatchObject({
      code: 'MATCH_FULL',
      details: expect.objectContaining({ waitlistAvailable: true }),
    });
  });

  it('admits the same new join immediately after the promotion timestamp passes', async () => {
    const service = joinService(new Date('2026-07-22T12:00:00.000Z'));
    await expect(service.join(MATCH_ID, OUTSIDER_ID, { guestCount: 0 })).resolves.toMatchObject({
      kind: 'participant',
      participant: expect.objectContaining({ userId: OUTSIDER_ID, status: 'CONFIRMED' }),
    });
  });

  it('returns REQUIREMENTS_NOT_MET from the locked join flow for a disallowed new player', async () => {
    const service = joinService(
      new Date('2026-07-22T12:00:00.000Z'),
      { allowNewPlayers: false },
    );
    await expect(service.join(MATCH_ID, OUTSIDER_ID, { guestCount: 0 })).rejects.toMatchObject({
      code: 'REQUIREMENTS_NOT_MET',
      details: { requirement: 'allowNewPlayers' },
    });
  });

  it('allows the promoted party to confirm after competing new joins were rejected', async () => {
    const expiresAt = new Date('2026-07-22T12:30:00.000Z');
    const promoted = { id: 'promoted-participant-id', matchId: MATCH_ID, userId: PROMOTED_ID, role: 'PLAYER', status: 'PENDING_CONFIRMATION', guestCount: 0, waitlistPosition: 1, promotionExpiresAt: expiresAt, joinedAt: new Date(), leftAt: null };
    let transactionNumber = 0;
    const prisma = {
      $transaction: jest.fn(async (callback: (client: object) => Promise<unknown>) => {
        transactionNumber += 1;
        let rawQueryCount = 0;
        let confirmedAggregateCount = 0;
        const confirming = transactionNumber === 2;
        const tx = {
          $queryRaw: jest.fn(async () => {
            rawQueryCount += 1;
            return rawQueryCount === 1 ? [lockedMatch()] : [];
          }),
          matchParticipant: {
            findUnique: jest.fn(async (args: { where: { matchId_userId?: { userId: string } } }) =>
              args.where.matchId_userId?.userId === PROMOTED_ID ? promoted : null),
            aggregate: jest.fn(async (args: { where: { status: string } }) => {
              if (args.where.status === 'PENDING_CONFIRMATION')
                return { _count: { _all: 1 }, _sum: { guestCount: 0 } };
              confirmedAggregateCount += 1;
              return { _count: { _all: confirming && confirmedAggregateCount > 1 ? 10 : 9 }, _sum: { guestCount: 0 } };
            }),
            upsert: jest.fn(),
            update: jest.fn(async () => ({ ...promoted, status: 'CONFIRMED', waitlistPosition: null, promotionExpiresAt: null })),
          },
          joinRequest: { findUnique: jest.fn(async () => null) },
          user: { findUnique: jest.fn(async () => ({ phoneVerifiedAt: new Date(), stats: null })) },
        };
        return callback(tx);
      }),
    };
    const service = new MatchParticipationService(
      prisma as unknown as PrismaService,
      { transition: jest.fn(async () => undefined) } as unknown as MatchStateService,
      { cancelPromotion: jest.fn(async () => undefined) } as unknown as MatchQueueService,
      config,
      attendanceQueue,
      notifications,
    );

    await expect(service.join(MATCH_ID, OUTSIDER_ID, { guestCount: 0 })).rejects.toBeInstanceOf(AppException);
    await expect(service.confirmPromotion(MATCH_ID, PROMOTED_ID)).resolves.toMatchObject({ status: 'CONFIRMED' });
  });
});

describe('P3-06 reputation requirements', () => {
  const requirements = (
    allowNewPlayers: boolean,
    minRating: number | null = 3.5,
    minAttendancePct: number | null = 60,
  ): { allowNewPlayers: boolean; minRating: Prisma.Decimal | null; minAttendancePct: number | null } => ({
    allowNewPlayers,
    minRating: minRating === null ? null : new Prisma.Decimal(minRating),
    minAttendancePct,
  });
  const stats = (bayesAvg: number | null, attendancePct: number | null): {
    bayesAvg: Prisma.Decimal | null;
    attendancePct: Prisma.Decimal | null;
  } => ({
    bayesAvg: bayesAvg === null ? null : new Prisma.Decimal(bayesAvg),
    attendancePct: attendancePct === null ? null : new Prisma.Decimal(attendancePct),
  });

  it('admits a user with null stats when new players are allowed', () => {
    expect(missedReputationRequirement(requirements(true), null)).toBeNull();
  });

  it('refuses a user with null stats when new players are not allowed', () => {
    expect(missedReputationRequirement(requirements(false), null)).toEqual({
      requirement: 'allowNewPlayers',
    });
  });

  it.each([
    ['rating at boundary', requirements(false, 3.5, null), stats(3.5, null), null],
    ['rating just below', requirements(false, 3.5, null), stats(3.49, null), { requirement: 'minRating', minimum: 3.5, actual: 3.49 }],
    ['attendance at boundary', requirements(false, null, 60), stats(4, 60), null],
    ['attendance just below', requirements(false, null, 60), stats(4, 59.99), { requirement: 'minAttendancePct', minimum: 60, actual: 59.99 }],
  ])('%s', (_name, match, userStats, expected) => {
    expect(missedReputationRequirement(match, userStats)).toEqual(expected);
  });
});
