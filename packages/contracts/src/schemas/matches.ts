import { z } from 'zod';
import {
  AgeGroupSchema,
  JoinModeSchema,
  LevelSchema,
  MatchFormatSchema,
  MatchStatusSchema,
  PositionSchema,
  SurfaceSchema,
  ParticipantStatusSchema,
  InvitationStatusSchema,
} from '../enums.js';

const MatchFieldsSchema = z.object({
  title: z.string().trim().min(1).max(120),
  format: MatchFormatSchema,
  startsAt: z.string().datetime({ offset: true }),
  durationMin: z.number().int().min(30).max(360),
  cityId: z.string().uuid(),
  stadiumId: z.string().uuid().nullable().optional(),
  address: z.string().trim().min(1).max(300).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  fieldPriceUzs: z.number().int().nonnegative(),
  perPlayerFeeUzs: z.number().int().nonnegative(),
  surface: SurfaceSchema,
  level: LevelSchema,
  joinMode: JoinModeSchema,
  minRating: z.number().min(1).max(5).nullable().optional(),
  minAttendancePct: z.number().int().min(0).max(100).nullable().optional(),
  allowNewPlayers: z.boolean().default(true),
  neededPositions: z.array(PositionSchema).default([]),
  ageGroup: AgeGroupSchema.default('MIXED'),
  verifiedPhoneOnly: z.boolean().default(false),
});
export const CreateMatchBodySchema = MatchFieldsSchema.extend({
  ownerPlays: z.boolean(),
  ownerGuestCount: z.number().int().min(0).max(10),
})
  .strict()
  .superRefine((body, context) => {
    if (!body.stadiumId && (!body.address || body.latitude == null || body.longitude == null))
      context.addIssue({
        code: 'custom',
        message: 'A stadium or freeform address and coordinates are required',
      });
    if (!body.ownerPlays && body.ownerGuestCount !== 0)
      context.addIssue({ code: 'custom', message: 'Owner guests require ownerPlays' });
  });
export const UpdateMatchBodySchema = MatchFieldsSchema.partial()
  .extend({ totalSlots: z.number().int().positive().optional() })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' });
export const CancelMatchBodySchema = z
  .object({ reason: z.string().trim().min(1).max(500) })
  .strict();
export const JoinMatchBodySchema = z
  .object({
    guestCount: z.number().int().min(0).max(10),
    message: z.string().trim().max(500).optional(),
    invitationToken: z.string().min(32).max(200).optional(),
  })
  .strict();
export const InviteByUsernameBodySchema = z
  .object({ username: z.string().trim().regex(/^[a-z0-9_]{3,20}$/) })
  .strict();
export const AssignAssistantBodySchema = z.object({ userId: z.string().uuid() }).strict();
export const JoinWaitlistBodySchema = z
  .object({ guestCount: z.number().int().min(0).max(10) })
  .strict();
export const UpdateMyParticipationBodySchema = z
  .object({ guestCount: z.number().int().min(0).max(10) })
  .strict();
export const MatchParticipantSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['OWNER', 'ASSISTANT', 'PLAYER']),
  status: ParticipantStatusSchema,
  guestCount: z.number().int().nonnegative(),
  waitlistPosition: z.number().int().positive().nullable(),
  promotionExpiresAt: z.string().datetime().nullable(),
  joinedAt: z.string().datetime(),
  leftAt: z.string().datetime().nullable(),
});
export const JoinRequestSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),
  userId: z.string().uuid(),
  message: z.string().nullable(),
  guestCount: z.number().int().nonnegative(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN']),
  decidedById: z.string().uuid().nullable(),
  decidedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export const InvitationSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),
  inviterId: z.string().uuid(),
  inviteeId: z.string().uuid().nullable(),
  status: InvitationStatusSchema,
  expiresAt: z.string().datetime(),
});
export const ShareInvitationSchema = InvitationSchema.extend({
  token: z.string(),
  url: z.string().url(),
});
export const JoinRequestSummarySchema = z.object({
  attendancePercent: z.number().min(0).max(100).nullable(),
  lastFiveRatingAverage: z.number().min(1).max(5).nullable(),
  noShowCount: z.number().int().nonnegative().nullable(),
  displayRating: z.union([z.number().min(1).max(5), z.literal('New player')]),
  warning: z.boolean(),
});
export const JoinRequestWithSummarySchema = JoinRequestSchema.extend({
  requester: z.object({
    id: z.string().uuid(),
    username: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    avatarUrl: z.string().url().nullable(),
    position: PositionSchema.nullable(),
  }),
  summary: JoinRequestSummarySchema,
});
export const JoinRequestsResponseSchema = z.array(JoinRequestWithSummarySchema);
export const JoinMatchResponseSchema = z.union([
  z.object({ kind: z.literal('participant'), participant: MatchParticipantSchema }),
  z.object({ kind: z.literal('request'), request: JoinRequestSchema }),
]);
const QueryBooleanSchema = z.preprocess(
  (value) => value === 'true' ? true : value === 'false' ? false : value,
  z.boolean(),
);
const QueryIntegerSchema = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const QueryNumberSchema = (min: number, max: number) => z.coerce.number().min(min).max(max);
const MultiValueSchema = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(
  (value) => {
    const values = Array.isArray(value) ? value : [value];
    return values.flatMap((entry) => typeof entry === 'string' ? entry.split(',') : [entry]);
  },
  z.array(schema).min(1),
);

export const MatchSortSchema = z.enum([
  'soonest', 'nearest', 'newest', 'mostFreeSlots', 'organizerTrust', 'priceAsc', 'priceDesc',
]);
export const MatchDateShortcutSchema = z.enum(['today', 'tomorrow', 'week']);
export const MatchesQuerySchema = z.object({
  city: z.string().trim().min(1).optional(),
  stadium: z.string().trim().min(1).optional(),
  district: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  date: MatchDateShortcutSchema.optional(),
  format: MultiValueSchema(MatchFormatSchema).optional(),
  level: MultiValueSchema(LevelSchema).optional(),
  surface: MultiValueSchema(SurfaceSchema).optional(),
  minFreeSlots: QueryIntegerSchema(0, 100).optional(),
  onlyAvailable: QueryBooleanSchema.optional(),
  favoritesOnly: QueryBooleanSchema.optional(),
  joinMode: JoinModeSchema.optional(),
  priceMin: QueryIntegerSchema(0, 2_000_000_000).optional(),
  priceMax: QueryIntegerSchema(0, 2_000_000_000).optional(),
  startHourFrom: QueryIntegerSchema(0, 23).optional(),
  startHourTo: QueryIntegerSchema(0, 23).optional(),
  position: PositionSchema.optional(),
  nearLat: QueryNumberSchema(-90, 90).optional(),
  nearLng: QueryNumberSchema(-180, 180).optional(),
  radiusKm: QueryNumberSchema(0.1, 500).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  sort: MatchSortSchema.default('soonest'),
  cursor: z.string().min(1).max(2000).optional(),
  limit: QueryIntegerSchema(1, 100).default(20),
}).superRefine((query, context) => {
  if ((query.nearLat === undefined) !== (query.nearLng === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['nearLat'], message: 'nearLat and nearLng must be provided together' });
  }
  if (query.sort === 'nearest' && query.nearLat === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['sort'], message: 'sort=nearest requires nearLat and nearLng' });
  }
  if (query.radiusKm !== undefined && query.nearLat === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['radiusKm'], message: 'radiusKm requires nearLat and nearLng' });
  }
  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['dateTo'], message: 'dateTo must be after dateFrom' });
  }
  if (query.priceMin !== undefined && query.priceMax !== undefined && query.priceMin > query.priceMax) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['priceMax'], message: 'priceMax must be at least priceMin' });
  }
});
export const MatchSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  ownerId: z.string().uuid(),
  title: z.string(),
  format: MatchFormatSchema,
  totalSlots: z.number().int().positive(),
  occupiedSlots: z.number().int().nonnegative(),
  freeSlots: z.number().int().nonnegative(),
  startsAt: z.string().datetime(),
  durationMin: z.number().int(),
  cityId: z.string().uuid(),
  stadiumId: z.string().uuid().nullable(),
  address: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  fieldPriceUzs: z.number().int(),
  perPlayerFeeUzs: z.number().int(),
  surface: SurfaceSchema,
  level: LevelSchema,
  joinMode: JoinModeSchema,
  minRating: z.number().nullable(),
  minAttendancePct: z.number().int().nullable(),
  allowNewPlayers: z.boolean(),
  neededPositions: z.array(PositionSchema),
  ageGroup: AgeGroupSchema,
  verifiedPhoneOnly: z.boolean(),
  status: MatchStatusSchema,
  cancelledReason: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export const MatchSearchItemSchema = MatchSchema.extend({
  distanceKm: z.number().nonnegative().nullable(),
  organizerTrust: z.number().nullable(),
});
export const MatchesResponseSchema = z.object({
  items: z.array(MatchSearchItemSchema),
  nextCursor: z.string().nullable(),
});
export const PublicMatchParticipantSchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().url().nullable(),
  position: PositionSchema.nullable(),
  role: z.enum(['OWNER', 'ASSISTANT', 'PLAYER']),
  status: ParticipantStatusSchema,
  guestCount: z.number().int().nonnegative(),
});
export const PublicMatchDetailSchema = MatchSchema.extend({
  visibility: z.literal('PUBLIC'),
  city: z.object({ slug: z.string(), name: z.string() }),
  stadium: z.object({
    slug: z.string(),
    name: z.string(),
    address: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }).nullable(),
  participants: z.array(PublicMatchParticipantSchema),
});
export const InviteOnlyMatchShellSchema = z.object({
  visibility: z.literal('INVITE_ONLY_SHELL'),
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  format: MatchFormatSchema,
  startsAt: z.string().datetime(),
  joinMode: z.literal('INVITE_ONLY'),
  status: MatchStatusSchema,
  city: z.object({ slug: z.string(), name: z.string() }),
});
export const MatchDetailSchema = z.discriminatedUnion('visibility', [
  PublicMatchDetailSchema,
  InviteOnlyMatchShellSchema,
]);

export type CreateMatchBody = z.infer<typeof CreateMatchBodySchema>;
export type UpdateMatchBody = z.infer<typeof UpdateMatchBodySchema>;
export type CancelMatchBody = z.infer<typeof CancelMatchBodySchema>;
export type JoinMatchBody = z.infer<typeof JoinMatchBodySchema>;
export type JoinWaitlistBody = z.infer<typeof JoinWaitlistBodySchema>;
export type UpdateMyParticipationBody = z.infer<typeof UpdateMyParticipationBodySchema>;
export type MatchParticipant = z.infer<typeof MatchParticipantSchema>;
export type JoinRequest = z.infer<typeof JoinRequestSchema>;
export type JoinMatchResponse = z.infer<typeof JoinMatchResponseSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type MatchSearchQuery = z.infer<typeof MatchesQuerySchema>;
export type MatchSearchItem = z.infer<typeof MatchSearchItemSchema>;
export type MatchesResponse = z.infer<typeof MatchesResponseSchema>;
export type MatchSort = z.infer<typeof MatchSortSchema>;
export type MatchDetail = z.infer<typeof MatchDetailSchema>;
export type PublicMatchDetail = z.infer<typeof PublicMatchDetailSchema>;
export type InviteOnlyMatchShell = z.infer<typeof InviteOnlyMatchShellSchema>;
export type PublicMatchParticipant = z.infer<typeof PublicMatchParticipantSchema>;
export type InviteByUsernameBody = z.infer<typeof InviteByUsernameBodySchema>;
export type AssignAssistantBody = z.infer<typeof AssignAssistantBodySchema>;
export type Invitation = z.infer<typeof InvitationSchema>;
export type ShareInvitation = z.infer<typeof ShareInvitationSchema>;
export type JoinRequestSummary = z.infer<typeof JoinRequestSummarySchema>;
export type JoinRequestWithSummary = z.infer<typeof JoinRequestWithSummarySchema>;
