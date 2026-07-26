import { buildRequesterSummary } from './requester-summary';

describe('requester summary', () => {
  it('is null-safe before Phase 3 and labels the requester New player', () => {
    expect(
      buildRequesterSummary({
        attendancePercent: null,
        lastFiveRatingAverage: null,
        noShowCount: null,
        ratingsCount: null,
      }),
    ).toEqual({
      attendancePercent: null,
      lastFiveRatingAverage: null,
      noShowCount: null,
      displayRating: 'New player',
      warning: false,
    });
  });

  it('does not display a numeric average with fewer than three ratings', () => {
    expect(
      buildRequesterSummary({
        attendancePercent: 90,
        lastFiveRatingAverage: 4.5,
        noShowCount: 0,
        ratingsCount: 2,
      }).displayRating,
    ).toBe('New player');
  });

  it('renders real materialized stats when they exist', () => {
    expect(
      buildRequesterSummary({
        attendancePercent: 60,
        lastFiveRatingAverage: 2.4,
        noShowCount: 4,
        ratingsCount: 5,
      }),
    ).toEqual({
      attendancePercent: 60,
      lastFiveRatingAverage: 2.4,
      noShowCount: 4,
      displayRating: 2.4,
      warning: true,
    });
  });

  it.each([
    { attendancePercent: 69, lastFiveRatingAverage: 4 },
    { attendancePercent: 90, lastFiveRatingAverage: 2.9 },
  ])('sets an informational warning for low stats', (stats) => {
    expect(
      buildRequesterSummary({ ...stats, noShowCount: 0, ratingsCount: 5 }).warning,
    ).toBe(true);
  });
});
