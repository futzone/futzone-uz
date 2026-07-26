'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@futzone/ui';
import type { AdminMatchDetail } from '@futzone/contracts';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/api';
import { MatchEditForm } from './match-edit-form';

type Action = 'flag' | 'unflag' | 'cancel';

export function MatchDetailView({ id }: { id: string }) {
  const t = useTranslations('matches');
  const common = useTranslations('common');
  const [match, setMatch] = useState<AdminMatchDetail | null>(null);
  const [active, setActive] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(() => { apiClient.match(id).then(setMatch).catch(() => undefined); }, [id]);
  useEffect(() => { load(); }, [load]);

  const submit = async (): Promise<void> => {
    if (!active) return;
    setPending(true); setError(null);
    try {
      if (active === 'flag') await apiClient.flagMatch(id, { reason });
      else if (active === 'unflag') await apiClient.unflagMatch(id, reason);
      else await apiClient.cancelMatch(id, reason);
      setDone(true); setActive(null); setReason(''); load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : common('error')); }
    finally { setPending(false); }
  };

  if (!match) return <p className="text-sm text-muted-foreground">{common('loading')}</p>;
  const cancellable = ['DRAFT', 'PUBLISHED', 'FULL'].includes(match.status);

  return (
    <div className="space-y-6">
      <Link href="/matches" className="text-sm text-brand-600 hover:underline">← {common('back')}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{match.title}</h1>
        <Badge variant="outline">{match.status}</Badge>
        {match.flagged && <Badge variant="destructive">{t('flagged')}</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">
        {t('detail.owner')}: {match.ownerUsername} · {t('detail.city')}: {match.cityName ?? '—'} · {t('detail.occupancy')}: {match.occupiedSlots}/{match.totalSlots}
      </p>
      {match.flaggedReason && <p className="text-sm text-destructive">{t('detail.flaggedReason')}: {match.flaggedReason}</p>}

      <MatchEditForm match={match} onSaved={setMatch} />

      <Card>
        <CardHeader><CardTitle>{t('actions.title')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {!match.flagged && <Button size="sm" variant={active === 'flag' ? 'default' : 'outline'} onClick={() => { setActive('flag'); setDone(false); setError(null); }}>{t('actions.flag')}</Button>}
            {match.flagged && <Button size="sm" variant={active === 'unflag' ? 'default' : 'outline'} onClick={() => { setActive('unflag'); setDone(false); setError(null); }}>{t('actions.unflag')}</Button>}
            {cancellable && <Button size="sm" variant={active === 'cancel' ? 'destructive' : 'outline'} onClick={() => { setActive('cancel'); setDone(false); setError(null); }}>{t('actions.cancel')}</Button>}
          </div>
          {active && (
            <div className="max-w-lg space-y-2">
              <Label htmlFor="reason">{t('actions.reason')}</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={submit} disabled={pending || !reason.trim()}>{common('confirm')}</Button>
                <Button size="sm" variant="ghost" onClick={() => { setActive(null); setReason(''); setError(null); }} disabled={pending}>{common('cancel')}</Button>
              </div>
            </div>
          )}
          {done && <p className="text-sm text-muted-foreground">{t('actions.done')}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('detail.participants')}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {match.participants.map((p) => (
                <li key={p.userId} className="flex justify-between gap-2">
                  <span>{p.firstName} {p.lastName} (@{p.username})</span>
                  <span className="text-muted-foreground">{p.role} · {p.status}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t('detail.auditTrail')}</CardTitle></CardHeader>
          <CardContent>
            {match.auditTrail.length === 0 ? <p className="text-sm text-muted-foreground">{t('detail.noAudit')}</p>
              : <ul className="space-y-1 text-sm">{match.auditTrail.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span className="font-medium">{a.action}</span>
                    <span className="text-muted-foreground">{a.actorUsername} · {new Date(a.createdAt).toLocaleDateString('ru-RU')}</span>
                  </li>
                ))}</ul>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
