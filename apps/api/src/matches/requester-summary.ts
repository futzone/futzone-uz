import type { JoinRequestSummary } from '@futzone/contracts';

export interface RequesterStats {
  attendancePercent: number | null;
  lastFiveRatingAverage: number | null;
  noShowCount: number | null;
  ratingsCount: number | null;
}

export function buildRequesterSummary(stats: RequesterStats): JoinRequestSummary {
  const displayRating =
    stats.ratingsCount !== null &&
    stats.ratingsCount >= 3 &&
    stats.lastFiveRatingAverage !== null
      ? stats.lastFiveRatingAverage
      : 'New player';
  return {
    attendancePercent: stats.attendancePercent,
    lastFiveRatingAverage: stats.lastFiveRatingAverage,
    noShowCount: stats.noShowCount,
    displayRating,
    warning:
      (stats.attendancePercent !== null && stats.attendancePercent < 70) ||
      (stats.lastFiveRatingAverage !== null && stats.lastFiveRatingAverage < 3),
  };
}
