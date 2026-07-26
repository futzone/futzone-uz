import type { PublicProfile as PublicProfileData } from '@futzone/contracts';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@futzone/ui';
import React, { type ReactNode } from 'react';
import { Link } from '../i18n/navigation';
import { isBadgeCode, type BadgeCode } from '../lib/badges';
import { isNewPlayer } from '../lib/profile';
import { OwnProfileHints } from './own-profile-hints';
import { ReportRatingButton } from './report-rating-button';

export type PublicProfileLabels = {
  verified: string; newPlayer: string; notSet: string; joined: string; position: string; city: string;
  badges: string; matchesPlayed: string; matchesOrganized: string; attendance: string; rating: string;
  ratingCount: string; breakdown: string; onTime: string; late: string; noShow: string;
  cancelledEarly: string; recentMatches: string; noRecentMatches: string; comments: string;
  noComments: string; previous: string; next: string; ownHint: string;
  badgeCatalog: Record<BadgeCode, { name: string; description: string }>;
};

export function PublicProfile({ profile, labels, joinedDate, positionLabel }: {
  profile: PublicProfileData; labels: PublicProfileLabels; joinedDate: string; positionLabel?: string;
}) {
  const stat = (label: string, value: ReactNode) => <div className="rounded-lg bg-muted p-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-bold">{value}</dd></div>;
  const rating = isNewPlayer(profile) ? labels.newPlayer : profile.stats.bayesAvg?.toFixed(2);
  return <article className="mx-auto max-w-4xl space-y-6 px-4 py-12">
    <Card><CardHeader><div className="flex flex-col gap-5 sm:flex-row sm:items-center">{profile.avatarUrl ? <img src={profile.avatarUrl} alt={`${profile.firstName} ${profile.lastName}`} className="h-28 w-28 rounded-full object-cover" /> : <div aria-hidden className="flex h-28 w-28 items-center justify-center rounded-full bg-muted text-3xl font-bold">{profile.firstName[0]}{profile.lastName[0]}</div>}<div><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-3xl">{profile.firstName} {profile.lastName}</CardTitle>{profile.verified ? <Badge>{labels.verified}</Badge> : null}{isNewPlayer(profile) ? <Badge variant="secondary">{labels.newPlayer}</Badge> : null}</div><p className="mt-1 text-muted-foreground">@{profile.username}</p></div></div></CardHeader><CardContent className="space-y-7">
      {profile.bio ? <p className="whitespace-pre-wrap">{profile.bio}</p> : null}
      <dl className="grid gap-3 sm:grid-cols-3"><div><dt className="text-sm text-muted-foreground">{labels.city}</dt><dd>{profile.city?.name ?? labels.notSet}</dd></div><div><dt className="text-sm text-muted-foreground">{labels.position}</dt><dd>{positionLabel ?? labels.notSet}</dd></div><div><dt className="text-sm text-muted-foreground">{labels.joined}</dt><dd>{joinedDate}</dd></div></dl>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{stat(labels.matchesPlayed, profile.stats.matchesPlayed)}{stat(labels.matchesOrganized, profile.stats.matchesOrganized)}{stat(labels.attendance, profile.stats.attendancePct === null ? labels.notSet : `${profile.stats.attendancePct}%`)}{stat(labels.rating, <>{rating}<span className="block text-xs font-normal text-muted-foreground">{labels.ratingCount.replace('{count}', String(profile.stats.ratingCount))}</span></>)}</dl>
      <section><h2 className="mb-3 font-semibold">{labels.breakdown}</h2><dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{stat(labels.onTime, profile.stats.onTime)}{stat(labels.late, profile.stats.late)}{stat(labels.noShow, profile.stats.noShow)}{stat(labels.cancelledEarly, profile.stats.cancelledEarly)}</dl></section>
      {profile.badges.length ? <section><h2 className="mb-3 font-semibold">{labels.badges}</h2><ul className="grid gap-3 sm:grid-cols-2">{profile.badges.filter(isBadgeCode).map((badge) => <li key={badge} className="rounded-lg border p-3"><Badge variant="outline">{labels.badgeCatalog[badge].name}</Badge><p className="mt-2 text-sm text-muted-foreground">{labels.badgeCatalog[badge].description}</p></li>)}</ul></section> : null}
      <OwnProfileHints username={profile.username} matchIds={profile.recentMatches.filter(({ status }) => status === 'RATING_PENDING').map(({ id }) => id)} label={labels.ownHint} />
    </CardContent></Card>
    <Card className="p-6"><h2 className="text-xl font-semibold">{labels.recentMatches}</h2>{profile.recentMatches.length ? <ul className="mt-4 divide-y">{profile.recentMatches.map((match) => <li key={match.id} className="py-3"><Link href={`/matches/${match.slug}`} className="font-medium text-primary hover:underline">{match.title}</Link></li>)}</ul> : <p className="mt-3 text-muted-foreground">{labels.noRecentMatches}</p>}</Card>
    <Card className="p-6"><h2 className="text-xl font-semibold">{labels.comments}</h2>{profile.comments.items.length ? <ul className="mt-4 space-y-4">{profile.comments.items.map((comment) => <li key={comment.id} className="rounded-lg border p-4"><div className="flex justify-between gap-4"><p className="font-medium">{comment.author.firstName} {comment.author.lastName} · {comment.overall}/5</p><ReportRatingButton ratingId={comment.id} /></div><p className="mt-2 whitespace-pre-wrap">{comment.comment}</p></li>)}</ul> : <p className="mt-3 text-muted-foreground">{labels.noComments}</p>}<nav className="mt-5 flex justify-between">{profile.comments.page > 1 ? <Link href={`/players/${profile.username}?commentsPage=${profile.comments.page - 1}`}>{labels.previous}</Link> : <span />}{profile.comments.page < profile.comments.totalPages ? <Link href={`/players/${profile.username}?commentsPage=${profile.comments.page + 1}`}>{labels.next}</Link> : null}</nav></Card>
  </article>;
}
