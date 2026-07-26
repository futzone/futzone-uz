import { describe, expect, it } from 'vitest';
import { getMessages } from '../src/i18n/messages';
import { BADGE_CODES } from '../src/lib/badges';

describe('badge translations', () => {
  it.each(['uz', 'uz-Cyrl', 'ru', 'en'] as const)('%s has a name and description for every badge code', (locale) => {
    const catalog = getMessages(locale).profile.badgeCatalog;
    for (const code of BADGE_CODES) {
      expect(catalog[code].name.trim()).not.toBe('');
      expect(catalog[code].description.trim()).not.toBe('');
      expect(catalog[code].name).not.toBe(code);
    }
  });
});
