import { defaultLocale, locales } from '@futzone/i18n';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({ locales, defaultLocale, localePrefix: 'always' });

export function negotiateRootLocale(acceptLanguage: string | null) {
  if (acceptLanguage === null) return routing.defaultLocale;

  const requestedLanguages = acceptLanguage
    .split(',')
    .map((entry) => {
      const [language = '', ...parameters] = entry.trim().split(';');
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const quality = qualityParameter === undefined ? 1 : Number(qualityParameter.trim().slice(2));
      return { language: language.toLowerCase(), quality: Number.isNaN(quality) ? 0 : quality };
    })
    .sort((left, right) => right.quality - left.quality);
  const mostSpecificLocales = [...routing.locales].sort((left, right) => right.length - left.length);

  for (const requested of requestedLanguages.filter(({ quality }) => quality > 0)) {
    const match = mostSpecificLocales.find((locale) => {
      const normalizedLocale = locale.toLowerCase();
      return requested.language === normalizedLocale || requested.language.startsWith(`${normalizedLocale}-`);
    });
    if (match !== undefined) return match;
  }

  return routing.defaultLocale;
}
