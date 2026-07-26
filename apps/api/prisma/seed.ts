import { Prisma, PrismaClient } from '../src/generated/prisma';

import { cityFixtures } from './fixtures/cities';
import { stadiumFixtures } from './fixtures/stadiums';
import { v7 as uuidv7 } from 'uuid';
import { StatsService } from '../src/stats/stats.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { RedisService } from '../src/redis/redis.service';
import type { ConfigService } from '../src/config/config.service';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const cityNames = {
    tashkent: { nameUz: 'Toshkent', nameUzCyrl: 'Тошкент', nameRu: 'Ташкент', nameEn: 'Tashkent', region: 'Tashkent' },
    samarkand: { nameUz: 'Samarqand', nameUzCyrl: 'Самарқанд', nameRu: 'Самарканд', nameEn: 'Samarkand', region: 'Samarkand' },
  } as const;
  const cities = new Map<string, string>();
  for (const fixture of cityFixtures) {
    const names = cityNames[fixture.slug];
    const city = await prisma.city.upsert({
      where: { slug: fixture.slug }, update: { ...names, lat: fixture.latitude, lng: fixture.longitude, isActive: true },
      create: { id: uuidv7(), slug: fixture.slug, ...names, lat: fixture.latitude, lng: fixture.longitude, isActive: true },
    });
    cities.set(fixture.slug, city.id);
  }

  const users = [
    ['+998990000001','Aziz','Karimov','aziz_karimov','GK','tashkent','Darvozada ishonchli o‘ynayman.','uz'],
    ['+998990000002','Sardor','Rahimov','sardor_rahimov','DEF','tashkent','Himoyada tartib va jamoaviy o‘yin.','uz'],
    ['+998990000003','Javohir','Usmonov','javohir_usmonov','MID','samarkand','Markazda pas va pressingni yoqtiraman.','uz'],
    ['+998990000004','Bekzod','Tursunov','bekzod_tursunov','FWD','tashkent','Tezkor hujumchi, kechki o‘yinlarga tayyorman.','uz'],
    ['+998990000005','Diyor','Nazarov','diyor_nazarov','UNIVERSAL','samarkand','Ҳар қандай позицияда жамоага ёрдам бераман.','uz-Cyrl'],
    ['+998990000006','Akmal','Yusupov','akmal_yusupov','GK','samarkand','Дарвозабон, мини-футбол тажрибам бор.','uz-Cyrl'],
    ['+998990000007','Odil','Qodirov','odil_qodirov','DEF','tashkent','Тартибли ҳимоячи, доим ўз вақтида келаман.','uz-Cyrl'],
    ['+998990000008','Sanjar','Ergashev','sanjar_ergashev','MID','samarkand','Люблю комбинационный футбол и точные передачи.','ru'],
    ['+998990000009','Rustam','Saidov','rustam_saidov','FWD','tashkent','Играю в атаке, ценю честную и дружелюбную игру.','ru'],
    ['+998990000010','Temur','Aliyev','temur_aliyev','UNIVERSAL','samarkand','Могу закрыть любую позицию на поле.','ru'],
    ['+998990000011','Shahzod','Mirzayev','shahzod_mirzayev','GK','tashkent','Goalkeeper focused on communication and positioning.','en'],
    ['+998990000012','Umid','Hamidov','umid_hamidov','DEF','samarkand','Reliable defender available on weekends.','en'],
    ['+998990000013','Asadbek','Ismoilov','asadbek_ismoilov','MID','tashkent','To‘p nazorati va qisqa paslarni yaxshi ko‘raman.','uz'],
    ['+998990000014','Farrux','Abdullayev','farrux_abdullayev','FWD','samarkand','Ҳужумда фаолман, жамоавий ўйинни қадрлайман.','uz-Cyrl'],
    ['+998990000015','Kamol','Rasulov','kamol_rasulov','UNIVERSAL','tashkent','Играю регулярно, предпочитаю быстрый темп.','ru'],
    ['+998990000016','Nodir','Mamatov','nodir_mamatov','GK','samarkand','Calm goalkeeper, happy to join friendly matches.','en'],
    ['+998990000017','Ibrohim','Sobirov','ibrohim_sobirov','DEF','tashkent','Qattiq, ammo halol himoyani yoqtiraman.','uz'],
    ['+998990000018','Muhammad','Olimov','muhammad_olimov','MID','samarkand','Жамоани боғлайдиган ярим ҳимоячиман.','uz-Cyrl'],
    ['+998990000019','Alisher','Ruziev','alisher_ruziev','FWD','tashkent','Нападающий, люблю открываться и создавать моменты.','ru'],
    ['+998990000020','Bobur','Salimov','bobur_salimov','UNIVERSAL','samarkand','Versatile player who values punctuality.','en'],
  ] as const;
  const verifiedAt = new Date('2026-01-01T00:00:00.000Z');
  for (const [phone, firstName, lastName, username, position, citySlug, bio, locale] of users) {
    const cityId = cities.get(citySlug);
    if (!cityId) throw new Error(`Missing seeded city: ${citySlug}`);
    await prisma.user.upsert({
      where: { phone }, update: {},
      create: { id: uuidv7(), phone, phoneVerifiedAt: verifiedAt, firstName, lastName, username, position, cityId, bio, locale },
    });
  }
  const creator = await prisma.user.findUniqueOrThrow({ where: { phone: users[0][0] }, select: { id: true } });
  for (const fixture of stadiumFixtures) {
    const cityId = cities.get(fixture.citySlug);
    if (!cityId) throw new Error(`Missing seeded city: ${fixture.citySlug}`);
    const id = uuidv7();
    await prisma.$executeRaw(Prisma.sql`INSERT INTO stadiums
      (id, slug, name_uz, name_ru, name_en, city_id, district, address, location, surface, photos, status, created_by_id)
      VALUES (${id}::uuid, ${fixture.slug}, ${fixture.name}, ${fixture.name}, ${fixture.name}, ${cityId}::uuid, 'Toshkent', ${fixture.name},
        ST_SetSRID(ST_MakePoint(${fixture.longitude}, ${fixture.latitude}),4326)::geography, 'ARTIFICIAL_GRASS'::"Surface", ARRAY[]::text[], 'APPROVED'::"StadiumStatus", ${creator.id}::uuid)
      ON CONFLICT (slug) DO UPDATE SET name_uz = EXCLUDED.name_uz, name_ru = EXCLUDED.name_ru, name_en = EXCLUDED.name_en,
        city_id = EXCLUDED.city_id, location = EXCLUDED.location, status = 'APPROVED'::"StadiumStatus"`);
  }
  const seededUsers = await prisma.user.findMany({ where: { phone: { in: users.map(([phone]) => phone) } }, orderBy: { phone: 'asc' }, select: { id: true } });
  const stadiums = await prisma.stadium.findMany({ where: { slug: { in: stadiumFixtures.map(({ slug }) => slug) } }, orderBy: { slug: 'asc' }, select: { id: true, cityId: true } });
  if (seededUsers.length !== 20 || stadiums.length !== 3) throw new Error('Match seeds require all users and stadiums');
  // A fixed anchor keeps reruns deterministic while leaving discovery fixtures far in the future.
  const scheduleAnchor = new Date('2030-06-15T00:00:00.000Z');
  const matchSeeds = [
    ['phase2-five-evening','F5','PUBLISHED','AUTO',1,0,2],
    ['phase2-six-friendly','F6','PUBLISHED','MANUAL',2,1,4],
    ['phase2-seven-open','F7','FULL','AUTO',0,2,12],
    ['phase2-eight-invite','F8','PUBLISHED','INVITE_ONLY',1,0,5],
    ['phase2-nine-advanced','F9','PUBLISHED','MANUAL',2,0,8],
    ['phase2-eleven-weekend','F11','PUBLISHED','AUTO',0,1,10],
    ['phase2-five-full','F5','FULL','AUTO',1,1,8],
    ['phase2-six-cancelled','F6','CANCELLED','MANUAL',0,0,3],
    ['phase2-seven-started','F7','STARTED','AUTO',1,0,9],
    ['phase2-eight-finished','F8','FINISHED','AUTO',0,1,7],
    ['phase2-nine-attendance','F9','FINISHED','MANUAL',1,0,9],
    ['phase2-eleven-rating','F11','STARTED','AUTO',0,0,12],
    ['phase2-five-completed','F5','FINISHED','AUTO',1,0,7],
    ['phase2-six-draft','F6','DRAFT','INVITE_ONLY',0,0,1],
    ['phase2-seven-tomorrow','F7','PUBLISHED','AUTO',2,0,6],
  ] as const;
  for (const [slug, format, status, joinMode, ownerGuests, playerGuests, confirmedCount] of matchSeeds) {
    const index = matchSeeds.findIndex(([candidate]) => candidate === slug);
    const totalSlots = Number(format.slice(1)) * 2;
    const stadium = stadiums[index % stadiums.length];
    if (!stadium) throw new Error('Missing seeded stadium');
    const startsAt = new Date(scheduleAnchor.getTime() + (index - 7) * 86_400_000 + 19 * 3_600_000);
    const owner = seededUsers[index % seededUsers.length];
    if (!owner) throw new Error('Missing seeded owner');
    const match = await prisma.match.upsert({
      where: { slug },
      update: {
        title: `Futzone ${format} #${index + 1}`, format, totalSlots, startsAt, stadiumId: stadium.id,
        cityId: stadium.cityId, status, joinMode, cancelledReason: status === 'CANCELLED' ? 'Maydon vaqtincha yopildi' : null,
      },
      create: {
        id: uuidv7(), slug, ownerId: owner.id, title: `Futzone ${format} #${index + 1}`, format, totalSlots,
        startsAt, durationMin: 90, cityId: stadium.cityId, stadiumId: stadium.id, fieldPriceUzs: 600_000 + index * 25_000,
        perPlayerFeeUzs: Math.ceil((600_000 + index * 25_000) / totalSlots), surface: 'ARTIFICIAL_GRASS',
        level: index % 3 === 0 ? 'AMATEUR' : index % 3 === 1 ? 'INTERMEDIATE' : 'ADVANCED',
        joinMode, status, allowNewPlayers: true, neededPositions: [], ageGroup: 'MIXED',
        cancelledReason: status === 'CANCELLED' ? 'Maydon vaqtincha yopildi' : null,
      },
    });
    await prisma.rating.deleteMany({ where: { matchId: match.id } });
    await prisma.matchParticipant.deleteMany({ where: { matchId: match.id } });
    for (let participantIndex = 0; participantIndex < confirmedCount; participantIndex += 1) {
      const user = seededUsers[(index + participantIndex) % seededUsers.length];
      if (!user) continue;
      const isOwner = user.id === owner.id;
      const guestCount = isOwner ? ownerGuests : (participantIndex === 1 ? playerGuests : 0);
      await prisma.matchParticipant.create({ data: { id: uuidv7(), matchId: match.id, userId: user.id, role: isOwner ? 'OWNER' : 'PLAYER', status: 'CONFIRMED', guestCount } });
    }
    if (status === 'FULL') {
      const waitlisted = seededUsers[(index + confirmedCount + 2) % seededUsers.length];
      if (waitlisted) await prisma.matchParticipant.create({ data: { id: uuidv7(), matchId: match.id, userId: waitlisted.id, role: 'PLAYER', status: 'WAITLISTED', guestCount: 0, waitlistPosition: 1 } });
    }
  }

  const retentionStadium = stadiums[0];
  const retentionOwner = seededUsers[0];
  if (!retentionStadium || !retentionOwner) throw new Error('SEO retention seeds require a stadium and owner');
  const retentionSeeds = [
    { slug: 'phase4-finished-recent', startsAt: new Date(Date.now() - 7 * 86_400_000) },
    { slug: 'phase4-finished-gone', startsAt: new Date(Date.now() - 31 * 86_400_000) },
  ] as const;
  for (const fixture of retentionSeeds) {
    await prisma.match.upsert({
      where: { slug: fixture.slug },
      update: { startsAt: fixture.startsAt, status: 'FINISHED', joinMode: 'AUTO' },
      create: {
        id: uuidv7(),
        slug: fixture.slug,
        ownerId: retentionOwner.id,
        title: fixture.slug === 'phase4-finished-recent' ? 'Recently finished SEO match' : 'Expired SEO match',
        format: 'F5',
        totalSlots: 10,
        startsAt: fixture.startsAt,
        durationMin: 90,
        cityId: retentionStadium.cityId,
        stadiumId: retentionStadium.id,
        fieldPriceUzs: 500_000,
        perPlayerFeeUzs: 50_000,
        surface: 'ARTIFICIAL_GRASS',
        level: 'AMATEUR',
        joinMode: 'AUTO',
        status: 'FINISHED',
        allowNewPlayers: true,
        neededPositions: [],
        ageGroup: 'MIXED',
      },
    });
  }

  const reliable = seededUsers[1];
  const poor = seededUsers[18];
  const newPlayer = seededUsers[19];
  const historyOwner = seededUsers[0];
  const historyStadium = stadiums[0];
  if (!reliable || !poor || !newPlayer || !historyOwner || !historyStadium)
    throw new Error('Trust-history seeds require the designated demo users and stadium');

  const historyCount = 10;
  for (let historyIndex = 0; historyIndex < historyCount; historyIndex += 1) {
    const slug = `phase3-trust-history-${String(historyIndex + 1).padStart(2, '0')}`;
    const startsAt = new Date(Date.UTC(2025, historyIndex, 10, 14, 0, 0));
    const match = await prisma.match.upsert({
      where: { slug },
      update: {
        ownerId: historyOwner.id,
        startsAt,
        status: 'COMPLETED',
        stadiumId: historyStadium.id,
        cityId: historyStadium.cityId,
      },
      create: {
        id: uuidv7(),
        slug,
        ownerId: historyOwner.id,
        title: `Trust demo match ${historyIndex + 1}`,
        format: 'F5',
        totalSlots: 10,
        startsAt,
        durationMin: 90,
        cityId: historyStadium.cityId,
        stadiumId: historyStadium.id,
        fieldPriceUzs: 500_000,
        perPlayerFeeUzs: 50_000,
        surface: 'ARTIFICIAL_GRASS',
        level: 'AMATEUR',
        joinMode: 'AUTO',
        status: 'COMPLETED',
        allowNewPlayers: true,
        neededPositions: [],
        ageGroup: 'MIXED',
      },
    });
    await prisma.rating.deleteMany({ where: { matchId: match.id } });
    await prisma.matchParticipant.deleteMany({ where: { matchId: match.id } });

    const fixtureUsers = [
      { user: historyOwner, role: 'OWNER' as const, attendance: 'ON_TIME' as const },
      { user: reliable, role: 'PLAYER' as const, attendance: 'ON_TIME' as const },
      {
        user: poor,
        role: 'PLAYER' as const,
        attendance: 'LATE' as const,
      },
      ...(historyIndex < 2
        ? [{ user: newPlayer, role: 'PLAYER' as const, attendance: 'ON_TIME' as const }]
        : []),
    ];
    const participants = new Map<string, string>();
    for (const fixtureUser of fixtureUsers) {
      const participant = await prisma.matchParticipant.create({
        data: {
          id: uuidv7(),
          matchId: match.id,
          userId: fixtureUser.user.id,
          role: fixtureUser.role,
          status: 'CONFIRMED',
          guestCount: 0,
        },
      });
      participants.set(fixtureUser.user.id, participant.id);
      await prisma.attendanceRecord.create({
        data: {
          id: uuidv7(),
          matchId: match.id,
          participantId: participant.id,
          status: fixtureUser.attendance,
          markedById: historyOwner.id,
          markedAt: new Date(startsAt.getTime() + 2 * 3_600_000),
          finalizedAt: new Date(startsAt.getTime() + 74 * 3_600_000),
        },
      });
    }

    const ratings = [
      { raterId: historyOwner.id, rateeId: reliable.id, overall: 5 },
      { raterId: reliable.id, rateeId: historyOwner.id, overall: 5 },
      { raterId: reliable.id, rateeId: poor.id, overall: 1 },
      { raterId: poor.id, rateeId: reliable.id, overall: 5 },
      ...(historyIndex < 2
        ? [{ raterId: historyOwner.id, rateeId: newPlayer.id, overall: 5 }]
        : []),
    ];
    for (const rating of ratings) {
      if (!participants.has(rating.raterId) || !participants.has(rating.rateeId))
        throw new Error('Trust-history rating participants are inconsistent');
      await prisma.rating.create({
        data: {
          id: uuidv7(),
          matchId: match.id,
          ...rating,
          discipline: rating.overall,
          punctuality: rating.overall,
          fairPlay: rating.overall,
          teamPlay: rating.overall,
          status: 'ACTIVE',
          createdAt: new Date(startsAt.getTime() + 3 * 3_600_000),
        },
      });
    }
  }

  // Reuse the production worker's reconcile path. The seed supplies an in-memory
  // cache adapter because the computed global mean is already passed to each user.
  const stats = new StatsService(
    prisma as unknown as PrismaService,
    {
      client: {
        get: async () => null,
        set: async () => 'OK',
      },
    } as unknown as RedisService,
    { get: () => 'seed' } as unknown as ConfigService,
  );
  await stats.reconcileAll();

  console.info(
    `Seeded ${cityFixtures.length} cities, ${users.length} users, ${stadiumFixtures.length} approved stadiums, ${matchSeeds.length} base matches, and ${historyCount} trust-history matches.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
