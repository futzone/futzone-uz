'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@futzone/ui';
import type { AdminModerationQueue } from '@futzone/contracts';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

type PendingAction = { label: string; submit: (reason: string) => Promise<unknown> };

export function ModerationQueue() {
  const t = useTranslations('moderation');
  const common = useTranslations('common');
  const [queue, setQueue] = useState<AdminModerationQueue | null>(null);
  const [active, setActive] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { apiClient.moderationQueue().then(setQueue).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);

  const start = (label: string, submit: (reason: string) => Promise<unknown>): void => { setActive({ label, submit }); setReason(''); };

  const confirm = async (): Promise<void> => {
    if (!active || !reason.trim()) return;
    setBusy(true);
    try { await active.submit(reason.trim()); setActive(null); setReason(''); load(); }
    catch { /* surfaced by reload */ }
    finally { setBusy(false); }
  };

  if (!queue) return <p className="text-sm text-muted-foreground">{common('loading')}</p>;
  const isEmpty = queue.reports.length === 0 && queue.disputes.length === 0 && queue.stadiums.length === 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {isEmpty && <p className="text-sm text-muted-foreground">{t('empty')}</p>}

      {active && (
        <Card className="border-brand-600">
          <CardContent className="space-y-2 pt-4">
            <Label htmlFor="mod-reason">{active.label} — {t('reason')}</Label>
            <Input id="mod-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <Button size="sm" onClick={confirm} disabled={busy || !reason.trim()}>{common('confirm')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setActive(null)} disabled={busy}>{common('cancel')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {queue.reports.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t('reports.title')} ({queue.reports.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {queue.reports.map((r) => (
              <div key={r.ratingId} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm">“{r.comment ?? '—'}”</p>
                  <p className="text-xs text-muted-foreground">{t('reports.about')}: @{r.rateeUsername} · {t('reports.by')}: @{r.raterUsername} · {t('reports.count')}: {r.reportCount} · <Badge variant="outline">{r.status}</Badge></p>
                </div>
                <div className="flex gap-2">
                  {r.status !== 'HIDDEN' && <Button size="sm" variant="outline" onClick={() => start(t('reports.hide'), (reason) => apiClient.resolveReport(r.ratingId, { action: 'hide', reason }))}>{t('reports.hide')}</Button>}
                  {r.status === 'HIDDEN' && <Button size="sm" variant="outline" onClick={() => start(t('reports.restore'), (reason) => apiClient.resolveReport(r.ratingId, { action: 'restore', reason }))}>{t('reports.restore')}</Button>}
                  <Button size="sm" variant="destructive" onClick={() => start(t('reports.delete'), (reason) => apiClient.resolveReport(r.ratingId, { action: 'delete', reason }))}>{t('reports.delete')}</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {queue.disputes.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t('disputes.title')} ({queue.disputes.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {queue.disputes.map((d) => (
              <div key={d.recordId} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm">{t('disputes.match')}: {d.matchTitle} · {t('disputes.participant')}: @{d.participantUsername} · <Badge variant="outline">{d.status}</Badge></p>
                  {d.disputeNote && <p className="text-xs text-muted-foreground">{t('disputes.note')}: {d.disputeNote}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => start(t('disputes.overturn'), (reason) => apiClient.resolveDispute(d.recordId, { status: 'ON_TIME', reason }))}>{t('disputes.overturn')}</Button>
                  <Button size="sm" variant="outline" onClick={() => start(t('disputes.uphold'), (reason) => apiClient.resolveDispute(d.recordId, { status: d.status, reason }))}>{t('disputes.uphold')}</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {queue.stadiums.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t('stadiums.title')} ({queue.stadiums.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {queue.stadiums.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
                <p className="text-sm">{s.name} · {s.cityName ?? '—'} · {t('stadiums.submittedBy')}: @{s.submittedByUsername}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => start(t('stadiums.approve'), (reason) => apiClient.resolveStadium(s.id, { decision: 'APPROVED', reason }))}>{t('stadiums.approve')}</Button>
                  <Button size="sm" variant="destructive" onClick={() => start(t('stadiums.reject'), (reason) => apiClient.resolveStadium(s.id, { decision: 'REJECTED', reason }))}>{t('stadiums.reject')}</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
