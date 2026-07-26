import { HttpStatus, Injectable } from '@nestjs/common';
import type { CreateStadiumBody, Stadium, StadiumModerationBody } from '@futzone/contracts';
import { Prisma } from '../generated/prisma';
import { v7 as uuidv7 } from 'uuid';
import { AppException } from '../common/errors/app.exception';
import { slugify } from '../common/slug';
import { PrismaService } from '../prisma/prisma.service';

type StadiumRow = Omit<Stadium, 'createdAt'> & { createdAt: Date };

@Injectable()
export class StadiumsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(city?: string): Promise<Stadium[]> {
    const rows = await this.prisma.$queryRaw<StadiumRow[]>(Prisma.sql`
      SELECT s.id, s.slug, s.name_uz AS "nameUz", s.name_ru AS "nameRu", s.name_en AS "nameEn", s.city_id AS "cityId",
        s.district, s.address, ST_Y(s.location::geometry) AS latitude, ST_X(s.location::geometry) AS longitude,
        s.surface, s.photos, s.status, s.created_at AS "createdAt"
      FROM stadiums s JOIN cities c ON c.id = s.city_id
      WHERE s.status = 'APPROVED'::"StadiumStatus" ${city ? Prisma.sql`AND (c.slug = ${city} OR c.id::text = ${city})` : Prisma.empty}
      ORDER BY s.name_uz ASC`);
    return rows.map(this.response);
  }

  public async bySlug(slug: string): Promise<Stadium> {
    const rows = await this.prisma.$queryRaw<StadiumRow[]>(Prisma.sql`
      SELECT s.id, s.slug, s.name_uz AS "nameUz", s.name_ru AS "nameRu", s.name_en AS "nameEn", s.city_id AS "cityId",
        s.district, s.address, ST_Y(s.location::geometry) AS latitude, ST_X(s.location::geometry) AS longitude,
        s.surface, s.photos, s.status, s.created_at AS "createdAt" FROM stadiums s
      WHERE s.slug = ${slug} AND s.status = 'APPROVED'::"StadiumStatus" LIMIT 1`);
    if (!rows[0]) throw new AppException('NOT_FOUND', 'Stadium not found', HttpStatus.NOT_FOUND);
    return this.response(rows[0]);
  }

  public async create(userId: string, body: CreateStadiumBody): Promise<Stadium> {
    const city = await this.prisma.city.findFirst({ where: { id: body.cityId, isActive: true }, select: { slug: true } });
    if (!city) throw new AppException('NOT_FOUND', 'City not found', HttpStatus.NOT_FOUND);
    const id = uuidv7();
    const slug = `${slugify(body.nameUz, 'stadium')}-${city.slug}-${id.slice(-6)}`;
    await this.prisma.$executeRaw(Prisma.sql`INSERT INTO stadiums
      (id, slug, name_uz, name_ru, name_en, city_id, district, address, location, surface, photos, status, created_by_id)
      VALUES (${id}::uuid, ${slug}, ${body.nameUz}, ${body.nameRu}, ${body.nameEn}, ${body.cityId}::uuid, ${body.district}, ${body.address},
        ST_SetSRID(ST_MakePoint(${body.longitude}, ${body.latitude}), 4326)::geography, ${body.surface}::"Surface", ${body.photos}::text[], 'PENDING'::"StadiumStatus", ${userId}::uuid)`);
    return this.pendingById(id);
  }

  public async moderate(adminId: string, id: string, body: StadiumModerationBody): Promise<Stadium> {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.stadium.updateMany({ where: { id }, data: { status: body.status } });
      if (changed.count !== 1) throw new AppException('NOT_FOUND', 'Stadium not found', HttpStatus.NOT_FOUND);
      await tx.auditLog.create({ data: { id: uuidv7(), actorId: adminId, action: `STADIUM_${body.status}`, targetType: 'Stadium', targetId: id, metadata: { status: body.status } } });
    });
    return this.pendingById(id);
  }

  private async pendingById(id: string): Promise<Stadium> {
    const rows = await this.prisma.$queryRaw<StadiumRow[]>(Prisma.sql`
      SELECT id, slug, name_uz AS "nameUz", name_ru AS "nameRu", name_en AS "nameEn", city_id AS "cityId", district, address,
        ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude, surface, photos, status, created_at AS "createdAt"
      FROM stadiums WHERE id = ${id}::uuid LIMIT 1`);
    if (!rows[0]) throw new AppException('NOT_FOUND', 'Stadium not found', HttpStatus.NOT_FOUND);
    return this.response(rows[0]);
  }
  private response(row: StadiumRow): Stadium { return { ...row, createdAt: row.createdAt.toISOString() }; }
}
