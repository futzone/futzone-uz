import { Injectable } from '@nestjs/common';
import type { SeoManifest } from '@futzone/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SeoService {
  public constructor(private readonly prisma: PrismaService) {}

  public async manifest(): Promise<SeoManifest> {
    const [cities, stadiums, matches, players] = await Promise.all([
      this.prisma.city.findMany({
        where: { isActive: true },
        select: { slug: true },
        orderBy: { slug: 'asc' },
      }),
      this.prisma.stadium.findMany({
        where: { status: 'APPROVED' },
        select: { slug: true, createdAt: true },
        orderBy: { slug: 'asc' },
      }),
      this.prisma.match.findMany({
        where: {
          deletedAt: null,
          status: { in: ['PUBLISHED', 'FULL'] },
          joinMode: { not: 'INVITE_ONLY' },
        },
        select: { slug: true, createdAt: true },
        orderBy: { slug: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { deletedAt: null, status: { not: 'BANNED' } },
        select: { username: true, createdAt: true },
        orderBy: { username: 'asc' },
      }),
    ]);
    const generatedAt = new Date().toISOString();
    return {
      generatedAt,
      cities: cities.map(({ slug }) => ({ slug, updatedAt: generatedAt })),
      stadiums: stadiums.map(({ slug, createdAt }) => ({ slug, updatedAt: createdAt.toISOString() })),
      matches: matches.map(({ slug, createdAt }) => ({ slug, updatedAt: createdAt.toISOString() })),
      players: players.map(({ username, createdAt }) => ({ slug: username, updatedAt: createdAt.toISOString() })),
    };
  }
}
