import { reminderWindows } from './reminder-schedule';

const HOUR = 60 * 60_000;
const now = new Date('2026-07-26T12:00:00.000Z');

describe('reminderWindows', () => {
  it('schedules both the 24h and 2h reminders for a match comfortably in the future', () => {
    const windows = reminderWindows(new Date(now.getTime() + 48 * HOUR), now);
    expect(windows.map((w) => w.notificationType)).toEqual(['MATCH_REMINDER_24H', 'MATCH_REMINDER_2H']);
    expect(windows[0]!.fireAt.toISOString()).toBe(new Date(now.getTime() + 24 * HOUR).toISOString());
    expect(windows[1]!.fireAt.toISOString()).toBe(new Date(now.getTime() + 46 * HOUR).toISOString());
  });

  it('drops the 24h reminder when the match starts in under a day', () => {
    const windows = reminderWindows(new Date(now.getTime() + 3 * HOUR), now);
    expect(windows.map((w) => w.notificationType)).toEqual(['MATCH_REMINDER_2H']);
  });

  it('schedules nothing when the match starts within two hours', () => {
    expect(reminderWindows(new Date(now.getTime() + 1 * HOUR), now)).toEqual([]);
  });

  it('keeps the 24h reminder that is only just still in the future', () => {
    const windows = reminderWindows(new Date(now.getTime() + 25 * HOUR), now);
    expect(windows.map((w) => w.notificationType)).toEqual(['MATCH_REMINDER_24H', 'MATCH_REMINDER_2H']);
  });
});
