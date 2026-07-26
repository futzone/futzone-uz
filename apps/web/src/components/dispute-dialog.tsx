'use client';

import { Button, Card } from '@futzone/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { mapErrorCodeToMessage } from '@/lib/api/errors';

export function DisputeDialog({ recordId }: { recordId: string }) {
  const t = useTranslations(); const [note, setNote] = useState(''); const [message, setMessage] = useState(''); const [closed, setClosed] = useState(false);
  const submit = async () => {
    try { await apiClient.disputeAttendance(recordId, note); setMessage(t('dispute.sent')); }
    catch (error) { if (error instanceof ApiClientError && error.code === 'DISPUTE_WINDOW_CLOSED') setClosed(true); setMessage(error instanceof ApiClientError ? mapErrorCodeToMessage(error.code, t) : t('dispute.failed')); }
  };
  return <Card className="mx-auto max-w-xl p-6"><h1 className="text-2xl font-bold">{t('dispute.title')}</h1><p className="mt-2 text-sm text-muted-foreground">{closed ? t('dispute.closed') : t('dispute.description')}</p><textarea aria-label={t('dispute.note')} className="mt-4 min-h-36 w-full rounded-md border bg-background p-3" maxLength={1000} disabled={closed} value={note} onChange={(event) => setNote(event.target.value)} /><Button className="mt-3" disabled={closed || !note.trim()} onClick={() => void submit()}>{t('dispute.submit')}</Button>{message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}</Card>;
}
