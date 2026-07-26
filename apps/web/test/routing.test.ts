import { defaultLocale, locales } from '@futzone/i18n';
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getAlternateLinks } from '../src/i18n/metadata';
import { negotiateRootLocale, routing } from '../src/i18n/routing';
import middleware, { hasUnsupportedLocalePrefix } from '../src/middleware';

vi.mock('next-intl/middleware', () => ({ default: () => vi.fn() }));

describe('locale routing', () => {
  it('uses exactly the shared locales and Uzbek as default', () => {
    expect(routing.locales).toEqual(['uz', 'uz-Cyrl', 'ru', 'en']);
    expect(routing.locales).toEqual(locales);
    expect(routing.defaultLocale).toBe('uz');
    expect(routing.defaultLocale).toBe(defaultLocale);
    expect(routing.localePrefix).toBe('always');
  });

  it.each([
    ['the default locale without a language preference', undefined, 'uz'],
    ['Russian when requested', 'ru', 'ru'],
    ['Russian when it has the highest quality', 'en;q=0.5,ru-RU;q=0.9', 'ru'],
  ])('negotiates the root to %s', (_description, language, locale) => {
    expect(negotiateRootLocale(language ?? null)).toBe(locale);
  });

  it('lets unsupported locale prefixes reach the locale layout', () => {
    expect(hasUnsupportedLocalePrefix('/de')).toBe(true);
    expect(hasUnsupportedLocalePrefix('/de/players/example')).toBe(true);
    expect(hasUnsupportedLocalePrefix('/uz')).toBe(false);
    expect(hasUnsupportedLocalePrefix('/nothing-at-all')).toBe(false);
    expect(hasUnsupportedLocalePrefix('/')).toBe(false);
  });

  it('generates absolute alternates for every locale and x-default', () => {
    const alternates = getAlternateLinks('ru', new URL('https://futzone.example'));

    expect(Object.keys(alternates.languages)).toEqual([...locales, 'x-default']);
    expect(alternates.languages['x-default']).toBe('https://futzone.example/uz');
    expect(alternates.canonical).toBe('https://futzone.example/ru');
    for (const url of Object.values(alternates.languages)) {
      expect(new URL(url).href).toBe(url);
    }
  });

  it('preserves a gone match as HTTP 410 instead of converting it to 404', async () => {
    const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 410 }));
    try {
      const response = await middleware(new NextRequest('https://futzone.example/en/matches/expired-match'));
      expect(response?.status).toBe(410);
      expect(response?.headers.get('x-middleware-rewrite')).toContain('/en/gone');
    } finally {
      fetchMock.mockRestore();
      if (previousApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
      else process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
    }
  });
});
