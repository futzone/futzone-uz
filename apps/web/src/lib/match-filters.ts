import type { JoinMode, Level, MatchFormat, MatchSort, Position, Surface } from '@futzone/contracts';

export const MATCH_SORTS: readonly MatchSort[] = [
  'soonest', 'nearest', 'newest', 'mostFreeSlots', 'organizerTrust', 'priceAsc', 'priceDesc',
];
export const DEFAULT_MATCH_SORT: MatchSort = 'soonest';
export const MATCH_DATE_SHORTCUTS = ['today', 'tomorrow', 'week'] as const;
export type MatchDateShortcut = (typeof MATCH_DATE_SHORTCUTS)[number];

export const MATCH_FORMAT_VALUES: readonly MatchFormat[] = ['F5', 'F6', 'F7', 'F8', 'F9', 'F11'];
export const MATCH_LEVEL_VALUES: readonly Level[] = ['BEGINNER', 'AMATEUR', 'INTERMEDIATE', 'ADVANCED', 'ANY'];
export const MATCH_SURFACE_VALUES: readonly Surface[] = ['NATURAL_GRASS', 'ARTIFICIAL_GRASS', 'PARQUET', 'RUBBER', 'CONCRETE'];
export const MATCH_JOIN_MODE_VALUES: readonly JoinMode[] = ['AUTO', 'MANUAL', 'INVITE_ONLY'];
export const MATCH_POSITION_VALUES: readonly Position[] = ['GK', 'DEF', 'MID', 'FWD', 'UNIVERSAL'];

/** Normalized discovery filter state — the single source of truth shared by the URL, the API query and the chips. */
export interface MatchFilters {
  city?: string;
  district?: string;
  date?: MatchDateShortcut;
  dateFrom?: string;
  dateTo?: string;
  format: MatchFormat[];
  level: Level[];
  surface: Surface[];
  joinMode?: JoinMode;
  position?: Position;
  minFreeSlots?: number;
  onlyAvailable?: boolean;
  favoritesOnly?: boolean;
  priceMin?: number;
  priceMax?: number;
  startHourFrom?: number;
  startHourTo?: number;
  nearLat?: number;
  nearLng?: number;
  radiusKm?: number;
  q?: string;
  sort: MatchSort;
}

/** The Next.js `searchParams` shape for a server component. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const trimmed = (value: string | string[] | undefined): string | undefined => {
  const raw = first(value)?.trim();
  return raw ? raw : undefined;
};

const asInt = (value: string | string[] | undefined): number | undefined => {
  const raw = trimmed(value);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : undefined;
};

const asFloat = (value: string | string[] | undefined): number | undefined => {
  const raw = trimmed(value);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const multi = <T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T[] => {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const flattened = values.flatMap((entry) => entry.split(','));
  const seen = new Set<string>();
  const result: T[] = [];
  for (const entry of flattened) {
    const token = entry.trim();
    if (token && (allowed as readonly string[]).includes(token) && !seen.has(token)) {
      seen.add(token);
      result.push(token as T);
    }
  }
  return result;
};

const oneOf = <T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | undefined => {
  const raw = trimmed(value);
  return raw !== undefined && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
};

/** Parse the raw `searchParams` object into a validated, normalized {@link MatchFilters}. Unknown values are dropped. */
export function parseMatchFilters(searchParams: RawSearchParams): MatchFilters {
  const nearLat = asFloat(searchParams.nearLat);
  const nearLng = asFloat(searchParams.nearLng);
  const haveGeo = nearLat !== undefined && nearLng !== undefined;
  const sort = oneOf(searchParams.sort, MATCH_SORTS) ?? DEFAULT_MATCH_SORT;
  return {
    city: trimmed(searchParams.city),
    district: trimmed(searchParams.district),
    date: oneOf(searchParams.date, MATCH_DATE_SHORTCUTS),
    dateFrom: trimmed(searchParams.dateFrom),
    dateTo: trimmed(searchParams.dateTo),
    format: multi(searchParams.format, MATCH_FORMAT_VALUES),
    level: multi(searchParams.level, MATCH_LEVEL_VALUES),
    surface: multi(searchParams.surface, MATCH_SURFACE_VALUES),
    joinMode: oneOf(searchParams.joinMode, MATCH_JOIN_MODE_VALUES),
    position: oneOf(searchParams.position, MATCH_POSITION_VALUES),
    minFreeSlots: asInt(searchParams.minFreeSlots),
    onlyAvailable: first(searchParams.onlyAvailable) === 'true' ? true : undefined,
    favoritesOnly: first(searchParams.favoritesOnly) === 'true' ? true : undefined,
    priceMin: asInt(searchParams.priceMin),
    priceMax: asInt(searchParams.priceMax),
    startHourFrom: asInt(searchParams.startHourFrom),
    startHourTo: asInt(searchParams.startHourTo),
    // Geo coordinates are only meaningful as a pair (matches the API's cross-field rule).
    nearLat: haveGeo ? nearLat : undefined,
    nearLng: haveGeo ? nearLng : undefined,
    radiusKm: haveGeo ? asFloat(searchParams.radiusKm) : undefined,
    q: trimmed(searchParams.q),
    // A geo-less request can never sort by distance; fall back so the API never rejects it.
    sort: sort === 'nearest' && !haveGeo ? DEFAULT_MATCH_SORT : sort,
  };
}

/** Serialize filters to a `URLSearchParams`. Empty values and the default sort are omitted to keep URLs clean and canonical. */
export function serializeMatchFilters(filters: MatchFilters, extra?: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  const setString = (key: string, value: string | undefined) => { if (value) params.set(key, value); };
  const setNumber = (key: string, value: number | undefined) => { if (value !== undefined) params.set(key, String(value)); };
  setString('city', filters.city);
  setString('district', filters.district);
  setString('date', filters.date);
  setString('dateFrom', filters.dateFrom);
  setString('dateTo', filters.dateTo);
  if (filters.format.length) params.set('format', filters.format.join(','));
  if (filters.level.length) params.set('level', filters.level.join(','));
  if (filters.surface.length) params.set('surface', filters.surface.join(','));
  setString('joinMode', filters.joinMode);
  setString('position', filters.position);
  setNumber('minFreeSlots', filters.minFreeSlots);
  if (filters.onlyAvailable) params.set('onlyAvailable', 'true');
  if (filters.favoritesOnly) params.set('favoritesOnly', 'true');
  setNumber('priceMin', filters.priceMin);
  setNumber('priceMax', filters.priceMax);
  setNumber('startHourFrom', filters.startHourFrom);
  setNumber('startHourTo', filters.startHourTo);
  setNumber('nearLat', filters.nearLat);
  setNumber('nearLng', filters.nearLng);
  setNumber('radiusKm', filters.radiusKm);
  setString('q', filters.q);
  if (filters.sort !== DEFAULT_MATCH_SORT) params.set('sort', filters.sort);
  for (const [key, value] of Object.entries(extra ?? {})) if (value) params.set(key, value);
  return params;
}

/** Serialize filters into the query string passed to `GET /api/matches` (no leading `?`). */
export function toMatchApiQuery(filters: MatchFilters, extra?: Record<string, string>): string {
  return serializeMatchFilters(filters, extra).toString();
}

/** A single active filter, for rendering a removable chip. `value` identifies a member of a multi-value set. */
export interface ActiveFilter {
  key: keyof MatchFilters;
  value?: string;
}

/** List every active filter (excluding sort, which is not a chip). Multi-value filters yield one entry per selected value. */
export function activeFilters(filters: MatchFilters): ActiveFilter[] {
  const entries: ActiveFilter[] = [];
  if (filters.city) entries.push({ key: 'city', value: filters.city });
  if (filters.district) entries.push({ key: 'district', value: filters.district });
  if (filters.date) entries.push({ key: 'date', value: filters.date });
  if (filters.dateFrom) entries.push({ key: 'dateFrom', value: filters.dateFrom });
  if (filters.dateTo) entries.push({ key: 'dateTo', value: filters.dateTo });
  for (const value of filters.format) entries.push({ key: 'format', value });
  for (const value of filters.level) entries.push({ key: 'level', value });
  for (const value of filters.surface) entries.push({ key: 'surface', value });
  if (filters.joinMode) entries.push({ key: 'joinMode', value: filters.joinMode });
  if (filters.position) entries.push({ key: 'position', value: filters.position });
  if (filters.minFreeSlots !== undefined) entries.push({ key: 'minFreeSlots', value: String(filters.minFreeSlots) });
  if (filters.onlyAvailable) entries.push({ key: 'onlyAvailable' });
  if (filters.favoritesOnly) entries.push({ key: 'favoritesOnly' });
  if (filters.priceMin !== undefined) entries.push({ key: 'priceMin', value: String(filters.priceMin) });
  if (filters.priceMax !== undefined) entries.push({ key: 'priceMax', value: String(filters.priceMax) });
  if (filters.startHourFrom !== undefined) entries.push({ key: 'startHourFrom', value: String(filters.startHourFrom) });
  if (filters.startHourTo !== undefined) entries.push({ key: 'startHourTo', value: String(filters.startHourTo) });
  if (filters.nearLat !== undefined && filters.nearLng !== undefined) entries.push({ key: 'nearLat' });
  if (filters.q) entries.push({ key: 'q', value: filters.q });
  return entries;
}

const MULTI_KEYS = ['format', 'level', 'surface'] as const;
type MultiKey = (typeof MULTI_KEYS)[number];
const isMultiKey = (key: keyof MatchFilters): key is MultiKey => (MULTI_KEYS as readonly string[]).includes(key);

/** Return a new filter set with one filter cleared. For a multi-value key, only `value` is removed; omit it to clear the whole set. */
export function removeFilter(filters: MatchFilters, key: keyof MatchFilters, value?: string): MatchFilters {
  const next: MatchFilters = { ...filters, format: [...filters.format], level: [...filters.level], surface: [...filters.surface] };
  if (isMultiKey(key)) {
    next[key] = value === undefined ? [] : (next[key] as string[]).filter((entry) => entry !== value) as never;
    return next;
  }
  if (key === 'nearLat' || key === 'nearLng') {
    // Coordinates and their dependent radius/sort are only valid together, so clear the whole geo cluster.
    next.nearLat = undefined;
    next.nearLng = undefined;
    next.radiusKm = undefined;
    if (next.sort === 'nearest') next.sort = DEFAULT_MATCH_SORT;
    return next;
  }
  if (key === 'sort') { next.sort = DEFAULT_MATCH_SORT; return next; }
  (next[key] as unknown) = undefined;
  return next;
}

/** True when no filter (other than the default sort) is active. */
export function hasActiveFilters(filters: MatchFilters): boolean {
  return activeFilters(filters).length > 0 || filters.sort !== DEFAULT_MATCH_SORT;
}

/** Locale-neutral short label for a match format, e.g. `F5` -> `5×5`. */
export function formatShortLabel(format: string): string {
  const side = format.replace(/^F/, '');
  return `${side}×${side}`;
}
