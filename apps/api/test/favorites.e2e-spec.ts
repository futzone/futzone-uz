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

describe('P4-06 favorites API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cityId = '019830ba-7d00-7000-8000-000000000f01';
  const stadiumId = '019830ba-7d00-7000-8000-000000000f10';
  // [0] actor, [1] favourited organizer, [2] other organizer.
  const ids = ['a1', 'b2', 'c3'].map((suffix) => `019830ba-7d00-7000-8000-0000000000${suffix}`);
  const tokens = new Map<string, string>();
  const auth = (id: string): string => `Bearer ${tokens.get(id) ?? ''}`;

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

    await prisma.match.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.favoriteStadium.deleteMany({ where: { userId: { in: ids } } });
    await prisma.favoriteOrganizer.deleteMany({ where: { userId: { in: ids } } });
    await prisma.stadium.deleteMany({ where: { id: stadiumId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await prisma.city.upsert({
      where: { slug: 'fav-e2e' }, update: {},
      create: { id: cityId, slug: 'fav-e2e', nameUz: 'Fav', nameUzCyrl: 'Фав', nameRu: 'Fav', nameEn: 'Fav', region: 'Test', lat: 41.3, lng: 69.2 },
    });
    await prisma.user.createMany({
      data: ids.map((id, index) => ({ id, phone: `+99890113010${index}`, phoneVerifiedAt: new Date(), firstName: 'Fav', lastName: `${index}`, username: `fav_e2e_${index}`, cityId })),
      skipDuplicates: true,
    });
    await prisma.$executeRaw`
      INSERT INTO stadiums (id, slug, name_uz, name_ru, name_en, city_id, district, address, location, surface, photos, status, created_by_id)
      VALUES (${stadiumId}::uuid, 'fav-e2e-stadium', 'Fav', 'Fav', 'Fav', ${cityId}::uuid, 'Test', 'Pitch',
        ST_SetSRID(ST_MakePoint(69.2, 41.3), 4326)::geography, 'ARTIFICIAL_GRASS'::"Surface", ARRAY[]::text[], 'APPROVED'::"StadiumStatus", ${ids[0]}::uuid)`;

    const jwt = app.get(JwtService);
    for (const id of ids)
      tokens.set(id, await jwt.signAsync({ sub: id, role: 'USER', status: 'ACTIVE', type: 'access' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 }));
  });

  afterAll(async () => {
    await prisma.match.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.favoriteStadium.deleteMany({ where: { userId: { in: ids } } });
    await prisma.favoriteOrganizer.deleteMany({ where: { userId: { in: ids } } });
    await prisma.stadium.deleteMany({ where: { id: stadiumId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await app.close();
  });

  async function createPublishedMatch(ownerId: string, title: string): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/matches').set('Authorization', auth(ownerId))
      .send({
        title, format: 'F5', startsAt: new Date('2035-02-01T10:00:00.000Z').toISOString(), durationMin: 90,
        cityId, address: 'Fav pitch', latitude: 41.3, longitude: 69.2, fieldPriceUzs: 100000, perPlayerFeeUzs: 10000,
        surface: 'ARTIFICIAL_GRASS', level: 'AMATEUR', joinMode: 'AUTO', allowNewPlayers: true,
        neededPositions: [], ageGroup: 'MIXED', verifiedPhoneOnly: false, ownerPlays: false, ownerGuestCount: 0,
      })
      .expect(201);
    const id = created.body.id as string;
    await request(app.getHttpServer()).post(`/matches/${id}/publish`).set('Authorization', auth(ownerId)).expect(200);
    return id;
  }

  it('requires authentication for every favourites endpoint', async () => {
    await request(app.getHttpServer()).get('/me/favorites').expect(401);
    await request(app.getHttpServer()).put(`/me/favorites/stadiums/${stadiumId}`).expect(401);
    await request(app.getHttpServer()).delete(`/me/favorites/organizers/${ids[1]}`).expect(401);
  });

  it('adds, lists and removes a favourite stadium idempotently', async () => {
    const add = await request(app.getHttpServer()).put(`/me/favorites/stadiums/${stadiumId}`).set('Authorization', auth(ids[0]!)).expect(200);
    expect(add.body).toEqual({ favorited: true });
    await request(app.getHttpServer()).put(`/me/favorites/stadiums/${stadiumId}`).set('Authorization', auth(ids[0]!)).expect(200);

    const list = await request(app.getHttpServer()).get('/me/favorites').set('Authorization', auth(ids[0]!)).expect(200);
    expect(list.body.stadiums).toHaveLength(1);
    expect(list.body.stadiums[0].id).toBe(stadiumId);

    const remove = await request(app.getHttpServer()).delete(`/me/favorites/stadiums/${stadiumId}`).set('Authorization', auth(ids[0]!)).expect(200);
    expect(remove.body).toEqual({ favorited: false });
    const after = await request(app.getHttpServer()).get('/me/favorites').set('Authorization', auth(ids[0]!)).expect(200);
    expect(after.body.stadiums).toHaveLength(0);
  });

  it('adds and lists a favourite organizer with public fields only and rejects self-favouriting', async () => {
    await request(app.getHttpServer()).put(`/me/favorites/organizers/${ids[1]}`).set('Authorization', auth(ids[0]!)).expect(200);
    const list = await request(app.getHttpServer()).get('/me/favorites').set('Authorization', auth(ids[0]!)).expect(200);
    expect(list.body.organizers).toHaveLength(1);
    expect(list.body.organizers[0]).toMatchObject({ id: ids[1], username: 'fav_e2e_1' });
    expect(list.body.organizers[0]).not.toHaveProperty('phone');

    const self = await request(app.getHttpServer()).put(`/me/favorites/organizers/${ids[0]}`).set('Authorization', auth(ids[0]!)).expect(400);
    expect(self.body.code).toBe('VALIDATION_ERROR');
    await request(app.getHttpServer()).delete(`/me/favorites/organizers/${ids[1]}`).set('Authorization', auth(ids[0]!)).expect(200);
  });

  it('returns 404 for an unknown stadium or organizer', async () => {
    const ghost = '019830ba-7d00-7000-8000-0000000000ff';
    await request(app.getHttpServer()).put(`/me/favorites/stadiums/${ghost}`).set('Authorization', auth(ids[0]!)).expect(404);
    await request(app.getHttpServer()).put(`/me/favorites/organizers/${ghost}`).set('Authorization', auth(ids[0]!)).expect(404);
  });

  it('filters discovery to favourited organizers, and returns nothing for anonymous favouritesOnly', async () => {
    const favourited = await createPublishedMatch(ids[1]!, 'Favourited organizer match');
    await createPublishedMatch(ids[2]!, 'Other organizer match');
    await request(app.getHttpServer()).put(`/me/favorites/organizers/${ids[1]}`).set('Authorization', auth(ids[0]!)).expect(200);

    const mine = await request(app.getHttpServer()).get('/matches?favoritesOnly=true&city=fav-e2e').set('Authorization', auth(ids[0]!)).expect(200);
    const mineIds = (mine.body.items as Array<{ id: string }>).map((item) => item.id);
    expect(mineIds).toContain(favourited);
    expect(mine.body.items.every((item: { ownerId: string }) => item.ownerId === ids[1])).toBe(true);

    const anon = await request(app.getHttpServer()).get('/matches?favoritesOnly=true&city=fav-e2e').expect(200);
    expect(anon.body.items).toHaveLength(0);
  });
});
