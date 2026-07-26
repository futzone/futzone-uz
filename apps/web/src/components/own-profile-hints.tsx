'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

export function OwnProfileHints({ username, matchIds, label }: { username: string; matchIds: string[]; label: string }) {
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    apiClient.me().then(async (user) => {
      if (user.username !== username) return;
      const lists = await Promise.all(matchIds.map((id) => apiClient.ratable(id)));
      setPending(lists.flat().filter((player) => !player.alreadyRated).length);
    }).catch(() => setPending(null));
  }, [matchIds, username]);
  return pending !== null && pending > 0 ? <aside className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">{label.replace('{count}', String(pending))}</aside> : null;
}
