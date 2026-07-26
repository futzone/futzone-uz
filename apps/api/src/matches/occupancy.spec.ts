import {
  assertPartyFits,
  assertTotalSlotsAtLeastOccupancy,
  computeOccupiedSlots,
} from './occupancy';
import { AppException } from '../common/errors/app.exception';

describe('match occupancy', () => {
  it('counts the confirmed owner, players, and every guest', () => {
    expect(
      computeOccupiedSlots([
        { status: 'CONFIRMED', guestCount: 2 },
        { status: 'CONFIRMED', guestCount: 1 },
        { status: 'PENDING', guestCount: 5 },
        { status: 'LEFT', guestCount: 0 },
      ]),
    ).toBe(5);
  });

  it('allows totalSlots equal to current occupancy', () => {
    expect(() => assertTotalSlotsAtLeastOccupancy(5, 5)).not.toThrow();
  });

  it('rejects totalSlots below current occupancy', () => {
    try {
      assertTotalSlotsAtLeastOccupancy(4, 5);
      throw new Error('Expected capacity validation to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).code).toBe('MATCH_FULL');
      expect((error as AppException).details).toEqual({ occupiedSlots: 5 });
    }
  });

  it('allows a join or guest increase that exactly fills the remaining seats', () => {
    expect(() => assertPartyFits(10, 7, 3)).not.toThrow();
  });

  it('rejects a join or guest increase beyond the remaining seats with waitlist details', () => {
    try {
      assertPartyFits(10, 8, 3);
      throw new Error('Expected party capacity validation to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).code).toBe('MATCH_FULL');
      expect((error as AppException).details).toEqual({
        occupiedSlots: 8,
        freeSlots: 2,
        waitlistAvailable: true,
      });
    }
  });
});
