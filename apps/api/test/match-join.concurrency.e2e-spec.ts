import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { computeMatchOccupancy } from '../src/matches/occupancy';
import { AvatarQueueService } from '../src/users/avatar/avatar-queue.service';
import { AvatarStorageService } from '../src/users/avatar/avatar-storage.service';

describe('P2-03 seat-capacity locking (concurrency e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cityId = '019830ba-7d00-7000-8000-000000000501';
  const userIds = Array.from(
    { length: 11 },
    (_, index) => `019830ba-7d00-7000-8000-0000000005${String(index + 2).padStart(2, '0')}`,
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
    await prisma.city.upsert({
      where: { slug: 'join-concurrency-e2e' },
      update: {},
      create: {
        id: cityId,
        slug: 'join-concurrency-e2e',
        nameUz: 'Race',
        nameUzCyrl: 'Race',
        nameRu: 'Race',
        nameEn: 'Race',
        region: 'Test',
        lat: 41.3,
        lng: 69.2,
      },
    });
    await prisma.user.createMany({
      data: userIds.map((id, index) => ({
        id,
        phone: `+9989011301${String(index).padStart(2, '0')}`,
        phoneVerifiedAt: new Date(),
        firstName: 'Race',
        lastName: `${index}`,
        username: `race_e2e_${index}`,
        cityId,
      })),
      skipDuplicates: true,
    });
    const jwt = app.get(JwtService);
    for (const id of userIds)
      tokens.set(
        id,
        await jwt.signAsync(
          { sub: id, role: 'USER', status: 'ACTIVE', type: 'access' },
          { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 },
        ),
      );
  });

  afterAll(async () => {
    await prisma.match.deleteMany({ where: { ownerId: userIds[0] } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await app.close();
  });

  it('never exceeds totalSlots across 20 rounds of 10 genuinely parallel guest joins for 3 free seats', async () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const ownerId = userIds[0]!;
      const created = await request(app.getHttpServer())
        .post('/matches')
        .set('Authorization', `Bearer ${tokens.get(ownerId) ?? ''}`)
        .send({
          title: `Concurrency ${iteration}`,
          format: 'F5',
          startsAt: new Date(Date.now() + (iteration + 1) * 86_400_000).toISOString(),
          durationMin: 90,
          cityId,
          address: 'Race pitch',
          latitude: 41.3,
          longitude: 69.2,
          fieldPriceUzs: 100000,
          perPlayerFeeUzs: 10000,
          surface: 'ARTIFICIAL_GRASS',
          level: 'AMATEUR',
          joinMode: 'AUTO',
          allowNewPlayers: true,
          neededPositions: [],
          ageGroup: 'MIXED',
          verifiedPhoneOnly: true,
          ownerPlays: true,
          ownerGuestCount: 6,
        })
        .expect(201);
      const matchId = created.body.id as string;
      await request(app.getHttpServer())
        .post(`/matches/${matchId}/publish`)
        .set('Authorization', `Bearer ${tokens.get(ownerId) ?? ''}`)
        .expect(200);

      // Construct all ten requests before awaiting any. Heterogeneous parties consume 2 or 3 seats, so with only
      // 3 free slots exactly one can win regardless of lock order; all contenders exercise guest seat accounting.
      const guestCounts = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2] as const;
      const attempts = userIds.slice(1).map((userId, index) =>
        request(app.getHttpServer())
          .post(`/matches/${matchId}/join`)
          .set('Authorization', `Bearer ${tokens.get(userId) ?? ''}`)
          .send({ guestCount: guestCounts[index] }),
      );
      const responses = await Promise.all(attempts);
      const winners = responses.filter(({ status }) => status === 200);
      const losers = responses.filter(({ status }) => status === 409);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(9);
      expect(losers.every(({ body }) => body.code === 'MATCH_FULL')).toBe(true);

      const match = await prisma.match.findUniqueOrThrow({
        where: { id: matchId },
        select: { totalSlots: true },
      });
      const occupied = await prisma.$transaction((tx) => computeMatchOccupancy(tx, matchId));
      expect(occupied).toBe(7 + 1 + (winners[0]?.body.participant.guestCount as number));
      expect(occupied).toBeLessThanOrEqual(match.totalSlots);
    }
  }, 120_000);
});
