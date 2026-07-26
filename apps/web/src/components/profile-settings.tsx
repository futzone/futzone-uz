'use client';

import { Position, type City, type MeProfile, type MeSettings } from '@futzone/contracts';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Skeleton } from '@futzone/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { normalizeUsername, USERNAME_PATTERN } from '@/lib/auth/username';
import { setAuthenticatedSessionMarker } from '@/lib/auth/route-guard';
import { apiClient, ApiClientError, mapErrorCodeToMessage } from '@/lib/api';
import { AvatarUploader } from './avatar-uploader';

function nextAllowedDate(details: unknown, locale: string): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const value = 'nextAllowedAt' in details ? (details as { nextAllowedAt?: unknown }).nextAllowedAt : 'nextAllowedDate' in details ? (details as { nextAllowedDate?: unknown }).nextAllowedDate : null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(value));
}

export function ProfileSettings() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [settings, setSettings] = useState<MeSettings | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient.me().then(async (authUser) => {
      const [privateSettings, cityList, publicProfile] = await Promise.all([apiClient.settings(), apiClient.cities(locale), apiClient.publicProfile(authUser.username, locale)]);
      setProfile({ id: authUser.id, firstName: publicProfile.firstName, lastName: publicProfile.lastName, username: authUser.username, avatarUrl: publicProfile.avatarUrl, bio: publicProfile.bio, cityId: publicProfile.city?.id ?? null, position: publicProfile.position, locale: privateSettings.locale });
      setSettings(privateSettings); setCities(cityList);
    }).catch((caught) => {
      if (caught instanceof ApiClientError && caught.code === 'UNAUTHORIZED') router.replace('/login');
      else setError(caught instanceof ApiClientError ? mapErrorCodeToMessage(caught.code, t) : t('errors.INTERNAL_ERROR'));
    });
  }, [locale, router, t]);

  function showError(caught: unknown) {
    if (caught instanceof ApiClientError) {
      const date = caught.code === 'USERNAME_CHANGE_TOO_SOON' ? nextAllowedDate(caught.details, locale) : null;
      setError(date ? t('profile.usernameChangeDate', { date }) : mapErrorCodeToMessage(caught.code, t));
    } else setError(t('errors.INTERNAL_ERROR'));
  }

  async function save(form: FormData) {
    if (!profile) return;
    setError(null); setSaved(false);
    try {
      const updated = await apiClient.updateMe({ firstName: String(form.get('firstName')), lastName: String(form.get('lastName')), bio: String(form.get('bio')).trim() || null, cityId: String(form.get('cityId')) || null, position: String(form.get('position')) ? String(form.get('position')) as keyof typeof Position : null, locale: String(form.get('locale')) as 'uz' | 'uz-Cyrl' | 'ru' | 'en' });
      setProfile(updated); setSaved(true);
    } catch (caught) { showError(caught); }
  }

  async function changeUsername(form: FormData) {
    if (!profile) return;
    const username = normalizeUsername(String(form.get('username')));
    setError(null); setSaved(false);
    if (!USERNAME_PATTERN.test(username)) { setError(t('profile.usernameInvalid')); return; }
    try { const updated = await apiClient.updateUsername(username); setProfile(updated); setSaved(true); } catch (caught) { showError(caught); }
  }

  async function logout() { try { await apiClient.logout(); setAuthenticatedSessionMarker(false); router.replace('/login'); } catch (caught) { showError(caught); } }

  if (!profile || !settings) return <div className="mx-auto max-w-2xl space-y-4 px-4 py-12"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-96 w-full" />{error ? <p role="alert">{error}</p> : null}</div>;
  return <Card className="mx-auto max-w-2xl"><CardHeader><CardTitle>{t('profile.settingsTitle')}</CardTitle></CardHeader><CardContent><div className="space-y-6"><form className="space-y-5" action={(form) => void save(form)}>
    <AvatarUploader currentUrl={profile.avatarUrl} />
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="firstName">{t('profile.firstName')}</Label><Input id="firstName" name="firstName" defaultValue={profile.firstName} required maxLength={50} /></div><div className="space-y-2"><Label htmlFor="lastName">{t('profile.lastName')}</Label><Input id="lastName" name="lastName" defaultValue={profile.lastName} required maxLength={50} /></div></div>
    <div className="space-y-2"><Label htmlFor="phone">{t('profile.phone')}</Label><Input id="phone" value={settings.phone} readOnly /></div>
    <div className="space-y-2"><Label htmlFor="bio">{t('profile.bio')}</Label><textarea id="bio" name="bio" defaultValue={profile.bio ?? ''} maxLength={300} className="min-h-24 w-full rounded-md border bg-background p-3" /></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="cityId">{t('profile.city')}</Label><select id="cityId" name="cityId" defaultValue={profile.cityId ?? ''} className="h-10 w-full rounded-md border bg-background px-3"><option value="">{t('profile.notSet')}</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="position">{t('profile.position')}</Label><select id="position" name="position" defaultValue={profile.position ?? ''} className="h-10 w-full rounded-md border bg-background px-3"><option value="">{t('profile.notSet')}</option>{Object.values(Position).map((value) => <option key={value} value={value}>{t(`positions.${value}`)}</option>)}</select></div></div>
    <div className="space-y-2"><Label htmlFor="locale">{t('profile.locale')}</Label><select id="locale" name="locale" defaultValue={profile.locale} className="h-10 w-full rounded-md border bg-background px-3">{(['uz', 'uz-Cyrl', 'ru', 'en'] as const).map((value) => <option key={value} value={value}>{t(`common.localeSwitcher.${value}`)}</option>)}</select></div>
    <Button type="submit">{t('profile.save')}</Button>
  </form><form className="space-y-3 border-t pt-5" action={(form) => void changeUsername(form)}><Label htmlFor="username">{t('profile.username')}</Label><Input id="username" name="username" defaultValue={profile.username} required /><Button type="submit" variant="outline">{t('profile.save')}</Button></form>{saved ? <p role="status" className="text-sm text-primary">{t('profile.saved')}</p> : null}{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<Button type="button" variant="outline" onClick={() => void logout()}>{t('auth.logout')}</Button></div></CardContent></Card>;
}
