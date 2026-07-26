import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PublicProfile, type PublicProfileLabels } from '@/components/public-profile';
import { ApiClient } from '@/lib/api';
import { BADGE_CODES } from '@/lib/badges';
import { loadPublicProfile, loadPublicProfileMetadata } from '@/lib/profile-loader';
import { getPathAlternateLinks, getSiteUrl } from '@/i18n/metadata';
import { breadcrumbJsonLd, JsonLdScript, personJsonLd } from '@/lib/structured-data';

type Props = { params: Promise<{ locale: string; username: string }>; searchParams: Promise<{ commentsPage?: string }> };
const serverApi = () => new ApiClient(process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, username } = await params;
  const [profile, t] = await Promise.all([loadPublicProfileMetadata(username, locale, serverApi()), getTranslations({ locale, namespace: 'profile' })]);
  if (!profile) return { robots: { index: false, follow: false } };
  const name = `${profile.firstName} ${profile.lastName}`;
  return { title: t('metadataTitle', { name }), description: profile.bio ?? t('metadataDescription', { name, username: profile.username }), alternates: getPathAlternateLinks(locale, `/players/${profile.username}`) };
}

export default async function PublicProfilePage({ params, searchParams }: Props) {
  const { locale, username } = await params; setRequestLocale(locale);
  const requestedPage = Number((await searchParams).commentsPage ?? 1);
  const commentsPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const profile = await loadPublicProfile(username, locale, serverApi(), commentsPage);
  if (!profile) notFound();
  const [t, positionT, commonT] = await Promise.all([getTranslations('profile'), getTranslations('positions'), getTranslations('common')]);
  const labels: PublicProfileLabels = {
    verified: t('verified'), newPlayer: t('newPlayer'), notSet: t('notSet'), joined: t('joined'),
    position: t('position'), city: t('city'), badges: t('badges'), matchesPlayed: t('stats.matchesPlayed'),
    matchesOrganized: t('stats.matchesOrganized'), attendance: t('stats.attendance'), rating: t('stats.bayesAvg'),
    ratingCount: t('stats.ratingCount', { count: profile.stats.ratingCount }), breakdown: t('attendanceBreakdown'),
    onTime: t('attendance.onTime'), late: t('attendance.late'), noShow: t('attendance.noShow'),
    cancelledEarly: t('attendance.cancelledEarly'), recentMatches: t('recentMatches'),
    noRecentMatches: t('noRecentMatches'), comments: t('comments.title'), noComments: t('comments.empty'),
    previous: t('comments.previous'), next: t('comments.next'), ownHint: t('ownHint'),
    badgeCatalog: Object.fromEntries(BADGE_CODES.map((code) => [code, {
      name: t(`badgeCatalog.${code}.name`),
      description: t(`badgeCatalog.${code}.description`),
    }])) as PublicProfileLabels['badgeCatalog'],
  };
  const profileUrl = new URL(`/${locale}/players/${profile.username}`, getSiteUrl()).toString();
  return <><JsonLdScript data={personJsonLd(profile, profileUrl)} /><JsonLdScript data={breadcrumbJsonLd([
    { name: commonT('appName'), url: new URL(`/${locale}`, getSiteUrl()).toString() },
    { name: `${profile.firstName} ${profile.lastName}`, url: profileUrl },
  ])} /><PublicProfile profile={profile} labels={labels} joinedDate={new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(profile.joinedAt))} positionLabel={profile.position ? positionT(profile.position) : undefined} /></>;
}
