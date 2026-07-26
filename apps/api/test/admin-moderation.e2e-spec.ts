import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { AvatarQueueService } from '../src/users/avatar/avatar-queue.service';
import { AvatarStorageService } from '../src/users/avatar/avatar-storage.service';

describe('P5-08 moderation queue (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cityId = '019830ba-7d00-7000-8000-000000000d01';
  const matchId = '019830ba-7d00-7000-8000-000000000d10';
  const participantId = '019830ba-7d00-7000-8000-000000000d20';
  const ratingId = '019830ba-7d00-7000-8000-000000000d30';
  const reportId = '019830ba-7d00-7000-8000-000000000d31';
  const recordId = '019830ba-7d00-7000-8000-000000000d40';
  const stadiumId = '019830ba-7d00-7000-8000-000000000d50';
  // [0] admin, [1] moderator, [2] ratee/participant, [3] rater/reporter, [4] stadium submitter.
  const ids = ['f1', 'f2', 'f3', 'f4', 'f5'].map((s) => `019830ba-7d00-7000-8000-0000000000${s}`);
  const [ADMIN, MOD, RATEE, REPORTER, SUBMITTER] = ids as [string, string, string, string, string];
  const roleOf: Record<string, 'ADMIN' | 'MODERATOR' | 'USER'> = { [ADMIN]: 'ADMIN', [MOD]: 'MODERATOR', [RATEE]: 'USER', [REPORTER]: 'USER', [SUBMITTER]: 'USER' };
  const tokens = new Map<string, string>();
  const auth = (id: string): string => `Bearer ${tokens.get(id) ?? ''}`;

  async function cleanup(): Promise<void> {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.report.deleteMany({ where: { id: reportId } });
    await prisma.rating.deleteMany({ where: { id: ratingId } });
    await prisma.attendanceRecord.deleteMany({ where: { id: recordId } });
    await prisma.matchParticipant.deleteMany({ where: { matchId } });
    await prisma.stadium.deleteMany({ where: { id: stadiumId } });
    await prisma.match.deleteMany({ where: { id: matchId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
  }

  async function seed(): Promise<void> {
    await prisma.city.upsert({ where: { slug: 'mod-e2e' }, update: {}, create: { id: cityId, slug: 'mod-e2e', nameUz: 'Mod', nameUzCyrl: 'Мод', nameRu: 'Mod', nameEn: 'Mod', region: 'Test', lat: 41.3, lng: 69.2 } });
    await prisma.user.createMany({ data: ids.map((id, i) => ({ id, phone: `+9989013401${(10 + i).toString().slice(-2)}`, phoneVerifiedAt: new Date(), firstName: 'Mod', lastName: `${i}`, username: `mod_e2e_${i}`, role: roleOf[id], cityId })), skipDuplicates: true });
    await prisma.$executeRaw`
      INSERT INTO matches (id, slug, owner_id, title, format, total_slots, starts_at, duration_min, city_id, address, location, field_price_uzs, per_player_fee_uzs, surface, level, join_mode, needed_positions, age_group, status)
      VALUES (${matchId}::uuid, 'mod-e2e-match', ${RATEE}::uuid, 'Mod match', 'F5', 10, '2030-01-01T10:00:00Z'::timestamptz, 90, ${cityId}::uuid, 'Pitch',
        ST_SetSRID(ST_MakePoint(69.2, 41.3), 4326)::geography, 100000, 10000, 'ARTIFICIAL_GRASS'::"Surface", 'AMATEUR'::"Level", 'AUTO'::"JoinMode",
        ARRAY[]::"Position"[], 'MIXED'::"AgeGroup", 'COMPLETED'::"MatchStatus")`;
    await prisma.matchParticipant.create({ data: { id: participantId, matchId, userId: RATEE, role: 'PLAYER', status: 'CONFIRMED', guestCount: 0 } });
    await prisma.rating.create({ data: { id: ratingId, matchId, raterId: REPORTER, rateeId: RATEE, discipline: 1, punctuality: 1, fairPlay: 1, teamPlay: 1, overall: 1, comment: 'Toxic comment', status: 'ACTIVE' } });
    await prisma.report.create({ data: { id: reportId, ratingId, reporterId: REPORTER, reason: 'Abusive language' } });
    await prisma.attendanceRecord.create({ data: { id: recordId, matchId, participantId, status: 'NO_SHOW', markedById: RATEE, markedAt: new Date('2030-01-01T12:00:00.000Z'), disputeStatus: 'OPEN', disputeNote: 'I was there' } });
    await prisma.$executeRaw`
      INSERT INTO stadiums (id, slug, name_uz, name_ru, name_en, city_id, district, address, location, surface, photos, status, created_by_id)
      VALUES (${stadiumId}::uuid, 'mod-e2e-stadium', 'Pending Arena', 'Pending Arena', 'Pending Arena', ${cityId}::uuid, 'Test', 'Somewhere',
        ST_SetSRID(ST_MakePoint(69.2, 41.3), 4326)::geography, 'ARTIFICIAL_GRASS'::"Surface", ARRAY[]::text[], 'PENDING'::"StadiumStatus", ${SUBMITTER}::uuid)`;
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AvatarStorageService).useValue({})
      .overrideProvider(AvatarQueueService).useValue({ enqueue: async () => undefined })
      .compile();
    app = module.createNestApplication();
    app.useLogger(app.get(Logger));
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter(app.get(Logger)));
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
    await seed();
    const jwt = app.get(JwtService);
    for (const id of ids) tokens.set(id, await jwt.signAsync({ sub: id, role: roleOf[id], status: 'ACTIVE', type: 'access' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 }));
  });

  afterAll(async () => { await cleanup(); await app.close(); });

  it('exposes the unified queue to moderators and rejects anonymous access', async () => {
    await request(app.getHttpServer()).get('/admin/moderation/queue').expect(401);
    const queue = await request(app.getHttpServer()).get('/admin/moderation/queue').set('Authorization', auth(MOD)).expect(200);
    expect((queue.body.reports as Array<{ ratingId: string }>).some((r) => r.ratingId === ratingId)).toBe(true);
    expect((queue.body.disputes as Array<{ recordId: string }>).some((d) => d.recordId === recordId)).toBe(true);
    expect((queue.body.stadiums as Array<{ id: string }>).some((s) => s.id === stadiumId)).toBe(true);
  });

  it('hides then restores a reported comment, notifying the reporter and auditing both actions', async () => {
    await request(app.getHttpServer()).post(`/admin/moderation/reports/${ratingId}`).set('Authorization', auth(MOD)).send({ action: 'hide', reason: 'Confirmed abuse' }).expect(200);
    expect((await prisma.rating.findUnique({ where: { id: ratingId }, select: { status: true } }))?.status).toBe('HIDDEN');
    expect(await prisma.notification.findFirst({ where: { userId: REPORTER, type: 'REPORT_RESOLVED' } })).not.toBeNull();
    expect(await prisma.auditLog.findFirst({ where: { action: 'RATING_HIDE', targetId: ratingId, actorId: MOD } })).not.toBeNull();

    await request(app.getHttpServer()).post(`/admin/moderation/reports/${ratingId}`).set('Authorization', auth(ADMIN)).send({ action: 'restore', reason: 'On second look, acceptable' }).expect(200);
    expect((await prisma.rating.findUnique({ where: { id: ratingId }, select: { status: true } }))?.status).toBe('ACTIVE');
    expect(await prisma.auditLog.findFirst({ where: { action: 'RATING_RESTORE', targetId: ratingId, actorId: ADMIN } })).not.toBeNull();
  });

  it('overturns an attendance dispute, notifying the participant and auditing it', async () => {
    await request(app.getHttpServer()).post(`/admin/moderation/disputes/${recordId}`).set('Authorization', auth(ADMIN)).send({ status: 'ON_TIME', reason: 'Roster confirms attendance' }).expect(200);
    const record = await prisma.attendanceRecord.findUnique({ where: { id: recordId }, select: { status: true, disputeStatus: true, finalizedAt: true } });
    expect(record?.status).toBe('ON_TIME');
    expect(record?.disputeStatus).toBe('OVERTURNED');
    expect(record?.finalizedAt).not.toBeNull();
    expect(await prisma.notification.findFirst({ where: { userId: RATEE, type: 'ATTENDANCE_DISPUTE_RESOLVED' } })).not.toBeNull();
    expect(await prisma.auditLog.findFirst({ where: { action: 'ATTENDANCE_DISPUTE_RESOLVED', targetId: recordId, actorId: ADMIN } })).not.toBeNull();

    await request(app.getHttpServer()).post(`/admin/moderation/disputes/${recordId}`).set('Authorization', auth(ADMIN)).send({ status: 'ON_TIME', reason: 'again' }).expect(409);
  });

  it('approves a pending stadium submission with an audit row', async () => {
    await request(app.getHttpServer()).post(`/admin/moderation/stadiums/${stadiumId}`).set('Authorization', auth(ADMIN)).send({ decision: 'APPROVED', reason: 'Looks legitimate' }).expect(200);
    expect((await prisma.stadium.findUnique({ where: { id: stadiumId }, select: { status: true } }))?.status).toBe('APPROVED');
    expect(await prisma.auditLog.findFirst({ where: { action: 'STADIUM_APPROVED', targetId: stadiumId, actorId: ADMIN } })).not.toBeNull();

    await request(app.getHttpServer()).post(`/admin/moderation/stadiums/${stadiumId}`).set('Authorization', auth(ADMIN)).send({ decision: 'REJECTED', reason: 'x' }).expect(409);
  });
});
