import en from '@futzone/i18n/messages/en';
import ru from '@futzone/i18n/messages/ru';
import uzCyrl from '@futzone/i18n/messages/uz-Cyrl';
import uz from '@futzone/i18n/messages/uz';
import { describe, expect, it } from 'vitest';
import { getMessages } from '../src/i18n/messages';

function leafKeys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'object' && child !== null ? leafKeys(child as object, path) : [path];
  }).sort();
}

describe('message catalogs', () => {
  it.each([['uz', uz], ['uz-Cyrl', uzCyrl], ['ru', ru]])('%s has the same keys as English', (_locale, messages) => {
    expect(leafKeys(messages)).toEqual(leafKeys(en));
  });
});

describe('web message catalogs', () => {
  it.each(['uz', 'uz-Cyrl', 'ru', 'en'] as const)('%s has the complete identical web key set', (locale) => {
    expect(leafKeys(getMessages(locale))).toEqual(leafKeys(getMessages('en')));
  });
});
