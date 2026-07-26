import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AdminMetricsService } from '../src/admin/admin-metrics.service';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { AvatarQueueService } from '../src/users/avatar/avatar-queue.service';
import { AvatarStorageService } from '../src/users/avatar/avatar-storage.service';

describe('P5-05..P5-10 admin panel (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cityId = '019830ba-7d00-7000-8000-000000000c01';
  // [0] admin, [1] moderator, [2] target user, [3] second admin.
  const ids = ['e1', 'e2', 'e3', 'e4'].map((s) => `019830ba-7d00-7000-8000-0000000000${s}`);
  const [ADMIN, MOD, TARGET, ADMIN2] = ids as [string, string, string, string];
  const roleOf: Record<string, 'ADMIN' | 'MODERATOR' | 'USER'> = { [ADMIN]: 'ADMIN', [MOD]: 'MODERATOR', [TARGET]: 'USER', [ADMIN2]: 'ADMIN' };
  const tokens = new Map<string, string>();
  const auth = (id: string): string => `Bearer ${tokens.get(id) ?? ''}`;

  async function expectAudit(action: string, targetId: string, actorId: string): Promise<void> {
    const row = await prisma.auditLog.findFirst({ where: { action, targetId, actorId }, orderBy: { createdAt: 'desc' } });
    expect(row).not.toBeNull();
    expect((row?.metadata as { reason?: string } | null)?.reason).toBeTruthy();
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

    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.match.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await prisma.city.upsert({
      where: { slug: 'admin-e2e' }, update: {},
      create: { id: cityId, slug: 'admin-e2e', nameUz: 'Admin', nameUzCyrl: 'Админ', nameRu: 'Admin', nameEn: 'Admin', region: 'Test', lat: 41.3, lng: 69.2 },
    });
    await prisma.user.createMany({
      data: ids.map((id, i) => ({ id, phone: `+9989012301${(1000 + i).toString().slice(-2)}`, phoneVerifiedAt: i === 2 ? null : new Date(), firstName: 'Adm', lastName: `${i}`, username: `admin_e2e_${i}`, role: roleOf[id], cityId })),
      skipDuplicates: true,
    });

    const jwt = app.get(JwtService);
    for (const id of ids)
      tokens.set(id, await jwt.signAsync({ sub: id, role: roleOf[id], status: 'ACTIVE', type: 'access' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 }));
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.match.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await app.close();
  });

  it('serves the dashboard to admins and hides it from moderators', async () => {
    await app.get(AdminMetricsService).aggregate();
    const dash = await request(app.getHttpServer()).get('/admin/metrics').set('Authorization', auth(ADMIN)).expect(200);
    expect(dash.body.latest).not.toBeNull();
    expect(dash.body.latest.totalUsers).toBeGreaterThanOrEqual(4);
    expect(Array.isArray(dash.body.series)).toBe(true);

    await request(app.getHttpServer()).get('/admin/metrics').set('Authorization', auth(MOD)).expect(403);
    await request(app.getHttpServer()).get('/admin/metrics').expect(401);
  });

  it('searches users by name and exposes only the last 4 phone digits', async () => {
    const res = await request(app.getHttpServer()).get('/admin/users?q=admin_e2e_2').set('Authorization', auth(MOD)).expect(200);
    const item = (res.body.items as Array<{ id: string; phoneLast4: string }>).find((u) => u.id === TARGET);
    expect(item).toBeTruthy();
    expect(item?.phoneLast4).toHaveLength(4);
    expect(JSON.stringify(res.body)).not.toContain('+99890');
  });

  it('lets a moderator warn (notifying the user) and writes an audit row', async () => {
    await request(app.getHttpServer())
      .post(`/admin/users/${TARGET}/warn`).set('Authorization', auth(MOD))
      .send({ reason: 'Repeated no-shows', message: 'Please stop missing matches' }).expect(200);
    const user = await prisma.user.findUnique({ where: { id: TARGET }, select: { status: true } });
    expect(user?.status).toBe('WARNED');
    const notice = await prisma.notification.findFirst({ where: { userId: TARGET, type: 'ACCOUNT_WARNING' } });
    expect(notice?.payload).toMatchObject({ message: 'Please stop missing matches' });
    await expectAudit('USER_WARN', TARGET, MOD);
  });

  it('enforces the permission matrix: moderator cannot ban, admin can', async () => {
    await request(app.getHttpServer())
      .post(`/admin/users/${TARGET}/ban`).set('Authorization', auth(MOD)).send({ reason: 'x' }).expect(403);

    await request(app.getHttpServer())
      .post(`/admin/users/${TARGET}/ban`).set('Authorization', auth(ADMIN)).send({ reason: 'Fraudulent behaviour' }).expect(200);
    expect((await prisma.user.findUnique({ where: { id: TARGET }, select: { status: true } }))?.status).toBe('BANNED');
    await expectAudit('USER_BAN', TARGET, ADMIN);
  });

  it('reinstates a user and marks phone verified, each audited', async () => {
    await request(app.getHttpServer())
      .post(`/admin/users/${TARGET}/unban`).set('Authorization', auth(ADMIN)).send({ reason: 'Appeal upheld' }).expect(200);
    expect((await prisma.user.findUnique({ where: { id: TARGET }, select: { status: true } }))?.status).toBe('ACTIVE');
    await expectAudit('USER_UNBAN', TARGET, ADMIN);

    await request(app.getHttpServer())
      .post(`/admin/users/${TARGET}/verify`).set('Authorization', auth(ADMIN)).send({ reason: 'Confirmed by call' }).expect(200);
    expect((await prisma.user.findUnique({ where: { id: TARGET }, select: { phoneVerifiedAt: true } }))?.phoneVerifiedAt).not.toBeNull();
    await expectAudit('USER_MARK_VERIFIED', TARGET, ADMIN);
  });

  it('refuses to moderate an administrator account or oneself', async () => {
    await request(app.getHttpServer())
      .post(`/admin/users/${ADMIN2}/ban`).set('Authorization', auth(ADMIN)).send({ reason: 'nope' }).expect(403);
    await request(app.getHttpServer())
      .post(`/admin/users/${ADMIN}/warn`).set('Authorization', auth(ADMIN)).send({ reason: 'self', message: 'self' }).expect(403);
  });

  it('validates that every action carries a reason', async () => {
    await request(app.getHttpServer())
      .post(`/admin/users/${TARGET}/ban`).set('Authorization', auth(ADMIN)).send({}).expect(400);
  });

  it('serves a filterable audit log and CSV export to admins only', async () => {
    const list = await request(app.getHttpServer())
      .get(`/admin/audit-logs?targetId=${TARGET}`).set('Authorization', auth(ADMIN)).expect(200);
    expect(list.body.total).toBeGreaterThan(0);
    const actions = (list.body.items as Array<{ action: string; targetId: string; actorUsername: string; reason: string | null }>);
    expect(actions.every((a) => a.targetId === TARGET)).toBe(true);
    expect(actions.some((a) => a.action === 'USER_BAN')).toBe(true);
    expect(actions[0]).toHaveProperty('actorUsername');

    const filtered = await request(app.getHttpServer())
      .get(`/admin/audit-logs?targetId=${TARGET}&action=USER_WARN`).set('Authorization', auth(ADMIN)).expect(200);
    expect(filtered.body.items.every((a: { action: string }) => a.action === 'USER_WARN')).toBe(true);

    const csv = await request(app.getHttpServer())
      .get(`/admin/audit-logs/export?targetId=${TARGET}`).set('Authorization', auth(ADMIN)).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\r\n')[0]).toBe('createdAt,actorUsername,action,targetType,targetId,reason');
    expect(csv.text).toContain('USER_BAN');

    await request(app.getHttpServer()).get('/admin/audit-logs').set('Authorization', auth(MOD)).expect(403);
    await request(app.getHttpServer()).get('/admin/audit-logs').expect(401);
  });

  async function createMatch(ownerId: string): Promise<string> {
    const created = await request(app.getHttpServer()).post('/matches').set('Authorization', auth(ownerId))
      .send({
        title: 'Admin module match', format: 'F5', startsAt: new Date('2035-05-01T10:00:00.000Z').toISOString(), durationMin: 90,
        cityId, address: 'Admin pitch', latitude: 41.3, longitude: 69.2, fieldPriceUzs: 100000, perPlayerFeeUzs: 10000,
        surface: 'ARTIFICIAL_GRASS', level: 'AMATEUR', joinMode: 'AUTO', allowNewPlayers: true,
        neededPositions: [], ageGroup: 'MIXED', verifiedPhoneOnly: false, ownerPlays: true, ownerGuestCount: 0,
      }).expect(201);
    const id = created.body.id as string;
    await request(app.getHttpServer()).post(`/matches/${id}/publish`).set('Authorization', auth(ownerId)).expect(200);
    return id;
  }

  it('searches matches, shows detail with participants + audit trail, and flags (admin only)', async () => {
    const matchId = await createMatch(TARGET);

    await request(app.getHttpServer()).get('/admin/matches').set('Authorization', auth(MOD)).expect(403);

    const list = await request(app.getHttpServer()).get('/admin/matches?q=Admin%20module').set('Authorization', auth(ADMIN)).expect(200);
    expect((list.body.items as Array<{ id: string }>).some((m) => m.id === matchId)).toBe(true);

    await request(app.getHttpServer()).post(`/admin/matches/${matchId}/flag`).set('Authorization', auth(ADMIN)).send({ reason: 'Suspicious pricing' }).expect(200);
    await expectAudit('MATCH_FLAG_SUSPICIOUS', matchId, ADMIN);
    const flagged = await request(app.getHttpServer()).get('/admin/matches?flagged=true').set('Authorization', auth(ADMIN)).expect(200);
    expect((flagged.body.items as Array<{ id: string; flagged: boolean }>).find((m) => m.id === matchId)?.flagged).toBe(true);

    const detail = await request(app.getHttpServer()).get(`/admin/matches/${matchId}`).set('Authorization', auth(ADMIN)).expect(200);
    expect(detail.body.participants.some((p: { userId: string; role: string }) => p.userId === TARGET && p.role === 'OWNER')).toBe(true);
    expect(detail.body.auditTrail.some((a: { action: string }) => a.action === 'MATCH_FLAG_SUSPICIOUS')).toBe(true);
    expect(detail.body.occupiedSlots).toBeGreaterThan(0);

    const edited = await request(app.getHttpServer()).patch(`/admin/matches/${matchId}`).set('Authorization', auth(ADMIN)).send({ title: 'Renamed by admin' }).expect(200);
    expect(edited.body.title).toBe('Renamed by admin');
    expect(await prisma.auditLog.findFirst({ where: { action: 'MATCH_EDIT', targetId: matchId, actorId: ADMIN } })).not.toBeNull();
  });

  it('force-cancels a match, notifying every active participant and auditing the action', async () => {
    const matchId = await createMatch(TARGET);
    await request(app.getHttpServer()).post(`/matches/${matchId}/join`).set('Authorization', auth(ADMIN2)).send({ guestCount: 0 }).expect(200);

    await request(app.getHttpServer()).post(`/admin/matches/${matchId}/cancel`).set('Authorization', auth(ADMIN)).send({ reason: 'Fake match' }).expect(200);

    expect((await prisma.match.findUnique({ where: { id: matchId }, select: { status: true } }))?.status).toBe('CANCELLED');
    await expectAudit('MATCH_FORCE_CANCEL', matchId, ADMIN);
    for (const uid of [TARGET, ADMIN2]) {
      const notice = await prisma.notification.findFirst({ where: { userId: uid, matchId, type: 'MATCH_CANCELLED' } });
      expect(notice).not.toBeNull();
    }
    // A match that already happened / already cancelled cannot be force-cancelled again.
    await request(app.getHttpServer()).post(`/admin/matches/${matchId}/cancel`).set('Authorization', auth(ADMIN)).send({ reason: 'again' }).expect(409);
  });
});
