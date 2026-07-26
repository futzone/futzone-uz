'use client';
import { Button } from '@futzone/ui';
import { useTranslations } from 'next-intl';
export default function ErrorShell({ reset }: { error: Error & { digest?: string }; reset: () => void }) { const t = useTranslations('status'); return <div className="mx-auto max-w-2xl px-4 py-20 text-center"><h1 className="text-3xl font-bold">{t('errorTitle')}</h1><p className="mt-4 text-muted-foreground">{t('errorDescription')}</p><Button className="mt-6" onClick={reset}>{t('retry')}</Button></div>; }
