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

describe('match create/edit API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let otherToken: string;
  const cityId = '019830ba-7d00-7000-8000-000000000301';
  const ownerId = '019830ba-7d00-7000-8000-000000000302';
  const otherId = '019830ba-7d00-7000-8000-000000000303';

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AvatarStorageService).useValue({})
      .overrideProvider(AvatarQueueService).useValue({ enqueue: async () => undefined })
      .compile();
    app = module.createNestApplication(); app.useLogger(app.get(Logger));
    app.useGlobalPipes(new ZodValidationPipe()); app.useGlobalFilters(new ApiExceptionFilter(app.get(Logger)));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.city.upsert({ where: { slug: 'matches-e2e' }, update: {}, create: { id: cityId, slug: 'matches-e2e', nameUz: 'Sinov', nameUzCyrl: 'Синов', nameRu: 'Тест', nameEn: 'Test', region: 'Test', lat: 41.3, lng: 69.2 } });
    await prisma.user.createMany({ data: [
      { id: ownerId, phone: '+998901110101', phoneVerifiedAt: new Date(), firstName: 'Match', lastName: 'Owner', username: 'match_owner_e2e', cityId },
      { id: otherId, phone: '+998901110102', phoneVerifiedAt: new Date(), firstName: 'Other', lastName: 'Player', username: 'match_other_e2e', cityId },
    ], skipDuplicates: true });
    const jwt = app.get(JwtService);
    ownerToken = await jwt.signAsync({ sub: ownerId, role: 'USER', status: 'ACTIVE', type: 'access' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 });
    otherToken = await jwt.signAsync({ sub: otherId, role: 'USER', status: 'ACTIVE', type: 'access' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 });
  });

  afterAll(async () => {
    await prisma.match.deleteMany({ where: { ownerId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await app.close();
  });

  it('creates, publishes, fetches computed occupancy, enforces ownership, and requires a cancel reason', async () => {
    const startsAt = new Date(Date.now() + 86_400_000).toISOString();
    const created = await request(app.getHttpServer()).post('/matches').set('Authorization', `Bearer ${ownerToken}`).send({
      title: 'Evening football', format: 'F5', startsAt, durationMin: 90, cityId, address: 'Test pitch', latitude: 41.31, longitude: 69.24,
      fieldPriceUzs: 500000, perPlayerFeeUzs: 50000, surface: 'ARTIFICIAL_GRASS', level: 'AMATEUR', joinMode: 'AUTO',
      allowNewPlayers: true, neededPositions: [], ageGroup: 'MIXED', verifiedPhoneOnly: false, ownerPlays: true, ownerGuestCount: 2,
    }).expect(201);
    expect(created.body).toEqual(expect.objectContaining({ status: 'DRAFT', totalSlots: 10, occupiedSlots: 3, freeSlots: 7 }));

    await request(app.getHttpServer()).patch(`/matches/${created.body.id as string}`).set('Authorization', `Bearer ${otherToken}`).send({ title: 'Hijacked' }).expect(403);
    await request(app.getHttpServer()).post(`/matches/${created.body.id as string}/publish`).set('Authorization', `Bearer ${otherToken}`).expect(403);
    const published = await request(app.getHttpServer()).post(`/matches/${created.body.id as string}/publish`).set('Authorization', `Bearer ${ownerToken}`).expect(200);
    expect(published.body.status).toBe('PUBLISHED');
    const fetched = await request(app.getHttpServer()).get(`/matches/${published.body.slug as string}`).expect(200);
    expect(fetched.body).toEqual(expect.objectContaining({ occupiedSlots: 3, freeSlots: 7 }));
    const missingReason = await request(app.getHttpServer()).post(`/matches/${created.body.id as string}/cancel`).set('Authorization', `Bearer ${ownerToken}`).send({ reason: '' }).expect(400);
    expect(missingReason.body.code).toBe('VALIDATION_ERROR');
  });
});
