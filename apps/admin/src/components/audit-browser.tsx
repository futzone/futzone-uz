'use client';

import { Button, Input, Label } from '@futzone/ui';
import type { AdminAuditItem } from '@futzone/contracts';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

type Filters = { action: string; targetType: string; targetId: string; dateFrom: string; dateTo: string };
const EMPTY: Filters = { action: '', targetType: '', targetId: '', dateFrom: '', dateTo: '' };

function toParams(f: Filters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.action) p.action = f.action;
  if (f.targetType) p.targetType = f.targetType;
  if (f.targetId) p.targetId = f.targetId;
  if (f.dateFrom) p.dateFrom = new Date(f.dateFrom).toISOString();
  if (f.dateTo) p.dateTo = new Date(f.dateTo).toISOString();
  return p;
}

export function AuditBrowser() {
  const t = useTranslations('audit');
  const common = useTranslations('common');
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [items, setItems] = useState<AdminAuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback((f: Filters) => {
    setLoading(true);
    apiClient.auditLogs(toParams(f)).then((res) => setItems(res.items)).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(EMPTY); }, [load]);

  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement>): void => setFilters((prev) => ({ ...prev, [key]: e.target.value }));

  const download = async (): Promise<void> => {
    const csv = await apiClient.auditCsv(toParams(filters)).catch(() => null);
    if (csv == null) return;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'audit-log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button variant="outline" size="sm" onClick={download}>{t('download')}</Button>
      </div>
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => { e.preventDefault(); load(filters); }}>
        <div className="space-y-1"><Label htmlFor="f-action">{t('action')}</Label><Input id="f-action" value={filters.action} onChange={set('action')} /></div>
        <div className="space-y-1"><Label htmlFor="f-type">{t('targetType')}</Label><Input id="f-type" value={filters.targetType} onChange={set('targetType')} /></div>
        <div className="space-y-1"><Label htmlFor="f-id">{t('targetId')}</Label><Input id="f-id" value={filters.targetId} onChange={set('targetId')} /></div>
        <div className="space-y-1"><Label htmlFor="f-from">{t('dateFrom')}</Label><Input id="f-from" type="date" value={filters.dateFrom} onChange={set('dateFrom')} /></div>
        <div className="space-y-1"><Label htmlFor="f-to">{t('dateTo')}</Label><Input id="f-to" type="date" value={filters.dateTo} onChange={set('dateTo')} /></div>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm">{t('apply')}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setFilters(EMPTY); load(EMPTY); }}>{t('reset')}</Button>
        </div>
      </form>
      {loading ? <p className="text-sm text-muted-foreground">{common('loading')}</p>
        : items.length === 0 ? <p className="text-sm text-muted-foreground">{t('empty')}</p>
        : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2">{t('columns.time')}</th>
                  <th className="px-3 py-2">{t('columns.actor')}</th>
                  <th className="px-3 py-2">{t('columns.action')}</th>
                  <th className="px-3 py-2">{t('columns.target')}</th>
                  <th className="px-3 py-2">{t('columns.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(row.createdAt).toLocaleString('ru-RU')}</td>
                    <td className="px-3 py-2">{row.actorUsername}</td>
                    <td className="px-3 py-2 font-medium">{row.action}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.targetType} · {row.targetId.slice(0, 8)}…</td>
                    <td className="px-3 py-2">{row.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
