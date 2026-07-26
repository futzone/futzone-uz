import { NextRequest } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '../src/lib/api';
import { AUTH_SESSION_MARKER, guardAuthenticatedRoute, safeReturnTo } from '../src/lib/auth/route-guard';

describe('profile route handling', () => {
  it('returns a sentinel when the profile API returns NOT_FOUND', async () => {
    const { loadPublicProfile } = await import('../src/lib/profile-loader');
    const client = { publicProfile: vi.fn().mockRejectedValue(new ApiClientError({ code: 'NOT_FOUND', message: 'Missing' })) };

    await expect(loadPublicProfile('nobody_here_xyz', 'uz', client)).resolves.toBeNull();
  });

  it('does not throw notFound from the metadata loader', async () => {
    const { loadPublicProfileMetadata } = await import('../src/lib/profile-loader');
    const client = { publicProfile: vi.fn().mockRejectedValue(new ApiClientError({ code: 'NOT_FOUND', message: 'Missing' })) };

    await expect(loadPublicProfileMetadata('nobody_here_xyz', 'uz', client)).resolves.toBeNull();
  });

  it('has a self-contained root not-found boundary', () => {
    const boundary = resolve(import.meta.dirname, '../src/app/not-found.tsx');

    expect(existsSync(boundary)).toBe(true);
    const source = readFileSync(boundary, 'utf8');
    expect(source).toContain('usePathname');
    expect(source).not.toContain('getTranslations');
    expect(source).not.toContain('useTranslations');
  });

  it('has a localized catch-all route that raises notFound', () => {
    const catchAll = resolve(import.meta.dirname, '../src/app/[locale]/[...rest]/page.tsx');

    expect(existsSync(catchAll)).toBe(true);
    expect(readFileSync(catchAll, 'utf8')).toContain('notFound()');
  });
});

describe('authenticated route guard', () => {
  it('redirects anonymous settings requests to localized login with returnTo', () => {
    const response = guardAuthenticatedRoute(new NextRequest('http://localhost:3010/uz/settings?tab=profile'));

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe('http://localhost:3010/uz/login?returnTo=%2Fuz%2Fsettings%3Ftab%3Dprofile');
  });

  it('allows requests carrying the authenticated session marker', () => {
    const request = new NextRequest('http://localhost:3010/uz/settings', { headers: { cookie: `${AUTH_SESSION_MARKER}=1` } });
    expect(guardAuthenticatedRoute(request)).toBeNull();
  });

  it('accepts only same-origin path return destinations', () => {
    expect(safeReturnTo('/uz/settings')).toBe('/uz/settings');
    expect(safeReturnTo('//example.com')).toBeNull();
    expect(safeReturnTo('https://example.com')).toBeNull();
  });
});
