import { MatchesQuerySchema, type MatchSearchQuery } from '@futzone/contracts';
import { buildMatchSearchQuery, buildMatchSearchWhere, decodeMatchSearchCursor, encodeMatchSearchCursor, type MatchSearchCursor } from './match-search.query';

const NOW = new Date('2026-07-23T10:00:00.000Z');

function query(input: Record<string, unknown> = {}): MatchSearchQuery {
  return MatchesQuerySchema.parse(input);
}

function text(sql: { strings: readonly string[] }): string {
  return sql.strings.join('?').replace(/\s+/g, ' ').trim();
}

describe('match search query builder', () => {
  it.each([
    [{ city: 'tashkent' }, 'c.slug ='],
    [{ stadium: 'olympic-arena' }, 's.slug ='],
    [{ district: 'Chilonzor' }, 's.district ='],
    [{ dateFrom: '2026-07-24T00:00:00.000Z' }, 'm.starts_at >='],
    [{ dateTo: '2026-07-25T00:00:00.000Z' }, 'm.starts_at <'],
    [{ date: 'today' }, 'm.starts_at >='],
    [{ date: 'tomorrow' }, 'm.starts_at <'],
    [{ date: 'week' }, 'm.starts_at >='],
    [{ format: 'F5,F7' }, 'm.format = ANY'],
    [{ level: ['AMATEUR', 'ADVANCED'] }, 'm.level = ANY'],
    [{ surface: 'ARTIFICIAL_GRASS' }, 'm.surface = ANY'],
    [{ minFreeSlots: '3' }, 'm.total_slots - occupancy.occupied_slots >='],
    [{ onlyAvailable: 'true' }, 'occupancy.occupied_slots < m.total_slots'],
    [{ joinMode: 'AUTO' }, 'm.join_mode ='],
    [{ priceMin: '30000' }, 'm.per_player_fee_uzs >='],
    [{ priceMax: '90000' }, 'm.per_player_fee_uzs <='],
    [{ startHourFrom: '18' }, "AT TIME ZONE 'Asia/Tashkent'"],
    [{ startHourTo: '22' }, "AT TIME ZONE 'Asia/Tashkent'"],
    [{ position: 'GK' }, 'cardinality(m.needed_positions) = 0'],
    [{ nearLat: '41.31', nearLng: '69.28', radiusKm: '5' }, 'ST_DWithin'],
    [{ q: 'futbol Chilonzor' }, 'websearch_to_tsquery'],
  ] as const)('adds the individual filter %j', (input, fragment) => {
    expect(text(buildMatchSearchWhere(query(input), NOW))).toContain(fragment);
  });

  it('combines city, local today, format, availability, price, geo radius and nearest sorting', () => {
    const sql = buildMatchSearchQuery(query({
      city: 'tashkent',
      date: 'today',
      format: ['F5'],
      onlyAvailable: 'true',
      priceMin: '30000',
      priceMax: '70000',
      nearLat: '41.311',
      nearLng: '69.279',
      radiusKm: '10',
      sort: 'nearest',
      limit: '25',
    }), NOW);
    const rendered = text(sql);
    expect(rendered).toContain('c.slug =');
    expect(rendered).toContain('m.starts_at >=');
    expect(rendered).toContain('m.format = ANY');
    expect(rendered).toContain("m.status <> 'FULL'");
    expect(rendered).toContain('m.per_player_fee_uzs >=');
    expect(rendered).toContain('ST_DWithin');
    expect(rendered).toContain('ORDER BY "distanceKm" ASC, id ASC');
    expect(sql.values).toContain(26);
  });

  it('converts today to Asia/Tashkent midnight boundaries (UTC+05:00)', () => {
    const sql = buildMatchSearchWhere(query({ date: 'today' }), NOW);
    expect(sql.values).toContainEqual(new Date('2026-07-22T19:00:00.000Z'));
    expect(sql.values).toContainEqual(new Date('2026-07-23T19:00:00.000Z'));
  });

  it('supports a wall-clock range crossing midnight', () => {
    const rendered = text(buildMatchSearchWhere(query({ startHourFrom: 22, startHourTo: 2 }), NOW));
    expect(rendered).toContain(' OR ');
    expect(rendered).toContain("AT TIME ZONE 'Asia/Tashkent'");
  });

  it.each([
    ['soonest', '"startsAt" ASC, id ASC'],
    ['nearest', '"distanceKm" ASC, id ASC'],
    ['newest', '"createdAt" DESC, id DESC'],
    ['mostFreeSlots', '"freeSlots" DESC, id ASC'],
    ['organizerTrust', '"organizerTrust" DESC NULLS LAST, id ASC'],
    ['priceAsc', '"perPlayerFeeUzs" ASC, id ASC'],
    ['priceDesc', '"perPlayerFeeUzs" DESC, id ASC'],
  ] as const)('builds stable %s sorting', (sort, expected) => {
    expect(text(buildMatchSearchQuery(query({
      sort,
      ...(sort === 'nearest' ? { nearLat: 41.3, nearLng: 69.2 } : {}),
    }), NOW))).toContain(expected);
  });

  it('round-trips an opaque cursor and rejects a cursor used with another sort', () => {
    const cursor = { sort: 'priceAsc' as const, perPlayerFeeUzs: 50_000, id: '019830ba-7d00-7000-8000-000000000301' };
    const encoded = encodeMatchSearchCursor(cursor);
    expect(decodeMatchSearchCursor(encoded, 'priceAsc')).toEqual(cursor);
    expect(() => decodeMatchSearchCursor(encoded, 'soonest')).toThrow('Invalid or mismatched');
  });

  it.each([
    [{ sort: 'soonest', startsAt: NOW.toISOString(), id: '019830ba-7d00-7000-8000-000000000301' }, '("startsAt", id) >'],
    [{ sort: 'nearest', distanceKm: 1.25, id: '019830ba-7d00-7000-8000-000000000301' }, '("distanceKm", id) >'],
    [{ sort: 'newest', createdAt: NOW.toISOString(), id: '019830ba-7d00-7000-8000-000000000301' }, '("createdAt", id) <'],
    [{ sort: 'mostFreeSlots', freeSlots: 4, id: '019830ba-7d00-7000-8000-000000000301' }, '"freeSlots" <'],
    [{ sort: 'organizerTrust', organizerTrust: null, id: '019830ba-7d00-7000-8000-000000000301' }, '"organizerTrust" IS NULL AND id >'],
    [{ sort: 'organizerTrust', organizerTrust: 4.2, id: '019830ba-7d00-7000-8000-000000000301' }, 'OR "organizerTrust" IS NULL'],
    [{ sort: 'priceAsc', perPlayerFeeUzs: 50_000, id: '019830ba-7d00-7000-8000-000000000301' }, '("perPlayerFeeUzs", id) >'],
    [{ sort: 'priceDesc', perPlayerFeeUzs: 50_000, id: '019830ba-7d00-7000-8000-000000000301' }, '"perPlayerFeeUzs" <'],
  ] satisfies Array<[MatchSearchCursor, string]>)('adds a stable continuation predicate for sort=$cursor.sort', ({ sort, ...cursorValue }, expected) => {
    const cursor = encodeMatchSearchCursor({ sort, ...cursorValue } as MatchSearchCursor);
    const rendered = text(buildMatchSearchQuery(query({
      sort,
      cursor,
      ...(sort === 'nearest' ? { nearLat: 41.3, nearLng: 69.2 } : {}),
    }), NOW));
    expect(rendered).toContain(expected);
  });

  it('applies limit independently and requests one look-ahead row', () => {
    const sql = buildMatchSearchQuery(query({ limit: 7 }), NOW);
    expect(text(sql)).toContain('LIMIT');
    expect(sql.values).toContain(8);
  });

  it('rejects nearest sorting without coordinates and invalid paired ranges', () => {
    expect(() => query({ sort: 'nearest' })).toThrow('requires nearLat');
    expect(() => query({ nearLat: 41.3 })).toThrow('provided together');
    expect(() => query({ priceMin: 100, priceMax: 50 })).toThrow('priceMax');
  });

  it('adds a favourites predicate binding organizer and stadium ids only when favourites are supplied', () => {
    const favorites = {
      ownerIds: ['019830ba-7d00-7000-8000-0000000000a1'],
      stadiumIds: ['019830ba-7d00-7000-8000-0000000000b2', '019830ba-7d00-7000-8000-0000000000b3'],
    };
    const withFavorites = buildMatchSearchWhere(query({ favoritesOnly: 'true' }), NOW, favorites);
    const rendered = text(withFavorites);
    expect(rendered).toContain('m.owner_id = ANY');
    expect(rendered).toContain('m.stadium_id = ANY');
    expect(withFavorites.values).toContainEqual(favorites.ownerIds);
    expect(withFavorites.values).toContainEqual(favorites.stadiumIds);
  });

  it('omits the favourites predicate when favouritesOnly is set but no favourites are resolved', () => {
    expect(text(buildMatchSearchWhere(query({ favoritesOnly: 'true' }), NOW))).not.toContain('m.owner_id = ANY');
    expect(text(buildMatchSearchWhere(query({}), NOW, { ownerIds: ['x'], stadiumIds: [] }))).not.toContain('m.owner_id = ANY');
  });
});
