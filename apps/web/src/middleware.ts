import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { guardAuthenticatedRoute } from './lib/auth/route-guard';

const intlMiddleware = createMiddleware(routing);

export function hasUnsupportedLocalePrefix(pathname: string) {
  const [firstSegment = ''] = pathname.slice(1).split('/');
  const isLocaleShaped = /^[a-z]{2}(?:-[A-Za-z]{2,4})?$/.test(firstSegment);
  return isLocaleShaped && !routing.locales.some((locale) => locale === firstSegment);
}

export function isSeoInfrastructurePath(pathname: string) {
  return pathname === '/robots.txt'
    || pathname === '/sitemap.xml'
    || pathname === '/sitemaps'
    || pathname.startsWith('/sitemaps/');
}

export default async function middleware(request: NextRequest) {
  if (isSeoInfrastructurePath(request.nextUrl.pathname)) return NextResponse.next();
  if (hasUnsupportedLocalePrefix(request.nextUrl.pathname)) return NextResponse.next();

  if (/^\/(?:uz|uz-Cyrl|ru|en)\/(?:settings(?:\/|$)|matches\/new(?:\/|$))/.test(request.nextUrl.pathname)) {
    const redirect = guardAuthenticatedRoute(request);
    if (redirect) return redirect;
  }

  const matchPage = request.nextUrl.pathname.match(/^\/(uz|uz-Cyrl|ru|en)\/matches\/([^/]+)$/);
  const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (matchPage && apiUrl) {
    const [, locale = routing.defaultLocale, slug = ''] = matchPage;
    const response = await fetch(new URL(`/api/matches/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`, apiUrl), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (response.status === 410) {
      const goneUrl = request.nextUrl.clone();
      goneUrl.pathname = `/${locale}/gone`;
      return NextResponse.rewrite(goneUrl, { status: 410 });
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: '/((?!api|_next|_vercel|robots\\.txt$|sitemap\\.xml$|sitemaps(?:/|$)|.*\\..*).*)',
};
