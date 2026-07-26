import { Button } from '@futzone/ui';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ActiveFilterChips } from '@/components/active-filter-chips';
import { MatchFiltersPanel } from '@/components/match-filters-panel';
import { MatchResults } from '@/components/match-results';
import { Link } from '@/i18n/navigation';
import { ApiClient } from '@/lib/api/client';
import { parseMatchFilters, toMatchApiQuery, type RawSearchParams } from '@/lib/match-filters';

export const dynamic = 'force-dynamic';
export async function generateMetadata() { const t = await getTranslations('matches.list'); return { title: t('title') }; }

export default async function MatchesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<RawSearchParams> }) {
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const filters = parseMatchFilters(rawSearchParams);
  const query = toMatchApiQuery(filters);
  const client = new ApiClient(process.env.NEXT_PUBLIC_API_URL);
  // Favourites are private to the signed-in user and cannot be resolved during anonymous SSR,
  // so the results component loads that first page client-side with the session token.
  const [search, cities, t] = await Promise.all([
    filters.favoritesOnly ? Promise.resolve({ items: [], nextCursor: null }) : client.matches(query, { cache: 'no-store' }),
    client.cities(locale),
    getTranslations(),
  ]);
  return <main className="mx-auto max-w-7xl px-4 py-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-bold">{t('matches.list.title')}</h1><p className="mt-2 text-muted-foreground">{t('matches.list.subtitle')}</p></div>
      <Button asChild><Link href="/matches/new">{t('matches.list.create')}</Link></Button>
    </div>
    <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
      <MatchFiltersPanel key={query} filters={filters} cities={cities} />
      <div>
        <ActiveFilterChips filters={filters} cities={cities} />
        <div className="mt-6"><MatchResults key={query} initialItems={search.items} initialCursor={search.nextCursor} query={query} favoritesOnly={filters.favoritesOnly ?? false} /></div>
      </div>
    </div>
  </main>;
}
