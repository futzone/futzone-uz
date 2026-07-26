import { Prisma } from '../generated/prisma';

export const BADGE_CATALOG = [
  { code: 'RELIABLE_PLAYER', name: 'Reliable Player', description: 'At least 90% attendance over 10 matches' },
  { code: 'TEN_MATCHES', name: '10 Matches', description: 'Played 10 matches' },
  { code: 'FIFTY_MATCHES', name: '50 Matches', description: 'Played 50 matches' },
  { code: 'PERFECT_ATTENDANCE', name: 'Perfect Attendance', description: 'No no-shows over at least 15 matches' },
  { code: 'TRUSTED_ORGANIZER', name: 'Trusted Organizer', description: 'Organized at least 10 matches with under 10% cancelled' },
  { code: 'FAIR_PLAY', name: 'Fair Play', description: 'At least a 4.5 fair-play average over 10 ratings' },
] as const;

export type BadgeCode = typeof BADGE_CATALOG[number]['code'];

export type BadgeFacts = {
  matchesPlayed: number;
  matchesOrganized: number;
  cancelledOrganized: number;
  noShow: number;
  attendancePct: Prisma.Decimal | null;
  fairPlayAvg: Prisma.Decimal | null;
  fairPlayRatingCount: number;
};

export function earnedBadgeCodes(facts: BadgeFacts): BadgeCode[] {
  const earned: BadgeCode[] = [];
  if (facts.matchesPlayed >= 10 && facts.attendancePct?.gte(90)) earned.push('RELIABLE_PLAYER');
  if (facts.matchesPlayed >= 10) earned.push('TEN_MATCHES');
  if (facts.matchesPlayed >= 50) earned.push('FIFTY_MATCHES');
  if (facts.matchesPlayed >= 15 && facts.noShow === 0) earned.push('PERFECT_ATTENDANCE');
  if (
    facts.matchesOrganized >= 10
    && new Prisma.Decimal(facts.cancelledOrganized).div(facts.matchesOrganized).mul(100).lt(10)
  ) earned.push('TRUSTED_ORGANIZER');
  if (facts.fairPlayRatingCount >= 10 && facts.fairPlayAvg?.gte('4.5')) earned.push('FAIR_PLAY');
  return earned;
}

export function badgesAfterEvaluation(existing: readonly BadgeCode[], facts: BadgeFacts): BadgeCode[] {
  return [...new Set([...existing, ...earnedBadgeCodes(facts)])];
}
