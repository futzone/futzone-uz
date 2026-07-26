import { z } from 'zod';
import { AttendanceStatusSchema, DisputeStatusSchema, NotificationTypeSchema } from '../enums.js';

// Per-type payload schemas. The DB column `Notification.type` stays a String (no enum migration
// over historical rows); these validate the payload at the `notify()` boundary and give the
// in-app centre enough structured data to render localized templates at display time (P5-02).
export const NotificationPayloadSchemas = {
  JOIN_REQUEST_RECEIVED: z.object({ requestId: z.string().uuid(), requesterId: z.string().uuid() }).strict(),
  JOIN_APPROVED: z.object({}).strict(),
  JOIN_REJECTED: z.object({}).strict(),
  MATCH_INVITE: z.object({ invitationId: z.string().uuid(), inviterId: z.string().uuid() }).strict(),
  WAITLIST_PROMOTED: z.object({ expiresAt: z.string().datetime() }).strict(),
  MATCH_UPDATED: z.object({ scheduleChanged: z.boolean(), stadiumChanged: z.boolean() }).strict(),
  MATCH_CANCELLED: z.object({ reason: z.string().nullable().optional() }).strict(),
  MATCH_REMINDER_24H: z.object({}).strict(),
  MATCH_REMINDER_2H: z.object({}).strict(),
  ATTENDANCE_MARKED: z.object({ recordId: z.string().uuid(), status: AttendanceStatusSchema }).strict(),
  ATTENDANCE_DISPUTE_RESOLVED: z.object({ recordId: z.string().uuid(), disputeStatus: DisputeStatusSchema }).strict(),
  RATING_WINDOW_OPEN: z.object({}).strict(),
  NEW_RATING_RECEIVED: z.object({ ratingId: z.string().uuid() }).strict(),
  REPORT_RESOLVED: z.object({ reportId: z.string().uuid() }).strict(),
  ACCOUNT_WARNING: z.object({ message: z.string().min(1) }).strict(),
} as const;

export type NotificationPayloadMap = {
  [K in keyof typeof NotificationPayloadSchemas]: z.infer<(typeof NotificationPayloadSchemas)[K]>;
};

// Wire shape of a notification. `payload` is a per-type object narrowed by `type` via
// NotificationPayloadMap on the client at render time.
export const NotificationSchema = z.object({
  id: z.string().uuid(),
  type: NotificationTypeSchema,
  matchId: z.string().uuid().nullable(),
  payload: z.record(z.string(), z.unknown()),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type Notification = z.infer<typeof NotificationSchema>;

// --- P5-02 in-app centre (list, unread count, mark-read, SSE) ---
export const NotificationListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;

export const NotificationListResponseSchema = z.object({
  items: z.array(NotificationSchema),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.string().uuid().nullable(),
});
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;

export const UnreadCountResponseSchema = z.object({ unreadCount: z.number().int().nonnegative() });
export type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>;

// One SSE frame: the freshly delivered notification plus the recipient's current unread total.
export const NotificationStreamEventSchema = z.object({
  notification: NotificationSchema,
  unreadCount: z.number().int().nonnegative(),
});
export type NotificationStreamEvent = z.infer<typeof NotificationStreamEventSchema>;

// In-app delivery is always on; push is opt-out per type. A missing entry means push enabled.
export const NotificationChannelFlagsSchema = z.object({ push: z.boolean() }).strict();
export const NotificationPreferenceSchema = z.object({
  perTypeChannelFlags: z.record(NotificationTypeSchema, NotificationChannelFlagsSchema),
});
export type NotificationPreference = z.infer<typeof NotificationPreferenceSchema>;

export const UpdateNotificationPreferenceBodySchema = z.object({
  perTypeChannelFlags: z.record(NotificationTypeSchema, NotificationChannelFlagsSchema),
}).strict();
export type UpdateNotificationPreferenceBody = z.infer<typeof UpdateNotificationPreferenceBodySchema>;

// --- P5-03 Web Push (VAPID) ---
export const PushSubscriptionBodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }).strict(),
  userAgent: z.string().max(512).optional(),
}).strict();
export type PushSubscriptionBody = z.infer<typeof PushSubscriptionBodySchema>;

export const PushUnsubscribeBodySchema = z.object({ endpoint: z.string().url() }).strict();
export type PushUnsubscribeBody = z.infer<typeof PushUnsubscribeBodySchema>;

export const PushSubscriptionMutationResponseSchema = z.object({ subscribed: z.boolean() });
export type PushSubscriptionMutationResponse = z.infer<typeof PushSubscriptionMutationResponseSchema>;

export const VapidPublicKeyResponseSchema = z.object({ publicKey: z.string().nullable() });
export type VapidPublicKeyResponse = z.infer<typeof VapidPublicKeyResponseSchema>;
