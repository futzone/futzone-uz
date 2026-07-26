import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';
import { getMessages } from './messages';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  if (!locale || !hasLocale(routing.locales, locale)) notFound();
  return { locale, messages: getMessages(locale) };
});
