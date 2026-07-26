import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { NotificationBell } from '@/components/notification-bell';
import { getAlternateLinks, getSiteUrl } from '@/i18n/metadata';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { breadcrumbJsonLd, JsonLdScript } from '@/lib/structured-data';
import '../globals.css';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })); }
export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> { const { locale } = await params; if (!hasLocale(routing.locales, locale)) notFound(); const t = await getTranslations({ locale, namespace: 'metadata' }); return { metadataBase: getSiteUrl(), title: t('title'), description: t('description'), alternates: getAlternateLinks(locale), manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'Futzone' }, icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/icon-192.png' } }; }

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params; if (!hasLocale(routing.locales, locale)) notFound(); setRequestLocale(locale);
  const messages = await getMessages(); const t = await getTranslations('common');
  return <html lang={locale}><body className="min-h-screen bg-background font-sans text-foreground antialiased"><JsonLdScript data={breadcrumbJsonLd([{ name: t('appName'), url: new URL(`/${locale}`, getSiteUrl()).toString() }])} /><NextIntlClientProvider messages={messages}><div className="flex min-h-screen flex-col"><header className="border-b"><div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4"><Link href="/" className="text-xl font-bold text-brand-600">{t('appName')}</Link><nav className="ml-auto flex items-center gap-2 sm:gap-4"><Link href="/" className="hidden text-sm font-medium sm:inline">{t('nav.matches')}</Link><Link href="/login" className="text-sm font-medium">{t('nav.login')}</Link><NotificationBell /><LocaleSwitcher /></nav></div></header><main className="flex-1">{children}</main><footer className="border-t"><div className="mx-auto max-w-7xl px-4 py-6 text-sm text-muted-foreground">© {new Date().getFullYear()} {t('appName')}. {t('footer.rights')}</div></footer></div></NextIntlClientProvider></body></html>;
}
