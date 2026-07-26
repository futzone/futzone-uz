'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@futzone/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiClient } from '@/lib/api';

export function LoginForm() {
  const t = useTranslations('login');
  const common = useTranslations('common');
  const router = useRouter();
  const [phase, setPhase] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const sendCode = async (): Promise<void> => {
    setPending(true); setError(null);
    try { await apiClient.requestOtp(phone.trim()); setPhase('code'); }
    catch { setError(common('error')); }
    finally { setPending(false); }
  };

  const verify = async (): Promise<void> => {
    setPending(true); setError(null);
    try {
      const res = await apiClient.verifyOtp(phone.trim(), code.trim());
      if (res.needsRegistration) { setError(t('forbidden')); return; }
      if (res.user.role !== 'ADMIN' && res.user.role !== 'MODERATOR') {
        apiClient.setAccessToken(res.accessToken);
        await apiClient.logout().catch(() => undefined);
        setError(t('forbidden'));
        return;
      }
      apiClient.setAccessToken(res.accessToken);
      router.replace('/');
    } catch { setError(t('invalidCode')); }
    finally { setPending(false); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="phone">{t('phoneLabel')}</Label>
            <Input id="phone" type="tel" inputMode="tel" placeholder={t('phonePlaceholder')} value={phone}
              onChange={(e) => setPhone(e.target.value)} disabled={phase === 'code' || pending} />
          </div>
          {phase === 'code' && (
            <div className="space-y-2">
              <Label htmlFor="code">{t('codeLabel')}</Label>
              <Input id="code" inputMode="numeric" autoComplete="one-time-code" placeholder={t('codePlaceholder')}
                value={code} onChange={(e) => setCode(e.target.value)} disabled={pending} />
            </div>
          )}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          {phase === 'phone'
            ? <Button className="w-full" onClick={sendCode} disabled={pending || phone.trim().length < 9}>{t('sendCode')}</Button>
            : <div className="space-y-2">
                <Button className="w-full" onClick={verify} disabled={pending || code.trim().length !== 6}>{t('verify')}</Button>
                <Button variant="ghost" className="w-full" onClick={() => { setPhase('phone'); setCode(''); setError(null); }} disabled={pending}>{common('back')}</Button>
              </div>}
        </CardContent>
      </Card>
    </main>
  );
}
