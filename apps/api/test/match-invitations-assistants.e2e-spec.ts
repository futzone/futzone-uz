import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { AvatarQueueService } from '../src/users/avatar/avatar-queue.service';
import { AvatarStorageService } from '../src/users/avatar/avatar-storage.service';

describe('P2-05/P2-07 invitations and assistants (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cityId = '019830ba-7d00-7000-8000-000000000701';
  const ids = Array.from(
    { length: 7 },
    (_, index) => `019830ba-7d00-7000-8000-0000000007${String(index + 2).padStart(2, '0')}`,
  );
  const tokens = new Map<string, string>();
  const matchStartBase = Date.now() + 30 * 86_400_000;
  let matchSequence = 0;

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
      where: { slug: 'invite-assistant-e2e' },
      update: {},
      create: {
        id: cityId,
        slug: 'invite-assistant-e2e',
        nameUz: 'Invite',
        nameUzCyrl: 'Инвайт',
        nameRu: 'Invite',
        nameEn: 'Invite',
        region: 'Test',
        lat: 41.3,
        lng: 69.2,
      },
    });
    await prisma.user.createMany({
      data: ids.map((id, index) => ({
        id,
        phone: `+99890117010${index}`,
        phoneVerifiedAt: new Date(),
        firstName: 'Invite',
        lastName: `${index}`,
        username: `invite_assistant_${index}`,
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

  async function createMatch(
    joinMode: 'AUTO' | 'MANUAL' | 'INVITE_ONLY',
    ownerGuestCount = 0,
    publish = true,
    startsAt = new Date(matchStartBase + matchSequence++ * 7 * 86_400_000),
  ): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/matches')
      .set('Authorization', auth(ids[0]!))
      .send({
        title: 'Invitation test',
        format: 'F5',
        startsAt: startsAt.toISOString(),
        durationMin: 90,
        cityId,
        address: 'Test pitch',
        latitude: 41.3,
        longitude: 69.2,
        fieldPriceUzs: 100000,
        perPlayerFeeUzs: 10000,
        surface: 'ARTIFICIAL_GRASS',
        level: 'AMATEUR',
        joinMode,
        allowNewPlayers: true,
        neededPositions: [],
        ageGroup: 'MIXED',
        verifiedPhoneOnly: true,
        ownerPlays: true,
        ownerGuestCount,
      })
      .expect(201);
    if (publish)
      await request(app.getHttpServer())
        .post(`/matches/${created.body.id as string}/publish`)
        .set('Authorization', auth(ids[0]!))
        .expect(200);
    return created.body.id as string;
  }

  it('rejects an expired invitation token with a typed error', async () => {
    const matchId = await createMatch('INVITE_ONLY');
    const token = `expired-${'x'.repeat(40)}`;
    await prisma.invitation.create({
      data: {
        id: uuidv7(),
        matchId,
        inviterId: ids[0]!,
        token,
        expiresAt: new Date(Date.now() - 1),
      },
    });
    await request(app.getHttpServer())
      .post(`/matches/invitations/${token}/accept`)
      .set('Authorization', auth(ids[1]!))
      .send({ guestCount: 0 })
      .expect(410)
      .expect(({ body }) => expect(body.code).toBe('INVITATION_EXPIRED'));
  });

  it('refuses INVITE_ONLY without an invitation and accepts a named invitation', async () => {
    const matchId = await createMatch('INVITE_ONLY');
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/join`)
      .set('Authorization', auth(ids[1]!))
      .send({ guestCount: 0 })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('INVITATION_REQUIRED'));
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/invitations`)
      .set('Authorization', auth(ids[0]!))
      .send({ username: 'invite_assistant_1' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/join`)
      .set('Authorization', auth(ids[1]!))
      .send({ guestCount: 0 })
      .expect(200);
  });

  it('returns MATCH_FULL when a token match fills before acceptance', async () => {
    const matchId = await createMatch('INVITE_ONLY', 8);
    const minted = await request(app.getHttpServer())
      .post(`/matches/${matchId}/invitations/share`)
      .set('Authorization', auth(ids[0]!))
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/matches/${matchId}/participants/me`)
      .set('Authorization', auth(ids[0]!))
      .send({ guestCount: 9 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/matches/invitations/${minted.body.token as string}/accept`)
      .set('Authorization', auth(ids[1]!))
      .send({ guestCount: 0 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('MATCH_FULL'));
  });

  it('rejects a confirmed player joining a second match in the same window', async () => {
    const startsAt = new Date(matchStartBase + 100 * 7 * 86_400_000);
    const firstMatchId = await createMatch('AUTO', 0, true, startsAt);
    const overlappingMatchId = await createMatch('AUTO', 0, true, startsAt);
    await request(app.getHttpServer())
      .post(`/matches/${firstMatchId}/join`)
      .set('Authorization', auth(ids[5]!))
      .send({ guestCount: 0 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/matches/${overlappingMatchId}/join`)
      .set('Authorization', auth(ids[5]!))
      .send({ guestCount: 0 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('OVERLAPPING_MATCH'));
  });

  it('enforces assistant restrictions and assignment rules', async () => {
    const matchId = await createMatch('AUTO');
    for (const userId of ids.slice(1, 5))
      await request(app.getHttpServer())
        .post(`/matches/${matchId}/join`)
        .set('Authorization', auth(userId))
        .send({ guestCount: 0 })
        .expect(200);

    await request(app.getHttpServer())
      .post(`/matches/${matchId}/assistants`)
      .set('Authorization', auth(ids[0]!))
      .send({ userId: ids[1] })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/matches/${matchId}`)
      .set('Authorization', auth(ids[1]!))
      .send({ title: 'Assistant edited' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/invitations`)
      .set('Authorization', auth(ids[1]!))
      .send({ username: 'invite_assistant_5' })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/matches/${matchId}/requests`)
      .set('Authorization', auth(ids[1]!))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/participants/${ids[4]}/remove`)
      .set('Authorization', auth(ids[1]!))
      .expect(200);

    await request(app.getHttpServer())
      .post(`/matches/${matchId}/cancel`)
      .set('Authorization', auth(ids[1]!))
      .send({ reason: 'not allowed' })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('FORBIDDEN'));
    await request(app.getHttpServer())
      .patch(`/matches/${matchId}`)
      .set('Authorization', auth(ids[1]!))
      .send({ fieldPriceUzs: 200000 })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('FORBIDDEN'));
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/participants/${ids[0]}/remove`)
      .set('Authorization', auth(ids[1]!))
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('FORBIDDEN'));
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/assistants`)
      .set('Authorization', auth(ids[1]!))
      .send({ userId: ids[2] })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('FORBIDDEN'));

    await request(app.getHttpServer())
      .post(`/matches/${matchId}/assistants`)
      .set('Authorization', auth(ids[0]!))
      .send({ userId: ids[2] })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/assistants`)
      .set('Authorization', auth(ids[0]!))
      .send({ userId: ids[3] })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_ERROR'));

    await request(app.getHttpServer())
      .post(`/matches/${matchId}/assistants`)
      .set('Authorization', auth(ids[0]!))
      .send({ userId: ids[6] })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('NOT_PARTICIPANT'));
  });
});
