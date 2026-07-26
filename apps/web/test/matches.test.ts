import { describe, expect, it } from 'vitest';
import { guestLabel, normalizeMapCoordinates, occupancyPercent, selectMatchCta, suggestPerPlayerFee, tashkentLocalToUtc, validateWizardStep, type WizardValues } from '../src/lib/matches';

const values: WizardValues = {
  title: 'Evening football', format: 'F5', level: 'AMATEUR', surface: 'ARTIFICIAL_GRASS',
  date: '2026-08-01', time: '19:00', cityId: 'city', stadiumId: 'stadium', address: '',
  latitude: '', longitude: '', durationMin: '90', fieldPriceUzs: '1000000', perPlayerFeeUzs: '100000',
  joinMode: 'AUTO', minRating: '', minAttendancePct: '', allowNewPlayers: true,
  ageGroup: 'MIXED', neededPositions: [],
  verifiedPhoneOnly: false, ownerPlays: true, ownerGuestCount: '0',
};

describe('match creation wizard rules', () => {
  it('validates every step and keeps money integral', () => {
    expect(validateWizardStep('basics', { ...values, title: '' })).toEqual(['basics']);
    expect(validateWizardStep('venue', { ...values, stadiumId: '', address: '' })).toContain('location');
    expect(validateWizardStep('money', { ...values, fieldPriceUzs: '10.5' })).toEqual(['money']);
    expect(validateWizardStep('rules', { ...values, ownerGuestCount: 'x' })).toEqual(['rules']);
  });
  it('suggests a whole UZS fee and converts Tashkent time to UTC', () => {
    expect(suggestPerPlayerFee(1_000_001, 10)).toBe(100_001);
    expect(tashkentLocalToUtc('2026-08-01', '19:00')).toBe('2026-08-01T14:00:00.000Z');
  });
  it('writes valid map coordinates in the same format as manual coordinate inputs', () => {
    expect(normalizeMapCoordinates([41.31108123, 69.27972291])).toEqual({ latitude: '41.311081', longitude: '69.279723' });
    expect(normalizeMapCoordinates([91, 69])).toBeNull();
  });
  it('accepts manual coordinates when the map is unavailable', () => {
    expect(validateWizardStep('venue', { ...values, stadiumId: '', address: 'Chilonzor', latitude: '41.2775', longitude: '69.2034' })).toEqual([]);
    expect(validateWizardStep('venue', { ...values, stadiumId: '', address: 'Chilonzor', latitude: '999', longitude: '69.2034' })).toContain('location');
  });
  it('validates reputation requirement ranges before submission', () => {
    expect(validateWizardStep('rules', { ...values, minRating: '5.1' })).toEqual(['rules']);
    expect(validateWizardStep('rules', { ...values, minAttendancePct: '101' })).toEqual(['rules']);
  });
});

describe('match presentation rules', () => {
  it('calculates bounded occupancy', () => {
    expect(occupancyPercent({ occupiedSlots: 5, totalSlots: 10 })).toBe(50);
    expect(occupancyPercent({ occupiedSlots: 12, totalSlots: 10 })).toBe(100);
  });
  it.each([
    [{ status: 'PUBLISHED', joinMode: 'AUTO', freeSlots: 1 }, 'join'],
    [{ status: 'PUBLISHED', joinMode: 'MANUAL', freeSlots: 1 }, 'request'],
    [{ status: 'FULL', joinMode: 'AUTO', freeSlots: 0 }, 'waitlist'],
    [{ status: 'PUBLISHED', joinMode: 'INVITE_ONLY', freeSlots: 1 }, 'inviteOnly'],
    [{ status: 'CANCELLED', joinMode: 'AUTO', freeSlots: 1 }, 'cancelled'],
    [{ status: 'PUBLISHED', joinMode: 'AUTO', freeSlots: 1, viewerStatus: 'PENDING_CONFIRMATION' }, 'confirm'],
    [{ status: 'PUBLISHED', joinMode: 'AUTO', freeSlots: 1, viewerStatus: 'CONFIRMED' }, 'leave'],
  ] as const)('selects contextual CTA %#', (input, expected) => expect(selectMatchCta(input)).toBe(expected));
  it('renders guest responsibility data as +N with username inputs', () => {
    expect(guestLabel(2, 'aziz')).toEqual({ count: 2, username: 'aziz' });
    expect(guestLabel(0, 'aziz')).toBeNull();
  });
});
