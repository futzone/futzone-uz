import { z } from 'zod';
import { AttendanceStatusSchema, MatchStatusSchema, UserRoleSchema, UserStatusSchema } from '../enums.js';

// --- P5-05 Dashboard ---
export const AdminActivityByCitySchema = z.object({
  cityId: z.string().uuid(),
  city: z.string(),
  matches: z.number().int().nonnegative(),
});
export const AdminMetricsDailySchema = z.object({
  date: z.string(), // YYYY-MM-DD
  totalUsers: z.number().int().nonnegative(),
  newUsers: z.number().int().nonnegative(),
  activeUsers7d: z.number().int().nonnegative(),
  activeUsers30d: z.number().int().nonnegative(),
  dau: z.number().int().nonnegative(),
  wau: z.number().int().nonnegative(),
  matchesCreated: z.number().int().nonnegative(),
  matchesCompleted: z.number().int().nonnegative(),
  matchesCancelled: z.number().int().nonnegative(),
  attendancePct: z.number().min(0).max(100).nullable(),
  activityByCity: z.array(AdminActivityByCitySchema),
});
export type AdminMetricsDaily = z.infer<typeof AdminMetricsDailySchema>;

export const AdminDashboardResponseSchema = z.object({
  latest: AdminMetricsDailySchema.nullable(),
  series: z.array(AdminMetricsDailySchema),
});
export type AdminDashboardResponse = z.infer<typeof AdminDashboardResponseSchema>;

// --- P5-06 Users module ---
export const AdminUserSearchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminUserSearchQuery = z.infer<typeof AdminUserSearchQuerySchema>;

// Phone never leaves the backend in full (privacy rule); only the last 4 digits reach the admin UI.
export const AdminUserListItemSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phoneLast4: z.string(),
  role: UserRoleSchema,
  status: UserStatusSchema,
  suspendedUntil: z.string().datetime().nullable(),
  verified: z.boolean(),
  createdAt: z.string().datetime(),
});
export type AdminUserListItem = z.infer<typeof AdminUserListItemSchema>;

export const AdminUserListResponseSchema = z.object({
  items: z.array(AdminUserListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});
export type AdminUserListResponse = z.infer<typeof AdminUserListResponseSchema>;

export const AdminUserMatchSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  startsAt: z.string().datetime(),
  status: z.string(),
  role: z.string(),
});
export const AdminUserReportSchema = z.object({
  id: z.string().uuid(),
  ratingId: z.string().uuid(),
  reason: z.string(),
  createdAt: z.string().datetime(),
});
export const AdminUserDetailSchema = AdminUserListItemSchema.extend({
  bio: z.string().nullable(),
  cityName: z.string().nullable(),
  matchesPlayed: z.number().int().nonnegative(),
  matchesOrganized: z.number().int().nonnegative(),
  attendancePct: z.number().min(0).max(100).nullable(),
  ratingAvg: z.number().min(1).max(5).nullable(),
  ratingCount: z.number().int().nonnegative(),
  recentMatches: z.array(AdminUserMatchSchema),
  reportsAgainst: z.array(AdminUserReportSchema),
});
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;

// Every action requires a reason (audit + accountability).
const ReasonSchema = z.string().trim().min(1).max(500);
export const AdminWarnBodySchema = z.object({ reason: ReasonSchema, message: z.string().trim().min(1).max(1000) }).strict();
export type AdminWarnBody = z.infer<typeof AdminWarnBodySchema>;
export const AdminSuspendBodySchema = z.object({ reason: ReasonSchema, until: z.string().datetime() }).strict();
export type AdminSuspendBody = z.infer<typeof AdminSuspendBodySchema>;
export const AdminReasonBodySchema = z.object({ reason: ReasonSchema }).strict();
export type AdminReasonBody = z.infer<typeof AdminReasonBodySchema>;

export const AdminUserActionResponseSchema = z.object({
  id: z.string().uuid(),
  status: UserStatusSchema,
  role: UserRoleSchema,
  suspendedUntil: z.string().datetime().nullable(),
  verified: z.boolean(),
});
export type AdminUserActionResponse = z.infer<typeof AdminUserActionResponseSchema>;

// --- P5-09 Audit log viewer ---
export const AdminAuditQuerySchema = z.object({
  actorId: z.string().uuid().optional(),
  action: z.string().trim().max(100).optional(),
  targetType: z.string().trim().max(100).optional(),
  targetId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminAuditQuery = z.infer<typeof AdminAuditQuerySchema>;

export const AdminAuditItemSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid(),
  actorUsername: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().uuid(),
  reason: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});
export type AdminAuditItem = z.infer<typeof AdminAuditItemSchema>;

export const AdminAuditListResponseSchema = z.object({
  items: z.array(AdminAuditItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});
export type AdminAuditListResponse = z.infer<typeof AdminAuditListResponseSchema>;

// --- P5-07 Matches module ---
export const AdminMatchSearchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: MatchStatusSchema.optional(),
  flagged: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminMatchSearchQuery = z.infer<typeof AdminMatchSearchQuerySchema>;

export const AdminMatchListItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  status: MatchStatusSchema,
  startsAt: z.string().datetime(),
  cityName: z.string().nullable(),
  ownerUsername: z.string(),
  totalSlots: z.number().int().positive(),
  flagged: z.boolean(),
  createdAt: z.string().datetime(),
});
export type AdminMatchListItem = z.infer<typeof AdminMatchListItemSchema>;

export const AdminMatchListResponseSchema = z.object({
  items: z.array(AdminMatchListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});
export type AdminMatchListResponse = z.infer<typeof AdminMatchListResponseSchema>;

export const AdminMatchParticipantSchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.string(),
  status: z.string(),
  guestCount: z.number().int().nonnegative(),
});
export const AdminMatchDetailSchema = AdminMatchListItemSchema.extend({
  flaggedReason: z.string().nullable(),
  occupiedSlots: z.number().int().nonnegative(),
  durationMin: z.number().int().positive(),
  address: z.string().nullable(),
  fieldPriceUzs: z.number().int().nonnegative(),
  perPlayerFeeUzs: z.number().int().nonnegative(),
  participants: z.array(AdminMatchParticipantSchema),
  auditTrail: z.array(AdminAuditItemSchema),
});
export type AdminMatchDetail = z.infer<typeof AdminMatchDetailSchema>;

export const AdminFlagBodySchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export type AdminFlagBody = z.infer<typeof AdminFlagBodySchema>;
export const AdminMatchActionResponseSchema = z.object({
  id: z.string().uuid(),
  status: MatchStatusSchema,
  flagged: z.boolean(),
});
export type AdminMatchActionResponse = z.infer<typeof AdminMatchActionResponseSchema>;

// --- P5-08 Moderation queue ---
export const AdminModReportSchema = z.object({
  ratingId: z.string().uuid(),
  comment: z.string().nullable(),
  overall: z.number().int(),
  status: z.string(),
  reportCount: z.number().int().nonnegative(),
  reasons: z.array(z.string()),
  rateeUsername: z.string(),
  raterUsername: z.string(),
  createdAt: z.string().datetime(),
});
export const AdminModDisputeSchema = z.object({
  recordId: z.string().uuid(),
  matchId: z.string().uuid(),
  matchTitle: z.string(),
  participantUsername: z.string(),
  status: AttendanceStatusSchema,
  disputeNote: z.string().nullable(),
});
export const AdminModStadiumSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  cityName: z.string().nullable(),
  submittedByUsername: z.string(),
  createdAt: z.string().datetime(),
});
export const AdminModerationQueueSchema = z.object({
  reports: z.array(AdminModReportSchema),
  disputes: z.array(AdminModDisputeSchema),
  stadiums: z.array(AdminModStadiumSchema),
});
export type AdminModerationQueue = z.infer<typeof AdminModerationQueueSchema>;

export const AdminReportActionBodySchema = z.object({ action: z.enum(['hide', 'restore', 'delete']), reason: ReasonSchema }).strict();
export type AdminReportActionBody = z.infer<typeof AdminReportActionBodySchema>;
export const AdminDisputeResolveBodySchema = z.object({ status: AttendanceStatusSchema, reason: ReasonSchema }).strict();
export type AdminDisputeResolveBody = z.infer<typeof AdminDisputeResolveBodySchema>;
export const AdminStadiumDecisionBodySchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), reason: ReasonSchema }).strict();
export type AdminStadiumDecisionBody = z.infer<typeof AdminStadiumDecisionBodySchema>;
export const AdminModerationActionResponseSchema = z.object({ resolved: z.literal(true) });
export type AdminModerationActionResponse = z.infer<typeof AdminModerationActionResponseSchema>;
