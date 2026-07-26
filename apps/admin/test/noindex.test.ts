import { describe, expect, it } from 'vitest';
import { metadata } from '../src/app/layout';
import robots from '../src/app/robots';
import { headers } from '../next.config';

describe('admin indexing protection', () => {
  it('sets noindex and nofollow in root metadata', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('disallows every crawler path in robots.txt', () => {
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });

  it('sets X-Robots-Tag for every response path', async () => {
    expect(await headers()).toEqual([
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ]);
  });
});
