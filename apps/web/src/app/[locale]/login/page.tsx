import { Skeleton } from '@futzone/ui';
import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthFlow } from '@/components/auth-flow';

export async function generateMetadata() {
  const t = await getTranslations('auth');
  return { title: t('pageTitle') };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <main className="mx-auto flex max-w-7xl justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="w-full max-w-md space-y-4" aria-busy="true">
            <span className="sr-only">{t('pageTitle')}</span>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        }
      >
        <AuthFlow />
      </Suspense>
    </main>
  );
}
