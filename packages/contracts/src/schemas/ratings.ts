import { z } from 'zod';
import { RatingStatusSchema } from '../enums.js';

const RatingScoreSchema = z.number().int().min(1).max(5);
export const CreateRatingBodySchema = z.object({
  rateeId: z.string().uuid(),
  discipline: RatingScoreSchema,
  punctuality: RatingScoreSchema,
  fairPlay: RatingScoreSchema,
  teamPlay: RatingScoreSchema,
  overall: RatingScoreSchema,
  comment: z.string().trim().min(1).max(500).optional(),
}).strict();
export const RatingSchema = z.object({
  id: z.string().uuid(), matchId: z.string().uuid(), raterId: z.string().uuid(), rateeId: z.string().uuid(),
  discipline: RatingScoreSchema, punctuality: RatingScoreSchema, fairPlay: RatingScoreSchema,
  teamPlay: RatingScoreSchema, overall: RatingScoreSchema, comment: z.string().nullable(),
  status: RatingStatusSchema, createdAt: z.string().datetime(),
});
export const RatablePlayerSchema = z.object({
  userId: z.string().uuid(), firstName: z.string(), lastName: z.string(), username: z.string(),
  alreadyRated: z.boolean(), ratingId: z.string().uuid().nullable(),
});
export const RatablePlayersSchema = z.array(RatablePlayerSchema);
export const ReportRatingBodySchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export const RatingReportSchema = z.object({
  id: z.string().uuid(), ratingId: z.string().uuid(), reporterId: z.string().uuid(),
  reason: z.string(), createdAt: z.string().datetime(),
});

export type CreateRatingBody = z.infer<typeof CreateRatingBodySchema>;
export type Rating = z.infer<typeof RatingSchema>;
export type RatablePlayer = z.infer<typeof RatablePlayerSchema>;
export type ReportRatingBody = z.infer<typeof ReportRatingBodySchema>;
export type RatingReport = z.infer<typeof RatingReportSchema>;
