import { Button, Card, CardContent } from '@futzone/ui';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  return <section className="mx-auto flex max-w-7xl items-center px-4 py-20 sm:py-28"><Card className="w-full overflow-hidden border-brand-200 bg-gradient-to-br from-brand-50 to-background dark:border-brand-900 dark:from-brand-950/40"><CardContent className="max-w-3xl py-10 sm:py-16"><p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-600">{t('eyebrow')}</p><h1 className="text-4xl font-bold tracking-tight sm:text-6xl">{t('title')}</h1><p className="mt-6 max-w-2xl text-lg text-muted-foreground">{t('description')}</p><Button asChild size="lg" className="mt-8"><Link href="/">{t('action')}</Link></Button></CardContent></Card></section>;
}
