import type { AttendanceStatus } from '@futzone/contracts';

const DISPUTE_WINDOW_MS = 72 * 60 * 60_000;

export function shouldCreateEarlyCancellation(startsAt: Date, leftAt: Date, earlyCancelHours: number): boolean {
  const cutoff = new Date(startsAt.getTime() - earlyCancelHours * 60 * 60_000);
  // ADR-030: equality is on the non-penalizing side; only a later departure gets a record.
  return leftAt > cutoff;
}

export function isDisputeWithinWindow(markedAt: Date, now: Date): boolean {
  return now.getTime() <= markedAt.getTime() + DISPUTE_WINDOW_MS;
}

export function attendanceFinalizesAt(markedAt: Date): Date {
  return new Date(markedAt.getTime() + DISPUTE_WINDOW_MS);
}

export function isFinalizedRecordEligibleForStats(record: { finalizedAt: Date | null; status: AttendanceStatus }): boolean {
  return record.finalizedAt !== null;
}
