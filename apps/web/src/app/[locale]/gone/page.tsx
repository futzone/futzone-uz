import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function GonePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('status');
  return <main className="mx-auto max-w-2xl px-4 py-24 text-center">
    <h1 className="text-3xl font-bold">{t('goneTitle')}</h1>
    <p className="mt-4 text-muted-foreground">{t('goneDescription')}</p>
  </main>;
}
