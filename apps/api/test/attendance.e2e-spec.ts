import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AttendanceQueueService } from '../src/attendance/attendance-queue.service';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { MatchJobProcessorService } from '../src/matches/match-job-processor.service';
import { MatchWorkerService } from '../src/matches/match-worker.service';
import { Prisma } from '../src/generated/prisma';
import { PrismaService } from '../src/prisma/prisma.service';
import { AvatarQueueService } from '../src/users/avatar/avatar-queue.service';
import { AvatarStorageService } from '../src/users/avatar/avatar-storage.service';

describe('P3-01 attendance and P3-02 disputes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cityId = '019830ba-7d00-7000-8000-000000000801';
  const ownerId = '019830ba-7d00-7000-8000-000000000802';
  const playerId = '019830ba-7d00-7000-8000-000000000803';
  const outsiderId = '019830ba-7d00-7000-8000-000000000804';
  const matchId = '019830ba-7d00-7000-8000-000000000805';
  const ownerParticipantId = '019830ba-7d00-7000-8000-000000000806';
  const playerParticipantId = '019830ba-7d00-7000-8000-000000000807';
  const stadiumId = '019830ba-7d00-7000-8000-000000000808';
  const tokens = new Map<string, string>();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AvatarStorageService).useValue({})
      .overrideProvider(AvatarQueueService).useValue({ enqueue: async () => undefined })
      .overrideProvider(MatchWorkerService).useValue({})
      .overrideProvider(AttendanceQueueService).useValue({ scheduleFallback: async () => undefined, scheduleFinalization: async () => undefined, cancelFinalization: async () => undefined })
      .compile();
    app = module.createNestApplication();
    app.useLogger(app.get(Logger)); app.useGlobalPipes(new ZodValidationPipe()); app.useGlobalFilters(new ApiExceptionFilter(app.get(Logger)));
    await app.init();
    prisma = app.get(PrismaService);
    // Recover suite-owned fixtures if a prior run was interrupted before afterAll.
    await prisma.match.deleteMany({ where: { id: matchId } });
    await prisma.stadium.deleteMany({ where: { id: stadiumId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, playerId, outsiderId] } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await prisma.city.create({ data: { id: cityId, slug: 'attendance-e2e', nameUz: 'Attendance', nameUzCyrl: 'Attendance', nameRu: 'Attendance', nameEn: 'Attendance', region: 'Test', lat: 41.3, lng: 69.2 } });
    await prisma.user.createMany({ data: [
      { id: ownerId, phone: '+998901140101', phoneVerifiedAt: new Date(), firstName: 'Attendance', lastName: 'Owner', username: 'attendance_owner', cityId },
      { id: playerId, phone: '+998901140102', phoneVerifiedAt: new Date(), firstName: 'Attendance', lastName: 'Player', username: 'attendance_player', cityId },
      { id: outsiderId, phone: '+998901140103', phoneVerifiedAt: new Date(), firstName: 'Attendance', lastName: 'Outsider', username: 'attendance_outsider', cityId },
    ] });
    // Prisma omits Unsupported geography fields from create inputs, so this suite-owned
    // stadium is inserted explicitly with a valid PostGIS point.
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO stadiums
        (id, slug, name_uz, name_ru, name_en, city_id, district, address, location, surface, photos, status, created_by_id)
      VALUES
        (${stadiumId}::uuid, 'attendance-e2e-stadium', 'Attendance', 'Attendance', 'Attendance',
         ${cityId}::uuid, 'Test', 'Pitch', ST_SetSRID(ST_MakePoint(69.2, 41.3), 4326)::geography,
         'ARTIFICIAL_GRASS'::"Surface", ARRAY[]::text[], 'APPROVED'::"StadiumStatus", ${ownerId}::uuid)
    `);
    await prisma.match.create({ data: {
      id: matchId, slug: 'attendance-e2e-match', ownerId, title: 'Attendance E2E', format: 'F5', totalSlots: 10,
      startsAt: new Date('2035-01-15T10:00:00.000Z'), durationMin: 90, cityId, stadiumId,
      fieldPriceUzs: 100000, perPlayerFeeUzs: 10000, surface: 'ARTIFICIAL_GRASS', level: 'AMATEUR',
      joinMode: 'AUTO', allowNewPlayers: true, neededPositions: [], ageGroup: 'MIXED', verifiedPhoneOnly: false, status: 'STARTED',
    } });
    await prisma.matchParticipant.createMany({ data: [
      { id: ownerParticipantId, matchId, userId: ownerId, role: 'OWNER', status: 'CONFIRMED' },
      { id: playerParticipantId, matchId, userId: playerId, role: 'PLAYER', status: 'CONFIRMED' },
    ] });
    const jwt = app.get(JwtService);
    for (const id of [ownerId, playerId, outsiderId]) tokens.set(id, await jwt.signAsync({ sub: id, role: 'USER', status: 'ACTIVE', type: 'access' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 }));
  });

  afterAll(async () => {
    await prisma.match.deleteMany({ where: { id: matchId } });
    await prisma.stadium.deleteMany({ where: { id: stadiumId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, playerId, outsiderId] } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await app.close();
  });
  const auth = (id: string): string => `Bearer ${tokens.get(id) ?? ''}`;

  it('finishes, rejects non-owner marking, marks everyone, transitions, disputes NO_SHOW, and amends to EXCUSED', async () => {
    await app.get(MatchJobProcessorService).finish({ matchId });
    expect((await prisma.match.findUniqueOrThrow({ where: { id: matchId } })).status).toBe('ATTENDANCE_PENDING');
    await request(app.getHttpServer()).put(`/matches/${matchId}/attendance/${playerParticipantId}`).set('Authorization', auth(outsiderId)).send({ status: 'NO_SHOW' }).expect(403);
    await request(app.getHttpServer()).put(`/matches/${matchId}/attendance/${ownerParticipantId}`).set('Authorization', auth(ownerId)).send({ status: 'ON_TIME' }).expect(200);
    const marked = await request(app.getHttpServer()).put(`/matches/${matchId}/attendance/${playerParticipantId}`).set('Authorization', auth(ownerId)).send({ status: 'NO_SHOW' }).expect(200);
    expect((await prisma.match.findUniqueOrThrow({ where: { id: matchId } })).status).toBe('RATING_PENDING');
    await request(app.getHttpServer()).post(`/attendance/${marked.body.id as string}/dispute`).set('Authorization', auth(playerId)).send({ note: 'I warned the owner' }).expect(200);
    const resolved = await request(app.getHttpServer()).post(`/attendance/${marked.body.id as string}/resolve`).set('Authorization', auth(ownerId)).send({ status: 'EXCUSED' }).expect(200);
    expect(resolved.body).toEqual(expect.objectContaining({ status: 'EXCUSED', disputeStatus: 'OVERTURNED' }));
    expect(resolved.body.finalizedAt).not.toBeNull();
  });
});
