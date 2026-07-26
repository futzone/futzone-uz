import type { MatchStatus } from '../generated/prisma';

export const FINISHED_MATCH_RETENTION_DAYS = 30;
const FINISHED_STATUSES: ReadonlySet<MatchStatus> = new Set([
  'FINISHED',
  'ATTENDANCE_PENDING',
  'RATING_PENDING',
  'COMPLETED',
]);

export type PublicMatchAvailability = 'LIVE' | 'GONE';

export function publicMatchAvailability(
  match: { status: MatchStatus; startsAt: Date; durationMin: number },
  now = new Date(),
): PublicMatchAvailability {
  if (!FINISHED_STATUSES.has(match.status)) return 'LIVE';
  const finishedAt = match.startsAt.getTime() + match.durationMin * 60_000;
  const expiresAt = finishedAt + FINISHED_MATCH_RETENTION_DAYS * 86_400_000;
  return now.getTime() < expiresAt ? 'LIVE' : 'GONE';
}

export function isFinishedMatch(status: MatchStatus): boolean {
  return FINISHED_STATUSES.has(status);
}
