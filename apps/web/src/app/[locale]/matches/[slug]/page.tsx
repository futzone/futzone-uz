import type { Metadata } from 'next';
import { cache } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Card } from '@futzone/ui';
import { CityMatchesLanding } from '@/components/city-matches-landing';
import { MatchCta } from '@/components/match-cta';
import { FavoriteButton } from '@/components/favorite-button';
import { OccupancyBar } from '@/components/occupancy-bar';
import { OwnerPanel } from '@/components/owner-panel';
import { ParticipantList } from '@/components/participant-list';
import { YandexMap } from '@/components/yandex-map';
import { InviteOnlyMatchShellView } from '@/components/invite-only-match-shell';
import { MatchTrustPanel } from '@/components/match-trust-panel';
import { ApiClient, ApiClientError } from '@/lib/api/client';
import { getPathAlternateLinks, getSiteUrl } from '@/i18n/metadata';
import { matchMetadataText, matchRobots } from '@/lib/match-metadata';
import { breadcrumbJsonLd, JsonLdScript, sportsEventJsonLd } from '@/lib/structured-data';

type Props = { params: Promise<{ locale: string; slug: string }> };
export const dynamic = 'force-dynamic';
const load = cache(async (slug: string, locale: string) => {
  const client = new ApiClient(process.env.NEXT_PUBLIC_API_URL);
  try { return await client.match(slug, locale, { next: { revalidate: 60 } }); }
  catch (error) { if (error instanceof ApiClientError && error.code === 'NOT_FOUND') notFound(); throw error; }
});
// `/matches/[slug]` also serves the city landing when the segment is a known city slug; a match
// slug always carries an id suffix so it can never equal a bare city slug (see DECISIONS.md ADR-035).
const cityForSegment = cache(async (segment: string, locale: string) => {
  const cities = await new ApiClient(process.env.NEXT_PUBLIC_API_URL).cities(locale);
  return cities.find((city) => city.slug === segment) ?? null;
});
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const city = await cityForSegment(slug, locale);
  if (city) {
    const tl = await getTranslations({ locale, namespace: 'matches.cityLanding' });
    return { title: tl('title', { city: city.name }), description: tl('intro', { city: city.name }), alternates: getPathAlternateLinks(locale, `/matches/${slug}`) };
  }
  const [match, t] = await Promise.all([load(slug, locale), getTranslations({ locale, namespace: 'matches.seo' })]);
  const text = matchMetadataText(match, locale, t);
  const alternates = getPathAlternateLinks(locale, `/matches/${slug}`);
  return {
    ...text,
    alternates,
    robots: matchRobots(match),
    openGraph: {
      ...text,
      type: 'website',
      url: alternates.canonical,
      images: [`/${locale}/matches/${slug}/opengraph-image`],
    },
  };
}
export default async function MatchPage({ params }: Props) {
  const { locale, slug } = await params; setRequestLocale(locale);
  const city = await cityForSegment(slug, locale);
  if (city) return <CityMatchesLanding city={city} locale={locale} />;
  const [match, t] = await Promise.all([load(slug, locale), getTranslations()]);
  if (match.visibility === 'INVITE_ONLY_SHELL') return <InviteOnlyMatchShellView match={match} locale={locale} labels={{
    state: t('matches.actions.inviteOnly'),
    when: t('matches.detail.when'),
    privacy: t('matches.detail.invitePrivacy'),
  }} />;
  const latitude = match.stadium?.latitude ?? match.latitude; const longitude = match.stadium?.longitude ?? match.longitude;
  return <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_22rem]">
    <JsonLdScript data={sportsEventJsonLd(match, {
      url: new URL(`/${locale}/matches/${slug}`, getSiteUrl()).toString(),
      organizerLabel: t('matches.seo.organizer'),
    })} />
    <JsonLdScript data={breadcrumbJsonLd([
      { name: t('common.appName'), url: new URL(`/${locale}`, getSiteUrl()).toString() },
      { name: t('matches.list.title'), url: new URL(`/${locale}/matches`, getSiteUrl()).toString() },
      { name: match.title, url: new URL(`/${locale}/matches/${slug}`, getSiteUrl()).toString() },
    ])} />
    <div className="grid gap-6">
      {match.status === 'CANCELLED' && <div className="rounded-xl bg-destructive/10 p-5 text-destructive"><strong>{t('matches.actions.cancelled')}</strong></div>}
      {['FINISHED', 'ATTENDANCE_PENDING', 'RATING_PENDING', 'COMPLETED'].includes(match.status) && <div className="rounded-xl bg-muted p-5"><strong>{t('matches.detail.finished')}</strong></div>}
      <div><p className="text-sm font-medium text-primary">{match.city.name} · {match.format}</p><h1 className="mt-2 text-3xl font-bold">{match.title}</h1></div>
      <Card className="grid gap-5 p-6 sm:grid-cols-2">
        <Info label={t('matches.detail.when')} value={new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Tashkent' }).format(new Date(match.startsAt))} />
        <Info label={t('matches.detail.where')} value={match.stadium?.name ?? match.address ?? ''} />
        <Info label={t('matches.detail.level')} value={t(`matches.wizard.levels.${match.level}`)} />
        <Info label={t('matches.detail.price')} value={`${new Intl.NumberFormat(locale).format(match.perPlayerFeeUzs)} UZS`} />
        <Info label={t('matches.detail.surface')} value={t(`matches.wizard.surfaces.${match.surface}`)} />
        <Info label={t('matches.detail.duration')} value={t('matches.detail.minutes', { count: match.durationMin })} />
      </Card>
      {latitude != null && longitude != null && <YandexMap latitude={latitude} longitude={longitude} />}
      <Card className="p-6"><h2 className="text-xl font-semibold">{t('matches.detail.players')}</h2><ParticipantList participants={match.participants} /></Card>
      <MatchTrustPanel match={match} />
    </div>
    <aside className="grid content-start gap-6">
      <Card className="p-6"><OccupancyBar occupiedSlots={match.occupiedSlots} totalSlots={match.totalSlots} label={t('matches.occupancy')} /><MatchCta match={match} /></Card>
      <Card className="p-6"><h2 className="mb-3 text-sm font-medium text-muted-foreground">{t('favorites.title')}</h2><div className="flex flex-wrap gap-2"><FavoriteButton type="organizer" targetId={match.ownerId} />{match.stadiumId && <FavoriteButton type="stadium" targetId={match.stadiumId} />}</div></Card>
      <OwnerPanel match={match} />
    </aside>
  </main>;
}
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-sm text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>; }
