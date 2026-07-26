import type { MatchDetail } from '@futzone/contracts';
import type { Metadata } from 'next';

export function matchRobots(match: MatchDetail): Metadata['robots'] {
  return match.visibility === 'INVITE_ONLY_SHELL' ? { index: false, follow: false } : undefined;
}

type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

export function matchMetadataText(match: MatchDetail, locale: string, t: Translator) {
  const date = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Tashkent',
  }).format(new Date(match.startsAt));
  const format = match.format.slice(1);
  if (match.visibility === 'INVITE_ONLY_SHELL') {
    return {
      title: t('inviteTitle', { format, city: match.city.name, date }),
      description: t('inviteDescription', { format, city: match.city.name, date }),
    };
  }
  return {
    title: t('title', { format, city: match.city.name, date, freeSlots: match.freeSlots }),
    description: t('description', {
      format,
      city: match.city.name,
      date,
      freeSlots: match.freeSlots,
      stadium: match.stadium?.name ?? match.address ?? match.city.name,
    }),
  };
}
