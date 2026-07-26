'use client';

import type { ParticipantStatus, PublicMatchDetail } from '@futzone/contracts';
import { Button } from '@futzone/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { mapErrorCodeToMessage } from '@/lib/api/errors';
import { selectMatchCta } from '@/lib/matches';

export function MatchCta({ match }: { match: PublicMatchDetail }) {
  const t = useTranslations();
  const [viewerStatus, setViewerStatus] = useState<ParticipantStatus | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    apiClient.me().then((user) => setViewerStatus(match.participants.find(({ userId }) => userId === user.id)?.status ?? null)).catch(() => setViewerStatus(null));
  }, [match.participants]);
  const cta = selectMatchCta({ status: match.status, joinMode: match.joinMode, freeSlots: match.freeSlots, viewerStatus });
  const act = async () => {
    setBusy(true); setMessage('');
    try {
      if (cta === 'join' || cta === 'request') {
        const result = await apiClient.joinMatch(match.id);
        setViewerStatus(result.kind === 'participant' ? result.participant.status : 'PENDING');
      } else if (cta === 'waitlist') {
        const participant = await apiClient.joinWaitlist(match.id); setViewerStatus(participant.status);
      } else if (cta === 'confirm') {
        const participant = await apiClient.confirmPromotion(match.id); setViewerStatus(participant.status);
      } else if (cta === 'leave') {
        if (viewerStatus === 'WAITLISTED') await apiClient.leaveWaitlist(match.id);
        else await apiClient.leaveMatch(match.id);
        setViewerStatus(null);
      }
      setMessage(t(`matches.actions.success.${cta}`));
    } catch (reason) {
      setMessage(reason instanceof ApiClientError ? mapErrorCodeToMessage(reason.code, t) : t('matches.actions.failed'));
    } finally { setBusy(false); }
  };
  if (cta === 'cancelled') return <div className="rounded-xl bg-destructive/10 p-4 font-medium text-destructive">{t('matches.actions.cancelled')}</div>;
  if (['full','inviteOnly','unavailable'].includes(cta)) return <div className="rounded-xl bg-muted p-4 text-center font-medium">{t(`matches.actions.${cta}`)}</div>;
  return <div className="grid gap-3"><Button size="lg" disabled={busy} onClick={act}>{t(`matches.actions.${cta}`)}</Button>{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}</div>;
}
