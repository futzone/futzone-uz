import { v7 as uuidv7 } from 'uuid';
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();
const MATCH_COUNT = 1_000;

async function main(): Promise<void> {
  const [stadiums, users] = await Promise.all([
    prisma.stadium.findMany({
      where: { status: 'APPROVED' },
      orderBy: { slug: 'asc' },
      select: { id: true, cityId: true, surface: true },
    }),
    prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      orderBy: { id: 'asc' },
      take: 20,
      select: { id: true },
    }),
  ]);
  if (stadiums.length === 0 || users.length === 0) {
    throw new Error('Run the demo seed before generating search performance fixtures');
  }

  const formats = ['F5', 'F6', 'F7', 'F8', 'F9', 'F11'] as const;
  const levels = ['BEGINNER', 'AMATEUR', 'INTERMEDIATE', 'ADVANCED', 'ANY'] as const;
  const base = Date.now() + 86_400_000;
  for (let index = 0; index < MATCH_COUNT; index += 1) {
    const slug = `perf-search-${String(index + 1).padStart(4, '0')}`;
    const stadium = stadiums[index % stadiums.length];
    const owner = users[index % users.length];
    const format = formats[index % formats.length];
    const level = levels[index % levels.length];
    if (!stadium || !owner || !format || !level) throw new Error('Performance fixture selection failed');
    const totalSlots = Number(format.slice(1)) * 2;
    const startsAt = new Date(base + (index % 60) * 86_400_000 + (index % 16) * 3_600_000);
    const match = await prisma.match.upsert({
      where: { slug },
      update: {
        ownerId: owner.id,
        cityId: stadium.cityId,
        stadiumId: stadium.id,
        startsAt,
      },
      create: {
        id: uuidv7(),
        slug,
        ownerId: owner.id,
        title: `Perf qidiruv futbol ${index + 1}`,
        format,
        totalSlots,
        startsAt,
        durationMin: 90,
        cityId: stadium.cityId,
        stadiumId: stadium.id,
        fieldPriceUzs: 400_000 + (index % 20) * 25_000,
        perPlayerFeeUzs: 30_000 + (index % 30) * 2_500,
        surface: stadium.surface,
        level,
        joinMode: index % 3 === 0 ? 'MANUAL' : 'AUTO',
        status: index % 11 === 0 ? 'FULL' : 'PUBLISHED',
        allowNewPlayers: true,
        neededPositions: index % 4 === 0 ? ['GK'] : [],
        ageGroup: 'MIXED',
      },
    });
    await prisma.matchParticipant.deleteMany({ where: { matchId: match.id } });
    const occupiedParties = index % 11 === 0 ? Math.min(totalSlots, users.length) : 1 + (index % Math.min(8, users.length));
    await prisma.matchParticipant.createMany({
      data: Array.from({ length: occupiedParties }, (_, participantIndex) => ({
        id: uuidv7(),
        matchId: match.id,
        userId: users[(index + participantIndex) % users.length]?.id ?? owner.id,
        role: participantIndex === 0 ? 'OWNER' as const : 'PLAYER' as const,
        status: 'CONFIRMED' as const,
        guestCount: index % 11 === 0 && participantIndex === 0 ? totalSlots - occupiedParties : 0,
      })),
    });
  }
  console.info(`Generated ${MATCH_COUNT} idempotent search performance matches (slug prefix: perf-search-).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
