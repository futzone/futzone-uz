import type { MatchSearchQuery, MatchSort } from '@futzone/contracts';
import {
  Prisma,
  type AgeGroup,
  type JoinMode,
  type Level,
  type MatchStatus,
  type Position,
  type Surface,
} from '../generated/prisma';
import { AppException } from '../common/errors/app.exception';

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

export type MatchSearchCursor =
  | { sort: 'soonest'; startsAt: string; id: string }
  | { sort: 'nearest'; distanceKm: number; id: string }
  | { sort: 'newest'; createdAt: string; id: string }
  | { sort: 'mostFreeSlots'; freeSlots: number; id: string }
  | { sort: 'organizerTrust'; organizerTrust: number | null; id: string }
  | { sort: 'priceAsc' | 'priceDesc'; perPlayerFeeUzs: number; id: string };

export type SearchMatchRow = {
  id: string;
  slug: string;
  ownerId: string;
  title: string;
  format: string;
  totalSlots: number;
  occupiedSlots: bigint | number;
  freeSlots: bigint | number;
  startsAt: Date;
  durationMin: number;
  cityId: string;
  stadiumId: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  fieldPriceUzs: number;
  perPlayerFeeUzs: number;
  surface: Surface;
  level: Level;
  joinMode: JoinMode;
  minRating: number | null;
  minAttendancePct: number | null;
  allowNewPlayers: boolean;
  neededPositions: Position[];
  ageGroup: AgeGroup;
  verifiedPhoneOnly: boolean;
  status: MatchStatus;
  cancelledReason: string | null;
  createdAt: Date;
  distanceKm: number | null;
  organizerTrust: number | null;
};

function localDayBounds(now: Date, shortcut: 'today' | 'tomorrow' | 'week'): [Date, Date] {
  const local = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  const localMidnightAsUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - TASHKENT_OFFSET_MS;
  const startOffsetDays = shortcut === 'tomorrow' ? 1 : 0;
  const durationDays = shortcut === 'week' ? 7 : 1;
  return [
    new Date(localMidnightAsUtc + startOffsetDays * 86_400_000),
    new Date(localMidnightAsUtc + (startOffsetDays + durationDays) * 86_400_000),
  ];
}

export function encodeMatchSearchCursor(cursor: MatchSearchCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeMatchSearchCursor(value: string | undefined, sort: MatchSort): MatchSearchCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      typeof parsed !== 'object' || parsed === null
      || !('sort' in parsed) || parsed.sort !== sort
      || !('id' in parsed) || typeof parsed.id !== 'string'
    ) throw new Error('Invalid cursor shape');
    switch (sort) {
      case 'soonest':
        if (!('startsAt' in parsed) || typeof parsed.startsAt !== 'string' || Number.isNaN(Date.parse(parsed.startsAt))) throw new Error('Invalid soonest cursor');
        return { sort, startsAt: parsed.startsAt, id: parsed.id };
      case 'nearest':
        if (!('distanceKm' in parsed) || typeof parsed.distanceKm !== 'number' || !Number.isFinite(parsed.distanceKm)) throw new Error('Invalid nearest cursor');
        return { sort, distanceKm: parsed.distanceKm, id: parsed.id };
      case 'newest':
        if (!('createdAt' in parsed) || typeof parsed.createdAt !== 'string' || Number.isNaN(Date.parse(parsed.createdAt))) throw new Error('Invalid newest cursor');
        return { sort, createdAt: parsed.createdAt, id: parsed.id };
      case 'mostFreeSlots':
        if (!('freeSlots' in parsed) || typeof parsed.freeSlots !== 'number' || !Number.isInteger(parsed.freeSlots)) throw new Error('Invalid free-slots cursor');
        return { sort, freeSlots: parsed.freeSlots, id: parsed.id };
      case 'organizerTrust':
        if (!('organizerTrust' in parsed) || !(parsed.organizerTrust === null || typeof parsed.organizerTrust === 'number')) throw new Error('Invalid organizer-trust cursor');
        return { sort, organizerTrust: parsed.organizerTrust, id: parsed.id };
      case 'priceAsc':
      case 'priceDesc':
        if (!('perPlayerFeeUzs' in parsed) || typeof parsed.perPlayerFeeUzs !== 'number' || !Number.isInteger(parsed.perPlayerFeeUzs)) throw new Error('Invalid price cursor');
        return { sort, perPlayerFeeUzs: parsed.perPlayerFeeUzs, id: parsed.id };
    }
  } catch {
    throw new AppException('VALIDATION_ERROR', 'Invalid or mismatched match search cursor', 400, { field: 'cursor' });
  }
}

function effectiveLocation(): Prisma.Sql {
  return Prisma.sql`COALESCE(m.location, s.location)`;
}

function searchDateRange(query: MatchSearchQuery, now: Date): [Date | undefined, Date | undefined] {
  const shortcut = query.date;
  if (!shortcut) return [query.dateFrom, query.dateTo];
  const [shortcutFrom, shortcutTo] = localDayBounds(now, shortcut);
  return [
    query.dateFrom && query.dateFrom > shortcutFrom ? query.dateFrom : shortcutFrom,
    query.dateTo && query.dateTo < shortcutTo ? query.dateTo : shortcutTo,
  ];
}

/** The current user's favourites, resolved to id lists, used only when `favoritesOnly` is requested. */
export interface MatchSearchFavorites { ownerIds: string[]; stadiumIds: string[] }

export function buildMatchSearchWhere(query: MatchSearchQuery, now = new Date(), favorites?: MatchSearchFavorites): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`m.deleted_at IS NULL`,
    Prisma.sql`m.status IN ('PUBLISHED'::"MatchStatus", 'FULL'::"MatchStatus")`,
    Prisma.sql`m.join_mode <> 'INVITE_ONLY'::"JoinMode"`,
  ];
  if (query.favoritesOnly && favorites) {
    // A match is a favourite when its organizer or its stadium is favourited.
    conditions.push(Prisma.sql`(m.owner_id = ANY(${favorites.ownerIds}::uuid[]) OR m.stadium_id = ANY(${favorites.stadiumIds}::uuid[]))`);
  }
  const [dateFrom, dateTo] = searchDateRange(query, now);
  if (query.city) conditions.push(Prisma.sql`c.slug = ${query.city}`);
  if (query.stadium) conditions.push(Prisma.sql`(s.slug = ${query.stadium} OR m.stadium_id::text = ${query.stadium})`);
  if (query.district) conditions.push(Prisma.sql`s.district = ${query.district}`);
  if (dateFrom) conditions.push(Prisma.sql`m.starts_at >= ${dateFrom}`);
  if (dateTo) conditions.push(Prisma.sql`m.starts_at < ${dateTo}`);
  if (query.format) conditions.push(Prisma.sql`m.format = ANY(${query.format}::text[])`);
  if (query.level) conditions.push(Prisma.sql`m.level = ANY(${query.level}::"Level"[])`);
  if (query.surface) conditions.push(Prisma.sql`m.surface = ANY(${query.surface}::"Surface"[])`);
  if (query.onlyAvailable) conditions.push(Prisma.sql`m.status <> 'FULL'::"MatchStatus" AND occupancy.occupied_slots < m.total_slots`);
  if (query.minFreeSlots !== undefined) conditions.push(Prisma.sql`m.total_slots - occupancy.occupied_slots >= ${query.minFreeSlots}`);
  if (query.joinMode) conditions.push(Prisma.sql`m.join_mode = ${query.joinMode}::"JoinMode"`);
  if (query.priceMin !== undefined) conditions.push(Prisma.sql`m.per_player_fee_uzs >= ${query.priceMin}`);
  if (query.priceMax !== undefined) conditions.push(Prisma.sql`m.per_player_fee_uzs <= ${query.priceMax}`);
  if (query.startHourFrom !== undefined && query.startHourTo !== undefined) {
    const localHour = Prisma.sql`EXTRACT(HOUR FROM m.starts_at AT TIME ZONE 'Asia/Tashkent')`;
    conditions.push(query.startHourFrom <= query.startHourTo
      ? Prisma.sql`${localHour} >= ${query.startHourFrom} AND ${localHour} <= ${query.startHourTo}`
      : Prisma.sql`(${localHour} >= ${query.startHourFrom} OR ${localHour} <= ${query.startHourTo})`);
  } else if (query.startHourFrom !== undefined) {
    conditions.push(Prisma.sql`EXTRACT(HOUR FROM m.starts_at AT TIME ZONE 'Asia/Tashkent') >= ${query.startHourFrom}`);
  } else if (query.startHourTo !== undefined) {
    conditions.push(Prisma.sql`EXTRACT(HOUR FROM m.starts_at AT TIME ZONE 'Asia/Tashkent') <= ${query.startHourTo}`);
  }
  if (query.position) conditions.push(Prisma.sql`(cardinality(m.needed_positions) = 0 OR ${query.position}::"Position" = ANY(m.needed_positions))`);
  if (query.nearLat !== undefined && query.nearLng !== undefined && query.radiusKm !== undefined) {
    const searchPoint = Prisma.sql`ST_SetSRID(ST_MakePoint(${query.nearLng}, ${query.nearLat}), 4326)::geography`;
    conditions.push(Prisma.sql`(
      (m.location IS NOT NULL AND ST_DWithin(m.location, ${searchPoint}, ${query.radiusKm * 1000}))
      OR (m.location IS NULL AND s.location IS NOT NULL AND ST_DWithin(s.location, ${searchPoint}, ${query.radiusKm * 1000}))
    )`);
  }
  if (query.q) {
    const term = query.q;
    conditions.push(Prisma.sql`(
      to_tsvector('simple', futzone_unaccent(COALESCE(m.title, '') || ' ' || COALESCE(m.address, ''))) @@ websearch_to_tsquery('simple', futzone_unaccent(${term}))
      OR to_tsvector('simple', futzone_unaccent(
        COALESCE(s.name_uz, '') || ' ' || COALESCE(s.name_ru, '') || ' '
        || COALESCE(s.name_en, '') || ' ' || COALESCE(s.address, '')
      )) @@ websearch_to_tsquery('simple', futzone_unaccent(${term}))
      OR futzone_unaccent(m.title) % futzone_unaccent(${term})
      OR futzone_unaccent(COALESCE(m.address, '')) % futzone_unaccent(${term})
      OR futzone_unaccent(s.name_uz) % futzone_unaccent(${term})
      OR futzone_unaccent(s.name_ru) % futzone_unaccent(${term})
      OR futzone_unaccent(s.name_en) % futzone_unaccent(${term})
      OR futzone_unaccent(s.address) % futzone_unaccent(${term})
    )`);
  }
  return Prisma.sql`${Prisma.join(conditions, ' AND ')}`;
}

function cursorPredicate(cursor: MatchSearchCursor | undefined): Prisma.Sql {
  if (!cursor) return Prisma.sql`TRUE`;
  switch (cursor.sort) {
    case 'soonest':
      return Prisma.sql`("startsAt", id) > (${new Date(cursor.startsAt)}, ${cursor.id}::uuid)`;
    case 'newest':
      return Prisma.sql`("createdAt", id) < (${new Date(cursor.createdAt)}, ${cursor.id}::uuid)`;
    case 'nearest':
      return Prisma.sql`("distanceKm", id) > (${cursor.distanceKm}, ${cursor.id}::uuid)`;
    case 'mostFreeSlots':
      return Prisma.sql`("freeSlots" < ${cursor.freeSlots} OR ("freeSlots" = ${cursor.freeSlots} AND id > ${cursor.id}::uuid))`;
    case 'organizerTrust':
      return cursor.organizerTrust === null
        ? Prisma.sql`"organizerTrust" IS NULL AND id > ${cursor.id}::uuid`
        : Prisma.sql`(
            "organizerTrust" < ${cursor.organizerTrust}
            OR "organizerTrust" IS NULL
            OR ("organizerTrust" = ${cursor.organizerTrust} AND id > ${cursor.id}::uuid)
          )`;
    case 'priceAsc':
      return Prisma.sql`("perPlayerFeeUzs", id) > (${cursor.perPlayerFeeUzs}, ${cursor.id}::uuid)`;
    case 'priceDesc':
      return Prisma.sql`("perPlayerFeeUzs" < ${cursor.perPlayerFeeUzs} OR ("perPlayerFeeUzs" = ${cursor.perPlayerFeeUzs} AND id > ${cursor.id}::uuid))`;
  }
  throw new AppException('VALIDATION_ERROR', 'Unsupported match search sort');
}

function orderBy(sort: MatchSort): Prisma.Sql {
  switch (sort) {
    case 'soonest': return Prisma.sql`"startsAt" ASC, id ASC`;
    case 'nearest': return Prisma.sql`"distanceKm" ASC, id ASC`;
    case 'newest': return Prisma.sql`"createdAt" DESC, id DESC`;
    case 'mostFreeSlots': return Prisma.sql`"freeSlots" DESC, id ASC`;
    case 'organizerTrust': return Prisma.sql`"organizerTrust" DESC NULLS LAST, id ASC`;
    case 'priceAsc': return Prisma.sql`"perPlayerFeeUzs" ASC, id ASC`;
    case 'priceDesc': return Prisma.sql`"perPlayerFeeUzs" DESC, id ASC`;
  }
  throw new AppException('VALIDATION_ERROR', 'Unsupported match search sort');
}

export function buildMatchSearchQuery(query: MatchSearchQuery, now = new Date(), favorites?: MatchSearchFavorites): Prisma.Sql {
  const cursor = decodeMatchSearchCursor(query.cursor, query.sort);
  const distance = query.nearLat !== undefined && query.nearLng !== undefined
    ? Prisma.sql`ROUND((ST_Distance(
        ${effectiveLocation()},
        ST_SetSRID(ST_MakePoint(${query.nearLng}, ${query.nearLat}), 4326)::geography
      ) / 1000.0)::numeric, 6)::float8`
    : Prisma.sql`NULL::float8`;
  return Prisma.sql`
    WITH search_results AS (
      SELECT m.id, m.slug, m.owner_id AS "ownerId", m.title, m.format,
        m.total_slots AS "totalSlots", occupancy.occupied_slots AS "occupiedSlots",
        GREATEST(0, m.total_slots - occupancy.occupied_slots) AS "freeSlots",
        m.starts_at AS "startsAt", m.duration_min AS "durationMin", m.city_id AS "cityId",
        m.stadium_id AS "stadiumId", COALESCE(m.address, s.address) AS address,
        ST_Y(${effectiveLocation()}::geometry) AS latitude,
        ST_X(${effectiveLocation()}::geometry) AS longitude,
        m.field_price_uzs AS "fieldPriceUzs", m.per_player_fee_uzs AS "perPlayerFeeUzs",
        m.surface, m.level, m.join_mode AS "joinMode", m.min_rating::float8 AS "minRating",
        m.min_attendance_pct AS "minAttendancePct", m.allow_new_players AS "allowNewPlayers",
        m.needed_positions AS "neededPositions", m.age_group AS "ageGroup",
        m.verified_phone_only AS "verifiedPhoneOnly", m.status,
        m.cancelled_reason AS "cancelledReason", m.created_at AS "createdAt",
        ${distance} AS "distanceKm", us.bayes_avg::float8 AS "organizerTrust"
      FROM matches m
      JOIN cities c ON c.id = m.city_id
      LEFT JOIN stadiums s ON s.id = m.stadium_id
      LEFT JOIN user_stats us ON us.user_id = m.owner_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(1 + mp.guest_count), 0)::int AS occupied_slots
        FROM match_participants mp
        WHERE mp.match_id = m.id AND mp.status = 'CONFIRMED'::"ParticipantStatus"
      ) occupancy ON TRUE
      WHERE ${buildMatchSearchWhere(query, now, favorites)}
    )
    SELECT * FROM search_results
    WHERE ${cursorPredicate(cursor)}
    ORDER BY ${orderBy(query.sort)}
    LIMIT ${query.limit + 1}
  `;
}

export function cursorForMatch(row: SearchMatchRow, sort: MatchSort): MatchSearchCursor {
  switch (sort) {
    case 'soonest': return { sort, startsAt: row.startsAt.toISOString(), id: row.id };
    case 'newest': return { sort, createdAt: row.createdAt.toISOString(), id: row.id };
    case 'nearest': {
      if (row.distanceKm === null) throw new AppException('VALIDATION_ERROR', 'Nearest search result is missing distance');
      return { sort, distanceKm: Number(row.distanceKm), id: row.id };
    }
    case 'mostFreeSlots': return { sort, freeSlots: Number(row.freeSlots), id: row.id };
    case 'organizerTrust': return { sort, organizerTrust: row.organizerTrust, id: row.id };
    case 'priceAsc':
    case 'priceDesc': return { sort, perPlayerFeeUzs: row.perPlayerFeeUzs, id: row.id };
  }
}
