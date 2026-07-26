'use client';

import type { MatchSearchItem } from '@futzone/contracts';
import { Button, cn } from '@futzone/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/api';
import { MatchCard } from './match-card';
import { MatchMap } from './match-map';

/**
 * Renders the current page of results and progressively appends further pages via the
 * cursor. Toggles between a card list and a clustered map of the same items. When
 * `favoritesOnly` is set the first page is fetched client-side with the user's session
 * (the anonymous SSR pass cannot read private favourites). The parent passes `key={query}`
 * so a new filter set remounts this component with a fresh seed.
 */
export function MatchResults({ initialItems, initialCursor, query, favoritesOnly = false }: { initialItems: MatchSearchItem[]; initialCursor: string | null; query: string; favoritesOnly?: boolean }) {
  const t = useTranslations('matches.list');
  const [items, setItems] = useState<MatchSearchItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(favoritesOnly);
  const [failed, setFailed] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const bootstrapped = useRef(false);

  const fetchPage = useCallback(async (continuation: string | null, append: boolean) => {
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams(query);
      if (continuation) params.set('cursor', continuation);
      const next = await apiClient.matches(params.toString(), undefined, favoritesOnly);
      setItems((previous) => (append ? [...previous, ...next.items] : next.items));
      setCursor(next.nextCursor);
    } catch (error) {
      if (favoritesOnly && error instanceof ApiClientError && error.code === 'UNAUTHORIZED') setUnauthorized(true);
      else setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [favoritesOnly, query]);

  // Favourites cannot be resolved during anonymous SSR, so load the first page here.
  useEffect(() => {
    if (favoritesOnly && !bootstrapped.current) { bootstrapped.current = true; void fetchPage(null, false); }
  }, [favoritesOnly, fetchPage]);

  const tab = (value: 'list' | 'map', label: string) => <button type="button" aria-pressed={view === value} onClick={() => setView(value)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', view === value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{label}</button>;

  if (unauthorized) return <p className="mt-12 text-center text-muted-foreground">{t('favoritesLogin')}</p>;
  if (!items.length && !loading) return <p className="mt-12 text-center text-muted-foreground">{favoritesOnly ? t('favoritesEmpty') : t('empty')}</p>;

  return <div>
    <div className="mb-4 flex items-center justify-end">
      <div className="inline-flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label={t('viewLabel')}>{tab('list', t('viewList'))}{tab('map', t('viewMap'))}</div>
    </div>
    {view === 'list'
      ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((match) => <MatchCard key={match.id} match={match} />)}</div>
      : <MatchMap matches={items} />}
    {(cursor || loading) && <div className="mt-8 flex flex-col items-center gap-2">
      <Button variant="outline" onClick={() => void fetchPage(cursor, true)} disabled={loading || !cursor}>{loading ? t('loading') : t('loadMore')}</Button>
      {failed && <p className="text-sm text-destructive">{t('loadMoreFailed')}</p>}
    </div>}
  </div>;
}
