/** Pick the localized stadium name. Cyrillic Uzbek falls back to the Latin Uzbek name (no separate column). */
export function stadiumName(stadium: { nameUz: string; nameRu: string; nameEn: string }, locale: string): string {
  if (locale === 'ru') return stadium.nameRu;
  if (locale === 'en') return stadium.nameEn;
  return stadium.nameUz;
}
