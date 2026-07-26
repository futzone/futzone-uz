export type ReminderNotificationType = 'MATCH_REMINDER_24H' | 'MATCH_REMINDER_2H';
export interface ReminderWindow { notificationType: ReminderNotificationType; fireAt: Date }

const HOUR_MS = 60 * 60_000;
const WINDOWS: ReadonlyArray<readonly [ReminderNotificationType, number]> = [
  ['MATCH_REMINDER_24H', 24],
  ['MATCH_REMINDER_2H', 2],
];

// The reminders to schedule for a match starting at `startsAt`, given the current time. A window
// whose fire time has already passed (match published/edited to within that window) is omitted.
export function reminderWindows(startsAt: Date, now: Date): ReminderWindow[] {
  return WINDOWS
    .map(([notificationType, hours]) => ({ notificationType, fireAt: new Date(startsAt.getTime() - hours * HOUR_MS) }))
    .filter((window) => window.fireAt.getTime() > now.getTime());
}
