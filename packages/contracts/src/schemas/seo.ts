import { z } from 'zod';

const SitemapEntrySchema = z.object({
  slug: z.string(),
  updatedAt: z.string().datetime(),
});

export const SeoManifestSchema = z.object({
  generatedAt: z.string().datetime(),
  cities: z.array(SitemapEntrySchema),
  stadiums: z.array(SitemapEntrySchema),
  matches: z.array(SitemapEntrySchema),
  players: z.array(SitemapEntrySchema),
});

export type SeoManifest = z.infer<typeof SeoManifestSchema>;
