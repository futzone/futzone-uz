/**
 * Uzbek Cyrillic → Latin transliteration, so a Cyrillic-entered name still yields a meaningful
 * Latin slug. Slugs stay Latin and there is a single slug per entity across all locales
 * (see DECISIONS.md ADR-036). Order matters: multi-character replacements are applied by the map.
 */
const UZ_CYRILLIC_TO_LATIN: ReadonlyArray<readonly [string, string]> = [
  ['ё', 'yo'], ['ж', 'j'], ['ч', 'ch'], ['ш', 'sh'], ['ю', 'yu'], ['я', 'ya'], ['ц', 'ts'], ['щ', 'sh'],
  ['ғ', 'gʻ'], ['ў', 'oʻ'], ['қ', 'q'], ['ҳ', 'h'], ['х', 'x'],
  ['а', 'a'], ['б', 'b'], ['в', 'v'], ['г', 'g'], ['д', 'd'], ['е', 'e'], ['з', 'z'], ['и', 'i'],
  ['й', 'y'], ['к', 'k'], ['л', 'l'], ['м', 'm'], ['н', 'n'], ['о', 'o'], ['п', 'p'], ['р', 'r'],
  ['с', 's'], ['т', 't'], ['у', 'u'], ['ф', 'f'], ['ъ', 'ʼ'], ['ь', ''], ['ы', 'i'], ['э', 'e'],
];

/** Transliterate Uzbek Cyrillic text to Latin. Non-Cyrillic characters pass through unchanged. */
export function transliterateUzCyrlToLatin(input: string): string {
  let result = '';
  for (const char of input) {
    const lower = char.toLowerCase();
    const pair = UZ_CYRILLIC_TO_LATIN.find(([cyrl]) => cyrl === lower);
    if (!pair) { result += char; continue; }
    const latin = pair[1];
    // Preserve the source casing for the first Latin letter.
    result += char === lower ? latin : latin.charAt(0).toUpperCase() + latin.slice(1);
  }
  return result;
}

/** Build a URL-safe Latin slug, transliterating Cyrillic first. Returns `fallback` when nothing remains. */
export function slugify(value: string, fallback = 'item'): string {
  return transliterateUzCyrlToLatin(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ʻʼ'`ʹ]/g, '') // drop modifier letters (gʻ, oʻ, ʼ) rather than turning them into separators
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}
