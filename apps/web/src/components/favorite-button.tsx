'use client';

import { Button } from '@futzone/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { apiClient, ApiClientError } from '@/lib/api';

/** Star toggle for favouriting a stadium or an organizer. Resolves its own initial state from the session. */
export function FavoriteButton({ type, targetId }: { type: 'stadium' | 'organizer'; targetId: string }) {
  const t = useTranslations('favorites');
  const router = useRouter();
  const pathname = usePathname();
  const [favorited, setFavorited] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient.favorites()
      .then((favorites) => {
        if (!active) return;
        const list = type === 'stadium' ? favorites.stadiums : favorites.organizers;
        setFavorited(list.some((entry) => entry.id === targetId));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [type, targetId]);

  const toggle = async () => {
    const next = !favorited;
    setPending(true);
    setFavorited(next); // optimistic
    try {
      if (type === 'stadium') await (next ? apiClient.addFavoriteStadium(targetId) : apiClient.removeFavoriteStadium(targetId));
      else await (next ? apiClient.addFavoriteOrganizer(targetId) : apiClient.removeFavoriteOrganizer(targetId));
    } catch (error) {
      setFavorited(!next); // revert
      if (error instanceof ApiClientError && error.code === 'UNAUTHORIZED') router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
    } finally {
      setPending(false);
    }
  };

  return <Button type="button" variant={favorited ? 'secondary' : 'outline'} size="sm" onClick={toggle} disabled={pending} aria-pressed={favorited} aria-label={t(favorited ? 'remove' : 'add')}>
    <span aria-hidden>{favorited ? '★' : '☆'}</span> {t(favorited ? 'favorited' : 'favorite')}
  </Button>;
}
