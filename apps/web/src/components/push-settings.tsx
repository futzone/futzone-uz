'use client';

import { Button } from '@futzone/ui';
import { NotificationType } from '@futzone/contracts';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/api';

const TYPES = Object.values(NotificationType);

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type Status = 'loading' | 'unsupported' | 'idle' | 'subscribed' | 'blocked' | 'unavailable';

/** Settings panel: toggle Web Push for this device and choose which notification types may push. */
export function PushSettings() {
  const t = useTranslations('notifications');
  const translate = useCallback((key: string) => t(key as never), [t]);
  const [status, setStatus] = useState<Status>('loading');
  const [pending, setPending] = useState(false);
  const [flags, setFlags] = useState<Record<string, { push: boolean }>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) { setStatus('unsupported'); return; }
    (async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const subscription = await registration.pushManager.getSubscription();
        if (!active) return;
        setStatus(Notification.permission === 'denied' ? 'blocked' : subscription ? 'subscribed' : 'idle');
      } catch { if (active) setStatus('unavailable'); }
      apiClient.notificationPreferences()
        .then((pref) => { if (active) setFlags({ ...(pref.perTypeChannelFlags as Record<string, { push: boolean }>) }); })
        .catch(() => undefined);
    })();
    return () => { active = false; };
  }, []);

  const enable = async () => {
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus('blocked'); return; }
      const { publicKey } = await apiClient.vapidPublicKey();
      if (!publicKey) { setStatus('unavailable'); return; }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = subscription.toJSON();
      await apiClient.subscribePush({
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
        userAgent: navigator.userAgent,
      });
      setStatus('subscribed');
    } catch (error) {
      if (!(error instanceof ApiClientError)) setStatus('unavailable');
    } finally {
      setPending(false);
    }
  };

  const disable = async () => {
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await apiClient.unsubscribePush(subscription.endpoint);
      }
      setStatus('idle');
    } catch (error) {
      if (!(error instanceof ApiClientError)) setStatus('unavailable');
    } finally {
      setPending(false);
    }
  };

  const toggleType = (type: string) => {
    setSaved(false);
    setFlags((prev) => {
      const current = prev[type]?.push !== false; // default on
      return { ...prev, [type]: { push: !current } };
    });
  };

  const savePreferences = async () => {
    setPending(true);
    try {
      const pref = await apiClient.updateNotificationPreferences({ perTypeChannelFlags: flags });
      setFlags({ ...(pref.perTypeChannelFlags as Record<string, { push: boolean }>) });
      setSaved(true);
    } catch (error) {
      if (!(error instanceof ApiClientError)) throw error;
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('push.heading')}</h2>
        {status === 'unsupported' && <p className="mt-1 text-sm text-muted-foreground">{t('push.unsupported')}</p>}
        {status === 'unavailable' && <p className="mt-1 text-sm text-muted-foreground">{t('push.unavailable')}</p>}
        {status === 'blocked' && <p className="mt-1 text-sm text-destructive">{t('push.blocked')}</p>}
        {status === 'subscribed' && (
          <div className="mt-2 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{t('push.enabled')}</span>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={disable}>{t('push.disable')}</Button>
          </div>
        )}
        {status === 'idle' && (
          <div className="mt-2">
            <Button type="button" size="sm" disabled={pending} onClick={enable}>{t('push.enable')}</Button>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold">{t('push.preferencesHeading')}</h3>
        <ul className="mt-2 space-y-1">
          {TYPES.map((type) => (
            <li key={type}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={flags[type]?.push !== false}
                  onChange={() => toggleType(type)}
                />
                <span>{translate(`types.${type}`)}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={savePreferences}>{t('push.save')}</Button>
          {saved && <span className="text-sm text-muted-foreground">{t('push.saved')}</span>}
        </div>
      </div>
    </section>
  );
}
