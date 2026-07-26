import { describe, expect, it } from 'vitest';
import {
  activeFilters,
  hasActiveFilters,
  parseMatchFilters,
  removeFilter,
  serializeMatchFilters,
  toMatchApiQuery,
  type MatchFilters,
} from '../src/lib/match-filters';

const empty = (): MatchFilters => parseMatchFilters({});

describe('parseMatchFilters', () => {
  it('defaults to an empty filter set sorted by soonest', () => {
    expect(empty()).toEqual({
      city: undefined, district: undefined, date: undefined, dateFrom: undefined, dateTo: undefined,
      format: [], level: [], surface: [], joinMode: undefined, position: undefined,
      minFreeSlots: undefined, onlyAvailable: undefined, favoritesOnly: undefined, priceMin: undefined, priceMax: undefined,
      startHourFrom: undefined, startHourTo: undefined, nearLat: undefined, nearLng: undefined,
      radiusKm: undefined, q: undefined, sort: 'soonest',
    });
  });

  it('parses each scalar param and coerces numbers', () => {
    const filters = parseMatchFilters({
      city: 'tashkent', district: 'Chilonzor', date: 'today', minFreeSlots: '3',
      onlyAvailable: 'true', priceMin: '50000', priceMax: '120000', startHourFrom: '18',
      startHourTo: '22', joinMode: 'AUTO', position: 'GK', q: '  5x5  ',
    });
    expect(filters.city).toBe('tashkent');
    expect(filters.district).toBe('Chilonzor');
    expect(filters.date).toBe('today');
    expect(filters.minFreeSlots).toBe(3);
    expect(filters.onlyAvailable).toBe(true);
    expect(filters.priceMin).toBe(50000);
    expect(filters.priceMax).toBe(120000);
    expect(filters.startHourFrom).toBe(18);
    expect(filters.joinMode).toBe('AUTO');
    expect(filters.position).toBe('GK');
    expect(filters.q).toBe('5x5');
  });

  it('parses comma-joined and repeated multi-values, dropping unknowns and duplicates', () => {
    expect(parseMatchFilters({ format: 'F5,F7,bogus,F5' }).format).toEqual(['F5', 'F7']);
    expect(parseMatchFilters({ level: ['AMATEUR', 'ADVANCED'] }).level).toEqual(['AMATEUR', 'ADVANCED']);
    expect(parseMatchFilters({ surface: 'CONCRETE' }).surface).toEqual(['CONCRETE']);
  });

  it('rejects a lone geo coordinate and keeps a valid pair with radius', () => {
    expect(parseMatchFilters({ nearLat: '41.3' }).nearLat).toBeUndefined();
    const geo = parseMatchFilters({ nearLat: '41.3', nearLng: '69.2', radiusKm: '5' });
    expect(geo).toMatchObject({ nearLat: 41.3, nearLng: 69.2, radiusKm: 5 });
  });

  it('falls back sort=nearest to soonest when no coordinates are present', () => {
    expect(parseMatchFilters({ sort: 'nearest' }).sort).toBe('soonest');
    expect(parseMatchFilters({ sort: 'nearest', nearLat: '41.3', nearLng: '69.2' }).sort).toBe('nearest');
    expect(parseMatchFilters({ sort: 'bogus' }).sort).toBe('soonest');
  });
});

describe('serializeMatchFilters / toMatchApiQuery', () => {
  it('omits empty values and the default sort, joins multi-values with commas', () => {
    const filters = parseMatchFilters({ city: 'tashkent', format: 'F5,F7', onlyAvailable: 'true' });
    const params = serializeMatchFilters(filters);
    expect(params.get('city')).toBe('tashkent');
    expect(params.get('format')).toBe('F5,F7');
    expect(params.get('onlyAvailable')).toBe('true');
    expect(params.get('sort')).toBeNull();
  });

  it('round-trips a combined filter through parse -> serialize -> parse', () => {
    const query = 'city=tashkent&format=F5,F7&level=AMATEUR&onlyAvailable=true&priceMin=50000&priceMax=120000&nearLat=41.3&nearLng=69.2&radiusKm=5&sort=nearest';
    const parsed = parseMatchFilters(Object.fromEntries(new URLSearchParams(query)));
    const reparsed = parseMatchFilters(Object.fromEntries(new URLSearchParams(toMatchApiQuery(parsed))));
    expect(reparsed).toEqual(parsed);
  });

  it('serializes a non-default sort', () => {
    expect(serializeMatchFilters(parseMatchFilters({ sort: 'priceAsc' })).get('sort')).toBe('priceAsc');
  });
});

describe('activeFilters / hasActiveFilters', () => {
  it('reports one chip per selected multi-value and none for the default state', () => {
    expect(activeFilters(empty())).toEqual([]);
    expect(hasActiveFilters(empty())).toBe(false);
    const filters = parseMatchFilters({ city: 'tashkent', format: 'F5,F7', onlyAvailable: 'true' });
    expect(activeFilters(filters)).toEqual([
      { key: 'city', value: 'tashkent' },
      { key: 'format', value: 'F5' },
      { key: 'format', value: 'F7' },
      { key: 'onlyAvailable' },
    ]);
    expect(hasActiveFilters(filters)).toBe(true);
  });

  it('treats a non-default sort as an active state even with no chips', () => {
    expect(hasActiveFilters(parseMatchFilters({ sort: 'newest' }))).toBe(true);
    expect(activeFilters(parseMatchFilters({ sort: 'newest' }))).toEqual([]);
  });

  it('collapses the geo cluster into a single chip', () => {
    const filters = parseMatchFilters({ nearLat: '41.3', nearLng: '69.2', radiusKm: '5' });
    expect(activeFilters(filters)).toEqual([{ key: 'nearLat' }]);
  });
});

describe('removeFilter', () => {
  it('removes a single value from a multi-value set', () => {
    const filters = parseMatchFilters({ format: 'F5,F7,F9' });
    expect(removeFilter(filters, 'format', 'F7').format).toEqual(['F5', 'F9']);
    expect(filters.format).toEqual(['F5', 'F7', 'F9']); // original untouched
  });

  it('clears a whole multi-value set when no value is given', () => {
    expect(removeFilter(parseMatchFilters({ level: 'AMATEUR,ADVANCED' }), 'level').level).toEqual([]);
  });

  it('clears the geo cluster and resets a nearest sort', () => {
    const filters = parseMatchFilters({ nearLat: '41.3', nearLng: '69.2', radiusKm: '5', sort: 'nearest' });
    const next = removeFilter(filters, 'nearLat');
    expect(next).toMatchObject({ nearLat: undefined, nearLng: undefined, radiusKm: undefined, sort: 'soonest' });
  });

  it('clears a scalar filter', () => {
    expect(removeFilter(parseMatchFilters({ city: 'tashkent' }), 'city').city).toBeUndefined();
    expect(removeFilter(parseMatchFilters({ onlyAvailable: 'true' }), 'onlyAvailable').onlyAvailable).toBeUndefined();
  });
});
