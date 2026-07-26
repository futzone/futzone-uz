import type { SeoManifest } from '@futzone/contracts';
import { NextRequest, NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as sitemapIndex } from '../src/app/sitemap.xml/route';
import { GET as sitemapSection } from '../src/app/sitemaps/[kind]/route';
import middleware, { config, isSeoInfrastructurePath } from '../src/middleware';

vi.mock('next-intl/middleware', () => ({
  default: () => (request: NextRequest) => {
    const locale = request.headers.get('accept-language')?.toLowerCase().startsWith('ru') ? 'ru' : 'uz';
    return NextResponse.redirect(new URL(`/${locale}`, request.url), 307);
  },
}));

const manifest: SeoManifest = {
  generatedAt: '2026-07-23T00:00:00.000Z',
  cities: [{ slug: 'tashkent', updatedAt: '2026-07-23T00:00:00.000Z' }],
  stadiums: [{ slug: 'bunyodkor', updatedAt: '2026-07-23T00:00:00.000Z' }],
  matches: [{ slug: 'phase2-five-evening', updatedAt: '2026-07-23T00:00:00.000Z' }],
  players: [{ slug: 'bobur_salimov', updatedAt: '2026-07-23T00:00:00.000Z' }],
};

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.API_INTERNAL_URL;
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('sitemap routing', () => {
  it('serves every extensionless section URL advertised by the index without a locale redirect', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example';
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(JSON.stringify(manifest), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    const indexResponse = sitemapIndex();
    expect(indexResponse.status).toBe(200);
    const indexXml = await indexResponse.text();
    const advertisedUrls = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].flatMap((match) => match[1] ? [match[1]] : []);
    expect(advertisedUrls).toHaveLength(5);

    for (const advertisedUrl of advertisedUrls) {
      const url = new URL(advertisedUrl);
      expect(isSeoInfrastructurePath(url.pathname)).toBe(true);
      const middlewareResponse = await middleware(new NextRequest(url));
      expect(middlewareResponse.status).toBe(200);
      expect(middlewareResponse.headers.get('location')).toBeNull();
      expect(middlewareResponse.headers.get('x-middleware-next')).toBe('1');

      const kind = url.pathname.split('/').at(-1);
      expect(kind).toBeTruthy();
      const sectionResponse = await sitemapSection(new Request(url), {
        params: Promise.resolve({ kind: kind ?? '' }),
      });
      expect(sectionResponse.status).toBe(200);
      expect(sectionResponse.headers.get('content-type')).toContain('application/xml');
      expect(await sectionResponse.text()).toMatch(/<urlset[^>]*>.*<loc>[^<]+<\/loc>.*<\/urlset>/);
    }

    expect(config.matcher).toContain('sitemaps');
    expect(config.matcher).toContain('robots');
  });

  it('keeps the matches section indexable-only and excludes the seeded invite-only match', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(manifest), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const response = await sitemapSection(new Request('https://futzone.example/sitemaps/matches'), {
      params: Promise.resolve({ kind: 'matches' }),
    });
    const xml = await response.text();
    expect(response.status).toBe(200);
    expect(xml).toContain('phase2-five-evening');
    expect(xml).not.toContain('phase2-eight-invite');
  });
});

describe('locale middleware regressions', () => {
  it('redirects the root to Uzbek by default', async () => {
    const response = await middleware(new NextRequest('https://futzone.example/'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://futzone.example/uz');
  });

  it('redirects the root to Russian when Accept-Language requests Russian', async () => {
    const response = await middleware(new NextRequest('https://futzone.example/', {
      headers: { 'Accept-Language': 'ru' },
    }));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://futzone.example/ru');
  });
});
