'use client';

import { Button, Input } from '@futzone/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { mapErrorCodeToMessage } from '@/lib/api/errors';

export function ReportRatingButton({ ratingId }: { ratingId: string }) {
  const t = useTranslations(); const [open, setOpen] = useState(false); const [reason, setReason] = useState(''); const [message, setMessage] = useState('');
  const submit = async () => {
    try { await apiClient.reportRating(ratingId, reason); setMessage(t('profile.report.sent')); setOpen(false); }
    catch (error) { setMessage(error instanceof ApiClientError ? mapErrorCodeToMessage(error.code, t) : t('profile.report.failed')); }
  };
  return <div className="text-right"><Button variant="outline" size="sm" onClick={() => setOpen(!open)}>{t('profile.report.button')}</Button>{open ? <div className="mt-2 flex gap-2"><Input aria-label={t('profile.report.reason')} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /><Button size="sm" disabled={!reason.trim()} onClick={submit}>{t('profile.report.submit')}</Button></div> : null}{message ? <p role="status" className="mt-1 text-xs text-muted-foreground">{message}</p> : null}</div>;
}
