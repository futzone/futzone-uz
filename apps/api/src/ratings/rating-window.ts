const RATING_WINDOW_MS = 7 * 24 * 60 * 60_000;

export function matchFinishesAt(startsAt: Date, durationMin: number): Date {
  return new Date(startsAt.getTime() + durationMin * 60_000);
}

export function ratingWindowClosesAt(startsAt: Date, durationMin: number): Date {
  return new Date(matchFinishesAt(startsAt, durationMin).getTime() + RATING_WINDOW_MS);
}

export function isInsideRatingWindow(startsAt: Date, durationMin: number, now: Date): boolean {
  return now < ratingWindowClosesAt(startsAt, durationMin);
}
