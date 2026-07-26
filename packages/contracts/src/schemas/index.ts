// Per-domain request and response schemas land in this namespace as features are implemented.
export {};
import { z } from 'zod';
import { LocaleSchema, MatchStatusSchema, OtpPurposeSchema, PositionSchema, UserRoleSchema, UserStatusSchema } from '../enums.js';
export * from './stadiums.js';
export * from './matches.js';
export * from './favorites.js';
export * from './attendance.js';
export * from './ratings.js';
export * from './seo.js';
export * from './notifications.js';
export * from './admin.js';

export const UzPhoneSchema = z.string().trim().regex(/^\+998\d{9}$/);
export const UsernameSchema = z.string().trim().regex(/^[a-z0-9_]{3,20}$/);

export const OtpRequestBodySchema = z.object({ phone: UzPhoneSchema, purpose: OtpPurposeSchema }).strict();
export const OtpRequestResponseSchema = z.object({ accepted: z.literal(true) });
export const OtpVerifyBodySchema = z.object({ phone: UzPhoneSchema, code: z.string().regex(/^\d{6}$/) }).strict();
export const RegisterBodySchema = z.object({
  registrationToken: z.string().min(1),
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  username: UsernameSchema,
}).strict();
export const RefreshBodySchema = z.object({}).strict();
export const UsernameAvailableQuerySchema = z.object({ username: UsernameSchema });
export const UsernameAvailableResponseSchema = z.object({ available: z.boolean(), suggestions: z.array(UsernameSchema) });
export const AuthUserSchema = z.object({
  id: z.string().uuid(), firstName: z.string(), lastName: z.string(), username: UsernameSchema,
  role: UserRoleSchema, status: UserStatusSchema,
});
export const TokenResponseSchema = z.object({ accessToken: z.string(), user: AuthUserSchema });
export const VerifyResponseSchema = z.union([
  TokenResponseSchema.extend({ needsRegistration: z.literal(false) }),
  z.object({ needsRegistration: z.literal(true), registrationToken: z.string() }),
]);
export const LogoutResponseSchema = z.object({ loggedOut: z.literal(true) });

export const CitySchema = z.object({ id: z.string().uuid(), slug: z.string(), name: z.string() });
export const CitiesResponseSchema = z.array(CitySchema);
export const CitiesQuerySchema = z.object({ locale: LocaleSchema.default('uz') });
export const PublicProfileQuerySchema = z.object({
  locale: LocaleSchema.default('uz'),
  commentsPage: z.coerce.number().int().positive().default(1),
});
export const PublicProfileStatsSchema = z.object({
  matchesPlayed: z.number().int().nonnegative(), matchesOrganized: z.number().int().nonnegative(),
  onTime: z.number().int().nonnegative(), late: z.number().int().nonnegative(),
  noShow: z.number().int().nonnegative(), cancelledEarly: z.number().int().nonnegative(),
  excused: z.number().int().nonnegative(), attendancePct: z.number().min(0).max(100).nullable(),
  bayesAvg: z.number().min(1).max(5).nullable(), ratingCount: z.number().int().nonnegative(),
  lastFiveAvg: z.number().min(1).max(5).nullable(),
});
export const PublicProfileMatchSchema = z.object({
  id: z.string().uuid(), slug: z.string(), title: z.string(), startsAt: z.string().datetime(),
  status: MatchStatusSchema,
});
export const PublicProfileCommentSchema = z.object({
  id: z.string().uuid(), overall: z.number().int().min(1).max(5), comment: z.string(),
  createdAt: z.string().datetime(),
  author: z.object({ username: UsernameSchema, firstName: z.string(), lastName: z.string() }),
});
export const PublicProfileSchema = z.object({
  avatarUrl: z.string().url().nullable(), firstName: z.string(), lastName: z.string(), username: UsernameSchema,
  bio: z.string().nullable(), city: CitySchema.nullable(), position: PositionSchema.nullable(),
  joinedAt: z.string().datetime(), verified: z.boolean(), stats: PublicProfileStatsSchema,
  badges: z.array(z.string()), recentMatches: z.array(PublicProfileMatchSchema),
  comments: z.object({
    items: z.array(PublicProfileCommentSchema), page: z.number().int().positive(),
    pageSize: z.number().int().positive(), total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
export const UpdateMeBodySchema = z.object({
  firstName: z.string().trim().min(1).max(50).optional(), lastName: z.string().trim().min(1).max(50).optional(),
  bio: z.string().trim().max(300).nullable().optional(), cityId: z.string().uuid().nullable().optional(),
  position: PositionSchema.nullable().optional(), locale: LocaleSchema.optional(),
}).strict().refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' });
export const MeProfileSchema = z.object({
  id: z.string().uuid(), firstName: z.string(), lastName: z.string(), username: UsernameSchema,
  avatarUrl: z.string().url().nullable(), bio: z.string().nullable(), cityId: z.string().uuid().nullable(),
  position: PositionSchema.nullable(), locale: LocaleSchema,
});
export const UpdateUsernameBodySchema = z.object({ username: UsernameSchema }).strict();
export const MeSettingsSchema = z.object({ phone: UzPhoneSchema, locale: LocaleSchema });
export const AvatarPresignBodySchema = z.object({ size: z.number().int().positive().max(5 * 1024 * 1024) }).strict();
export const AvatarPresignResponseSchema = z.object({ uploadUrl: z.string().url(), objectKey: z.string(), expiresAt: z.string().datetime() });
export const AvatarCompleteBodySchema = z.object({ objectKey: z.string().min(1).max(512) }).strict();
export const AvatarCompleteResponseSchema = z.object({ accepted: z.literal(true) });

export type OtpRequestBody = z.infer<typeof OtpRequestBodySchema>;
export type OtpVerifyBody = z.infer<typeof OtpVerifyBodySchema>;
export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type City = z.infer<typeof CitySchema>;
export type PublicProfile = z.infer<typeof PublicProfileSchema>;
export type UpdateMeBody = z.infer<typeof UpdateMeBodySchema>;
export type MeProfile = z.infer<typeof MeProfileSchema>;
export type UpdateUsernameBody = z.infer<typeof UpdateUsernameBodySchema>;
export type MeSettings = z.infer<typeof MeSettingsSchema>;
export type AvatarPresignBody = z.infer<typeof AvatarPresignBodySchema>;
export type AvatarPresignResponse = z.infer<typeof AvatarPresignResponseSchema>;
export type AvatarCompleteBody = z.infer<typeof AvatarCompleteBodySchema>;
