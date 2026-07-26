import type { Prisma } from '../generated/prisma';
import { HttpStatus } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';

export type ConfirmedParticipant = { status: string; guestCount: number };

export function computeOccupiedSlots(participants: readonly ConfirmedParticipant[]): number {
  return participants.reduce(
    (total, participant) =>
      participant.status === 'CONFIRMED' ? total + 1 + participant.guestCount : total,
    0,
  );
}

export async function computeMatchOccupancy(
  client: Prisma.TransactionClient,
  matchId: string,
): Promise<number> {
  const aggregate = await client.matchParticipant.aggregate({
    where: { matchId, status: 'CONFIRMED' },
    _count: { _all: true },
    _sum: { guestCount: true },
  });
  return aggregate._count._all + (aggregate._sum.guestCount ?? 0);
}

export function assertTotalSlotsAtLeastOccupancy(totalSlots: number, occupiedSlots: number): void {
  if (totalSlots < occupiedSlots)
    throw new AppException(
      'MATCH_FULL',
      'Total slots cannot be lower than current occupancy',
      HttpStatus.CONFLICT,
      { occupiedSlots },
    );
}

export function assertPartyFits(
  totalSlots: number,
  occupiedSlots: number,
  partySeats: number,
): void {
  if (occupiedSlots + partySeats > totalSlots)
    throw new AppException('MATCH_FULL', 'Party exceeds available capacity', HttpStatus.CONFLICT, {
      occupiedSlots,
      freeSlots: Math.max(0, totalSlots - occupiedSlots),
      waitlistAvailable: true,
    });
}
