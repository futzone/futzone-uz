import { AppException } from '../common/errors/app.exception';
import { USERNAME_CHANGE_INTERVAL_MS, UsernameChangePolicy } from './username-change.policy';

describe('UsernameChangePolicy', () => {
  const policy = new UsernameChangePolicy();
  const changedAt = new Date('2026-01-01T00:00:00.000Z');
  it('allows a change at exactly 30 elapsed days', () => {
    expect(() => policy.assertAllowed(changedAt, new Date(changedAt.getTime() + USERNAME_CHANGE_INTERVAL_MS))).not.toThrow();
  });
  it('rejects anything less than 30 elapsed days with the UTC next date', () => {
    try { policy.assertAllowed(changedAt, new Date(changedAt.getTime() + USERNAME_CHANGE_INTERVAL_MS - 1)); throw new Error('Expected rejection'); }
    catch (error: unknown) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).code).toBe('USERNAME_CHANGE_TOO_SOON');
      expect((error as AppException).details).toEqual({ nextAllowedAt: '2026-01-31T00:00:00.000Z' });
    }
  });
});
