import { sitemapIndexXml } from '../../lib/sitemap';

export const revalidate = 300;

export function GET() {
  return new Response(sitemapIndexXml(), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
  });
}
