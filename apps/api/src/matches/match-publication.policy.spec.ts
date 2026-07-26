import { publicMatchAvailability } from './match-publication.policy';

const match = { status: 'FINISHED' as const, startsAt: new Date('2026-01-01T10:00:00Z'), durationMin: 90 };

describe('public match retention', () => {
  it('keeps a finished match live until the exact 30-day boundary', () => {
    expect(publicMatchAvailability(match, new Date('2026-01-31T11:29:59.999Z'))).toBe('LIVE');
  });

  it('marks a finished match gone at the exact 30-day boundary', () => {
    expect(publicMatchAvailability(match, new Date('2026-01-31T11:30:00.000Z'))).toBe('GONE');
  });

  it('does not age out an upcoming public match', () => {
    expect(publicMatchAvailability({ ...match, status: 'PUBLISHED' }, new Date('2030-01-01T00:00:00Z'))).toBe('LIVE');
  });
});
