import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
export default withNextIntl({
  output: 'standalone',
  transpilePackages: ['@futzone/ui', '@futzone/i18n', '@futzone/contracts'],
});
