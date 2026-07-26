'use client';

import { Badge, Button, Input } from '@futzone/ui';
import type { AdminMatchListItem } from '@futzone/contracts';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

export function MatchesBrowser() {
  const t = useTranslations('matches');
  const common = useTranslations('common');
  const [q, setQ] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [items, setItems] = useState<AdminMatchListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback((query: string, flagged: boolean) => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (query) params.q = query;
    if (flagged) params.flagged = 'true';
    apiClient.matches(params).then((res) => setItems(res.items)).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load('', false); }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <form className="flex flex-wrap items-center gap-3" onSubmit={(e) => { e.preventDefault(); load(q.trim(), flaggedOnly); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="max-w-md" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={flaggedOnly} onChange={(e) => { setFlaggedOnly(e.target.checked); load(q.trim(), e.target.checked); }} />
          {t('flaggedOnly')}
        </label>
        <Button type="submit">{t('search')}</Button>
      </form>
      {loading ? <p className="text-sm text-muted-foreground">{common('loading')}</p>
        : items.length === 0 ? <p className="text-sm text-muted-foreground">{t('empty')}</p>
        : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2">{t('columns.title')}</th>
                  <th className="px-3 py-2">{t('columns.owner')}</th>
                  <th className="px-3 py-2">{t('columns.status')}</th>
                  <th className="px-3 py-2">{t('columns.starts')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{m.title} {m.flagged && <Badge variant="destructive" className="ml-1">!</Badge>}</td>
                    <td className="px-3 py-2">{m.ownerUsername}</td>
                    <td className="px-3 py-2">{m.status}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(m.startsAt).toLocaleString('ru-RU')}</td>
                    <td className="px-3 py-2 text-right"><Link className="text-brand-600 hover:underline" href={`/matches/${m.id}`}>{t('view')}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
