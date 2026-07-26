import { Prisma } from '../generated/prisma';
import { attendancePercentage, bayesianAverage, bayesianEstimate, roundAggregate, type CountedRating } from './stats-calculator';

const rating = (overall: number, overrides: Partial<CountedRating> = {}): CountedRating => ({
  overall,
  status: 'ACTIVE',
  deletedAt: null,
  raterStatus: 'ACTIVE',
  ...overrides,
});

describe('stats formulas', () => {
  const mean = new Prisma.Decimal('4.2');

  it('keeps 0 and 1 rating as New player, and calculates exactly at 3', () => {
    expect(bayesianAverage([], mean)).toBeNull();
    expect(bayesianAverage([rating(5)], mean)).toBeNull();
    expect(roundAggregate(bayesianAverage([rating(5), rating(4), rating(3)], mean))?.toString()).toBe('4.13');
  });

  it('excludes hidden, removed, soft-deleted, and banned-author ratings', () => {
    const ratings = [
      rating(5), rating(4), rating(3),
      rating(1, { status: 'HIDDEN' }),
      rating(1, { status: 'REMOVED' }),
      rating(1, { deletedAt: new Date() }),
      rating(1, { raterStatus: 'BANNED' }),
    ];
    expect(roundAggregate(bayesianAverage(ratings, mean))?.toString()).toBe('4.13');
  });

  it('explicitly ranks a single 5.0 below fifty 4.8 ratings', () => {
    const single = bayesianEstimate([rating(5)], mean);
    const established = bayesianEstimate(Array.from({ length: 50 }, () => rating(4.8)), mean);
    expect(single.lt(established)).toBe(true);
    expect(bayesianAverage([rating(5)], mean)).toBeNull();
  });

  it('weights LATE at one half of an attendance and ignores unfinalized records', () => {
    const finalizedAt = new Date();
    const result = attendancePercentage([
      { status: 'ON_TIME', finalizedAt },
      { status: 'EXCUSED', finalizedAt },
      { status: 'LATE', finalizedAt },
      { status: 'NO_SHOW', finalizedAt },
    ]);
    expect(roundAggregate(result)?.toString()).toBe('62.5');
    expect(attendancePercentage([{ status: 'ON_TIME', finalizedAt: null }])).toBeNull();
  });
});
