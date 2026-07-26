import { firstFittingWaitlistParty } from './waitlist-selection';

describe('firstFittingWaitlistParty', () => {
  it('promotes in FIFO order when the first party fits', () => {
    const parties = [
      { id: 'first', guestCount: 0, waitlistPosition: 1 },
      { id: 'second', guestCount: 0, waitlistPosition: 2 },
    ];
    expect(firstFittingWaitlistParty(parties, 1)?.id).toBe('first');
  });

  it('skips a party that does not fit without changing its position', () => {
    const parties = [
      { id: 'large', guestCount: 2, waitlistPosition: 4 },
      { id: 'fitting', guestCount: 0, waitlistPosition: 5 },
    ];
    expect(firstFittingWaitlistParty(parties, 1)?.id).toBe('fitting');
    expect(parties[0]?.waitlistPosition).toBe(4);
    expect(parties.map(({ id }) => id)).toEqual(['large', 'fitting']);
  });
});
