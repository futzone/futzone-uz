'use client';

import type { MatchSearchItem } from '@futzone/contracts';
import { Badge, Card } from '@futzone/ui';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { OccupancyBar } from './occupancy-bar';

export function MatchCard({ match }: { match: MatchSearchItem }) {
  const t = useTranslations();
  const locale = useLocale();
  const distance = match.distanceKm == null ? null : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(match.distanceKm)} ${t('matches.list.km')}`;
  return <Link href={`/matches/${match.slug}`} className="block">
    <Card className="h-full p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{new Intl.DateTimeFormat(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' }).format(new Date(match.startsAt))}</p><h2 className="mt-1 text-lg font-semibold">{match.title}</h2></div><Badge variant="secondary">{match.format}</Badge></div>
      <div className="flex flex-wrap items-center gap-2 text-sm"><Badge variant="outline">{t(`matches.wizard.levels.${match.level}`)}</Badge><span className="font-medium">{new Intl.NumberFormat(locale).format(match.perPlayerFeeUzs)} UZS</span>{distance && <span className="text-muted-foreground">· {distance}</span>}</div>
      <OccupancyBar occupiedSlots={match.occupiedSlots} totalSlots={match.totalSlots} label={t('matches.occupancy')} />
    </Card>
  </Link>;
}
