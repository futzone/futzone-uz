import { HttpStatus, Injectable } from '@nestjs/common';
import type { FavoriteMutationResponse, FavoriteOrganizer, FavoritesResponse, Stadium } from '@futzone/contracts';
import { Prisma } from '../generated/prisma';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';

type StadiumRow = Omit<Stadium, 'createdAt'> & { createdAt: Date };

@Injectable()
export class FavoritesService {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(userId: string): Promise<FavoritesResponse> {
    const [stadiumRows, organizerRows] = await Promise.all([
      this.prisma.$queryRaw<StadiumRow[]>(Prisma.sql`
        SELECT s.id, s.slug, s.name_uz AS "nameUz", s.name_ru AS "nameRu", s.name_en AS "nameEn", s.city_id AS "cityId",
          s.district, s.address, ST_Y(s.location::geometry) AS latitude, ST_X(s.location::geometry) AS longitude,
          s.surface, s.photos, s.status, s.created_at AS "createdAt"
        FROM favorite_stadiums f JOIN stadiums s ON s.id = f.stadium_id
        WHERE f.user_id = ${userId}::uuid
        ORDER BY f.created_at DESC`),
      this.prisma.favoriteOrganizer.findMany({
        where: { userId, organizer: { deletedAt: null } },
        orderBy: { createdAt: 'desc' },
        select: { organizer: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true, position: true } } },
      }),
    ]);
    const stadiums: Stadium[] = stadiumRows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
    const organizers: FavoriteOrganizer[] = organizerRows.map((row) => row.organizer);
    return { stadiums, organizers };
  }

  public async addStadium(userId: string, stadiumId: string): Promise<FavoriteMutationResponse> {
    const stadium = await this.prisma.stadium.findFirst({ where: { id: stadiumId, status: 'APPROVED' }, select: { id: true } });
    if (!stadium) throw new AppException('NOT_FOUND', 'Stadium not found', HttpStatus.NOT_FOUND);
    await this.prisma.favoriteStadium.upsert({ where: { userId_stadiumId: { userId, stadiumId } }, create: { userId, stadiumId }, update: {} });
    return { favorited: true };
  }

  public async removeStadium(userId: string, stadiumId: string): Promise<FavoriteMutationResponse> {
    await this.prisma.favoriteStadium.deleteMany({ where: { userId, stadiumId } });
    return { favorited: false };
  }

  public async addOrganizer(userId: string, organizerId: string): Promise<FavoriteMutationResponse> {
    if (organizerId === userId) throw new AppException('VALIDATION_ERROR', 'You cannot favourite yourself');
    const organizer = await this.prisma.user.findFirst({ where: { id: organizerId, deletedAt: null }, select: { id: true } });
    if (!organizer) throw new AppException('NOT_FOUND', 'Organizer not found', HttpStatus.NOT_FOUND);
    await this.prisma.favoriteOrganizer.upsert({ where: { userId_organizerId: { userId, organizerId } }, create: { userId, organizerId }, update: {} });
    return { favorited: true };
  }

  public async removeOrganizer(userId: string, organizerId: string): Promise<FavoriteMutationResponse> {
    await this.prisma.favoriteOrganizer.deleteMany({ where: { userId, organizerId } });
    return { favorited: false };
  }
}
