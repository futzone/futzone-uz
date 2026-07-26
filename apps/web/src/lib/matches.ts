import type { AgeGroup, JoinMode, Match, MatchFormat, MatchStatus, ParticipantStatus, Position } from '@futzone/contracts';

export const FORMAT_SLOTS: Readonly<Record<MatchFormat, number>> = {
  F5: 10, F6: 12, F7: 14, F8: 16, F9: 18, F11: 22,
};

export function suggestPerPlayerFee(fieldPriceUzs: number, totalSlots: number): number {
  return totalSlots > 0 ? Math.ceil(fieldPriceUzs / totalSlots) : 0;
}

export type WizardStep = 'basics' | 'venue' | 'money' | 'rules' | 'review';
export type WizardValues = {
  title: string; format: MatchFormat; level: string; surface: string;
  date: string; time: string; cityId: string; stadiumId: string; address: string;
  latitude: string; longitude: string; durationMin: string;
  fieldPriceUzs: string; perPlayerFeeUzs: string; joinMode: JoinMode;
  minRating: string; minAttendancePct: string; allowNewPlayers: boolean;
  ageGroup: AgeGroup; neededPositions: Position[];
  verifiedPhoneOnly: boolean; ownerPlays: boolean; ownerGuestCount: string;
};

export function normalizeMapCoordinates(coordinates: readonly number[]): { latitude: string; longitude: string } | null {
  const [latitude, longitude] = coordinates;
  if (latitude === undefined || longitude === undefined || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) };
}

export function validateWizardStep(step: WizardStep, values: WizardValues): string[] {
  const errors: string[] = [];
  if (step === 'basics' && (!values.title.trim() || !values.format || !values.level || !values.surface)) errors.push('basics');
  if (step === 'venue') {
    if (!values.date || !values.time || !values.cityId) errors.push('schedule');
    if (!values.stadiumId && (!values.address.trim() || normalizeMapCoordinates([Number(values.latitude), Number(values.longitude)]) === null)) errors.push('location');
  }
  if (step === 'money' && [values.fieldPriceUzs, values.perPlayerFeeUzs].some((value) => !/^\d+$/.test(value))) errors.push('money');
  if (step === 'rules') {
    const rating = values.minRating === '' ? null : Number(values.minRating);
    const attendance = values.minAttendancePct === '' ? null : Number(values.minAttendancePct);
    if (
      (values.ownerPlays && !/^\d+$/.test(values.ownerGuestCount))
      || (rating !== null && (!Number.isFinite(rating) || rating < 1 || rating > 5))
      || (attendance !== null && (!Number.isInteger(attendance) || attendance < 0 || attendance > 100))
    ) errors.push('rules');
  }
  return errors;
}

export type MatchCta =
  | 'join' | 'request' | 'waitlist' | 'confirm' | 'leave' | 'full' | 'inviteOnly' | 'cancelled' | 'unavailable';

export function selectMatchCta(input: {
  status: MatchStatus; joinMode: JoinMode; freeSlots: number; viewerStatus?: ParticipantStatus | null;
}): MatchCta {
  if (input.status === 'CANCELLED') return 'cancelled';
  if (input.viewerStatus === 'PENDING_CONFIRMATION') return 'confirm';
  if (input.viewerStatus === 'CONFIRMED' || input.viewerStatus === 'WAITLISTED') return 'leave';
  if (input.joinMode === 'INVITE_ONLY') return 'inviteOnly';
  if (input.status === 'FULL' || input.freeSlots === 0) return 'waitlist';
  if (input.status !== 'PUBLISHED') return 'unavailable';
  return input.joinMode === 'MANUAL' ? 'request' : 'join';
}

export function occupancyPercent(match: Pick<Match, 'occupiedSlots' | 'totalSlots'>): number {
  return Math.min(100, Math.max(0, Math.round((match.occupiedSlots / match.totalSlots) * 100)));
}

export function guestLabel(count: number, username: string): { count: number; username: string } | null {
  return count > 0 ? { count, username } : null;
}

export function tashkentLocalToUtc(date: string, time: string): string {
  if (!date || !time) return '';
  const value = new Date(`${date}T${time}:00+05:00`);
  return Number.isNaN(value.getTime()) ? '' : value.toISOString();
}
