export const QUEUE_NAMES = {
  AVATAR_PROCESSING: 'avatar-processing',
  MATCH_STATE_TRANSITIONS: 'match-state-transitions',
  REMINDERS: 'reminders',
  NOTIFICATIONS: 'notifications',
  STATS: 'stats',
  ADMIN_METRICS: 'admin-metrics',
} as const;

export const JOB_NAMES = {
  PROCESS_AVATAR: 'process-avatar',
  TRANSITION_MATCH_STATE: 'transition-match-state',
  SEND_MATCH_REMINDER: 'send-match-reminder',
  DELIVER_NOTIFICATION: 'deliver-notification',
  MATCH_START: 'match.start',
  MATCH_FINISH: 'match.finish',
  WAITLIST_PROMOTION_EXPIRE: 'match.waitlist-promotion-expire',
  ATTENDANCE_FALLBACK: 'attendance.fallback',
  ATTENDANCE_FINALIZE: 'attendance.finalize',
  RATING_WINDOW_CLOSE: 'rating.window-close',
  ATTENDANCE_FINALIZED: 'attendance.finalized',
  RATING_CHANGED: 'rating.changed',
  STATS_RECONCILE: 'stats.reconcile',
  ADMIN_METRICS_AGGREGATE: 'admin-metrics.aggregate',
} as const;

export interface ProcessAvatarJobPayload { userId: string; objectKey: string; processedKey: string }
export interface TransitionMatchStateJobPayload { matchId: string; expectedStatus: string }
export interface MatchTransitionJobPayload { matchId: string }
export interface WaitlistPromotionExpiryJobPayload { matchId: string; participantId: string; expiresAt: string }
export interface AttendanceFallbackJobPayload { matchId: string }
export interface AttendanceFinalizeJobPayload { recordId: string }
export interface RatingWindowCloseJobPayload { matchId: string }
export interface StatsUserJobPayload { userId: string }
export interface StatsReconcileJobPayload { refreshGlobalMean: boolean }
export interface SendMatchReminderJobPayload { matchId: string; scheduledFor: string; notificationType: 'MATCH_REMINDER_24H' | 'MATCH_REMINDER_2H' }
export interface DeliverNotificationJobPayload { notificationId: string; userId: string }

export interface JobPayloads {
  [JOB_NAMES.PROCESS_AVATAR]: ProcessAvatarJobPayload;
  [JOB_NAMES.TRANSITION_MATCH_STATE]: TransitionMatchStateJobPayload;
  [JOB_NAMES.SEND_MATCH_REMINDER]: SendMatchReminderJobPayload;
  [JOB_NAMES.DELIVER_NOTIFICATION]: DeliverNotificationJobPayload;
  [JOB_NAMES.MATCH_START]: MatchTransitionJobPayload;
  [JOB_NAMES.MATCH_FINISH]: MatchTransitionJobPayload;
  [JOB_NAMES.WAITLIST_PROMOTION_EXPIRE]: WaitlistPromotionExpiryJobPayload;
  [JOB_NAMES.ATTENDANCE_FALLBACK]: AttendanceFallbackJobPayload;
  [JOB_NAMES.ATTENDANCE_FINALIZE]: AttendanceFinalizeJobPayload;
  [JOB_NAMES.RATING_WINDOW_CLOSE]: RatingWindowCloseJobPayload;
  [JOB_NAMES.ATTENDANCE_FINALIZED]: StatsUserJobPayload;
  [JOB_NAMES.RATING_CHANGED]: StatsUserJobPayload;
  [JOB_NAMES.STATS_RECONCILE]: StatsReconcileJobPayload;
}
