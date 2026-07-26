'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@futzone/ui';
import type { AdminMatchDetail, UpdateMatchBody } from '@futzone/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/api';

// ISO → value for <input type="datetime-local"> (local wall-clock, minutes precision).
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MatchEditForm({ match, onSaved }: { match: AdminMatchDetail; onSaved: (updated: AdminMatchDetail) => void }) {
  const t = useTranslations('matches');
  const common = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: match.title,
    startsAt: toLocalInput(match.startsAt),
    durationMin: String(match.durationMin),
    totalSlots: String(match.totalSlots),
    address: match.address ?? '',
    fieldPriceUzs: String(match.fieldPriceUzs),
    perPlayerFeeUzs: String(match.perPlayerFeeUzs),
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>): void => setForm((p) => ({ ...p, [key]: e.target.value }));

  const save = async (): Promise<void> => {
    const body: UpdateMatchBody = {};
    if (form.title !== match.title) body.title = form.title;
    if (new Date(form.startsAt).toISOString() !== match.startsAt) body.startsAt = new Date(form.startsAt).toISOString();
    if (Number(form.durationMin) !== match.durationMin) body.durationMin = Number(form.durationMin);
    if (Number(form.totalSlots) !== match.totalSlots) body.totalSlots = Number(form.totalSlots);
    if (form.address !== (match.address ?? '')) body.address = form.address;
    if (Number(form.fieldPriceUzs) !== match.fieldPriceUzs) body.fieldPriceUzs = Number(form.fieldPriceUzs);
    if (Number(form.perPlayerFeeUzs) !== match.perPlayerFeeUzs) body.perPlayerFeeUzs = Number(form.perPlayerFeeUzs);
    if (Object.keys(body).length === 0) { setError(t('edit.noChanges')); return; }
    setPending(true); setError(null);
    try {
      const updated = await apiClient.editMatch(match.id, body);
      onSaved(updated);
      setOpen(false);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : common('error')); }
    finally { setPending(false); }
  };

  if (!open) return <Button size="sm" variant="outline" onClick={() => { setError(null); setOpen(true); }}>{t('edit.title')}</Button>;

  const field = (key: keyof typeof form, label: string, type = 'text'): React.ReactElement => (
    <div className="space-y-1">
      <Label htmlFor={`edit-${key}`}>{label}</Label>
      <Input id={`edit-${key}`} type={type} value={form[key]} onChange={set(key)} />
    </div>
  );

  return (
    <Card>
      <CardHeader><CardTitle>{t('edit.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {field('title', t('edit.matchTitle'))}
          {field('startsAt', t('edit.startsAt'), 'datetime-local')}
          {field('durationMin', t('edit.durationMin'), 'number')}
          {field('totalSlots', t('edit.totalSlots'), 'number')}
          {field('address', t('edit.address'))}
          {field('fieldPriceUzs', t('edit.fieldPrice'), 'number')}
          {field('perPlayerFeeUzs', t('edit.perPlayerFee'), 'number')}
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={pending}>{t('edit.save')}</Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>{common('cancel')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
