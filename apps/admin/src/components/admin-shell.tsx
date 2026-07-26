'use client';

import { Button } from '@futzone/ui';
import type { AuthUser } from '@futzone/contracts';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '@/lib/api';

// [key, href, minRole] — 'MOD' items are visible to moderators and admins; 'ADMIN' to admins only.
const NAV = [
  ['dashboard', '/', 'ADMIN'],
  ['users', '/users', 'MOD'],
  ['matches', '/matches', 'ADMIN'],
  ['moderation', '/moderation', 'MOD'],
  ['auditLog', '/audit-log', 'ADMIN'],
] as const;

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const t = useTranslations('dashboard');
  const common = useTranslations('common');
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    apiClient.me()
      .then((u) => {
        if (!active) return;
        if (u.role !== 'ADMIN' && u.role !== 'MODERATOR') { router.replace('/login'); return; }
        setUser(u);
      })
      .catch(() => { if (active) { setUser(null); router.replace('/login'); } });
    return () => { active = false; };
  }, [router]);

  if (!user) return <div className="p-6 text-sm text-muted-foreground">{common('loading')}</div>;

  const items = NAV.filter(([, , min]) => user.role === 'ADMIN' || min === 'MOD');
  const signOut = async (): Promise<void> => { await apiClient.logout().catch(() => undefined); router.replace('/login'); };

  return (
    <div className="grid min-h-screen md:grid-cols-[16rem_1fr]">
      <aside className="border-r bg-card p-5">
        <Link href="/" className="text-lg font-bold text-brand-600">{common('appName')}</Link>
        <nav className="mt-8 space-y-1" aria-label={t('navigationLabel')}>
          {items.map(([key, href]) => (
            <Link key={key} href={href} className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">
              {t(`nav.${key}`)}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center justify-end gap-3 border-b px-6">
          <span className="text-sm text-muted-foreground">{t('signedInAs')} {user.username} ({user.role})</span>
          <Button variant="outline" size="sm" onClick={signOut}>{t('signOut')}</Button>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
