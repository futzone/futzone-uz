import type { Metadata } from 'next';
import { cache } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Card } from '@futzone/ui';
import type { City, Stadium } from '@futzone/contracts';
import { MatchCard } from '@/components/match-card';
import { StadiumCard } from '@/components/stadium-card';
import { YandexMap } from '@/components/yandex-map';
import { getPathAlternateLinks, getSiteUrl } from '@/i18n/metadata';
import { Link } from '@/i18n/navigation';
import { ApiClient, ApiClientError } from '@/lib/api/client';
import { stadiumName } from '@/lib/stadiums';
import { breadcrumbJsonLd, JsonLdScript } from '@/lib/structured-data';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ locale: string; segment: string }> };
type Resolved = { kind: 'city'; city: City } | { kind: 'stadium'; stadium: Stadium } | { kind: 'notfound' };

// `/stadiums/[segment]` serves both a city landing and a stadium page; a stadium slug always
// carries an id suffix so it can never collide with a bare city slug (see DECISIONS.md ADR-035).
const resolve = cache(async (locale: string, segment: string): Promise<Resolved> => {
  const client = new ApiClient(process.env.NEXT_PUBLIC_API_URL);
  const cities = await client.cities(locale);
  const city = cities.find((entry) => entry.slug === segment);
  if (city) return { kind: 'city', city };
  try {
    const stadium = await client.stadium(segment, { next: { revalidate: 300 } });
    return { kind: 'stadium', stadium };
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'NOT_FOUND') return { kind: 'notfound' };
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, segment } = await params;
  const [resolved, t] = await Promise.all([resolve(locale, segment), getTranslations({ locale, namespace: 'stadiums' })]);
  if (resolved.kind === 'notfound') return { robots: { index: false, follow: false } };
  const path = `/stadiums/${segment}`;
  if (resolved.kind === 'city') return { title: t('inCity', { city: resolved.city.name }), description: t('inCityIntro', { city: resolved.city.name }), alternates: getPathAlternateLinks(locale, path) };
  const name = stadiumName(resolved.stadium, locale);
  return { title: t('detailTitle', { name }), description: `${name} · ${resolved.stadium.district}. ${t('upcomingHere')}`, alternates: getPathAlternateLinks(locale, path) };
}

export default async function StadiumSegmentPage({ params }: Props) {
  const { locale, segment } = await params;
  setRequestLocale(locale);
  const resolved = await resolve(locale, segment);
  if (resolved.kind === 'notfound') notFound();
  const client = new ApiClient(process.env.NEXT_PUBLIC_API_URL);
  const t = await getTranslations();

  if (resolved.kind === 'city') {
    const stadiums = await client.stadiums(resolved.city.slug, { next: { revalidate: 300 } });
    return <main className="mx-auto max-w-7xl px-4 py-10">
      <JsonLdScript data={breadcrumbJsonLd([
        { name: t('common.appName'), url: new URL(`/${locale}`, getSiteUrl()).toString() },
        { name: t('stadiums.title'), url: new URL(`/${locale}/stadiums`, getSiteUrl()).toString() },
        { name: resolved.city.name, url: new URL(`/${locale}/stadiums/${resolved.city.slug}`, getSiteUrl()).toString() },
      ])} />
      <h1 className="text-3xl font-bold">{t('stadiums.inCity', { city: resolved.city.name })}</h1>
      <p className="mt-2 text-muted-foreground">{t('stadiums.inCityIntro', { city: resolved.city.name })}</p>
      {stadiums.length
        ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{stadiums.map((stadium) => <StadiumCard key={stadium.id} stadium={stadium} locale={locale} />)}</div>
        : <p className="mt-12 text-center text-muted-foreground">{t('stadiums.empty')}</p>}
    </main>;
  }

  const { stadium } = resolved;
  const name = stadiumName(stadium, locale);
  const upcoming = await client.matches(`stadium=${encodeURIComponent(stadium.slug)}`, { cache: 'no-store' });
  return <main className="mx-auto max-w-6xl px-4 py-10">
    <JsonLdScript data={breadcrumbJsonLd([
      { name: t('common.appName'), url: new URL(`/${locale}`, getSiteUrl()).toString() },
      { name: t('stadiums.title'), url: new URL(`/${locale}/stadiums`, getSiteUrl()).toString() },
      { name, url: new URL(`/${locale}/stadiums/${stadium.slug}`, getSiteUrl()).toString() },
    ])} />
    <h1 className="text-3xl font-bold">{name}</h1>
    <p className="mt-2 text-muted-foreground">{stadium.district} · {stadium.address}</p>
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div>
        <h2 className="text-xl font-semibold">{t('stadiums.upcomingHere')}</h2>
        {upcoming.items.length
          ? <div className="mt-4 grid gap-5 sm:grid-cols-2">{upcoming.items.map((match) => <MatchCard key={match.id} match={match} />)}</div>
          : <p className="mt-4 text-muted-foreground">{t('stadiums.noUpcoming')}</p>}
      </div>
      <aside className="grid content-start gap-4">
        <Card className="p-4"><YandexMap latitude={stadium.latitude} longitude={stadium.longitude} readOnly /></Card>
        <Link href={`/matches?stadium=${encodeURIComponent(stadium.slug)}`} className="text-sm text-primary underline-offset-4 hover:underline">{t('stadiums.allHere')}</Link>
      </aside>
    </div>
  </main>;
}
