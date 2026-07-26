import { z } from 'zod';
import { PositionSchema } from '../enums.js';
import { StadiumSchema } from './stadiums.js';

/** A favourited organizer, exposed with public profile fields only (never phone). */
export const FavoriteOrganizerSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().url().nullable(),
  position: PositionSchema.nullable(),
});

export const FavoritesResponseSchema = z.object({
  stadiums: z.array(StadiumSchema),
  organizers: z.array(FavoriteOrganizerSchema),
});

/** Result of a favourite add/remove; `favorited` is the resulting state (idempotent). */
export const FavoriteMutationResponseSchema = z.object({ favorited: z.boolean() });

export type FavoriteOrganizer = z.infer<typeof FavoriteOrganizerSchema>;
export type FavoritesResponse = z.infer<typeof FavoritesResponseSchema>;
export type FavoriteMutationResponse = z.infer<typeof FavoriteMutationResponseSchema>;
