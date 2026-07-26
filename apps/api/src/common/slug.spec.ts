import { slugify, transliterateUzCyrlToLatin } from './slug';

describe('transliterateUzCyrlToLatin', () => {
  it('transliterates Uzbek Cyrillic words to Latin', () => {
    expect(transliterateUzCyrlToLatin('Тошкент')).toBe('Toshkent');
    expect(transliterateUzCyrlToLatin('шаҳар')).toBe('shahar');
    expect(transliterateUzCyrlToLatin('Ўзбекистон')).toBe('Oʻzbekiston');
    expect(transliterateUzCyrlToLatin('Чортоқ')).toBe('Chortoq');
    expect(transliterateUzCyrlToLatin('Ёшлар')).toBe('Yoshlar');
  });

  it('passes Latin and non-alphabetic characters through unchanged', () => {
    expect(transliterateUzCyrlToLatin('Lokomotiv 5x5')).toBe('Lokomotiv 5x5');
  });
});

describe('slugify', () => {
  it('produces a Latin slug from Cyrillic input (slugs stay Latin, ADR-036)', () => {
    expect(slugify('Тошкент Арена')).toBe('toshkent-arena');
    expect(slugify('Миллий стадион')).toBe('milliy-stadion');
  });

  it('slugifies Latin input and collapses separators', () => {
    expect(slugify('Lokomotiv Stadium!!')).toBe('lokomotiv-stadium');
    expect(slugify('  Yunusobod  5x5  ')).toBe('yunusobod-5x5');
  });

  it('drops modifier letters that transliteration introduces', () => {
    expect(slugify('Ўзбекистон')).toBe('ozbekiston');
  });

  it('falls back when nothing usable remains', () => {
    expect(slugify('!!!', 'stadium')).toBe('stadium');
    expect(slugify('')).toBe('item');
  });
});
