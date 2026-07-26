import { NextRequest, NextResponse } from 'next/server';

export const AUTH_SESSION_MARKER = 'futzone_authenticated';

export function guardAuthenticatedRoute(request: NextRequest): NextResponse | null {
  if (request.cookies.get(AUTH_SESSION_MARKER)?.value === '1') return null;

  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const locale = segments[0] ?? 'uz';
  const loginUrl = new URL(`/${locale}/login`, request.url);
  loginUrl.searchParams.set('returnTo', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export function setAuthenticatedSessionMarker(authenticated: boolean): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${AUTH_SESSION_MARKER}=${authenticated ? '1' : ''}; Path=/; SameSite=Strict${secure}${authenticated ? '' : '; Max-Age=0'}`;
}

export function safeReturnTo(value: string | null): string | null {
  return value?.startsWith('/') && !value.startsWith('//') ? value : null;
}
