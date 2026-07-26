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

describe('P5-01 notifications fire from real triggers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cityId = '019830ba-7d00-7000-8000-000000000e01';
  // [0] owner, [1] requester.
  const ids = ['d1', 'd2'].map((suffix) => `019830ba-7d00-7000-8000-0000000000${suffix}`);
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

    await prisma.pushSubscription.deleteMany({ where: { userId: { in: ids } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.match.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await prisma.city.upsert({
      where: { slug: 'notif-e2e' }, update: {},
      create: { id: cityId, slug: 'notif-e2e', nameUz: 'Notif', nameUzCyrl: 'Нотиф', nameRu: 'Notif', nameEn: 'Notif', region: 'Test', lat: 41.3, lng: 69.2 },
    });
    await prisma.user.createMany({
      data: ids.map((id, index) => ({ id, phone: `+99890114010${index}`, phoneVerifiedAt: new Date(), firstName: 'Notif', lastName: `${index}`, username: `notif_e2e_${index}`, cityId })),
      skipDuplicates: true,
    });

    const jwt = app.get(JwtService);
    for (const id of ids)
      tokens.set(id, await jwt.signAsync({ sub: id, role: 'USER', status: 'ACTIVE', type: 'access' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 }));
  });

  afterAll(async () => {
    await prisma.pushSubscription.deleteMany({ where: { userId: { in: ids } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.match.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await app.close();
  });

  async function createManualMatch(ownerId: string): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/matches').set('Authorization', auth(ownerId))
      .send({
        title: 'Notif manual match', format: 'F5', startsAt: new Date('2035-03-01T10:00:00.000Z').toISOString(), durationMin: 90,
        cityId, address: 'Notif pitch', latitude: 41.3, longitude: 69.2, fieldPriceUzs: 100000, perPlayerFeeUzs: 10000,
        surface: 'ARTIFICIAL_GRASS', level: 'AMATEUR', joinMode: 'MANUAL', allowNewPlayers: true,
        neededPositions: [], ageGroup: 'MIXED', verifiedPhoneOnly: false, ownerPlays: false, ownerGuestCount: 0,
      })
      .expect(201);
    const id = created.body.id as string;
    await request(app.getHttpServer()).post(`/matches/${id}/publish`).set('Authorization', auth(ownerId)).expect(200);
    return id;
  }

  it('notifies the owner of a join request and the requester of the decision', async () => {
    const matchId = await createManualMatch(ids[0]!);

    const joined = await request(app.getHttpServer())
      .post(`/matches/${matchId}/join`).set('Authorization', auth(ids[1]!))
      .send({ guestCount: 0 }).expect(200);
    expect(joined.body.kind).toBe('request');
    const requestId = joined.body.request.id as string;

    const ownerNotice = await prisma.notification.findFirst({
      where: { userId: ids[0], matchId, type: 'JOIN_REQUEST_RECEIVED' },
    });
    expect(ownerNotice).not.toBeNull();
    expect(ownerNotice?.payload).toMatchObject({ requestId, requesterId: ids[1] });

    await request(app.getHttpServer())
      .post(`/matches/${matchId}/requests/${requestId}/approve`).set('Authorization', auth(ids[0]!))
      .expect(200);

    const requesterNotice = await prisma.notification.findFirst({
      where: { userId: ids[1], matchId, type: 'JOIN_APPROVED' },
    });
    expect(requesterNotice).not.toBeNull();
  });

  it('lists, counts and marks the in-app centre read for the owner', async () => {
    const list = await request(app.getHttpServer())
      .get('/me/notifications').set('Authorization', auth(ids[0]!)).expect(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.length).toBeGreaterThan(0);
    expect(list.body.items[0]).toMatchObject({ type: 'JOIN_REQUEST_RECEIVED' });
    expect(list.body.unreadCount).toBeGreaterThan(0);
    expect(list.body.items.every((n: { readAt: string | null }) => n.readAt === null)).toBe(true);

    const count = await request(app.getHttpServer())
      .get('/me/notifications/unread-count').set('Authorization', auth(ids[0]!)).expect(200);
    expect(count.body.unreadCount).toBe(list.body.unreadCount);

    const first = list.body.items[0].id as string;
    const afterOne = await request(app.getHttpServer())
      .post(`/me/notifications/${first}/read`).set('Authorization', auth(ids[0]!)).expect(200);
    expect(afterOne.body.unreadCount).toBe(list.body.unreadCount - 1);

    const afterAll = await request(app.getHttpServer())
      .post('/me/notifications/read-all').set('Authorization', auth(ids[0]!)).expect(200);
    expect(afterAll.body.unreadCount).toBe(0);
  });

  it('requires authentication for the in-app centre and its stream', async () => {
    await request(app.getHttpServer()).get('/me/notifications').expect(401);
    await request(app.getHttpServer()).get('/me/notifications/unread-count').expect(401);
    await request(app.getHttpServer()).get('/me/notifications/stream').expect(401);
    await request(app.getHttpServer()).get('/me/notifications/stream?token=bogus').expect(401);
  });

  it('round-trips per-type push preferences', async () => {
    const initial = await request(app.getHttpServer())
      .get('/me/notifications/preferences').set('Authorization', auth(ids[0]!)).expect(200);
    expect(initial.body.perTypeChannelFlags).toEqual({});

    const updated = await request(app.getHttpServer())
      .put('/me/notifications/preferences').set('Authorization', auth(ids[0]!))
      .send({ perTypeChannelFlags: { MATCH_REMINDER_24H: { push: false } } }).expect(200);
    expect(updated.body.perTypeChannelFlags).toEqual({ MATCH_REMINDER_24H: { push: false } });

    const persisted = await request(app.getHttpServer())
      .get('/me/notifications/preferences').set('Authorization', auth(ids[0]!)).expect(200);
    expect(persisted.body.perTypeChannelFlags.MATCH_REMINDER_24H).toEqual({ push: false });

    await request(app.getHttpServer())
      .put('/me/notifications/preferences').set('Authorization', auth(ids[0]!))
      .send({ perTypeChannelFlags: { NOT_A_TYPE: { push: false } } }).expect(400);
  });

  it('registers and removes a push subscription and exposes the VAPID key endpoint', async () => {
    const key = await request(app.getHttpServer()).get('/push/vapid-public-key').expect(200);
    expect(key.body).toHaveProperty('publicKey'); // null when VAPID is not configured in the test env

    const endpoint = 'https://push.example.com/sub-e2e-1';
    const sub = await request(app.getHttpServer())
      .post('/me/push/subscriptions').set('Authorization', auth(ids[0]!))
      .send({ endpoint, keys: { p256dh: 'BPk', auth: 'aX' }, userAgent: 'jest' }).expect(200);
    expect(sub.body).toEqual({ subscribed: true });
    expect(await prisma.pushSubscription.count({ where: { userId: ids[0], endpoint } })).toBe(1);

    const remove = await request(app.getHttpServer())
      .delete('/me/push/subscriptions').set('Authorization', auth(ids[0]!))
      .send({ endpoint }).expect(200);
    expect(remove.body).toEqual({ subscribed: false });
    expect(await prisma.pushSubscription.count({ where: { userId: ids[0], endpoint } })).toBe(0);

    await request(app.getHttpServer()).post('/me/push/subscriptions').send({ endpoint, keys: { p256dh: 'x', auth: 'y' } }).expect(401);
  });
});
