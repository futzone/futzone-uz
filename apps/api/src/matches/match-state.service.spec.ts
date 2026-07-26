import type { MatchStatus, Prisma } from '../generated/prisma';
import { AppException } from '../common/errors/app.exception';
import { MatchStateService } from './match-state.service';

const statuses: MatchStatus[] = ['DRAFT', 'PUBLISHED', 'FULL', 'STARTED', 'FINISHED', 'ATTENDANCE_PENDING', 'RATING_PENDING', 'COMPLETED', 'CANCELLED'];
const valid = new Set([
  'DRAFT>PUBLISHED', 'DRAFT>CANCELLED', 'PUBLISHED>FULL', 'PUBLISHED>STARTED', 'PUBLISHED>CANCELLED',
  'FULL>PUBLISHED', 'FULL>STARTED', 'FULL>CANCELLED', 'STARTED>FINISHED', 'FINISHED>ATTENDANCE_PENDING',
  'ATTENDANCE_PENDING>RATING_PENDING', 'RATING_PENDING>COMPLETED',
]);

describe('MatchStateService', () => {
  const service = new MatchStateService();
  it.each(statuses.flatMap((from) => statuses.map((to) => [from, to] as const)))('%s -> %s follows the canonical transition table', (from, to) => {
    const action = (): void => service.assertTransition(from, to);
    if (valid.has(`${from}>${to}`)) expect(action).not.toThrow();
    else {
      try { action(); throw new Error('Expected transition to fail'); }
      catch (error: unknown) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe('INVALID_STATE_TRANSITION');
      }
    }
  });

  it('mutates status through the supplied transaction client', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = { match: { updateMany } } as unknown as Prisma.TransactionClient;
    await service.transition(tx, '019830ba-7d00-7000-8000-000000000201', 'DRAFT', 'PUBLISHED');
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'PUBLISHED' } }));
  });
});
