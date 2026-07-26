'use client';

import type { City } from '@futzone/contracts';
import { Button, cn, Input } from '@futzone/ui';
import { useTranslations } from 'next-intl';
import { useState, useTransition, type ReactNode } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import {
  MATCH_DATE_SHORTCUTS,
  MATCH_FORMAT_VALUES,
  MATCH_JOIN_MODE_VALUES,
  MATCH_LEVEL_VALUES,
  MATCH_POSITION_VALUES,
  MATCH_SORTS,
  MATCH_SURFACE_VALUES,
  formatShortLabel,
  serializeMatchFilters,
  type MatchFilters,
} from '@/lib/match-filters';

const ROUND = 1e5;
const roundCoord = (value: number) => Math.round(value * ROUND) / ROUND;
const toggle = <T extends string>(list: T[], value: T): T[] => list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
const parseNumber = (raw: string): number | undefined => { const value = Number(raw); return raw.trim() === '' || !Number.isFinite(value) ? undefined : value; };
const numberValue = (value: number | undefined) => value === undefined ? '' : String(value);

function ToggleChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={cn('rounded-full border px-3 py-1 text-sm transition-colors', selected ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>{children}</button>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><p className="text-sm font-medium">{label}</p>{children}</div>;
}

const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function MatchFiltersPanel({ filters, cities }: { filters: MatchFilters; cities: City[] }) {
  const t = useTranslations('matches.filter');
  const tMisc = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState<MatchFilters>(filters);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<MatchFilters>) => setDraft((current) => ({ ...current, ...patch }));
  const hasGeo = draft.nearLat !== undefined && draft.nearLng !== undefined;

  const apply = (next: MatchFilters = draft) => {
    const query = serializeMatchFilters(next).toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
    setOpen(false);
  };
  const reset = () => { const cleared: MatchFilters = { ...draft, city: undefined, district: undefined, date: undefined, dateFrom: undefined, dateTo: undefined, format: [], level: [], surface: [], joinMode: undefined, position: undefined, minFreeSlots: undefined, onlyAvailable: undefined, favoritesOnly: undefined, priceMin: undefined, priceMax: undefined, startHourFrom: undefined, startHourTo: undefined, nearLat: undefined, nearLng: undefined, radiusKm: undefined, q: undefined, sort: 'soonest' }; setDraft(cleared); apply(cleared); };

  const locateMe = () => {
    setGeoError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGeoError(t('geoUnavailable')); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => { setLocating(false); const next: MatchFilters = { ...draft, nearLat: roundCoord(position.coords.latitude), nearLng: roundCoord(position.coords.longitude), radiusKm: draft.radiusKm ?? 5, sort: 'nearest' }; setDraft(next); apply(next); },
      () => { setLocating(false); setGeoError(t('geoDenied')); },
    );
  };

  const form = <form onSubmit={(event) => { event.preventDefault(); apply(); }} className="space-y-5">
    <Field label={t('search')}><Input value={draft.q ?? ''} onChange={(event) => set({ q: event.target.value || undefined })} placeholder={t('searchPlaceholder')} /></Field>

    <Field label={t('city')}>
      <select className={selectClass} value={draft.city ?? ''} onChange={(event) => set({ city: event.target.value || undefined })}>
        <option value="">{t('allCities')}</option>
        {cities.map((city) => <option key={city.id} value={city.slug}>{city.name}</option>)}
      </select>
    </Field>

    <Field label={t('date')}>
      <div className="flex flex-wrap gap-2">{MATCH_DATE_SHORTCUTS.map((shortcut) => <ToggleChip key={shortcut} selected={draft.date === shortcut} onClick={() => set({ date: draft.date === shortcut ? undefined : shortcut })}>{tMisc(`matches.list.${shortcut}`)}</ToggleChip>)}</div>
    </Field>

    <Field label={t('format')}>
      <div className="flex flex-wrap gap-2">{MATCH_FORMAT_VALUES.map((format) => <ToggleChip key={format} selected={draft.format.includes(format)} onClick={() => set({ format: toggle(draft.format, format) })}>{formatShortLabel(format)}</ToggleChip>)}</div>
    </Field>

    <Field label={t('level')}>
      <div className="flex flex-wrap gap-2">{MATCH_LEVEL_VALUES.map((level) => <ToggleChip key={level} selected={draft.level.includes(level)} onClick={() => set({ level: toggle(draft.level, level) })}>{tMisc(`matches.wizard.levels.${level}`)}</ToggleChip>)}</div>
    </Field>

    <Field label={t('surface')}>
      <div className="flex flex-wrap gap-2">{MATCH_SURFACE_VALUES.map((surface) => <ToggleChip key={surface} selected={draft.surface.includes(surface)} onClick={() => set({ surface: toggle(draft.surface, surface) })}>{tMisc(`matches.wizard.surfaces.${surface}`)}</ToggleChip>)}</div>
    </Field>

    <Field label={t('joinMode')}>
      <select className={selectClass} value={draft.joinMode ?? ''} onChange={(event) => set({ joinMode: (event.target.value || undefined) as MatchFilters['joinMode'] })}>
        <option value="">{t('anyJoinMode')}</option>
        {MATCH_JOIN_MODE_VALUES.map((mode) => <option key={mode} value={mode}>{tMisc(`matches.wizard.joinModes.${mode}`)}</option>)}
      </select>
    </Field>

    <Field label={t('position')}>
      <select className={selectClass} value={draft.position ?? ''} onChange={(event) => set({ position: (event.target.value || undefined) as MatchFilters['position'] })}>
        <option value="">{t('anyPosition')}</option>
        {MATCH_POSITION_VALUES.map((position) => <option key={position} value={position}>{tMisc(`positions.${position}`)}</option>)}
      </select>
    </Field>

    <div className="flex flex-wrap gap-2">
      <ToggleChip selected={draft.onlyAvailable === true} onClick={() => set({ onlyAvailable: draft.onlyAvailable ? undefined : true })}>{t('onlyAvailable')}</ToggleChip>
      <ToggleChip selected={draft.favoritesOnly === true} onClick={() => set({ favoritesOnly: draft.favoritesOnly ? undefined : true })}>{t('favoritesOnly')}</ToggleChip>
    </div>

    <Field label={t('minFreeSlots')}><Input type="number" min={0} inputMode="numeric" value={numberValue(draft.minFreeSlots)} onChange={(event) => set({ minFreeSlots: parseNumber(event.target.value) })} /></Field>

    <Field label={t('price')}>
      <div className="flex items-center gap-2">
        <Input type="number" min={0} inputMode="numeric" aria-label={t('priceMin')} placeholder={t('priceMin')} value={numberValue(draft.priceMin)} onChange={(event) => set({ priceMin: parseNumber(event.target.value) })} />
        <span className="text-muted-foreground">—</span>
        <Input type="number" min={0} inputMode="numeric" aria-label={t('priceMax')} placeholder={t('priceMax')} value={numberValue(draft.priceMax)} onChange={(event) => set({ priceMax: parseNumber(event.target.value) })} />
      </div>
    </Field>

    <Field label={t('startHour')}>
      <div className="flex items-center gap-2">
        <Input type="number" min={0} max={23} inputMode="numeric" aria-label={t('from')} placeholder={t('from')} value={numberValue(draft.startHourFrom)} onChange={(event) => set({ startHourFrom: parseNumber(event.target.value) })} />
        <span className="text-muted-foreground">—</span>
        <Input type="number" min={0} max={23} inputMode="numeric" aria-label={t('to')} placeholder={t('to')} value={numberValue(draft.startHourTo)} onChange={(event) => set({ startHourTo: parseNumber(event.target.value) })} />
      </div>
    </Field>

    <Field label={t('nearMe')}>
      <div className="space-y-2">
        <Button type="button" variant={hasGeo ? 'secondary' : 'outline'} onClick={locateMe} disabled={locating} className="w-full">{locating ? t('locating') : hasGeo ? t('nearMeActive') : t('nearMe')}</Button>
        {hasGeo && <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">{t('radius')}</span><Input type="number" min={0.1} step={0.5} inputMode="decimal" value={numberValue(draft.radiusKm)} onChange={(event) => set({ radiusKm: parseNumber(event.target.value) })} /><span className="text-sm text-muted-foreground">{tMisc('matches.list.km')}</span></div>}
        {geoError && <p className="text-sm text-destructive">{geoError}</p>}
      </div>
    </Field>

    <Field label={t('sort')}>
      <select className={selectClass} value={draft.sort} onChange={(event) => set({ sort: event.target.value as MatchFilters['sort'] })}>
        {MATCH_SORTS.map((sort) => <option key={sort} value={sort} disabled={sort === 'nearest' && !hasGeo}>{t(`sortOptions.${sort}`)}</option>)}
      </select>
    </Field>

    <div className="flex gap-2 pt-2">
      <Button type="submit" disabled={pending} className="flex-1">{t('apply')}</Button>
      <Button type="button" variant="ghost" onClick={reset} disabled={pending}>{t('reset')}</Button>
    </div>
  </form>;

  return <>
    <div className="mb-4 lg:hidden"><Button variant="outline" onClick={() => setOpen(true)} className="w-full">{t('filtersButton')}</Button></div>
    <aside className="hidden lg:block"><div className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">{t('title')}</h2>{form}</div></aside>
    {open && <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('title')}>
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto bg-background p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{t('title')}</h2><Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t('close')}</Button></div>
        {form}
      </div>
    </div>}
  </>;
}
