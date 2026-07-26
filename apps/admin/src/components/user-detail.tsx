'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@futzone/ui';
import type { AdminUserDetail, AuthUser } from '@futzone/contracts';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/api';

type Action = 'warn' | 'suspend' | 'ban' | 'unban' | 'verify';
const ADMIN_ONLY: Action[] = ['suspend', 'ban', 'unban', 'verify'];

export function UserDetail({ id }: { id: string }) {
  const t = useTranslations('users');
  const common = useTranslations('common');
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [role, setRole] = useState<AuthUser['role'] | null>(null);
  const [active, setActive] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [until, setUntil] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(() => { apiClient.user(id).then(setUser).catch(() => undefined); }, [id]);
  useEffect(() => { load(); apiClient.me().then((u) => setRole(u.role)).catch(() => undefined); }, [load]);

  const actions: Action[] = role === 'ADMIN' ? ['warn', 'suspend', 'ban', 'unban', 'verify'] : ['warn'];

  const reset = (): void => { setActive(null); setReason(''); setMessage(''); setUntil(''); setError(null); };

  const submit = async (): Promise<void> => {
    if (!active) return;
    setPending(true); setError(null);
    try {
      if (active === 'warn') await apiClient.warnUser(id, { reason, message });
      else if (active === 'suspend') await apiClient.suspendUser(id, { reason, until: new Date(until).toISOString() });
      else if (active === 'ban') await apiClient.banUser(id, { reason });
      else if (active === 'unban') await apiClient.unbanUser(id, { reason });
      else await apiClient.verifyUser(id, { reason });
      setDone(true); reset(); load();
    } catch (e) {
      setError(e instanceof ApiClientError && e.code === 'FORBIDDEN' ? t('actions.forbidden') : common('error'));
    } finally { setPending(false); }
  };

  if (!user) return <p className="text-sm text-muted-foreground">{common('loading')}</p>;

  return (
    <div className="space-y-6">
      <Link href="/users" className="text-sm text-brand-600 hover:underline">← {common('back')}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{user.firstName} {user.lastName}</h1>
        <span className="text-muted-foreground">@{user.username}</span>
        <Badge variant={user.status === 'ACTIVE' ? 'secondary' : 'destructive'}>{t(`status.${user.status}`)}</Badge>
        <Badge variant="outline">{t(`role.${user.role}`)}</Badge>
        <span className="text-sm text-muted-foreground">{user.verified ? t('verified') : t('notVerified')} · •••• {user.phoneLast4}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('detail.matchesPlayed')}</CardTitle></CardHeader><CardContent className="text-xl font-bold">{user.matchesPlayed}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('detail.matchesOrganized')}</CardTitle></CardHeader><CardContent className="text-xl font-bold">{user.matchesOrganized}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('detail.attendancePct')}</CardTitle></CardHeader><CardContent className="text-xl font-bold">{user.attendancePct == null ? '—' : `${user.attendancePct}%`}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('detail.rating')}</CardTitle></CardHeader><CardContent className="text-xl font-bold">{user.ratingAvg == null ? '—' : `${user.ratingAvg} (${user.ratingCount})`}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('actions.title')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <Button key={a} size="sm" variant={active === a ? 'default' : 'outline'} disabled={role !== 'ADMIN' && ADMIN_ONLY.includes(a)}
                onClick={() => { setActive(a); setError(null); setDone(false); }}>{t(`actions.${a}`)}</Button>
            ))}
          </div>
          {active && (
            <div className="max-w-lg space-y-3">
              <div className="space-y-1">
                <Label htmlFor="reason">{t('actions.reason')}</Label>
                <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              {active === 'warn' && (
                <div className="space-y-1">
                  <Label htmlFor="message">{t('actions.message')}</Label>
                  <Input id="message" value={message} onChange={(e) => setMessage(e.target.value)} />
                </div>
              )}
              {active === 'suspend' && (
                <div className="space-y-1">
                  <Label htmlFor="until">{t('actions.until')}</Label>
                  <Input id="until" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
                </div>
              )}
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={submit} disabled={pending || !reason.trim() || (active === 'warn' && !message.trim()) || (active === 'suspend' && !until)}>{common('confirm')}</Button>
                <Button size="sm" variant="ghost" onClick={reset} disabled={pending}>{common('cancel')}</Button>
              </div>
            </div>
          )}
          {done && <p className="text-sm text-muted-foreground">{t('actions.done')}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('detail.recentMatches')}</CardTitle></CardHeader>
          <CardContent>
            {user.recentMatches.length === 0 ? <p className="text-sm text-muted-foreground">{t('detail.noMatches')}</p>
              : <ul className="space-y-1 text-sm">{user.recentMatches.map((m) => <li key={m.id} className="flex justify-between gap-2"><span className="truncate">{m.title}</span><span className="text-muted-foreground">{m.status}</span></li>)}</ul>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t('detail.reports')}</CardTitle></CardHeader>
          <CardContent>
            {user.reportsAgainst.length === 0 ? <p className="text-sm text-muted-foreground">{t('detail.noReports')}</p>
              : <ul className="space-y-1 text-sm">{user.reportsAgainst.map((r) => <li key={r.id} className="truncate">{r.reason}</li>)}</ul>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
