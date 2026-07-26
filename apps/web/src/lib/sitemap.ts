import type { SeoManifest } from '@futzone/contracts';
import { routing } from '../i18n/routing';
import { getSiteUrl } from '../i18n/metadata';

export const SITEMAP_KINDS = ['static', 'cities', 'stadiums', 'matches', 'players'] as const;
export type SitemapKind = typeof SITEMAP_KINDS[number];

export function sitemapEntries(kind: SitemapKind, manifest: SeoManifest, siteUrl = getSiteUrl()) {
  const paths: ReadonlyArray<{ path: string; updatedAt: string }> = kind === 'static'
    ? routing.locales.flatMap((locale) => [
        { path: `/${locale}`, updatedAt: manifest.generatedAt },
        { path: `/${locale}/matches`, updatedAt: manifest.generatedAt },
      ])
    : routing.locales.flatMap((locale) =>
        manifest[kind].map(({ slug, updatedAt }) => ({
          path: kind === 'cities'
            ? `/${locale}/matches/${slug}`
            : `/${locale}/${kind}/${slug}`,
          updatedAt,
        })),
      );
  return paths.map(({ path, updatedAt }) => ({ url: new URL(path, siteUrl).toString(), updatedAt }));
}

function xmlEscape(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  })[character] ?? character);
}

export function urlSetXml(entries: ReadonlyArray<{ url: string; updatedAt: string }>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(({ url, updatedAt }) => `<url><loc>${xmlEscape(url)}</loc><lastmod>${xmlEscape(updatedAt)}</lastmod></url>`).join('')}</urlset>`;
}

export function sitemapIndexXml(siteUrl = getSiteUrl()): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${SITEMAP_KINDS.map((kind) => `<sitemap><loc>${xmlEscape(new URL(`/sitemaps/${kind}`, siteUrl).toString())}</loc></sitemap>`).join('')}</sitemapindex>`;
}
