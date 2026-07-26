import { HttpStatus, Injectable } from '@nestjs/common';
import type { MatchStatus, Prisma } from '../generated/prisma';
import { AppException } from '../common/errors/app.exception';

const TRANSITIONS: Readonly<Record<MatchStatus, readonly MatchStatus[]>> = {
  DRAFT: ['PUBLISHED', 'CANCELLED'], PUBLISHED: ['FULL', 'STARTED', 'CANCELLED'], FULL: ['PUBLISHED', 'STARTED', 'CANCELLED'],
  STARTED: ['FINISHED'], FINISHED: ['ATTENDANCE_PENDING'], ATTENDANCE_PENDING: ['RATING_PENDING'], RATING_PENDING: ['COMPLETED'],
  COMPLETED: [], CANCELLED: [],
};

@Injectable()
export class MatchStateService {
  public assertTransition(from: MatchStatus, to: MatchStatus): void {
    if (!TRANSITIONS[from].includes(to)) throw new AppException('INVALID_STATE_TRANSITION', `Cannot transition match from ${from} to ${to}`, HttpStatus.CONFLICT, { from, to });
  }

  public async transition(client: Prisma.TransactionClient, matchId: string, from: MatchStatus, to: MatchStatus, cancelledReason?: string): Promise<void> {
    this.assertTransition(from, to);
    if (to === 'CANCELLED' && !cancelledReason?.trim()) throw new AppException('VALIDATION_ERROR', 'Cancellation reason is required');
    const changed = await client.match.updateMany({
      where: { id: matchId, status: from, deletedAt: null },
      data: { status: to, ...(to === 'CANCELLED' ? { cancelledReason: cancelledReason?.trim() } : {}) },
    });
    if (changed.count !== 1) throw new AppException('INVALID_STATE_TRANSITION', 'Match state changed concurrently', HttpStatus.CONFLICT, { from, to });
  }
}
