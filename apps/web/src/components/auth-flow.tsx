'use client';

import { Position, type City, type OtpPurpose } from '@futzone/contracts';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@futzone/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { DEFAULT_RESEND_SECONDS, resendSecondsRemaining, retryAfterSeconds } from '@/lib/auth/countdown';
import { formatUzPhone, isValidUzPhone, normalizeUzPhone } from '@/lib/auth/phone';
import { debounceUsernameCheck, normalizeUsername, USERNAME_PATTERN } from '@/lib/auth/username';
import { safeReturnTo, setAuthenticatedSessionMarker } from '@/lib/auth/route-guard';
import { apiClient, ApiClientError, mapErrorCodeToMessage } from '@/lib/api';
import { UsernameSuggestions } from './username-suggestions';

type Step = 'phone' | 'otp' | 'registration';
const CITY_COORDINATES: Record<string, readonly [number, number]> = { tashkent: [41.3111, 69.2797], samarqand: [39.6542, 66.9597], samarkand: [39.6542, 66.9597], bukhara: [39.7681, 64.4556], buxoro: [39.7681, 64.4556], namangan: [40.9983, 71.6726], andijan: [40.7821, 72.3442], andijon: [40.7821, 72.3442], fergana: [40.3894, 71.7870], fargona: [40.3894, 71.7870], nukus: [42.4600, 59.6166] };

function nearestCity(cities: City[], latitude: number, longitude: number) {
  return cities.reduce<{ city: City; distance: number } | null>((best, city) => {
    const point = CITY_COORDINATES[city.slug];
    if (!point) return best;
    const distance = (point[0] - latitude) ** 2 + (point[1] - longitude) ** 2;
    return !best || distance < best.distance ? { city, distance } : best;
  }, null)?.city;
}

export function AuthFlow() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = safeReturnTo(searchParams.get('returnTo')) ?? '/settings';
  const codeRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('phone');
  const [purpose, setPurpose] = useState<OtpPurpose>('LOGIN');
  const [phone, setPhone] = useState('+998');
  const [code, setCode] = useState('');
  const [registrationToken, setRegistrationToken] = useState('');
  const [availableAt, setAvailableAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [availability, setAvailability] = useState<{ available: boolean; suggestions: string[] } | null>(null);
  const checkUsername = useMemo(() => debounceUsernameCheck((value) => apiClient.usernameAvailable(value)), []);
  const remaining = resendSecondsRemaining(availableAt, now);

  useEffect(() => { if (step === 'otp') codeRef.current?.focus(); }, [step]);
  useEffect(() => { if (!remaining) return; const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, [remaining]);
  useEffect(() => { apiClient.cities(locale).then(setCities).catch(() => setCities([])); }, [locale]);
  useEffect(() => {
    setAvailability(null);
    if (!USERNAME_PATTERN.test(username)) return;
    let current = true;
    checkUsername(username).then((result) => { if (current) setAvailability(result); }).catch(() => { if (current) setAvailability(null); });
    return () => { current = false; };
  }, [checkUsername, username]);

  function showError(caught: unknown) {
    if (caught instanceof ApiClientError) {
      setError(mapErrorCodeToMessage(caught.code, t));
      if (caught.code === 'OTP_RATE_LIMITED') setAvailableAt(Date.now() + retryAfterSeconds(caught.details) * 1000);
    } else setError(t('errors.INTERNAL_ERROR'));
  }

  async function sendOtp() {
    if (!isValidUzPhone(phone) || remaining > 0) { if (!isValidUzPhone(phone)) setError(t('auth.phoneInvalid')); return; }
    setBusy(true); setError(null);
    try { await apiClient.requestOtp(normalizeUzPhone(phone), purpose); setStep('otp'); setNow(Date.now()); setAvailableAt(Date.now() + DEFAULT_RESEND_SECONDS * 1000); }
    catch (caught) { showError(caught); } finally { setBusy(false); }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code)) { setError(t('auth.codeInvalid')); return; }
    setBusy(true); setError(null);
    try {
      const result = await apiClient.verifyOtp(normalizeUzPhone(phone), code);
      if (result.needsRegistration) { setRegistrationToken(result.registrationToken); setStep('registration'); }
      else { apiClient.setAccessToken(result.accessToken); setAuthenticatedSessionMarker(true); router.replace(destination); }
    } catch (caught) { showError(caught); } finally { setBusy(false); }
  }

  async function register(form: FormData) {
    setBusy(true); setError(null);
    try {
      const result = await apiClient.register({ registrationToken, firstName: String(form.get('firstName')), lastName: String(form.get('lastName')), username });
      apiClient.setAccessToken(result.accessToken);
      setAuthenticatedSessionMarker(true);
      const bio = String(form.get('bio') ?? '').trim();
      const position = String(form.get('position') ?? '');
      try {
        if (bio || cityId || position) await apiClient.updateMe({ bio: bio || null, cityId: cityId || null, position: position ? position as keyof typeof Position : null, locale: locale as 'uz' | 'uz-Cyrl' | 'ru' | 'en' });
        if (avatar) {
          const { uploadUrl, objectKey } = await apiClient.presignAvatar(avatar.size);
          const upload = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': avatar.type, 'Content-Length': String(avatar.size) }, body: avatar });
          if (!upload.ok) throw new Error('upload');
          await apiClient.completeAvatar(objectKey);
        }
      } catch { /* Registration is complete; optional fields remain editable in settings. */ }
      router.replace(destination);
    } catch (caught) { showError(caught); } finally { setBusy(false); }
  }

  function useLocation() {
    if (!navigator.geolocation) { setError(t('auth.locationUnavailable')); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const city = nearestCity(cities, coords.latitude, coords.longitude);
      if (city) setCityId(city.id); else setError(t('auth.locationNoMatch'));
    }, () => setError(t('auth.locationDenied')), { enableHighAccuracy: false, timeout: 10000 });
  }

  return <Card className="w-full max-w-xl"><CardHeader><CardTitle>{t(`auth.${step}Title`)}</CardTitle></CardHeader><CardContent>
    {step === 'phone' ? <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void sendOtp(); }}>
      <div className="grid grid-cols-2 gap-2"><Button type="button" variant={purpose === 'LOGIN' ? 'default' : 'outline'} onClick={() => setPurpose('LOGIN')}>{t('auth.login')}</Button><Button type="button" variant={purpose === 'REGISTER' ? 'default' : 'outline'} onClick={() => setPurpose('REGISTER')}>{t('auth.register')}</Button></div>
      <div className="space-y-2"><Label htmlFor="phone">{t('auth.phone')}</Label><Input id="phone" inputMode="tel" autoComplete="tel" value={formatUzPhone(phone)} onChange={(event) => setPhone(normalizeUzPhone(event.target.value))} placeholder={t('auth.phonePlaceholder')} /></div>
      <p className="text-sm text-muted-foreground">{t('auth.privacy')}</p><Button className="w-full" disabled={busy} type="submit">{t('auth.sendCode')}</Button>
    </form> : null}
    {step === 'otp' ? <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void verify(); }}>
      <p className="text-sm text-muted-foreground">{t('auth.codeSent')}</p><div className="space-y-2"><Label htmlFor="code">{t('auth.code')}</Label><Input ref={codeRef} id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
      <Button className="w-full" disabled={busy} type="submit">{t('auth.verify')}</Button><Button className="w-full" variant="outline" type="button" disabled={busy || remaining > 0} onClick={() => void sendOtp()}>{remaining > 0 ? t('auth.resendIn', { seconds: remaining }) : t('auth.resend')}</Button>
    </form> : null}
    {step === 'registration' ? <form className="space-y-5" action={(form) => void register(form)}>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="firstName">{t('profile.firstName')}</Label><Input id="firstName" name="firstName" required maxLength={50} /></div><div className="space-y-2"><Label htmlFor="lastName">{t('profile.lastName')}</Label><Input id="lastName" name="lastName" required maxLength={50} /></div></div>
      <div className="space-y-2"><Label htmlFor="username">{t('profile.username')}</Label><Input id="username" value={username} onChange={(event) => setUsername(normalizeUsername(event.target.value))} required minLength={3} maxLength={20} />{availability ? <p data-testid="username-status" className="text-sm">{availability.available ? t('auth.usernameAvailable') : t('errors.USERNAME_TAKEN')}</p> : null}{availability && !availability.available ? <UsernameSuggestions suggestions={availability.suggestions} onSelect={setUsername} /> : null}</div>
      <div className="space-y-2"><Label htmlFor="bio">{t('profile.bio')}</Label><Input id="bio" name="bio" maxLength={300} /></div>
      <div className="space-y-2"><Label htmlFor="position">{t('profile.position')}</Label><select id="position" name="position" className="h-10 w-full rounded-md border bg-background px-3"><option value="">{t('profile.notSet')}</option>{Object.values(Position).map((value) => <option key={value} value={value}>{t(`positions.${value}`)}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="city">{t('profile.city')}</Label><select id="city" value={cityId} onChange={(event) => setCityId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3"><option value="">{t('profile.notSet')}</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select><Button type="button" variant="outline" onClick={useLocation}>{t('auth.useLocation')}</Button></div>
      <div className="space-y-2"><Label htmlFor="registrationAvatar">{t('profile.avatar')}</Label><Input id="registrationAvatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAvatar(event.target.files?.[0] ?? null)} /></div><Button className="w-full" disabled={busy || !availability?.available} type="submit">{t('auth.completeRegistration')}</Button>
    </form> : null}
    {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
  </CardContent></Card>;
}
