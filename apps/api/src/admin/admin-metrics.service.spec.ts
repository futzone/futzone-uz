import { startOfUtcDay } from './admin-metrics.service';

describe('startOfUtcDay', () => {
  it('truncates to midnight UTC regardless of the time of day', () => {
    expect(startOfUtcDay(new Date('2026-07-26T18:43:12.500Z')).toISOString()).toBe('2026-07-26T00:00:00.000Z');
    expect(startOfUtcDay(new Date('2026-07-26T00:00:00.000Z')).toISOString()).toBe('2026-07-26T00:00:00.000Z');
  });
});
