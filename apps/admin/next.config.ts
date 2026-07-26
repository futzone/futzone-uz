import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export async function headers(): Promise<NonNullable<NextConfig['headers']> extends (...args: never[]) => infer Result ? Awaited<Result> : never> {
  return [
    {
      source: '/:path*',
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
    },
  ];
}

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@futzone/ui', '@futzone/contracts'],
  headers,
};

export default withNextIntl(nextConfig);
