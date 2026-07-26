import { notFound } from 'next/navigation';
import { ApiClient } from '../../../lib/api/client';
import { SITEMAP_KINDS, sitemapEntries, urlSetXml, type SitemapKind } from '../../../lib/sitemap';

export const revalidate = 300;

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!SITEMAP_KINDS.some((candidate) => candidate === kind)) notFound();
  const manifest = await new ApiClient(process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL)
    .seoManifest({ next: { revalidate: 300 } });
  const xml = urlSetXml(sitemapEntries(kind as SitemapKind, manifest));
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
  });
}
