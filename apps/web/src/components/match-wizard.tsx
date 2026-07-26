'use client';

import type { City, CreateMatchBody, MatchFormat, Position, Stadium } from '@futzone/contracts';
import { Button, Card, Input, Label } from '@futzone/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { mapErrorCodeToMessage } from '@/lib/api/errors';
import { FORMAT_SLOTS, normalizeMapCoordinates, suggestPerPlayerFee, tashkentLocalToUtc, validateWizardStep, type WizardStep, type WizardValues } from '@/lib/matches';
import { YandexMap } from './yandex-map';

const steps: WizardStep[] = ['basics', 'venue', 'money', 'rules', 'review'];
const formats = Object.keys(FORMAT_SLOTS) as MatchFormat[];
const initial: WizardValues = {
  title: '', format: 'F5', level: 'AMATEUR', surface: 'ARTIFICIAL_GRASS',
  date: '', time: '', cityId: '', stadiumId: '', address: '', latitude: '41.2995',
  longitude: '69.2401', durationMin: '90', fieldPriceUzs: '0', perPlayerFeeUzs: '0',
  joinMode: 'AUTO', minRating: '', minAttendancePct: '', allowNewPlayers: true,
  ageGroup: 'MIXED', neededPositions: [],
  verifiedPhoneOnly: false, ownerPlays: true, ownerGuestCount: '0',
};

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export function MatchWizard() {
  const t = useTranslations('matches.wizard');
  const errorT = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [stepIndex, setStepIndex] = useState(0);
  const [cities, setCities] = useState<City[]>([]);
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [feeEdited, setFeeEdited] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const totalSlots = FORMAT_SLOTS[values.format];
  const step = steps[stepIndex] ?? 'basics';
  const selectedStadium = stadiums.find(({ id }) => id === values.stadiumId);
  const mapPoint = selectedStadium
    ? { latitude: selectedStadium.latitude, longitude: selectedStadium.longitude }
    : { latitude: Number(values.latitude) || 41.2995, longitude: Number(values.longitude) || 69.2401 };

  useEffect(() => { apiClient.cities(locale).then(setCities).catch(() => setError(t('loadError'))); }, [locale, t]);
  useEffect(() => {
    if (!values.cityId) { setStadiums([]); return; }
    apiClient.stadiums(values.cityId).then(setStadiums).catch(() => setError(t('loadError')));
  }, [values.cityId, t]);
  useEffect(() => {
    if (!feeEdited) setValues((current) => ({ ...current, perPlayerFeeUzs: String(suggestPerPlayerFee(Number(current.fieldPriceUzs) || 0, FORMAT_SLOTS[current.format])) }));
  }, [values.fieldPriceUzs, values.format, feeEdited]);

  const update = <Key extends keyof WizardValues>(key: Key, value: WizardValues[Key]) => setValues((current) => ({ ...current, [key]: value }));
  const updateCoordinates = useCallback((coordinates: readonly number[]) => {
    const normalized = normalizeMapCoordinates(coordinates);
    if (normalized) setValues((current) => ({ ...current, ...normalized }));
  }, []);
  const togglePosition = (position: Position) => update('neededPositions', values.neededPositions.includes(position)
    ? values.neededPositions.filter((candidate) => candidate !== position)
    : [...values.neededPositions, position]);
  const next = () => {
    if (validateWizardStep(step, values).length) { setError(t('validation')); return; }
    setError(''); setStepIndex((current) => Math.min(steps.length - 1, current + 1));
  };
  const body = useMemo<CreateMatchBody>(() => ({
    title: values.title.trim(), format: values.format, startsAt: tashkentLocalToUtc(values.date, values.time),
    durationMin: Number(values.durationMin), cityId: values.cityId, stadiumId: values.stadiumId || null,
    address: values.stadiumId ? null : values.address.trim(), latitude: values.stadiumId ? null : Number(values.latitude),
    longitude: values.stadiumId ? null : Number(values.longitude), fieldPriceUzs: Number(values.fieldPriceUzs),
    perPlayerFeeUzs: Number(values.perPlayerFeeUzs), surface: values.surface as CreateMatchBody['surface'],
    level: values.level as CreateMatchBody['level'], joinMode: values.joinMode,
    minRating: values.minRating ? Number(values.minRating) : null,
    minAttendancePct: values.minAttendancePct ? Number(values.minAttendancePct) : null,
    allowNewPlayers: values.allowNewPlayers, neededPositions: values.neededPositions, ageGroup: values.ageGroup,
    verifiedPhoneOnly: values.verifiedPhoneOnly, ownerPlays: values.ownerPlays,
    ownerGuestCount: values.ownerPlays ? Number(values.ownerGuestCount) : 0,
  }), [values]);
  const submit = async (publish: boolean) => {
    setBusy(true); setError('');
    try {
      const match = await apiClient.createMatch(body);
      if (publish) await apiClient.publishMatch(match.id);
      router.push(`/matches/${match.slug}`);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? mapErrorCodeToMessage(reason.code, errorT) : t('loadError'));
    } finally { setBusy(false); }
  };

  return <Card className="mx-auto max-w-3xl p-6">
    <ol className="mb-8 grid grid-cols-5 gap-2" aria-label={t('progress')}>
      {steps.map((name, index) => <li key={name} className={`h-2 rounded-full ${index <= stepIndex ? 'bg-primary' : 'bg-muted'}`}><span className="sr-only">{t(`steps.${name}`)}</span></li>)}
    </ol>
    <h1 className="mb-6 text-2xl font-bold">{t(`steps.${step}`)}</h1>
    {step === 'basics' && <div className="grid gap-5">
      <Field label={t('title')}><Input value={values.title} onChange={(event) => update('title', event.target.value)} /></Field>
      <Field label={t('format')}><select className={selectClass} value={values.format} onChange={(event) => update('format', event.target.value as MatchFormat)}>{formats.map((format) => <option key={format} value={format}>{t(`formats.${format}`, { slots: FORMAT_SLOTS[format] })}</option>)}</select></Field>
      <p className="rounded-lg bg-muted p-3 text-sm">{t('slots', { count: totalSlots })}</p>
      <Field label={t('level')}><select className={selectClass} value={values.level} onChange={(event) => update('level', event.target.value)}>{['BEGINNER','AMATEUR','INTERMEDIATE','ADVANCED','ANY'].map((value) => <option key={value} value={value}>{t(`levels.${value}`)}</option>)}</select></Field>
      <Field label={t('surface')}><select className={selectClass} value={values.surface} onChange={(event) => update('surface', event.target.value)}>{['NATURAL_GRASS','ARTIFICIAL_GRASS','PARQUET','RUBBER','CONCRETE'].map((value) => <option key={value}>{t(`surfaces.${value}`)}</option>)}</select></Field>
    </div>}
    {step === 'venue' && <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-3"><Field label={t('date')}><Input type="date" value={values.date} onChange={(event) => update('date', event.target.value)} /></Field><Field label={t('time')}><Input type="time" value={values.time} onChange={(event) => update('time', event.target.value)} /></Field><Field label={t('duration')}><Input inputMode="numeric" value={values.durationMin} onChange={(event) => update('durationMin', event.target.value.replace(/\\D/g, ''))} /></Field></div>
      <Field label={t('city')}><select className={selectClass} value={values.cityId} onChange={(event) => { update('cityId', event.target.value); update('stadiumId', ''); }}><option value="">{t('chooseCity')}</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></Field>
      <Field label={t('stadium')}><select className={selectClass} value={values.stadiumId} onChange={(event) => update('stadiumId', event.target.value)}><option value="">{t('freeAddress')}</option>{stadiums.map((stadium) => <option key={stadium.id} value={stadium.id}>{stadium.nameUz}</option>)}</select></Field>
      {!values.stadiumId && <><Field label={t('address')}><Input value={values.address} onChange={(event) => update('address', event.target.value)} /></Field><div className="grid grid-cols-2 gap-4"><Field label={t('latitude')}><Input inputMode="decimal" value={values.latitude} onChange={(event) => update('latitude', event.target.value)} /></Field><Field label={t('longitude')}><Input inputMode="decimal" value={values.longitude} onChange={(event) => update('longitude', event.target.value)} /></Field></div></>}
      <YandexMap {...mapPoint} onCoordinatesChange={values.stadiumId ? undefined : updateCoordinates} />
    </div>}
    {step === 'money' && <div className="grid gap-5">
      <Field label={t('fieldPrice')}><Input inputMode="numeric" value={values.fieldPriceUzs} onChange={(event) => update('fieldPriceUzs', event.target.value.replace(/\\D/g, ''))} /></Field>
      <Field label={t('playerFee')}><Input inputMode="numeric" value={values.perPlayerFeeUzs} onChange={(event) => { setFeeEdited(true); update('perPlayerFeeUzs', event.target.value.replace(/\\D/g, '')); }} /></Field>
      <p className="text-sm text-muted-foreground">{t('feeHint')}</p>
    </div>}
    {step === 'rules' && <div className="grid gap-5">
      <Field label={t('joinMode')}><select className={selectClass} value={values.joinMode} onChange={(event) => update('joinMode', event.target.value as WizardValues['joinMode'])}>{['AUTO','MANUAL','INVITE_ONLY'].map((value) => <option key={value}>{t(`joinModes.${value}`)}</option>)}</select></Field>
      <Field label={t('ageGroup')}><select className={selectClass} value={values.ageGroup} onChange={(event) => update('ageGroup', event.target.value as WizardValues['ageGroup'])}>{(['YOUTH','ADULT','MIXED'] as const).map((value) => <option key={value} value={value}>{t(`ageGroups.${value}`)}</option>)}</select></Field>
      <fieldset className="grid gap-2"><legend className="text-sm font-medium">{t('neededPositions')}</legend><div className="flex flex-wrap gap-4">{(['GK','DEF','MID','FWD','UNIVERSAL'] as const).map((position) => <Check key={position} label={errorT(`positions.${position}`)} checked={values.neededPositions.includes(position)} onChange={() => togglePosition(position)} />)}</div></fieldset>
      {/* TODO(phase-3): reputation-backed requirements become effective when Phase 3 supplies player aggregates. */}
      <div className="grid grid-cols-2 gap-4"><Field label={t('minRating')}><Input inputMode="decimal" value={values.minRating} onChange={(event) => update('minRating', event.target.value)} /></Field><Field label={t('minAttendance')}><Input inputMode="numeric" value={values.minAttendancePct} onChange={(event) => update('minAttendancePct', event.target.value.replace(/\\D/g, ''))} /></Field></div>
      <p className="text-sm text-muted-foreground">{t('reputationNotice')}</p>
      <Check label={t('allowNew')} checked={values.allowNewPlayers} onChange={(checked) => update('allowNewPlayers', checked)} />
      <Check label={t('verifiedOnly')} checked={values.verifiedPhoneOnly} onChange={(checked) => update('verifiedPhoneOnly', checked)} />
      <Check label={t('ownerPlays')} checked={values.ownerPlays} onChange={(checked) => update('ownerPlays', checked)} />
      {values.ownerPlays && <Field label={t('ownerGuests')}><Input inputMode="numeric" value={values.ownerGuestCount} onChange={(event) => update('ownerGuestCount', event.target.value.replace(/\\D/g, ''))} /></Field>}
    </div>}
    {step === 'review' && <dl className="grid gap-3 rounded-xl bg-muted p-5 text-sm">
      <Review label={t('title')} value={values.title} /><Review label={t('format')} value={`${values.format} · ${totalSlots}`} />
      <Review label={t('date')} value={`${values.date} ${values.time}`} /><Review label={t('stadium')} value={selectedStadium?.nameUz ?? values.address} />
      <Review label={t('playerFee')} value={`${values.perPlayerFeeUzs} UZS`} /><Review label={t('joinMode')} value={t(`joinModes.${values.joinMode}`)} />
    </dl>}
    {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
    <div className="mt-8 flex flex-wrap justify-between gap-3">
      <Button variant="outline" disabled={stepIndex === 0 || busy} onClick={() => setStepIndex((current) => current - 1)}>{t('back')}</Button>
      {step !== 'review' ? <Button onClick={next}>{t('next')}</Button> : <div className="flex gap-3"><Button variant="outline" disabled={busy} onClick={() => submit(false)}>{t('saveDraft')}</Button><Button disabled={busy} onClick={() => submit(true)}>{t('publish')}</Button></div>}
    </div>
  </Card>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label>{label}</Label>{children}</div>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }) { return <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }
function Review({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>; }
