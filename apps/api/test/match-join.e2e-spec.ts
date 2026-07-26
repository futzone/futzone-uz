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

describe('P2-03 match participation API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cityId = '019830ba-7d00-7000-8000-000000000401';
  const ids = Array.from(
    { length: 4 },
    (_, index) => `019830ba-7d00-7000-8000-0000000004${String(index + 2).padStart(2, '0')}`,
  );
  const tokens = new Map<string, string>();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AvatarStorageService)
      .useValue({})
      .overrideProvider(AvatarQueueService)
      .useValue({ enqueue: async () => undefined })
      .compile();
    app = module.createNestApplication();
    app.useLogger(app.get(Logger));
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter(app.get(Logger)));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.match.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await prisma.city.upsert({
      where: { slug: 'join-e2e' },
      update: {},
      create: {
        id: cityId,
        slug: 'join-e2e',
        nameUz: 'Join',
        nameUzCyrl: 'Жоин',
        nameRu: 'Join',
        nameEn: 'Join',
        region: 'Test',
        lat: 41.3,
        lng: 69.2,
      },
    });
    await prisma.user.createMany({
      data: ids.map((id, index) => ({
        id,
        phone: `+99890112010${index}`,
        phoneVerifiedAt: new Date(),
        firstName: 'Join',
        lastName: `${index}`,
        username: `join_e2e_${index}`,
        cityId,
      })),
      skipDuplicates: true,
    });
    const jwt = app.get(JwtService);
    for (const id of ids)
      tokens.set(
        id,
        await jwt.signAsync(
          { sub: id, role: 'USER', status: 'ACTIVE', type: 'access' },
          { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 },
        ),
      );
  });

  afterAll(async () => {
    await prisma.match.deleteMany({ where: { ownerId: ids[0] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await app.close();
  });

  const auth = (id: string): string => `Bearer ${tokens.get(id) ?? ''}`;
  async function createPublished(
    joinMode: 'AUTO' | 'MANUAL',
    startsAt: Date,
    ownerGuestCount: number,
    requirements: { minRating?: number; minAttendancePct?: number; allowNewPlayers?: boolean } = {},
  ): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/matches')
      .set('Authorization', auth(ids[0]!))
      .send({
        title: 'Join flow',
        format: 'F5',
        startsAt: startsAt.toISOString(),
        durationMin: 90,
        cityId,
        address: 'Join pitch',
        latitude: 41.3,
        longitude: 69.2,
        fieldPriceUzs: 100000,
        perPlayerFeeUzs: 10000,
        surface: 'ARTIFICIAL_GRASS',
        level: 'AMATEUR',
        joinMode,
        minRating: requirements.minRating,
        minAttendancePct: requirements.minAttendancePct,
        allowNewPlayers: requirements.allowNewPlayers ?? true,
        neededPositions: [],
        ageGroup: 'MIXED',
        verifiedPhoneOnly: true,
        ownerPlays: true,
        ownerGuestCount,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/matches/${created.body.id as string}/publish`)
      .set('Authorization', auth(ids[0]!))
      .expect(200);
    return created.body.id as string;
  }

  it('revalidates capacity for join, guest edits, lowering, and leave', async () => {
    const matchId = await createPublished('AUTO', new Date(Date.now() + 86_400_000), 6);
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/join`)
      .set('Authorization', auth(ids[1]!))
      .send({ guestCount: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/matches/${matchId}/participants/me`)
      .set('Authorization', auth(ids[1]!))
      .send({ guestCount: 3 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('MATCH_FULL'));
    await request(app.getHttpServer())
      .patch(`/matches/${matchId}/participants/me`)
      .set('Authorization', auth(ids[1]!))
      .send({ guestCount: 2 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/matches/${matchId}/participants/me`)
      .set('Authorization', auth(ids[1]!))
      .send({ guestCount: 0 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/leave`)
      .set('Authorization', auth(ids[1]!))
      .expect(200);
    expect(await prisma.matchParticipant.count({ where: { matchId, status: 'CONFIRMED' } })).toBe(
      1,
    );
  });

  it('rejects overlapping half-open time windows but permits touching boundaries', async () => {
    const start = new Date(Date.now() + 172_800_000);
    const first = await createPublished('AUTO', start, 0);
    await request(app.getHttpServer())
      .post(`/matches/${first}/join`)
      .set('Authorization', auth(ids[1]!))
      .send({ guestCount: 0 })
      .expect(200);
    const overlapping = await createPublished('AUTO', new Date(start.getTime() + 30 * 60_000), 0);
    await request(app.getHttpServer())
      .post(`/matches/${overlapping}/join`)
      .set('Authorization', auth(ids[1]!))
      .send({ guestCount: 0 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('OVERLAPPING_MATCH'));
    const touching = await createPublished('AUTO', new Date(start.getTime() + 90 * 60_000), 0);
    await request(app.getHttpServer())
      .post(`/matches/${touching}/join`)
      .set('Authorization', auth(ids[1]!))
      .send({ guestCount: 0 })
      .expect(200);
  });

  it('serializes concurrent joins by one user across overlapping matches', async () => {
    const start = new Date(Date.now() + 345_600_000);
    const [first, second] = await Promise.all([
      createPublished('AUTO', start, 0),
      createPublished('AUTO', new Date(start.getTime() + 15 * 60_000), 0),
    ]);
    const responses = await Promise.all(
      [first, second].map((matchId) =>
        request(app.getHttpServer())
          .post(`/matches/${matchId}/join`)
          .set('Authorization', auth(ids[2]!))
          .send({ guestCount: 0 }),
      ),
    );
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(responses.find(({ status }) => status === 409)?.body.code).toBe('OVERLAPPING_MATCH');
    expect(
      await prisma.matchParticipant.count({
        where: { userId: ids[2], status: 'CONFIRMED', matchId: { in: [first, second] } },
      }),
    ).toBe(1);
  });

  it('keeps a manual request pending when the match fills and rejects approval with MATCH_FULL', async () => {
    const matchId = await createPublished('MANUAL', new Date(Date.now() + 259_200_000), 8);
    const joined = await request(app.getHttpServer())
      .post(`/matches/${matchId}/join`)
      .set('Authorization', auth(ids[1]!))
      .send({ guestCount: 0, message: 'Let me play' })
      .expect(200);
    expect(joined.body.kind).toBe('request');
    await request(app.getHttpServer())
      .patch(`/matches/${matchId}/participants/me`)
      .set('Authorization', auth(ids[0]!))
      .send({ guestCount: 9 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/requests/${joined.body.request.id as string}/approve`)
      .set('Authorization', auth(ids[0]!))
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('MATCH_FULL'));
    expect(
      (
        await prisma.joinRequest.findUniqueOrThrow({
          where: { id: joined.body.request.id as string },
        })
      ).status,
    ).toBe('PENDING');
  });

  it('refuses a low-reputation user until the owner drops the thresholds', async () => {
    await prisma.userStats.upsert({
      where: { userId: ids[3]! },
      create: {
        userId: ids[3]!,
        matchesPlayed: 10,
        onTime: 3,
        noShow: 7,
        attendancePct: 30,
        bayesAvg: 2.5,
        ratingCount: 5,
        lastFiveAvg: 2.4,
      },
      update: {
        matchesPlayed: 10,
        onTime: 3,
        noShow: 7,
        attendancePct: 30,
        bayesAvg: 2.5,
        ratingCount: 5,
        lastFiveAvg: 2.4,
      },
    });
    const matchId = await createPublished(
      'AUTO',
      new Date('2035-06-01T12:00:00.000Z'),
      0,
      { minRating: 3, minAttendancePct: 60, allowNewPlayers: false },
    );

    await request(app.getHttpServer())
      .post(`/matches/${matchId}/join`)
      .set('Authorization', auth(ids[3]!))
      .send({ guestCount: 0 })
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe('REQUIREMENTS_NOT_MET');
        expect(body.details).toEqual({
          requirement: 'minRating',
          minimum: 3,
          actual: 2.5,
        });
      });

    await prisma.match.update({
      where: { id: matchId },
      data: { minRating: null, minAttendancePct: null, allowNewPlayers: true },
    });
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/join`)
      .set('Authorization', auth(ids[3]!))
      .send({ guestCount: 0 })
      .expect(200);
  });
});
