export const locales = ['uz', 'uz-Cyrl', 'ru', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale = 'uz' satisfies Locale;
