import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NotificationCenter } from '@/components/notification-center';

export async function generateMetadata() {
  const t = await getTranslations('notifications');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <main>{<NotificationCenter />}</main>;
}
