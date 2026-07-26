import type { PublicProfile as PublicProfileData } from '@futzone/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PublicProfile, type PublicProfileLabels } from '../src/components/public-profile';

vi.mock('../src/components/own-profile-hints', () => ({ OwnProfileHints: () => null }));
vi.mock('../src/components/report-rating-button', () => ({ ReportRatingButton: () => null }));
vi.mock('../src/i18n/navigation', () => ({ Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const labels: PublicProfileLabels = {
  verified: 'Verified', newPlayer: 'New player', notSet: 'Not set', joined: 'Joined', position: 'Position',
  city: 'City', badges: 'Badges', matchesPlayed: 'Matches', matchesOrganized: 'Organized', attendance: 'Attendance',
  rating: 'Rating', ratingCount: '{count} ratings', breakdown: 'Attendance breakdown', onTime: 'On time',
  late: 'Late', noShow: 'No-show', cancelledEarly: 'Cancelled early', recentMatches: 'Recent matches',
  noRecentMatches: 'None', comments: 'Comments', noComments: 'No comments', previous: 'Previous', next: 'Next',
  ownHint: 'Pending ratings',
  badgeCatalog: {
    RELIABLE_PLAYER: { name: 'Reliable player', description: 'Reliable attendance' },
    TEN_MATCHES: { name: '10 matches', description: 'Played 10 matches' },
    FIFTY_MATCHES: { name: '50 matches', description: 'Played 50 matches' },
    PERFECT_ATTENDANCE: { name: 'Perfect attendance', description: 'No no-shows' },
    TRUSTED_ORGANIZER: { name: 'Trusted organizer', description: 'Organized reliably' },
    FAIR_PLAY: { name: 'Fair play', description: 'High fair-play rating' },
  },
};
const profile: PublicProfileData = {
  avatarUrl: null, firstName: 'Aziz', lastName: 'Karimov', username: 'aziz', bio: 'Midfielder',
  city: { id: '018f47a0-7b11-7cc2-8d00-0123456789ab', slug: 'tashkent', name: 'Tashkent' },
  position: 'MID', joinedAt: '2026-01-01T00:00:00.000Z', verified: true,
  stats: { matchesPlayed: 12, matchesOrganized: 2, onTime: 8, late: 2, noShow: 1, cancelledEarly: 1, excused: 0, attendancePct: 75, bayesAvg: null, ratingCount: 2, lastFiveAvg: 4 },
  badges: ['FAIR_PLAY'], recentMatches: [], comments: { items: [], page: 1, pageSize: 5, total: 0, totalPages: 0 },
};

const render = (value: PublicProfileData) => renderToStaticMarkup(<PublicProfile profile={value} labels={labels} joinedDate="January 1, 2026" positionLabel="Midfielder" />);

describe('public profile markup', () => {
  it('omits phone and renders New player when Bayesian average is null', () => {
    const markup = render(profile); expect(markup).toContain('New player'); expect(markup).not.toContain('+998'); expect(markup.toLowerCase()).not.toContain('phone');
  });
  it('renders a number only at three or more ratings', () => {
    expect(render({ ...profile, stats: { ...profile.stats, ratingCount: 3, bayesAvg: 4.61 } })).toContain('4.61');
    expect(render({ ...profile, stats: { ...profile.stats, ratingCount: 2, bayesAvg: 4.99 } })).not.toContain('4.99');
  });
  it('renders every required attendance status', () => {
    const markup = render(profile);
    for (const value of ['On time', 'Late', 'No-show', 'Cancelled early']) expect(markup).toContain(value);
    for (const value of ['8', '2', '1']) expect(markup).toContain(value);
  });
  it('renders localized badge content without exposing its enum code', () => {
    const markup = render(profile);
    expect(markup).toContain('Fair play');
    expect(markup).toContain('High fair-play rating');
    expect(markup).not.toContain('FAIR_PLAY');
  });
});
