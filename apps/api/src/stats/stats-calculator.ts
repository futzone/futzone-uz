import { Prisma } from '../generated/prisma';

export const BAYES_CONFIDENCE = new Prisma.Decimal(5);
export const MIN_RATINGS_FOR_SCORE = 3;

export type CountedRating = {
  overall: number;
  status: 'ACTIVE' | 'HIDDEN' | 'REMOVED';
  deletedAt: Date | null;
  raterStatus: 'ACTIVE' | 'WARNED' | 'SUSPENDED' | 'BANNED';
};

export type AttendanceEntry = {
  status: 'ON_TIME' | 'LATE' | 'NO_SHOW' | 'CANCELLED_EARLY' | 'EXCUSED' | 'REMOVED_BY_OWNER';
  finalizedAt: Date | null;
};

export function ratingsThatCount(ratings: readonly CountedRating[]): CountedRating[] {
  return ratings.filter((rating) => rating.status === 'ACTIVE' && rating.deletedAt === null && rating.raterStatus !== 'BANNED');
}

export function bayesianAverage(ratings: readonly CountedRating[], globalMean: Prisma.Decimal): Prisma.Decimal | null {
  const counted = ratingsThatCount(ratings);
  if (counted.length < MIN_RATINGS_FOR_SCORE) return null;
  return bayesianEstimate(counted, globalMean);
}

export function bayesianEstimate(ratings: readonly CountedRating[], globalMean: Prisma.Decimal): Prisma.Decimal {
  const counted = ratingsThatCount(ratings);
  const sum = counted.reduce((total, rating) => total.plus(rating.overall), new Prisma.Decimal(0));
  return BAYES_CONFIDENCE.mul(globalMean).plus(sum).div(BAYES_CONFIDENCE.plus(counted.length));
}

export function attendancePercentage(records: readonly AttendanceEntry[]): Prisma.Decimal | null {
  const finalized = records.filter((record) => record.finalizedAt !== null);
  if (finalized.length === 0) return null;
  const onTime = finalized.filter((record) => record.status === 'ON_TIME').length;
  const excused = finalized.filter((record) => record.status === 'EXCUSED').length;
  const late = finalized.filter((record) => record.status === 'LATE').length;
  return new Prisma.Decimal(onTime).plus(excused).plus(new Prisma.Decimal(late).mul('0.5')).div(finalized.length).mul(100);
}

// Persisted aggregates are rounded half-up to two decimal places. All inputs and
// intermediate arithmetic remain Prisma Decimal values; JavaScript floats are never used.
export function roundAggregate(value: Prisma.Decimal | null): Prisma.Decimal | null {
  return value?.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) ?? null;
}
