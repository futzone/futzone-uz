import type { InviteOnlyMatchShell } from '@futzone/contracts';
import { Card } from '@futzone/ui';
import React from 'react';

export function InviteOnlyMatchShellView({
  match,
  locale,
  labels,
}: {
  match: InviteOnlyMatchShell;
  locale: string;
  labels: { state: string; when: string; privacy: string };
}) {
  return <main className="mx-auto max-w-3xl px-4 py-10">
    <p className="text-sm font-medium text-primary">{match.city.name} · {match.format}</p>
    <h1 className="mt-2 text-3xl font-bold">{match.title}</h1>
    <Card className="mt-8 p-6">
      <p className="font-semibold">{labels.state}</p>
      <p className="mt-3 text-sm text-muted-foreground">{labels.when}</p>
      <p>{new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Tashkent' }).format(new Date(match.startsAt))}</p>
      <p className="mt-5 text-sm text-muted-foreground">{labels.privacy}</p>
    </Card>
  </main>;
}
