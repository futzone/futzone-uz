'use client';

import { Badge } from '@futzone/ui';
import type { Notification, NotificationStreamEvent } from '@futzone/contracts';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { apiClient, ApiClientError } from '@/lib/api';
import { notificationMessage } from '@/lib/notifications/template';

/** Header bell: live unread badge (via SSE) and a dropdown of recent notifications. Renders nothing
 * for signed-out visitors. Notification text is localized from `type` at render time. */
export function NotificationBell() {
  const t = useTranslations('notifications');
  const translate = useCallback((key: string) => t(key as never), [t]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    let active = true;
    apiClient.unreadNotificationCount()
      .then(({ unreadCount }) => { if (active) { setUnread(unreadCount); setAuthed(true); } })
      .catch(() => { if (active) setAuthed(false); });
    return () => { active = false; };
  }, []);

  // Live stream. On error (including access-token expiry) close, resync the count, and reconnect
  // with a freshly minted token after a short delay.
  useEffect(() => {
    if (authed !== true) return;
    let source: EventSource | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const connect = async () => {
      const token = await apiClient.ensureAccessToken();
      if (!token || stopped) return;
      source = new EventSource(apiClient.notificationStreamUrl(token));
      source.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as NotificationStreamEvent;
          setUnread(data.unreadCount);
          setItems((prev) => [data.notification, ...prev.filter((n) => n.id !== data.notification.id)].slice(0, 10));
        } catch { /* ignore keepalive / malformed frames */ }
      };
      source.onerror = () => {
        source?.close();
        if (stopped) return;
        apiClient.unreadNotificationCount().then(({ unreadCount }) => setUnread(unreadCount)).catch(() => undefined);
        timer = setTimeout(() => { void connect(); }, 5_000);
      };
    };
    void connect();
    return () => { stopped = true; if (timer) clearTimeout(timer); source?.close(); };
  }, [authed]);

  const loadRecent = useCallback(() => {
    apiClient.notifications(undefined, 10)
      .then((res) => { setItems(res.items); setUnread(res.unreadCount); })
      .catch(() => undefined);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadRecent();
  };

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

  if (authed !== true) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? t('unreadAria', { count: unread }) : t('bellAria')}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
      >
        <span aria-hidden className="text-lg">🔔</span>
        {unread > 0 && (
          <Badge variant="destructive" className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1 text-[10px] leading-none">
            {unread > 99 ? '99+' : unread}
          </Badge>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-md border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">{t('title')}</span>
              {unread > 0 && (
                <button type="button" onClick={markAll} className="text-xs font-medium text-brand-600 hover:underline">{t('markAllRead')}</button>
              )}
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t('empty')}</li>}
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onItemClick(n)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${n.readAt ? '' : 'bg-accent/40'}`}
                  >
                    {!n.readAt && <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                    <span className={n.readAt ? 'text-muted-foreground' : 'font-medium'}>{notificationMessage(n.type, translate)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t px-3 py-2 text-center">
              <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-brand-600 hover:underline">{t('viewAll')}</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
