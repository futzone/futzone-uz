import { isInsideRatingWindow, ratingWindowClosesAt } from './rating-window';

describe('rating window', () => {
  const startsAt = new Date('2035-01-15T10:00:00.000Z');
  const durationMin = 90;
  const closesAt = ratingWindowClosesAt(startsAt, durationMin);

  it('is open one millisecond inside the seven-day boundary', () => {
    expect(isInsideRatingWindow(startsAt, durationMin, new Date(closesAt.getTime() - 1))).toBe(true);
  });

  it('is closed at and one millisecond outside the seven-day boundary', () => {
    expect(isInsideRatingWindow(startsAt, durationMin, closesAt)).toBe(false);
    expect(isInsideRatingWindow(startsAt, durationMin, new Date(closesAt.getTime() + 1))).toBe(false);
  });
});
