'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@futzone/ui';
import type { AdminDashboardResponse, AdminMetricsDaily } from '@futzone/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Sparkline } from './sparkline';

// Numeric keys whose day-over-day series is worth a trend sparkline.
const TREND_KEYS = ['totalUsers', 'newUsers', 'activeUsers7d', 'activeUsers30d', 'dau', 'wau', 'matchesCreated'] as const;
type TrendKey = (typeof TREND_KEYS)[number];

export function DashboardCards() {
  const t = useTranslations('dashboard');
  const tr = (key: string): string => t(key as never); // dynamic card keys
  const common = useTranslations('common');
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiClient.metrics().then((d) => { if (active) setData(d); }).catch(() => undefined).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">{common('loading')}</p>;
  const m = data?.latest;
  if (!m) return <Card><CardHeader><CardTitle>{t('title')}</CardTitle></CardHeader><CardContent className="text-muted-foreground">{t('placeholder')}</CardContent></Card>;

  const cards: Array<[string, string | number]> = [
    ['totalUsers', m.totalUsers], ['newUsers', m.newUsers],
    ['activeUsers7d', m.activeUsers7d], ['activeUsers30d', m.activeUsers30d],
    ['dau', m.dau], ['wau', m.wau],
    ['matchesCreated', m.matchesCreated], ['matchesCompleted', m.matchesCompleted],
    ['matchesCancelled', m.matchesCancelled], ['attendancePct', m.attendancePct == null ? '—' : `${m.attendancePct}%`],
  ];
  const seriesFor = (key: string): number[] =>
    TREND_KEYS.includes(key as TrendKey) ? data!.series.map((s) => Number(s[key as keyof AdminMetricsDaily])) : [];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('cards.asOf')}: {m.date}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([key, value]) => {
          const series = seriesFor(key);
          return (
            <Card key={key}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{tr(`cards.${key}`)}</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {series.length > 1 && <Sparkline values={series} ariaLabel={`${tr(`cards.${key}`)}: ${series[0]} → ${series[series.length - 1]}`} />}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {m.activityByCity.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t('activityByCity')}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {m.activityByCity.map((c) => (
                <li key={c.cityId} className="flex justify-between text-sm">
                  <span>{c.city}</span>
                  <span className="font-medium">{c.matches} {t('matches')}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
