'use client';

import type { RatablePlayer } from '@futzone/contracts';
import { Button, Card } from '@futzone/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { mapErrorCodeToMessage } from '@/lib/api/errors';
import { ratingFormErrors } from '@/lib/ratings';

const criteria = ['discipline', 'punctuality', 'fairPlay', 'teamPlay', 'overall'] as const;
type Scores = Record<(typeof criteria)[number], number>;
const initialScores: Scores = { discipline: 3, punctuality: 3, fairPlay: 3, teamPlay: 3, overall: 3 };

export function RatingFlow({ matchId, initial }: { matchId: string; initial: RatablePlayer[] }) {
  const t = useTranslations(); const [players, setPlayers] = useState(initial); const [selected, setSelected] = useState(initial.find((player) => !player.alreadyRated)?.userId ?? ''); const [scores, setScores] = useState(initialScores); const [comment, setComment] = useState(''); const [message, setMessage] = useState('');
  const submit = async () => {
    const body = { rateeId: selected, ...scores, comment };
    if (ratingFormErrors(body).length) { setMessage(t('ratings.validation')); return; }
    try {
      await apiClient.createRating(matchId, { ...body, comment: comment.trim() || undefined });
      setPlayers((current) => current.map((player) => player.userId === selected ? { ...player, alreadyRated: true } : player));
      setSelected(players.find((player) => !player.alreadyRated && player.userId !== selected)?.userId ?? '');
      setScores(initialScores); setComment(''); setMessage(t('ratings.saved'));
    } catch (error) { setMessage(error instanceof ApiClientError ? mapErrorCodeToMessage(error.code, t) : t('ratings.failed')); }
  };
  const available = players.filter((player) => !player.alreadyRated);
  return <Card className="p-6"><h2 className="text-xl font-semibold">{t('ratings.title')}</h2>{available.length ? <div className="mt-4 space-y-4"><label className="grid gap-1 text-sm">{t('ratings.teammate')}<select className="h-10 rounded-md border bg-background px-3" value={selected} onChange={(event) => setSelected(event.target.value)}>{available.map((player) => <option key={player.userId} value={player.userId}>{player.firstName} {player.lastName}</option>)}</select></label>{criteria.map((criterion) => <label key={criterion} className="grid gap-1 text-sm"><span>{t(`ratings.criteria.${criterion}`)}: {scores[criterion]}</span><input aria-label={t(`ratings.criteria.${criterion}`)} type="range" min={1} max={5} step={1} value={scores[criterion]} onChange={(event) => setScores((current) => ({ ...current, [criterion]: Number(event.target.value) }))} /></label>)}<label className="grid gap-1 text-sm">{t('ratings.comment')}<textarea className="min-h-24 rounded-md border bg-background p-3" maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)} /><span className="text-right text-xs text-muted-foreground">{comment.length}/500</span></label><Button disabled={!selected} onClick={() => void submit()}>{t('ratings.submit')}</Button></div> : <p className="mt-3 text-muted-foreground">{t('ratings.complete')}</p>}{message ? <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p> : null}</Card>;
}
