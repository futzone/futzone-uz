import { describe, expect, it } from 'vitest';
import { ratingFormErrors, selectRatingFlowState } from '../src/lib/ratings';

const valid = { rateeId: '018f47a0-7b11-7cc2-8d00-0123456789ab', discipline: 1, punctuality: 2, fairPlay: 3, teamPlay: 4, overall: 5, comment: 'Good teammate' };

describe('rating form validation', () => {
  it('accepts 1..5 for all five criteria and a 500-character comment', () => {
    expect(ratingFormErrors({ ...valid, comment: 'x'.repeat(500) })).toEqual([]);
  });
  it.each(['discipline', 'punctuality', 'fairPlay', 'teamPlay', 'overall'] as const)('rejects %s outside 1..5', (criterion) => {
    expect(ratingFormErrors({ ...valid, [criterion]: 0 })).toContain(criterion);
    expect(ratingFormErrors({ ...valid, [criterion]: 6 })).toContain(criterion);
  });
  it('rejects comments above 500 characters', () => {
    expect(ratingFormErrors({ ...valid, comment: 'x'.repeat(501) })).toContain('comment');
  });
});

describe('rating flow state', () => {
  it('shows the CTA only during RATING_PENDING', () => {
    expect(selectRatingFlowState('RATING_PENDING', true)).toBe('rate');
    expect(selectRatingFlowState('COMPLETED', true)).toBe('closed');
    expect(selectRatingFlowState('ATTENDANCE_PENDING', true)).toBe('hidden');
    expect(selectRatingFlowState('RATING_PENDING', false)).toBe('hidden');
  });
});
