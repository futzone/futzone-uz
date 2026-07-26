'use client';

import { locales, type Locale } from '@futzone/i18n';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@futzone/ui';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations('common.localeSwitcher');
  const pathname = usePathname();
  const router = useRouter();
  // Preserve the full URL — path and query (active filters) — when switching locale. Reading
  // the query at click time (not via useSearchParams) keeps this header out of a Suspense boundary.
  const switchTo = (candidate: Locale) => {
    const query = typeof window === 'undefined' ? '' : window.location.search;
    router.replace(`${pathname}${query}`, { locale: candidate });
  };
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" aria-label={t('label')}>{t(locale)}</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{locales.map((candidate) => <DropdownMenuItem key={candidate} disabled={candidate === locale} onSelect={() => switchTo(candidate)}>{t(candidate)}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}
