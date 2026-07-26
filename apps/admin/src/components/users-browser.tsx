'use client';

import { Badge, Button, Input } from '@futzone/ui';
import type { AdminUserListItem } from '@futzone/contracts';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'secondary', WARNED: 'outline', SUSPENDED: 'destructive', BANNED: 'destructive',
};

export function UsersBrowser() {
  const t = useTranslations('users');
  const common = useTranslations('common');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback((query: string) => {
    setLoading(true);
    apiClient.users(query).then((res) => setItems(res.items)).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(''); }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); load(q.trim()); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="max-w-md" />
        <Button type="submit">{t('search')}</Button>
      </form>
      {loading ? <p className="text-sm text-muted-foreground">{common('loading')}</p>
        : items.length === 0 ? <p className="text-sm text-muted-foreground">{t('empty')}</p>
        : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2">{t('columns.name')}</th>
                  <th className="px-3 py-2">{t('columns.username')}</th>
                  <th className="px-3 py-2">{t('columns.phone')}</th>
                  <th className="px-3 py-2">{t('columns.status')}</th>
                  <th className="px-3 py-2">{t('columns.role')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{u.firstName} {u.lastName}</td>
                    <td className="px-3 py-2">{u.username}</td>
                    <td className="px-3 py-2 tabular-nums">•••• {u.phoneLast4}</td>
                    <td className="px-3 py-2"><Badge variant={STATUS_VARIANT[u.status] ?? 'outline'}>{t(`status.${u.status}`)}</Badge></td>
                    <td className="px-3 py-2">{t(`role.${u.role}`)}</td>
                    <td className="px-3 py-2 text-right"><Link className="text-brand-600 hover:underline" href={`/users/${u.id}`}>{t('view')}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
