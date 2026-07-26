import { getTranslations } from 'next-intl/server';
import { DashboardCards } from '@/components/dashboard-cards';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <DashboardCards />
    </div>
  );
}
