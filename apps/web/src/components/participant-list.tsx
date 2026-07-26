import type { PublicMatchParticipant } from '@futzone/contracts';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { guestLabel } from '@/lib/matches';

export async function ParticipantList({ participants }: { participants: PublicMatchParticipant[] }) {
  const t = await getTranslations();
  return <ul className="divide-y">
    {participants.filter(({ status }) => status === 'CONFIRMED').map((participant) => <li key={participant.userId} className="flex items-center gap-3 py-4">
      {participant.avatarUrl ? <img src={participant.avatarUrl} alt="" className="size-10 rounded-full object-cover" /> : <span className="flex size-10 items-center justify-center rounded-full bg-muted font-semibold">{participant.firstName[0]}</span>}
      <div className="min-w-0 flex-1"><Link href={`/players/${participant.username}`} className="font-medium">{participant.firstName} {participant.lastName}</Link><p className="text-sm text-muted-foreground">@{participant.username} · {participant.position ? t(`positions.${participant.position}`) : t('profile.notSet')}</p></div>
      {guestLabel(participant.guestCount, participant.username) && <span className="text-sm font-medium">{t('matches.guests', { count: participant.guestCount, username: participant.username })}</span>}
    </li>)}
  </ul>;
}
