import type { Locale, NotificationType } from '@futzone/contracts';
import en from '@futzone/i18n/messages/en';
import ru from '@futzone/i18n/messages/ru';
import uz from '@futzone/i18n/messages/uz';
import uzCyrl from '@futzone/i18n/messages/uz-Cyrl';

// Push notifications are shown by the service worker, which has no next-intl runtime, so their text
// must be localized to the recipient's stored locale here at send time (unlike the in-app centre,
// which localizes at display time). Both read the same shared @futzone/i18n templates.
type Catalog = { notifications: { title: string; types: Record<string, string> } };
const CATALOGS: Record<Locale, Catalog> = { uz, 'uz-Cyrl': uzCyrl, ru, en } as Record<Locale, Catalog>;

export function pushContent(type: NotificationType, locale: Locale): { title: string; body: string } {
  const catalog = CATALOGS[locale] ?? CATALOGS.uz;
  return { title: catalog.notifications.title, body: catalog.notifications.types[type] ?? type };
}
