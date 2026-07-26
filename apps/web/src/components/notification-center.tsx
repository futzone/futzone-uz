'use client';

import { Button } from '@futzone/ui';
import type { Notification } from '@futzone/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { apiClient, ApiClientError } from '@/lib/api';
import { notificationMessage } from '@/lib/notifications/template';

/** Full notification history with cursor pagination, mark-one/mark-all read. */
export function NotificationCenter() {
  const t = useTranslations('notifications');
  const translate = useCallback((key: string) => t(key as never), [t]);
  const format = useFormatter();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (next?: string) => {
    setLoading(true);
    try {
      const res = await apiClient.notifications(next, 20);
      setItems((prev) => (next ? [...prev, ...res.items] : res.items));
      setCursor(res.nextCursor);
      setUnread(res.unreadCount);
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'UNAUTHORIZED') router.push('/login?returnTo=/notifications');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const markAll = async () => {
    try {
      const { unreadCount } = await apiClient.markAllNotificationsRead();
      setUnread(unreadCount);
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    } catch (error) { if (!(error instanceof ApiClientError)) throw error; }
  };

  const onItemClick = async (n: Notification) => {
    if (n.readAt) return;
    try {
      const { unreadCount } = await apiClient.markNotificationRead(n.id);
      setUnread(unreadCount);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    } catch (error) { if (!(error instanceof ApiClientError)) throw error; }
  };

  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        {unread > 0 && <Button type="button" variant="outline" size="sm" onClick={markAll}>{t('markAllRead')}</Button>}
      </div>
      {!loading && items.length === 0 && <p className="py-16 text-center text-muted-foreground">{t('empty')}</p>}
      <ul className="divide-y rounded-md border">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onItemClick(n)}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent ${n.readAt ? '' : 'bg-accent/40'}`}
            >
              {!n.readAt && <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
              <span className="flex-1">
                <span className={`block text-sm ${n.readAt ? 'text-muted-foreground' : 'font-medium'}`}>{notificationMessage(n.type, translate)}</span>
                <time className="mt-0.5 block text-xs text-muted-foreground" dateTime={n.createdAt}>
                  {format.dateTime(new Date(n.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
                </time>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {cursor && (
        <div className="mt-4 text-center">
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => load(cursor)}>{t('loadMore')}</Button>
        </div>
      )}
    </section>
  );
}
