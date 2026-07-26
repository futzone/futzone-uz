import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { Prisma } from '../src/generated/prisma';
import { PrismaService } from '../src/prisma/prisma.service';
import { AvatarQueueService } from '../src/users/avatar/avatar-queue.service';
import { AvatarStorageService } from '../src/users/avatar/avatar-storage.service';

describe('match discovery search (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cityId = '019830ba-7d00-7000-8000-000000000401';
  const ownerId = '019830ba-7d00-7000-8000-000000000402';
  const trustedOwnerId = '019830ba-7d00-7000-8000-000000000405';
  const stadiumIds = [
    '019830ba-7d00-7000-8000-000000000403',
    '019830ba-7d00-7000-8000-000000000404',
  ];
  const matchIds: string[] = [];

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
    await prisma.city.upsert({
      where: { slug: 'search-e2e' },
      update: {},
      create: { id: cityId, slug: 'search-e2e', nameUz: 'Qidiruv', nameUzCyrl: 'Қидирув', nameRu: 'Поиск', nameEn: 'Search', region: 'Test', lat: 41.3, lng: 69.2 },
    });
    await prisma.user.upsert({
      where: { phone: '+998901110401' },
      update: {},
      create: { id: ownerId, phone: '+998901110401', phoneVerifiedAt: new Date(), firstName: 'Search', lastName: 'Owner', username: 'search_owner_e2e', cityId },
    });
    await prisma.user.upsert({
      where: { phone: '+998901110402' },
      update: {},
      create: { id: trustedOwnerId, phone: '+998901110402', phoneVerifiedAt: new Date(), firstName: 'Trusted', lastName: 'Owner', username: 'search_trusted_owner_e2e', cityId },
    });
    await prisma.userStats.upsert({
      where: { userId: trustedOwnerId },
      update: { bayesAvg: 4.5, ratingCount: 10 },
      create: { userId: trustedOwnerId, bayesAvg: 4.5, ratingCount: 10 },
    });
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO stadiums
        (id, slug, name_uz, name_ru, name_en, city_id, district, address, location, surface, photos, status, created_by_id)
      VALUES
        (${stadiumIds[0]}::uuid, 'search-e2e-near', 'Yaqin', 'Близко', 'Near', ${cityId}::uuid, 'Chilonzor', 'Near pitch',
          ST_SetSRID(ST_MakePoint(69.2797, 41.3111), 4326)::geography, 'ARTIFICIAL_GRASS', ARRAY[]::text[], 'APPROVED', ${ownerId}::uuid),
        (${stadiumIds[1]}::uuid, 'search-e2e-far', 'Uzoq', 'Далеко', 'Far', ${cityId}::uuid, 'Chilonzor', 'Far pitch',
          ST_SetSRID(ST_MakePoint(69.3100, 41.3300), 4326)::geography, 'ARTIFICIAL_GRASS', ARRAY[]::text[], 'APPROVED', ${ownerId}::uuid)
      ON CONFLICT (id) DO UPDATE SET location = EXCLUDED.location, status = 'APPROVED'
    `);
    const tashkentNow = new Date(Date.now() + 5 * 3_600_000);
    const startsAt = new Date(Date.UTC(
      tashkentNow.getUTCFullYear(), tashkentNow.getUTCMonth(), tashkentNow.getUTCDate(), 14, 0, 0,
    ) - 5 * 3_600_000);
    for (const [index, status] of (['PUBLISHED', 'PUBLISHED', 'FULL'] as const).entries()) {
      const id = uuidv7();
      matchIds.push(id);
      await prisma.match.create({
        data: {
          id,
          slug: `search-e2e-${index}`,
          ownerId: index === 0 ? trustedOwnerId : ownerId,
          title: `Search result ${index}`,
          format: 'F5',
          totalSlots: 10,
          startsAt: new Date(startsAt.getTime() + index * 60_000),
          durationMin: 90,
          cityId,
          stadiumId: stadiumIds[index === 1 ? 1 : 0],
          fieldPriceUzs: 500_000,
          perPlayerFeeUzs: index === 1 ? 60_000 : 50_000,
          surface: 'ARTIFICIAL_GRASS',
          level: 'AMATEUR',
          joinMode: 'AUTO',
          status,
          neededPositions: [],
          ageGroup: 'MIXED',
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
    await prisma.stadium.deleteMany({ where: { id: { in: stadiumIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, trustedOwnerId] } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await app.close();
  });

  it('returns distance-ordered results from seeded coordinates', async () => {
    const response = await request(app.getHttpServer())
      .get('/matches?city=search-e2e&nearLat=41.3110&nearLng=69.2795&radiusKm=20&sort=nearest')
      .expect(200);
    expect(response.body.items.slice(0, 2).map((match: { slug: string }) => match.slug))
      .toEqual(['search-e2e-0', 'search-e2e-2']);
    expect(response.body.items[0].distanceKm).toBeLessThan(response.body.items.at(-1).distanceKm);
  });

  it('onlyAvailable excludes FULL matches', async () => {
    const response = await request(app.getHttpServer())
      .get('/matches?city=search-e2e&onlyAvailable=true')
      .expect(200);
    expect(response.body.items.map((match: { status: string }) => match.status)).not.toContain('FULL');
  });

  it('combines city, today, 5x5, availability, price and nearest sorting', async () => {
    const response = await request(app.getHttpServer())
      .get('/matches?city=search-e2e&date=today&format=F5&onlyAvailable=true&priceMin=45000&priceMax=55000&nearLat=41.3110&nearLng=69.2795&sort=nearest')
      .expect(200);
    expect(response.body.items.map((match: { slug: string }) => match.slug)).toEqual(['search-e2e-0']);
  });

  it.each(['soonest', 'nearest', 'newest', 'mostFreeSlots', 'organizerTrust', 'priceAsc', 'priceDesc'] as const)(
    'keeps cursor pages stable for sort=%s',
    async (sort) => {
      const geo = sort === 'nearest' ? '&nearLat=41.3110&nearLng=69.2795' : '';
      const expected = await request(app.getHttpServer())
        .get(`/matches?city=search-e2e&sort=${sort}&limit=100${geo}`)
        .expect(200);
      const expectedIds = (expected.body.items as Array<{ id: string }>).map(({ id }) => id);
      expect(expectedIds.length).toBeGreaterThanOrEqual(2);

      const pagedIds: string[] = [];
      let cursor: string | null = null;
      do {
        const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
        const page = await request(app.getHttpServer())
          .get(`/matches?city=search-e2e&sort=${sort}&limit=1${geo}${cursorQuery}`)
          .expect(200);
        const items = page.body.items as Array<{ id: string }>;
        expect(items).toHaveLength(1);
        pagedIds.push(items[0]?.id ?? '');
        cursor = page.body.nextCursor as string | null;
      } while (cursor !== null);

      expect(new Set(pagedIds).size).toBe(pagedIds.length);
      expect(pagedIds).toEqual(expectedIds);
    },
  );
});
