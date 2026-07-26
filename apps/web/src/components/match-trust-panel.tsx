'use client';

import type { PublicMatchDetail } from '@futzone/contracts';
import { Card } from '@futzone/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { selectRatingFlowState } from '@/lib/ratings';
import { AttendanceSheet } from './attendance-sheet';
import { RatingFlow } from './rating-flow';

type TrustData = { kind: 'attendance'; entries: Awaited<ReturnType<typeof apiClient.attendance>> } | { kind: 'rating'; players: Awaited<ReturnType<typeof apiClient.ratable>> } | { kind: 'closed' } | null;

export function MatchTrustPanel({ match }: { match: PublicMatchDetail }) {
  const t = useTranslations(); const [data, setData] = useState<TrustData>(null);
  useEffect(() => {
    apiClient.me().then(async (user) => {
      const participant = match.participants.find(({ userId }) => userId === user.id);
      if (!participant) return;
      if (match.status === 'ATTENDANCE_PENDING' && (participant.role === 'OWNER' || participant.role === 'ASSISTANT')) {
        setData({ kind: 'attendance', entries: await apiClient.attendance(match.id) }); return;
      }
      const state = selectRatingFlowState(match.status, participant.status === 'CONFIRMED');
      if (state === 'rate') setData({ kind: 'rating', players: await apiClient.ratable(match.id) });
      else if (state === 'closed') setData({ kind: 'closed' });
    }).catch(() => setData(null));
  }, [match]);
  if (data?.kind === 'attendance') return <AttendanceSheet matchId={match.id} initial={data.entries} />;
  if (data?.kind === 'rating') return <RatingFlow matchId={match.id} initial={data.players} />;
  if (data?.kind === 'closed') return <Card className="p-6 text-muted-foreground">{t('ratings.windowClosed')}</Card>;
  return null;
}
