import type { PublicProfile } from '@futzone/contracts';

export function isNewPlayer(profile: Pick<PublicProfile, 'stats'>): boolean {
  return profile.stats.ratingCount < 3 || profile.stats.bayesAvg === null;
}

export function publicProfileText(profile: PublicProfile, newPlayerLabel: string): string {
  return [profile.firstName, profile.lastName, profile.username, profile.bio, profile.city?.name, profile.position, isNewPlayer(profile) ? newPlayerLabel : profile.stats.bayesAvg?.toFixed(2), ...profile.badges]
    .filter((value): value is string => typeof value === 'string').join(' ');
}
