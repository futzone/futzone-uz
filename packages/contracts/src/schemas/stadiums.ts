import { z } from 'zod';
import { StadiumStatusSchema, SurfaceSchema } from '../enums.js';

export const CreateStadiumBodySchema = z.object({
  nameUz: z.string().trim().min(1).max(120),
  nameRu: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  cityId: z.string().uuid(),
  district: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(300),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  surface: SurfaceSchema,
  photos: z.array(z.string().url()).max(10).default([]),
}).strict();
export const StadiumModerationBodySchema = z.object({ status: z.enum(['APPROVED', 'REJECTED']) }).strict();
export const StadiumsQuerySchema = z.object({ city: z.string().trim().min(1).optional() });
export const StadiumSchema = z.object({
  id: z.string().uuid(), slug: z.string(), nameUz: z.string(), nameRu: z.string(), nameEn: z.string(),
  cityId: z.string().uuid(), district: z.string(), address: z.string(), latitude: z.number(), longitude: z.number(),
  surface: SurfaceSchema, photos: z.array(z.string().url()), status: StadiumStatusSchema, createdAt: z.string().datetime(),
});
export const StadiumsResponseSchema = z.array(StadiumSchema);

export type CreateStadiumBody = z.infer<typeof CreateStadiumBodySchema>;
export type StadiumModerationBody = z.infer<typeof StadiumModerationBodySchema>;
export type Stadium = z.infer<typeof StadiumSchema>;
