import { NotificationType } from '@futzone/contracts';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { getMessages } from '../src/i18n/messages';
import { notificationMessage, type NotificationTranslator } from '../src/lib/notifications/template';

const locales = ['uz', 'uz-Cyrl', 'ru', 'en'] as const;
const types = Object.values(NotificationType);

function translatorFor(locale: (typeof locales)[number]): NotificationTranslator {
  const t = createTranslator({ locale, messages: getMessages(locale), namespace: 'notifications' });
  return (key: string) => t(key as never);
}

describe('notification templates', () => {
  it.each(locales)('renders every notification type as non-empty localized text in %s', (locale) => {
    const t = translatorFor(locale);
    for (const type of types) {
      const message = notificationMessage(type, t);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      // A raw key path leaking through would mean a missing template.
      expect(message).not.toContain('notifications.types');
      expect(message).not.toBe(`types.${type}`);
    }
  });

  it('localizes the same type differently across locales', () => {
    const rendered = locales.map((locale) => notificationMessage('MATCH_INVITE', translatorFor(locale)));
    expect(new Set(rendered).size).toBeGreaterThan(1);
  });
});
