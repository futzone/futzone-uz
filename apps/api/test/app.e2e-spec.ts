import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request, { type Response as SupertestResponse } from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { AvatarQueueService } from '../src/users/avatar/avatar-queue.service';
import { AvatarStorageService } from '../src/users/avatar/avatar-storage.service';

type SmsMessage = { code: string };
const phones = {
  register: '+998901110001', login: '+998901110002', enumeration: '+998901110003',
  enumerationRegistered: '+998901110004', refresh: '+998901110005', suspended: '+998901110006',
  banned: '+998901110007', leak: '+998901110008',
  profile: '+998901110009', update: '+998901110010', username: '+998901110011', profileBanned: '+998901110012',
  settings: '+998901110013', attempts: '+998901110014', rateLimit: '+998901110015',
};

describe('auth API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const observed: SupertestResponse[] = [];
  const capture = (response: SupertestResponse): SupertestResponse => { observed.push(response); return response; };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AvatarStorageService).useValue({
        presignPut: async () => 'http://localhost:9000/test/signed-avatar', metadata: async () => ({ size: 128 }),
        prefix: async () => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), publicUrl: (key: string) => `http://localhost:9000/test/${key}`,
        read: async () => new Uint8Array(), write: async () => undefined, delete: async () => undefined, keyFromPublicUrl: () => null,
      })
      .overrideProvider(AvatarQueueService).useValue({ enqueue: async () => undefined })
      .compile();
    app = module.createNestApplication(); app.useLogger(app.get(Logger));
    app.useGlobalPipes(new ZodValidationPipe()); app.useGlobalFilters(new ApiExceptionFilter(app.get(Logger)));
    await app.init(); prisma = app.get(PrismaService);
    await prisma.otpRequest.deleteMany({ where: { phone: { in: Object.values(phones) } } });
    await prisma.user.deleteMany({ where: { phone: { in: Object.values(phones) } } });
    await fetch(`${process.env.MOCK_SMS_URL}/messages`, { method: 'DELETE' });
  });
  beforeEach(async () => {
    const redis = app.get(RedisService).client;
    const phoneKeys = Object.values(phones).flatMap((phone) => {
      const encoded = Buffer.from(phone).toString('base64url');
      return [`otp:cooldown:${encoded}`, `otp:phone:${encoded}`];
    });
    const loopbackIpKeys = ['otp:ip:::ffff:127.0.0.1', 'otp:ip:127.0.0.1', 'otp:ip:::1'];
    await redis.del(...phoneKeys, ...loopbackIpKeys);
  });
  afterAll(async () => {
    await prisma.otpRequest.deleteMany({ where: { phone: { in: Object.values(phones) } } });
    await prisma.user.deleteMany({ where: { phone: { in: Object.values(phones) } } });
    await app.close();
  });

  const otp = async (phone: string): Promise<string> => {
    const response = await fetch(`${process.env.MOCK_SMS_URL}/messages/${encodeURIComponent(phone)}`);
    const message = await response.json() as SmsMessage;
    return message.code;
  };
  const cookie = (response: SupertestResponse): string => {
    const values = response.headers['set-cookie'];
    const first = Array.isArray(values) ? values[0] : values;
    if (!first) throw new Error('Expected refresh cookie');
    return first.split(';')[0];
  };
  const beginRegistration = async (phone: string): Promise<string> => {
    capture(await request(app.getHttpServer()).post('/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(200));
    const response = capture(await request(app.getHttpServer()).post('/auth/verify').send({ phone, code: await otp(phone) }).expect(200));
    expect(response.body.needsRegistration).toBe(true);
    return response.body.registrationToken as string;
  };
  const login = async (phone: string): Promise<SupertestResponse> => {
    capture(await request(app.getHttpServer()).post('/auth/otp').send({ phone, purpose: 'LOGIN' }).expect(200));
    return request(app.getHttpServer()).post('/auth/verify').send({ phone, code: await otp(phone) }).expect(200).then(capture);
  };

  it('registers a new user', async () => {
    const registrationToken = await beginRegistration(phones.register);
    const response = capture(await request(app.getHttpServer()).post('/auth/register').send({ registrationToken, firstName: 'Aziz', lastName: 'Karimov', username: 'aziz_e2e' }).expect(200));
    expect(response.body).toEqual(expect.objectContaining({ accessToken: expect.any(String), user: expect.objectContaining({ username: 'aziz_e2e' }) }));
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.[0]).toContain('Secure');
  });

  it('returns the identical OTP-request response for registered and new phones', async () => {
    await prisma.user.create({ data: { id: '019830ba-7d00-7000-8000-000000000004', phone: phones.enumerationRegistered, phoneVerifiedAt: new Date(), firstName: 'Known', lastName: 'User', username: 'known_e2e' } });
    const registered = await request(app.getHttpServer()).post('/auth/otp').send({ phone: phones.enumerationRegistered, purpose: 'LOGIN' }).expect(200);
    const unknown = await request(app.getHttpServer()).post('/auth/otp').send({ phone: phones.enumeration, purpose: 'LOGIN' }).expect(200);
    capture(registered); capture(unknown); expect(registered.text).toBe(unknown.text);
  });

  it('kills an OTP after the fifth failed verification attempt', async () => {
    capture(await request(app.getHttpServer()).post('/auth/otp').send({ phone: phones.attempts, purpose: 'LOGIN' }).expect(200));
    const validCode = await otp(phones.attempts);
    const wrongCode = validCode === '000000' ? '000001' : '000000';
    for (let attempt = 1; attempt < 5; attempt += 1) {
      const response = capture(await request(app.getHttpServer()).post('/auth/verify').send({ phone: phones.attempts, code: wrongCode }).expect(401));
      expect(response.body.code).toBe('OTP_INVALID');
    }
    const fifth = capture(await request(app.getHttpServer()).post('/auth/verify').send({ phone: phones.attempts, code: wrongCode }).expect(429));
    expect(fifth.body.code).toBe('OTP_ATTEMPTS_EXCEEDED');
    const dead = capture(await request(app.getHttpServer()).post('/auth/verify').send({ phone: phones.attempts, code: validCode }).expect(429));
    expect(dead.body.code).toBe('OTP_ATTEMPTS_EXCEEDED');
  });

  it('enforces the OTP send cooldown rate limit', async () => {
    capture(await request(app.getHttpServer()).post('/auth/otp').send({ phone: phones.rateLimit, purpose: 'LOGIN' }).expect(200));
    const limited = capture(await request(app.getHttpServer()).post('/auth/otp').send({ phone: phones.rateLimit, purpose: 'LOGIN' }).expect(429));
    expect(limited.body.code).toBe('OTP_RATE_LIMITED');
  });

  it('logs in an existing user', async () => {
    await prisma.user.create({ data: { id: '019830ba-7d00-7000-8000-000000000002', phone: phones.login, phoneVerifiedAt: new Date(), firstName: 'Login', lastName: 'User', username: 'login_e2e' } });
    capture(await request(app.getHttpServer()).post('/auth/otp').send({ phone: phones.login, purpose: 'LOGIN' }).expect(200));
    const response = capture(await request(app.getHttpServer()).post('/auth/verify').send({ phone: phones.login, code: await otp(phones.login) }).expect(200));
    expect(response.body).toEqual(expect.objectContaining({ needsRegistration: false, accessToken: expect.any(String) }));
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    await prisma.user.create({ data: { id: '019830ba-7d00-7000-8000-000000000005', phone: phones.refresh, phoneVerifiedAt: new Date(), firstName: 'Refresh', lastName: 'User', username: 'refresh_e2e' } });
    capture(await request(app.getHttpServer()).post('/auth/otp').send({ phone: phones.refresh, purpose: 'LOGIN' }).expect(200));
    const login = capture(await request(app.getHttpServer()).post('/auth/verify').send({ phone: phones.refresh, code: await otp(phones.refresh) }).expect(200));
    const original = cookie(login);
    const rotated = capture(await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', original).send({}).expect(200));
    const replacement = cookie(rotated);
    capture(await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', original).send({}).expect(401));
    capture(await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', replacement).send({}).expect(401));
  });

  it('refuses new tokens to suspended and banned users', async () => {
    await prisma.user.createMany({ data: [
      { id: '019830ba-7d00-7000-8000-000000000006', phone: phones.suspended, phoneVerifiedAt: new Date(), firstName: 'Suspended', lastName: 'User', username: 'suspended_e2e', status: 'SUSPENDED' },
      { id: '019830ba-7d00-7000-8000-000000000007', phone: phones.banned, phoneVerifiedAt: new Date(), firstName: 'Banned', lastName: 'User', username: 'banned_e2e', status: 'BANNED' },
    ] });
    capture(await request(app.getHttpServer()).post('/auth/otp').send({ phone: phones.suspended, purpose: 'LOGIN' }).expect(200));
    const suspended = capture(await request(app.getHttpServer()).post('/auth/verify').send({ phone: phones.suspended, code: await otp(phones.suspended) }).expect(403));
    expect(suspended.body.code).toBe('USER_SUSPENDED');
    capture(await request(app.getHttpServer()).post('/auth/otp').send({ phone: phones.banned, purpose: 'LOGIN' }).expect(200));
    const banned = capture(await request(app.getHttpServer()).post('/auth/verify').send({ phone: phones.banned, code: await otp(phones.banned) }).expect(403));
    expect(banned.body.code).toBe('USER_BANNED');
  });

  it('returns only the public profile contract and omits private fields', async () => {
    await prisma.user.create({ data: { id: '019830ba-7d00-7000-8000-000000000009', phone: phones.profile, phoneVerifiedAt: new Date(), firstName: 'Public', lastName: 'Player', username: 'public_e2e', bio: 'Public bio', locale: 'uz' } });
    const response = capture(await request(app.getHttpServer()).get('/users/public_e2e').expect(200));
    const profile = response.body as Record<string, unknown>;
    expect(Object.keys(profile).sort()).toEqual([
      'avatarUrl', 'badges', 'bio', 'city', 'comments', 'firstName', 'joinedAt', 'lastName',
      'position', 'recentMatches', 'stats', 'username', 'verified',
    ]);
    const stats = profile.stats as Record<string, unknown>;
    expect(Object.keys(stats).sort()).toEqual([
      'attendancePct', 'bayesAvg', 'cancelledEarly', 'excused', 'lastFiveAvg', 'late',
      'matchesOrganized', 'matchesPlayed', 'noShow', 'onTime', 'ratingCount',
    ]);
    expect(profile.username).toBe('public_e2e');
    expect(profile.verified).toBe(true);
    expect(profile.badges).toEqual([]);
    expect(stats.matchesPlayed).toBe(0);
    expect(stats.bayesAvg).toBeNull();
    for (const privateField of ['phone','phoneVerifiedAt','role','status','suspendedUntil','deletedAt','usernameChangedAt','avatarUploadKey','cityId','id']) expect(response.body).not.toHaveProperty(privateField);
  });

  it('updates all editable profile fields', async () => {
    const city = await prisma.city.upsert({ where: { slug: 'e2e-city' }, update: {}, create: { id: '019830ba-7d00-7000-8000-000000000101', slug: 'e2e-city', nameUz: 'Sinov', nameUzCyrl: 'Синов', nameRu: 'Тест', nameEn: 'Test', region: 'Test', lat: 41.3, lng: 69.2 } });
    await prisma.user.create({ data: { id: '019830ba-7d00-7000-8000-000000000010', phone: phones.update, phoneVerifiedAt: new Date(), firstName: 'Before', lastName: 'Before', username: 'update_e2e' } });
    const authenticated = await login(phones.update);
    const response = capture(await request(app.getHttpServer()).patch('/me').set('Authorization', `Bearer ${authenticated.body.accessToken as string}`).send({ firstName: 'After', lastName: 'Updated', bio: 'Updated bio', cityId: city.id, position: 'MID', locale: 'en' }).expect(200));
    expect(response.body).toEqual(expect.objectContaining({ firstName: 'After', lastName: 'Updated', bio: 'Updated bio', cityId: city.id, position: 'MID', locale: 'en' }));
  });

  it('rejects a second username change inside 30 days', async () => {
    await prisma.user.create({ data: { id: '019830ba-7d00-7000-8000-000000000011', phone: phones.username, phoneVerifiedAt: new Date(), firstName: 'Name', lastName: 'Changer', username: 'change_e2e' } });
    const authenticated = await login(phones.username);
    capture(await request(app.getHttpServer()).patch('/me/username').set('Authorization', `Bearer ${authenticated.body.accessToken as string}`).send({ username: 'changed_e2e' }).expect(200));
    const rejected = capture(await request(app.getHttpServer()).patch('/me/username').set('Authorization', `Bearer ${authenticated.body.accessToken as string}`).send({ username: 'changed_again_e2e' }).expect(429));
    expect(rejected.body).toEqual(expect.objectContaining({ code: 'USERNAME_CHANGE_TOO_SOON', details: { nextAllowedAt: expect.any(String) } }));
  });

  it('returns the caller phone only from private settings', async () => {
    await prisma.user.create({ data: { id: '019830ba-7d00-7000-8000-000000000013', phone: phones.settings, phoneVerifiedAt: new Date(), firstName: 'Settings', lastName: 'Owner', username: 'settings_e2e', locale: 'en' } });
    const authenticated = await login(phones.settings);
    const response = await request(app.getHttpServer()).get('/me/settings').set('Authorization', `Bearer ${authenticated.body.accessToken as string}`).expect(200);
    expect(response.body).toEqual({ phone: phones.settings, locale: 'en' });
  });

  it('hides banned users as not found', async () => {
    await prisma.user.create({ data: { id: '019830ba-7d00-7000-8000-000000000012', phone: phones.profileBanned, phoneVerifiedAt: new Date(), firstName: 'Hidden', lastName: 'Player', username: 'hidden_e2e', status: 'BANNED' } });
    const response = capture(await request(app.getHttpServer()).get('/users/hidden_e2e').expect(404));
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('never leaks any test phone in a Phase-1 endpoint response', async () => {
    const user = await prisma.user.create({ data: { id: '019830ba-7d00-7000-8000-000000000008', phone: phones.leak, phoneVerifiedAt: new Date(), firstName: 'Leak', lastName: 'User', username: 'leak_e2e' } });
    const meLogin = await request(app.getHttpServer()).post('/auth/otp').send({ phone: phones.leak, purpose: 'LOGIN' }).expect(200).then(capture);
    void meLogin;
    const verified = await request(app.getHttpServer()).post('/auth/verify').send({ phone: phones.leak, code: await otp(phones.leak) }).expect(200).then(capture);
    capture(await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${verified.body.accessToken as string}`).expect(200));
    capture(await request(app.getHttpServer()).get('/auth/username-available').query({ username: user.username }).expect(200));
    capture(await request(app.getHttpServer()).get(`/users/${user.username}`).expect(200));
    capture(await request(app.getHttpServer()).get('/cities').query({ locale: 'ru' }).expect(200));
    capture(await request(app.getHttpServer()).patch('/me').set('Authorization', `Bearer ${verified.body.accessToken as string}`).send({ bio: 'Leak sweep bio' }).expect(200));
    capture(await request(app.getHttpServer()).patch('/me/username').set('Authorization', `Bearer ${verified.body.accessToken as string}`).send({ username: 'leak_e2e_changed' }).expect(200));
    const presigned = capture(await request(app.getHttpServer()).post('/me/avatar').set('Authorization', `Bearer ${verified.body.accessToken as string}`).send({ size: 128 }).expect(200));
    capture(await request(app.getHttpServer()).post('/me/avatar/complete').set('Authorization', `Bearer ${verified.body.accessToken as string}`).send({ objectKey: presigned.body.objectKey as string }).expect(200));
    capture(await request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie(verified)).expect(200));
    const serialized = JSON.stringify(observed.map((response) => ({ body: response.body, headers: response.headers })));
    for (const phone of Object.values(phones)) expect(serialized).not.toContain(phone);
  });
});
