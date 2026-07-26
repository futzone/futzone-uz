'use client';

import type { JoinRequestWithSummary, PublicMatchDetail } from '@futzone/contracts';
import { Button, Card, Input, Label } from '@futzone/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { mapErrorCodeToMessage } from '@/lib/api/errors';

export function OwnerPanel({ match }: { match: PublicMatchDetail }) {
  const t = useTranslations();
  const [requests, setRequests] = useState<JoinRequestWithSummary[]>([]);
  const [username, setUsername] = useState('');
  const [reason, setReason] = useState('');
  const [title, setTitle] = useState(match.title);
  const [message, setMessage] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => { apiClient.me().then((user) => setIsOwner(user.id === match.ownerId)).catch(() => setIsOwner(false)); }, [match.ownerId]);
  const run = async (action: () => Promise<unknown>, success: string) => {
    try { await action(); setMessage(success); } catch (error) { setMessage(error instanceof ApiClientError ? mapErrorCodeToMessage(error.code, t) : t('matches.actions.failed')); }
  };
  if (!isOwner) return null;
  return <Card className="p-6">
    <h2 className="text-xl font-semibold">{t('matches.owner.title')}</h2>
    <div className="flex flex-wrap gap-2">
      {match.status === 'DRAFT' && <Button onClick={() => run(() => apiClient.publishMatch(match.id), t('matches.owner.published'))}>{t('matches.owner.publish')}</Button>}
      <Button variant="outline" onClick={() => apiClient.requests(match.id).then(setRequests).catch((error: unknown) => setMessage(error instanceof ApiClientError ? mapErrorCodeToMessage(error.code, t) : t('matches.actions.failed')))}>{t('matches.owner.requests')}</Button>
    </div>
    <div className="grid gap-2"><Label>{t('matches.wizard.title')}</Label><div className="flex gap-2"><Input value={title} onChange={(event) => setTitle(event.target.value)} /><Button variant="outline" onClick={() => run(() => apiClient.updateMatch(match.id, { title }), t('profile.saved'))}>{t('profile.save')}</Button></div></div>
    <div className="grid gap-2"><Label>{t('matches.owner.inviteUsername')}</Label><div className="flex gap-2"><Input value={username} onChange={(event) => setUsername(event.target.value)} /><Button onClick={() => run(() => apiClient.inviteUser(match.id, username), t('matches.owner.invited'))}>{t('matches.owner.invite')}</Button></div></div>
    <div className="grid gap-2"><Label>{t('matches.owner.cancelReason')}</Label><div className="flex gap-2"><Input value={reason} onChange={(event) => setReason(event.target.value)} /><Button variant="destructive" onClick={() => run(() => apiClient.cancelMatch(match.id, reason), t('matches.owner.cancelled'))}>{t('matches.owner.cancel')}</Button></div></div>
    {requests.map((request) => <div key={request.id} className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-4"><div><p className="font-medium">{request.requester.firstName} {request.requester.lastName}</p><p className="text-sm text-muted-foreground">{request.summary.displayRating === 'New player' ? t('profile.newPlayer') : request.summary.displayRating}</p></div>{request.summary.warning && <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs text-destructive">{t('matches.owner.warning')}</span>}</div>
      <p className="mt-2 text-sm">{t('matches.owner.summary', { attendance: request.summary.attendancePercent ?? '—', noShows: request.summary.noShowCount ?? '—' })}</p>
      <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => run(() => apiClient.decideRequest(match.id, request.id, 'approve'), t('matches.owner.approved'))}>{t('matches.owner.approve')}</Button><Button size="sm" variant="outline" onClick={() => run(() => apiClient.decideRequest(match.id, request.id, 'reject'), t('matches.owner.rejected'))}>{t('matches.owner.reject')}</Button></div>
    </div>)}
    {match.participants.filter(({ role }) => role !== 'OWNER' && role !== undefined).map((participant) => <div key={participant.userId} className="flex items-center justify-between gap-3 text-sm"><span>@{participant.username}</span><Button size="sm" variant="outline" onClick={() => run(() => apiClient.removeParticipant(match.id, participant.userId), t('matches.owner.removed'))}>{t('matches.owner.remove')}</Button></div>)}
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
  </Card>;
}
