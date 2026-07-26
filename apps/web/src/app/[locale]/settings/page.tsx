import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProfileSettings } from '@/components/profile-settings';
import { PushSettings } from '@/components/push-settings';

export async function generateMetadata() { const t = await getTranslations('profile'); return { title: t('settingsTitle'), robots: { index: false, follow: false } }; }
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; setRequestLocale(locale); return <main className="mx-auto max-w-2xl space-y-12 px-4 py-12"><ProfileSettings /><PushSettings /></main>; }
