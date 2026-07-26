import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AttendanceQueueService } from '../src/attendance/attendance-queue.service';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { MatchQueueService } from '../src/matches/match-queue.service';
import { MatchStateService } from '../src/matches/match-state.service';
import { MatchWorkerService } from '../src/matches/match-worker.service';
import { Prisma } from '../src/generated/prisma';
import { PrismaService } from '../src/prisma/prisma.service';
import { AvatarQueueService } from '../src/users/avatar/avatar-queue.service';
import { AvatarStorageService } from '../src/users/avatar/avatar-storage.service';

describe('P3-03 ratings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let states: MatchStateService;
  const cityId = '019830ba-7d00-7000-8000-000000000a01';
  const stadiumId = '019830ba-7d00-7000-8000-000000000a02';
  const matchId = '019830ba-7d00-7000-8000-000000000a03';
  const ownerId = '019830ba-7d00-7000-8000-000000000a04';
  const playerId = '019830ba-7d00-7000-8000-000000000a05';
  const noShowId = '019830ba-7d00-7000-8000-000000000a06';
  const outsiderId = '019830ba-7d00-7000-8000-000000000a07';
  const ownerParticipantId = '019830ba-7d00-7000-8000-000000000a08';
  const playerParticipantId = '019830ba-7d00-7000-8000-000000000a09';
  const noShowParticipantId = '019830ba-7d00-7000-8000-000000000a0a';
  const tokens = new Map<string, string>();
  const body = { rateeId: playerId, discipline: 5, punctuality: 4, fairPlay: 5, teamPlay: 4, overall: 5, comment: 'Reliable teammate' };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AvatarStorageService).useValue({})
      .overrideProvider(AvatarQueueService).useValue({ enqueue: async () => undefined })
      .overrideProvider(MatchWorkerService).useValue({})
      .overrideProvider(AttendanceQueueService).useValue({ scheduleFallback: async () => undefined, scheduleFinalization: async () => undefined, cancelFinalization: async () => undefined })
      .overrideProvider(MatchQueueService).useValue({ scheduleRatingWindowClose: async () => undefined })
      .compile();
    app = module.createNestApplication();
    app.useLogger(app.get(Logger));
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter(app.get(Logger)));
    await app.init();
    prisma = app.get(PrismaService);
    states = app.get(MatchStateService);

    await prisma.match.deleteMany({ where: { id: matchId } });
    await prisma.stadium.deleteMany({ where: { id: stadiumId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, playerId, noShowId, outsiderId] } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await prisma.city.create({ data: { id: cityId, slug: 'ratings-e2e', nameUz: 'Ratings', nameUzCyrl: 'Ratings', nameRu: 'Ratings', nameEn: 'Ratings', region: 'Test', lat: 41.3, lng: 69.2 } });
    await prisma.user.createMany({ data: [
      { id: ownerId, phone: '+998901140201', phoneVerifiedAt: new Date(), firstName: 'Rating', lastName: 'Owner', username: 'rating_owner', cityId },
      { id: playerId, phone: '+998901140202', phoneVerifiedAt: new Date(), firstName: 'Rating', lastName: 'Player', username: 'rating_player', cityId },
      { id: noShowId, phone: '+998901140203', phoneVerifiedAt: new Date(), firstName: 'Rating', lastName: 'NoShow', username: 'rating_noshow', cityId },
      { id: outsiderId, phone: '+998901140204', phoneVerifiedAt: new Date(), firstName: 'Rating', lastName: 'Outsider', username: 'rating_outsider', cityId },
    ] });
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO stadiums
        (id, slug, name_uz, name_ru, name_en, city_id, district, address, location, surface, photos, status, created_by_id)
      VALUES
        (${stadiumId}::uuid, 'ratings-e2e-stadium', 'Ratings', 'Ratings', 'Ratings',
         ${cityId}::uuid, 'Test', 'Pitch', ST_SetSRID(ST_MakePoint(69.2, 41.3), 4326)::geography,
         'ARTIFICIAL_GRASS'::"Surface", ARRAY[]::text[], 'APPROVED'::"StadiumStatus", ${ownerId}::uuid)
    `);
    await prisma.match.create({ data: {
      id: matchId, slug: 'ratings-e2e-match', ownerId, title: 'Ratings E2E', format: 'F5', totalSlots: 10,
      startsAt: new Date('2035-02-15T10:00:00.000Z'), durationMin: 90, cityId, stadiumId,
      fieldPriceUzs: 100000, perPlayerFeeUzs: 10000, surface: 'ARTIFICIAL_GRASS', level: 'AMATEUR',
      joinMode: 'AUTO', allowNewPlayers: true, neededPositions: [], ageGroup: 'MIXED', verifiedPhoneOnly: false, status: 'ATTENDANCE_PENDING',
    } });
    await prisma.matchParticipant.createMany({ data: [
      { id: ownerParticipantId, matchId, userId: ownerId, role: 'OWNER', status: 'CONFIRMED' },
      { id: playerParticipantId, matchId, userId: playerId, role: 'PLAYER', status: 'CONFIRMED' },
      { id: noShowParticipantId, matchId, userId: noShowId, role: 'PLAYER', status: 'CONFIRMED' },
    ] });
    await prisma.attendanceRecord.createMany({ data: [
      { id: '019830ba-7d00-7000-8000-000000000a11', matchId, participantId: ownerParticipantId, status: 'ON_TIME', markedById: ownerId, markedAt: new Date() },
      { id: '019830ba-7d00-7000-8000-000000000a12', matchId, participantId: playerParticipantId, status: 'LATE', markedById: ownerId, markedAt: new Date() },
      { id: '019830ba-7d00-7000-8000-000000000a13', matchId, participantId: noShowParticipantId, status: 'NO_SHOW', markedById: ownerId, markedAt: new Date() },
    ] });
    const jwt = app.get(JwtService);
    for (const id of [ownerId, playerId, noShowId, outsiderId])
      tokens.set(id, await jwt.signAsync({ sub: id, role: 'USER', status: 'ACTIVE', type: 'access' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 }));
  });

  afterAll(async () => {
    await prisma.match.deleteMany({ where: { id: matchId } });
    await prisma.stadium.deleteMany({ where: { id: stadiumId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, playerId, noShowId, outsiderId] } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await app.close();
  });

  const auth = (id: string): string => `Bearer ${tokens.get(id) ?? ''}`;

  it('enforces the window and participant rules, rejects duplicates, and permits delete-then-re-rate', async () => {
    await request(app.getHttpServer()).post(`/matches/${matchId}/ratings`).set('Authorization', auth(ownerId)).send(body)
      .expect(409).expect(({ body: error }) => expect(error.code).toBe('RATING_WINDOW_CLOSED'));

    await prisma.$transaction((tx) => states.transition(tx, matchId, 'ATTENDANCE_PENDING', 'RATING_PENDING'));
    const initialRatable = await request(app.getHttpServer()).get(`/matches/${matchId}/ratable`).set('Authorization', auth(ownerId)).expect(200);
    expect(initialRatable.body).toEqual([{
      userId: playerId,
      firstName: 'Rating',
      lastName: 'Player',
      username: 'rating_player',
      alreadyRated: false,
      ratingId: null,
    }]);
    await request(app.getHttpServer()).post(`/matches/${matchId}/ratings`).set('Authorization', auth(ownerId)).send({ ...body, rateeId: ownerId })
      .expect(403).expect(({ body: error }) => expect(error.code).toBe('SELF_RATING_FORBIDDEN'));
    await request(app.getHttpServer()).post(`/matches/${matchId}/ratings`).set('Authorization', auth(outsiderId)).send(body).expect(403);
    await request(app.getHttpServer()).post(`/matches/${matchId}/ratings`).set('Authorization', auth(noShowId)).send(body)
      .expect(403).expect(({ body: error }) => expect(error.code).toBe('NOT_PARTICIPANT'));

    const created = await request(app.getHttpServer()).post(`/matches/${matchId}/ratings`).set('Authorization', auth(ownerId)).send(body).expect(201);
    expect(created.body).toEqual(expect.objectContaining({ raterId: ownerId, rateeId: playerId, comment: 'Reliable teammate' }));
    expect(created.body.phone).toBeUndefined();
    const ratedList = await request(app.getHttpServer()).get(`/matches/${matchId}/ratable`).set('Authorization', auth(ownerId)).expect(200);
    expect(ratedList.body).toEqual([{
      userId: playerId,
      firstName: 'Rating',
      lastName: 'Player',
      username: 'rating_player',
      alreadyRated: true,
      ratingId: created.body.id,
    }]);
    await request(app.getHttpServer()).post(`/matches/${matchId}/ratings`).set('Authorization', auth(ownerId)).send(body)
      .expect(409).expect(({ body: error }) => expect(error.code).toBe('DUPLICATE_RATING'));

    await request(app.getHttpServer()).delete(`/matches/${matchId}/ratings/${created.body.id as string}`).set('Authorization', auth(ownerId)).expect(204);
    const afterDelete = await request(app.getHttpServer()).get(`/matches/${matchId}/ratable`).set('Authorization', auth(ownerId)).expect(200);
    expect(afterDelete.body).toEqual([expect.objectContaining({ userId: playerId, alreadyRated: false, ratingId: null })]);
    const rerated = await request(app.getHttpServer()).post(`/matches/${matchId}/ratings`).set('Authorization', auth(ownerId)).send({ ...body, overall: 4 }).expect(201);
    expect(rerated.body).toEqual(expect.objectContaining({ id: created.body.id, overall: 4 }));

    await request(app.getHttpServer()).post(`/ratings/${rerated.body.id as string}/report`).set('Authorization', auth(playerId)).send({ reason: 'Abusive comment' }).expect(200);
    await request(app.getHttpServer()).post(`/ratings/${rerated.body.id as string}/report`).set('Authorization', auth(playerId)).send({ reason: 'Repeated' })
      .expect(409).expect(({ body: error }) => expect(error.code).toBe('DUPLICATE_REPORT'));
    await request(app.getHttpServer()).post(`/ratings/${rerated.body.id as string}/report`).set('Authorization', auth(noShowId)).send({ reason: 'Private information' }).expect(200);
    expect((await prisma.rating.findUniqueOrThrow({ where: { id: rerated.body.id as string } })).status).toBe('ACTIVE');
    await request(app.getHttpServer()).post(`/ratings/${rerated.body.id as string}/report`).set('Authorization', auth(outsiderId)).send({ reason: 'Harassment' }).expect(200);
    expect(await prisma.report.count({ where: { ratingId: rerated.body.id as string } })).toBe(3);
    expect((await prisma.rating.findUniqueOrThrow({ where: { id: rerated.body.id as string } })).status).toBe('HIDDEN');

    await prisma.$transaction((tx) => states.transition(tx, matchId, 'RATING_PENDING', 'COMPLETED'));
    await request(app.getHttpServer()).post(`/matches/${matchId}/ratings`).set('Authorization', auth(playerId)).send({ ...body, rateeId: ownerId })
      .expect(409).expect(({ body: error }) => expect(error.code).toBe('RATING_WINDOW_CLOSED'));
  });
});
