import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { MatchQueueService } from '../src/matches/match-queue.service';
import { MatchWorkerService } from '../src/matches/match-worker.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AvatarQueueService } from '../src/users/avatar/avatar-queue.service';
import { AvatarStorageService } from '../src/users/avatar/avatar-storage.service';

describe('P2-04 waitlist and P2-08 scheduling (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cityId = '019830ba-7d00-7000-8000-000000000501';
  const ids = Array.from({ length: 5 }, (_, index) => `019830ba-7d00-7000-8000-0000000005${String(index + 2).padStart(2, '0')}`);
  const tokens = new Map<string, string>();
  let matchQueue: MatchQueueService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AvatarStorageService).useValue({})
      .overrideProvider(AvatarQueueService).useValue({ enqueue: async () => undefined })
      .overrideProvider(MatchWorkerService).useValue({})
      .compile();
    app = module.createNestApplication();
    app.useLogger(app.get(Logger));
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter(app.get(Logger)));
    await app.init();
    prisma = app.get(PrismaService);
    matchQueue = app.get(MatchQueueService);
    await prisma.city.upsert({ where: { slug: 'waitlist-e2e' }, update: {}, create: { id: cityId, slug: 'waitlist-e2e', nameUz: 'Waitlist', nameUzCyrl: 'Waitlist', nameRu: 'Waitlist', nameEn: 'Waitlist', region: 'Test', lat: 41.3, lng: 69.2 } });
    await prisma.user.createMany({ data: ids.map((id, index) => ({ id, phone: `+99890113010${index}`, phoneVerifiedAt: new Date(), firstName: 'Wait', lastName: `${index}`, username: `wait_e2e_${index}`, cityId })), skipDuplicates: true });
    const jwt = app.get(JwtService);
    for (const id of ids) tokens.set(id, await jwt.signAsync({ sub: id, role: 'USER', status: 'ACTIVE', type: 'access' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 }));
  });

  afterAll(async () => {
    await prisma.match.deleteMany({ where: { ownerId: ids[0] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await app.close();
  });

  const auth = (id: string): string => `Bearer ${tokens.get(id) ?? ''}`;
  async function createAndPublish(): Promise<string> {
    const created = await request(app.getHttpServer()).post('/matches').set('Authorization', auth(ids[0]!)).send({
      title: 'Waitlist flow', format: 'F5', startsAt: new Date(Date.now() + 86_400_000).toISOString(), durationMin: 90,
      cityId, address: 'Waitlist pitch', latitude: 41.3, longitude: 69.2, fieldPriceUzs: 100000, perPlayerFeeUzs: 10000,
      surface: 'ARTIFICIAL_GRASS', level: 'AMATEUR', joinMode: 'AUTO', allowNewPlayers: true, neededPositions: [], ageGroup: 'MIXED', verifiedPhoneOnly: true,
      ownerPlays: true, ownerGuestCount: 8,
    }).expect(201);
    await request(app.getHttpServer()).post(`/matches/${created.body.id as string}/publish`).set('Authorization', auth(ids[0]!)).expect(200);
    return created.body.id as string;
  }

  it('promotes the first fitting waitlisted party when a FULL match frees a seat', async () => {
    const matchId = await createAndPublish();
    await request(app.getHttpServer()).post(`/matches/${matchId}/join`).set('Authorization', auth(ids[1]!)).send({ guestCount: 0 }).expect(200);
    await request(app.getHttpServer()).post(`/matches/${matchId}/waitlist`).set('Authorization', auth(ids[2]!)).send({ guestCount: 1 }).expect(200);
    await request(app.getHttpServer()).post(`/matches/${matchId}/waitlist`).set('Authorization', auth(ids[3]!)).send({ guestCount: 0 }).expect(200);
    await request(app.getHttpServer()).post(`/matches/${matchId}/leave`).set('Authorization', auth(ids[1]!)).expect(200);

    const [skipped, promoted] = await Promise.all([
      prisma.matchParticipant.findUniqueOrThrow({ where: { matchId_userId: { matchId, userId: ids[2]! } } }),
      prisma.matchParticipant.findUniqueOrThrow({ where: { matchId_userId: { matchId, userId: ids[3]! } } }),
    ]);
    expect(skipped.status).toBe('WAITLISTED');
    expect(skipped.waitlistPosition).toBe(1);
    expect(promoted.status).toBe('PENDING_CONFIRMATION');
    expect(promoted.waitlistPosition).toBe(2);
    expect(promoted.promotionExpiresAt?.getTime()).toBeGreaterThan(Date.now());

    await request(app.getHttpServer())
      .post(`/matches/${matchId}/join`)
      .set('Authorization', auth(ids[4]!))
      .send({ guestCount: 0 })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('MATCH_FULL');
        expect(body.details.waitlistAvailable).toBe(true);
      });
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/waitlist/confirm`)
      .set('Authorization', auth(ids[3]!))
      .expect(200);
    expect(
      (
        await prisma.matchParticipant.findUniqueOrThrow({
          where: { matchId_userId: { matchId, userId: ids[3]! } },
        })
      ).status,
    ).toBe('CONFIRMED');
  });

  it('cancelling a match cancels its scheduled jobs', async () => {
    const matchId = await createAndPublish();
    expect(await matchQueue.hasScheduledMatchJobs(matchId)).toBe(true);
    await request(app.getHttpServer()).post(`/matches/${matchId}/cancel`).set('Authorization', auth(ids[0]!)).send({ reason: 'Pitch unavailable' }).expect(200);
    expect(await matchQueue.hasScheduledMatchJobs(matchId)).toBe(false);
  });
});
