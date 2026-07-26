import type { City } from '@futzone/contracts';
import { Button } from '@futzone/ui';
import { getTranslations } from 'next-intl/server';
import { MatchCard } from '@/components/match-card';
import { getSiteUrl } from '@/i18n/metadata';
import { Link } from '@/i18n/navigation';
import { ApiClient } from '@/lib/api/client';
import { breadcrumbJsonLd, JsonLdScript } from '@/lib/structured-data';

/** SEO city landing served from `/[locale]/matches/[city]` when the segment is a known city slug. */
export async function CityMatchesLanding({ city, locale }: { city: City; locale: string }) {
  const client = new ApiClient(process.env.NEXT_PUBLIC_API_URL);
  const [search, t] = await Promise.all([client.matches(`city=${encodeURIComponent(city.slug)}`, { cache: 'no-store' }), getTranslations()]);
  return <main className="mx-auto max-w-7xl px-4 py-10">
    <JsonLdScript data={breadcrumbJsonLd([
      { name: t('common.appName'), url: new URL(`/${locale}`, getSiteUrl()).toString() },
      { name: t('matches.list.title'), url: new URL(`/${locale}/matches`, getSiteUrl()).toString() },
      { name: city.name, url: new URL(`/${locale}/matches/${city.slug}`, getSiteUrl()).toString() },
    ])} />
    <h1 className="text-3xl font-bold">{t('matches.cityLanding.title', { city: city.name })}</h1>
    <p className="mt-2 max-w-2xl text-muted-foreground">{t('matches.cityLanding.intro', { city: city.name })}</p>
    <div className="mt-4"><Button asChild variant="outline"><Link href={`/matches?city=${encodeURIComponent(city.slug)}`}>{t('matches.cityLanding.browseAll')}</Link></Button></div>
    {search.items.length
      ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{search.items.map((match) => <MatchCard key={match.id} match={match} />)}</div>
      : <p className="mt-12 text-center text-muted-foreground">{t('matches.list.empty')}</p>}
  </main>;
}
