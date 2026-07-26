import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MatchWizard } from '@/components/match-wizard';

export async function generateMetadata() { const t = await getTranslations('matches.wizard'); return { title: t('metadata'), robots: { index: false, follow: false } }; }
export default async function NewMatchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  return <main className="px-4 py-10"><MatchWizard /></main>;
}
