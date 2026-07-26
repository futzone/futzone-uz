import { routing } from './routing';

const defaultSiteUrl = 'http://localhost:3000';

export function getSiteUrl() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl);
}

export function getAlternateLinks(locale: string, siteUrl = getSiteUrl()) {
  const absoluteLocaleUrl = (candidate: string) => new URL(`/${candidate}`, siteUrl).toString();
  const languages = Object.fromEntries(
    routing.locales.map((candidate) => [candidate, absoluteLocaleUrl(candidate)]),
  );

  return {
    canonical: absoluteLocaleUrl(locale),
    languages: {
      ...languages,
      'x-default': absoluteLocaleUrl(routing.defaultLocale),
    },
  };
}

export function getPathAlternateLinks(locale: string, path: string, siteUrl = getSiteUrl()) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const absoluteLocaleUrl = (candidate: string) => new URL(`/${candidate}${suffix}`, siteUrl).toString();
  return {
    canonical: absoluteLocaleUrl(locale),
    languages: {
      ...Object.fromEntries(routing.locales.map((candidate) => [candidate, absoluteLocaleUrl(candidate)])),
      'x-default': absoluteLocaleUrl(routing.defaultLocale),
    },
  };
}
