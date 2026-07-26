import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { AvatarQueueService } from '../src/users/avatar/avatar-queue.service';
import { AvatarStorageService } from '../src/users/avatar/avatar-storage.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('match search performance (1k fixture smoke)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
  });

  afterAll(async () => app.close());

  it('keeps p95 search latency below 150 ms', async () => {
    const path = '/matches?q=futbol&format=F5,F7&onlyAvailable=true&priceMin=30000&priceMax=100000&nearLat=41.31&nearLng=69.28&radiusKm=100&sort=nearest&limit=20';
    await request(app.getHttpServer()).get('/matches?q=Perf&limit=100').expect(200);
    expect(await prisma.match.count({ where: { slug: { startsWith: 'perf-search-' } } })).toBeGreaterThanOrEqual(1_000);
    for (let warmup = 0; warmup < 10; warmup += 1) await request(app.getHttpServer()).get(path).expect(200);
    const durations: number[] = [];
    for (let iteration = 0; iteration < 100; iteration += 1) {
      const started = performance.now();
      await request(app.getHttpServer()).get(path).expect(200);
      durations.push(performance.now() - started);
    }
    durations.sort((left, right) => left - right);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
    console.info(`match-search p95=${p95.toFixed(2)}ms over ${durations.length} requests`);
    expect(p95).toBeLessThan(150);
  });
});
