import { Prisma } from '../generated/prisma';
import { badgesAfterEvaluation, earnedBadgeCodes, type BadgeFacts } from './badge-rules';

const facts = (overrides: Partial<BadgeFacts>): BadgeFacts => ({
  matchesPlayed: 0,
  matchesOrganized: 0,
  cancelledOrganized: 0,
  noShow: 1,
  attendancePct: null,
  fairPlayAvg: null,
  fairPlayRatingCount: 0,
  ...overrides,
});

describe('badge rules', () => {
  it.each([
    ['RELIABLE_PLAYER', facts({ matchesPlayed: 10, attendancePct: new Prisma.Decimal(90) }), facts({ matchesPlayed: 10, attendancePct: new Prisma.Decimal('89.99') })],
    ['TEN_MATCHES', facts({ matchesPlayed: 10 }), facts({ matchesPlayed: 9 })],
    ['FIFTY_MATCHES', facts({ matchesPlayed: 50 }), facts({ matchesPlayed: 49 })],
    ['PERFECT_ATTENDANCE', facts({ matchesPlayed: 15, noShow: 0 }), facts({ matchesPlayed: 14, noShow: 0 })],
    ['TRUSTED_ORGANIZER', facts({ matchesOrganized: 10, cancelledOrganized: 0 }), facts({ matchesOrganized: 10, cancelledOrganized: 1 })],
    ['FAIR_PLAY', facts({ fairPlayRatingCount: 10, fairPlayAvg: new Prisma.Decimal('4.5') }), facts({ fairPlayRatingCount: 10, fairPlayAvg: new Prisma.Decimal('4.49') })],
  ] as const)('%s awards at its threshold and not just below', (code, atThreshold, below) => {
    expect(earnedBadgeCodes(atThreshold)).toContain(code);
    expect(earnedBadgeCodes(below)).not.toContain(code);
  });

  it('never revokes an existing badge after stats drop', () => {
    expect(badgesAfterEvaluation(['RELIABLE_PLAYER'], facts({ matchesPlayed: 1, attendancePct: new Prisma.Decimal(0) })))
      .toContain('RELIABLE_PLAYER');
  });

  it('requires every conjunct of the multi-threshold rules', () => {
    expect(earnedBadgeCodes(facts({ matchesPlayed: 9, attendancePct: new Prisma.Decimal(90) })))
      .not.toContain('RELIABLE_PLAYER');
    expect(earnedBadgeCodes(facts({ matchesPlayed: 15, noShow: 1 })))
      .not.toContain('PERFECT_ATTENDANCE');
    expect(earnedBadgeCodes(facts({ fairPlayRatingCount: 9, fairPlayAvg: new Prisma.Decimal('4.5') })))
      .not.toContain('FAIR_PLAY');
    expect(earnedBadgeCodes(facts({ matchesOrganized: 9, cancelledOrganized: 0 })))
      .not.toContain('TRUSTED_ORGANIZER');
  });
});
