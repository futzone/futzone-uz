import { HttpStatus, Injectable } from '@nestjs/common';
import type { CancelMatchBody, CreateMatchBody, Match as MatchResponse, MatchDetail, MatchFormat, MatchesResponse, MatchSearchQuery, PublicMatchDetail, UpdateMatchBody } from '@futzone/contracts';
import { Prisma, type MatchStatus } from '../generated/prisma';
import { v7 as uuidv7 } from 'uuid';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { assertTotalSlotsAtLeastOccupancy, computeMatchOccupancy } from './occupancy';
import { MatchStateService } from './match-state.service';
import { MatchQueueService } from './match-queue.service';
import { buildMatchSearchQuery, cursorForMatch, encodeMatchSearchCursor, type SearchMatchRow } from './match-search.query';
import { publicMatchAvailability } from './match-publication.policy';
import { NotificationsService } from '../notifications/notifications.service';

const FORMAT_SLOTS: Readonly<Record<MatchFormat, number>> = { F5: 10, F6: 12, F7: 14, F8: 16, F9: 18, F11: 22 };
const AFTER_PUBLISH_EDITABLE = new Set<keyof UpdateMatchBody>(['title', 'totalSlots', 'startsAt', 'durationMin', 'stadiumId', 'address', 'latitude', 'longitude']);
type MatchRow = Omit<MatchResponse, 'startsAt'|'createdAt'|'occupiedSlots'|'freeSlots'|'minRating'> & { startsAt: Date; createdAt: Date; minRating: number | null };

@Injectable()
export class MatchesService {
  public constructor(private readonly prisma: PrismaService, private readonly states: MatchStateService, private readonly queue: MatchQueueService, private readonly notifications: NotificationsService) {}

  public async create(ownerId: string, body: CreateMatchBody): Promise<MatchResponse> {
    const totalSlots = FORMAT_SLOTS[body.format];
    if (body.ownerPlays && 1 + body.ownerGuestCount > totalSlots) throw new AppException('VALIDATION_ERROR', 'Owner party exceeds match capacity');
    const [city, stadium] = await Promise.all([
      this.prisma.city.findFirst({ where: { id: body.cityId, isActive: true }, select: { slug: true } }),
      body.stadiumId ? this.prisma.stadium.findFirst({ where: { id: body.stadiumId, cityId: body.cityId, status: 'APPROVED' }, select: { id: true } }) : Promise.resolve(null),
    ]);
    if (!city) throw new AppException('NOT_FOUND', 'City not found', HttpStatus.NOT_FOUND);
    if (body.stadiumId && !stadium) throw new AppException('NOT_FOUND', 'Approved stadium not found in the selected city', HttpStatus.NOT_FOUND);
    const id = uuidv7();
    const slug = this.matchSlug(city.slug, body.format, new Date(body.startsAt), id);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`INSERT INTO matches
        (id, slug, owner_id, title, format, total_slots, starts_at, duration_min, city_id, stadium_id, address, location,
         field_price_uzs, per_player_fee_uzs, surface, level, join_mode, min_rating, min_attendance_pct, allow_new_players,
         needed_positions, age_group, verified_phone_only)
        VALUES (${id}::uuid, ${slug}, ${ownerId}::uuid, ${body.title}, ${body.format}, ${totalSlots}, ${new Date(body.startsAt)}, ${body.durationMin},
          ${body.cityId}::uuid, ${body.stadiumId ?? null}::uuid, ${body.address ?? null},
          ${body.latitude == null || body.longitude == null ? Prisma.sql`NULL` : Prisma.sql`ST_SetSRID(ST_MakePoint(${body.longitude}, ${body.latitude}),4326)::geography`},
          ${body.fieldPriceUzs}, ${body.perPlayerFeeUzs}, ${body.surface}::"Surface", ${body.level}::"Level", ${body.joinMode}::"JoinMode",
          ${body.minRating ?? null}, ${body.minAttendancePct ?? null}, ${body.allowNewPlayers}, ${body.neededPositions}::"Position"[],
          ${body.ageGroup}::"AgeGroup", ${body.verifiedPhoneOnly})`);
      if (body.ownerPlays) await tx.matchParticipant.create({ data: { id: uuidv7(), matchId: id, userId: ownerId, role: 'OWNER', status: 'CONFIRMED', guestCount: body.ownerGuestCount } });
    });
    return this.byId(id, true);
  }

  public async update(id: string, actorId: string, body: UpdateMatchBody, auditInTx?: (tx: Prisma.TransactionClient) => Promise<void>): Promise<MatchResponse> {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ hasLocation: boolean }>>(Prisma.sql`SELECT location IS NOT NULL AS "hasLocation" FROM matches WHERE id = ${id}::uuid AND deleted_at IS NULL FOR UPDATE`);
      const match = await tx.match.findFirst({ where: { id, deletedAt: null }, select: { status: true, startsAt: true, stadiumId: true, cityId: true, address: true } });
      if (!match) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
      if (!['DRAFT', 'PUBLISHED', 'FULL'].includes(match.status)) throw new AppException('INVALID_STATE_TRANSITION', 'This match can no longer be edited', HttpStatus.CONFLICT, { status: match.status });
      if (match.status !== 'DRAFT') {
        const forbidden = Object.keys(body).find((key) => !AFTER_PUBLISH_EDITABLE.has(key as keyof UpdateMatchBody));
        if (forbidden) throw new AppException('FORBIDDEN', `Field ${forbidden} cannot be edited after publication`, HttpStatus.FORBIDDEN, { field: forbidden });
      }
      const occupied = body.totalSlots !== undefined ? await computeMatchOccupancy(tx, id) : undefined;
      if (body.totalSlots !== undefined && occupied !== undefined) {
        assertTotalSlotsAtLeastOccupancy(body.totalSlots, occupied);
      }
      const proposedStadiumId = body.stadiumId === undefined ? match.stadiumId : body.stadiumId;
      const proposedCityId = body.cityId ?? match.cityId;
      if (body.cityId) {
        const city = await tx.city.findFirst({ where: { id: body.cityId, isActive: true }, select: { id: true } });
        if (!city) throw new AppException('NOT_FOUND', 'City not found', HttpStatus.NOT_FOUND);
      }
      if (proposedStadiumId) {
        const stadium = await tx.stadium.findFirst({ where: { id: proposedStadiumId, status: 'APPROVED' }, select: { cityId: true } });
        if (!stadium || stadium.cityId !== proposedCityId) throw new AppException('NOT_FOUND', 'Approved stadium not found in the selected city', HttpStatus.NOT_FOUND);
      }
      if ((body.latitude === undefined) !== (body.longitude === undefined)) throw new AppException('VALIDATION_ERROR', 'Latitude and longitude must be updated together');
      const proposedAddress = body.address === undefined ? match.address : body.address;
      const proposedHasLocation = body.latitude === undefined && body.longitude === undefined ? (locked[0]?.hasLocation ?? false) : body.latitude != null && body.longitude != null;
      if (!proposedStadiumId && (!proposedAddress || !proposedHasLocation)) throw new AppException('VALIDATION_ERROR', 'A stadium or freeform address and coordinates are required');
      const { latitude, longitude, ...scalar } = body;
      await tx.match.update({ where: { id }, data: { ...scalar, startsAt: body.startsAt ? new Date(body.startsAt) : undefined } });
      if (latitude !== undefined || longitude !== undefined) {
        if (latitude == null || longitude == null) await tx.$executeRaw(Prisma.sql`UPDATE matches SET location = NULL WHERE id = ${id}::uuid`);
        else await tx.$executeRaw(Prisma.sql`UPDATE matches SET location = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}),4326)::geography WHERE id = ${id}::uuid`);
      }
      if (body.totalSlots !== undefined && occupied !== undefined) {
        if (match.status === 'PUBLISHED' && occupied === body.totalSlots) await this.states.transition(tx, id, 'PUBLISHED', 'FULL');
        else if (match.status === 'FULL' && occupied < body.totalSlots) await this.states.transition(tx, id, 'FULL', 'PUBLISHED');
      }
      const scheduleChanged = body.startsAt !== undefined && new Date(body.startsAt).getTime() !== match.startsAt.getTime();
      const venueChanged = (body.stadiumId !== undefined && body.stadiumId !== match.stadiumId) || body.address !== undefined || body.latitude !== undefined;
      if (match.status !== 'DRAFT' && (scheduleChanged || venueChanged)) await this.notifyScheduleOrVenueChange(tx, id, actorId, scheduleChanged, venueChanged);
      if (auditInTx) await auditInTx(tx); // admin edits record their AuditLog in the same transaction
    });
    if (body.startsAt !== undefined || body.durationMin !== undefined) {
      const schedule = await this.prisma.match.findUnique({ where: { id }, select: { status: true, startsAt: true, durationMin: true } });
      if (schedule && (schedule.status === 'PUBLISHED' || schedule.status === 'FULL')) {
        await this.queue.scheduleMatch(id, schedule.startsAt, schedule.durationMin);
        await this.queue.scheduleReminders(id, schedule.startsAt);
      }
    }
    return this.byId(id, true);
  }

  public async publish(id: string): Promise<MatchResponse> {
    const schedule = await this.prisma.$transaction(async (tx) => {
      const match = await tx.match.findFirst({ where: { id, deletedAt: null } });
      if (!match) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
      this.assertPublishable(match);
      await this.states.transition(tx, id, match.status, 'PUBLISHED');
      return { startsAt: match.startsAt, durationMin: match.durationMin };
    });
    await this.queue.scheduleMatch(id, schedule.startsAt, schedule.durationMin);
    await this.queue.scheduleReminders(id, schedule.startsAt);
    return this.byId(id, true);
  }

  public async cancel(id: string, body: CancelMatchBody): Promise<MatchResponse> {
    await this.prisma.$transaction(async (tx) => {
      const match = await tx.match.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
      if (!match) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
      await this.states.transition(tx, id, match.status, 'CANCELLED', body.reason);
    });
    await this.queue.cancelMatch(id);
    await this.queue.cancelReminders(id);
    return this.byId(id, true);
  }

  public bySlug(slug: string, locale = 'uz'): Promise<MatchDetail> { return this.bySlugInternal(slug, locale); }
  public async list(query: MatchSearchQuery, userId?: string): Promise<MatchesResponse> {
    let favorites: { ownerIds: string[]; stadiumIds: string[] } | undefined;
    if (query.favoritesOnly) {
      // Favourites are private to the requester; without an authenticated user there is nothing to match.
      if (!userId) return { items: [], nextCursor: null };
      const [organizers, stadiums] = await Promise.all([
        this.prisma.favoriteOrganizer.findMany({ where: { userId }, select: { organizerId: true } }),
        this.prisma.favoriteStadium.findMany({ where: { userId }, select: { stadiumId: true } }),
      ]);
      favorites = { ownerIds: organizers.map((row) => row.organizerId), stadiumIds: stadiums.map((row) => row.stadiumId) };
      if (favorites.ownerIds.length === 0 && favorites.stadiumIds.length === 0) return { items: [], nextCursor: null };
    }
    const rows = await this.prisma.$queryRaw<SearchMatchRow[]>(buildMatchSearchQuery(query, undefined, favorites));
    const hasNextPage = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => ({
        ...row,
        format: row.format as MatchFormat,
        startsAt: row.startsAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        occupiedSlots: Number(row.occupiedSlots),
        freeSlots: Number(row.freeSlots),
        distanceKm: row.distanceKm === null ? null : Number(row.distanceKm),
        organizerTrust: row.organizerTrust === null ? null : Number(row.organizerTrust),
      })),
      nextCursor: hasNextPage && last
        ? encodeMatchSearchCursor(cursorForMatch(last, query.sort))
        : null,
    };
  }

  private async bySlugInternal(slug: string, locale: string): Promise<MatchDetail> {
    const row = await this.prisma.match.findFirst({
      where: { slug, deletedAt: null, status: { not: 'DRAFT' } },
      select: {
        id: true, slug: true, title: true, format: true, startsAt: true, durationMin: true, joinMode: true, status: true,
        city: { select: { slug: true, nameUz: true, nameUzCyrl: true, nameRu: true, nameEn: true } },
      },
    });
    if (!row) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    if (publicMatchAvailability(row) === 'GONE')
      throw new AppException('NOT_FOUND', 'Match is no longer available', HttpStatus.GONE);
    const cityName = locale === 'ru' ? row.city.nameRu : locale === 'en' ? row.city.nameEn : locale === 'uz-Cyrl' ? row.city.nameUzCyrl : row.city.nameUz;
    if (row.joinMode === 'INVITE_ONLY') return {
      visibility: 'INVITE_ONLY_SHELL',
      id: row.id,
      slug: row.slug,
      title: row.title,
      format: row.format as MatchFormat,
      startsAt: row.startsAt.toISOString(),
      joinMode: 'INVITE_ONLY',
      status: row.status,
      city: { slug: row.city.slug, name: cityName },
    };
    const [match, context] = await Promise.all([
      this.byId(row.id, false),
      this.prisma.match.findUniqueOrThrow({
        where: { id: row.id },
        select: {
          city: { select: { slug: true, nameUz: true, nameUzCyrl: true, nameRu: true, nameEn: true } },
          stadium: { select: { slug: true, nameUz: true, nameRu: true, nameEn: true, address: true } },
          participants: {
            where: { status: { in: ['CONFIRMED', 'PENDING_CONFIRMATION', 'WAITLISTED'] } },
            orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
            select: {
              role: true, status: true, guestCount: true,
              user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true, position: true } },
            },
          },
        },
      }),
    ]);
    const stadiumCoordinates = context.stadium
      ? await this.prisma.$queryRaw<Array<{ latitude: number; longitude: number }>>(Prisma.sql`
          SELECT ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude
          FROM stadiums WHERE slug = ${context.stadium.slug} LIMIT 1`)
      : [];
    const detailCityName = locale === 'ru' ? context.city.nameRu : locale === 'en' ? context.city.nameEn : locale === 'uz-Cyrl' ? context.city.nameUzCyrl : context.city.nameUz;
    const stadiumName = context.stadium
      ? (locale === 'ru' ? context.stadium.nameRu : locale === 'en' ? context.stadium.nameEn : context.stadium.nameUz)
      : null;
    return {
      visibility: 'PUBLIC',
      ...match,
      city: { slug: context.city.slug, name: detailCityName },
      stadium: context.stadium ? {
        slug: context.stadium.slug,
        name: stadiumName ?? context.stadium.nameUz,
        address: context.stadium.address,
        latitude: stadiumCoordinates[0]?.latitude ?? 0,
        longitude: stadiumCoordinates[0]?.longitude ?? 0,
      } : null,
      participants: context.participants.map(({ user, ...participant }) => ({
        userId: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName,
        avatarUrl: user.avatarUrl, position: user.position, ...participant,
      })),
    } satisfies PublicMatchDetail;
  }
  private async byId(id: string, includeDraft: boolean): Promise<MatchResponse> {
    const rows = await this.prisma.$queryRaw<MatchRow[]>(Prisma.sql`SELECT m.id, m.slug, m.owner_id AS "ownerId", m.title, m.format,
      m.total_slots AS "totalSlots", m.starts_at AS "startsAt", m.duration_min AS "durationMin", m.city_id AS "cityId", m.stadium_id AS "stadiumId",
      m.address, ST_Y(m.location::geometry) AS latitude, ST_X(m.location::geometry) AS longitude, m.field_price_uzs AS "fieldPriceUzs",
      m.per_player_fee_uzs AS "perPlayerFeeUzs", m.surface, m.level, m.join_mode AS "joinMode", m.min_rating::float8 AS "minRating",
      m.min_attendance_pct AS "minAttendancePct", m.allow_new_players AS "allowNewPlayers", m.needed_positions AS "neededPositions",
      m.age_group AS "ageGroup", m.verified_phone_only AS "verifiedPhoneOnly", m.status, m.cancelled_reason AS "cancelledReason", m.created_at AS "createdAt"
      FROM matches m WHERE m.id = ${id}::uuid AND m.deleted_at IS NULL ${includeDraft ? Prisma.empty : Prisma.sql`AND m.status <> 'DRAFT'::"MatchStatus"`} LIMIT 1`);
    const row = rows[0];
    if (!row) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    const occupiedSlots = await this.prisma.$transaction((tx) => computeMatchOccupancy(tx, id));
    return { ...row, format: row.format as MatchFormat, startsAt: row.startsAt.toISOString(), createdAt: row.createdAt.toISOString(), occupiedSlots, freeSlots: Math.max(0, row.totalSlots - occupiedSlots) };
  }
  private assertPublishable(match: { status: MatchStatus; title: string; startsAt: Date; cityId: string; stadiumId: string|null; address: string|null }): void {
    if (!match.title || !match.startsAt || !match.cityId || (!match.stadiumId && !match.address)) throw new AppException('VALIDATION_ERROR', 'Match is missing fields required for publication');
  }
  private async notifyScheduleOrVenueChange(tx: Prisma.TransactionClient, matchId: string, actorId: string, scheduleChanged: boolean, stadiumChanged: boolean): Promise<void> {
    const recipients = await tx.matchParticipant.findMany({ where: { matchId, status: 'CONFIRMED', userId: { not: actorId } }, select: { userId: true } });
    await this.notifications.notifyMany(recipients.map((r) => r.userId), 'MATCH_UPDATED', { scheduleChanged, stadiumChanged }, { matchId, tx });
  }
  private matchSlug(city: string, format: MatchFormat, startsAt: Date, id: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(startsAt);
    const value = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? '';
    return `${city}-${format.toLowerCase()}-${value('year')}${value('month')}${value('day')}-${value('hour')}${value('minute')}-${id.slice(-6)}`;
  }
}
