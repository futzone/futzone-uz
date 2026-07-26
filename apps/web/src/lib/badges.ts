export const BADGE_CODES = [
  'RELIABLE_PLAYER',
  'TEN_MATCHES',
  'FIFTY_MATCHES',
  'PERFECT_ATTENDANCE',
  'TRUSTED_ORGANIZER',
  'FAIR_PLAY',
] as const;

export type BadgeCode = (typeof BADGE_CODES)[number];

export function isBadgeCode(value: string): value is BadgeCode {
  return BADGE_CODES.some((code) => code === value);
}
