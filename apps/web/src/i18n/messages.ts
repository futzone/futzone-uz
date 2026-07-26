import type { Locale } from '@futzone/i18n';
import en from '@futzone/i18n/messages/en';
import ru from '@futzone/i18n/messages/ru';
import uzCyrl from '@futzone/i18n/messages/uz-Cyrl';
import uz from '@futzone/i18n/messages/uz';
import enWeb from './catalogs/en.json';
import ruWeb from './catalogs/ru.json';
import uzCyrlWeb from './catalogs/uz-Cyrl.json';
import uzWeb from './catalogs/uz.json';

const messagesByLocale = {
  uz: { ...uz, ...uzWeb }, 'uz-Cyrl': { ...uzCyrl, ...uzCyrlWeb }, ru: { ...ru, ...ruWeb }, en: { ...en, ...enWeb },
} satisfies Record<Locale, typeof en & typeof enWeb>;
export function getMessages(locale: Locale): typeof en & typeof enWeb { return messagesByLocale[locale]; }
