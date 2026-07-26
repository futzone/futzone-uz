export const DEFAULT_RESEND_SECONDS = 60;
export function resendSecondsRemaining(availableAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((availableAtMs - nowMs) / 1000));
}
export function retryAfterSeconds(details: unknown): number {
  if (typeof details === 'object' && details !== null && 'retryAfterSec' in details) {
    const value = (details as { retryAfterSec?: unknown }).retryAfterSec;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.ceil(value);
  }
  return DEFAULT_RESEND_SECONDS;
}
