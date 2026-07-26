import { Injectable } from '@nestjs/common';
import type { AdminDashboardResponse, AdminMetricsDaily as AdminMetricsDailyDto } from '@futzone/contracts';
import type { AdminMetricsDaily } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60_000;

export function startOfUtcDay(reference: Date): Date {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
}
function addDays(date: Date, days: number): Date { return new Date(date.getTime() + days * DAY_MS); }
function round2(value: number): number { return Math.round(value * 100) / 100; }

@Injectable()
export class AdminMetricsService {
  public constructor(private readonly prisma: PrismaService) {}

  // Recompute and upsert the snapshot for the day containing `reference`. Run nightly (or on demand).
  // "Active" is proxied by MatchParticipant.joinedAt — the platform's clearest engagement signal.
  public async aggregate(reference: Date = new Date()): Promise<void> {
    const dayStart = startOfUtcDay(reference);
    const dayEnd = addDays(dayStart, 1);
    const d7 = addDays(dayStart, -7);
    const d30 = addDays(dayStart, -30);

    const distinctUsers = async (gte: Date, lt: Date): Promise<number> =>
      (await this.prisma.matchParticipant.findMany({ where: { joinedAt: { gte, lt } }, select: { userId: true }, distinct: ['userId'] })).length;

    const [totalUsers, newUsers, matchesCreated, matchesCompleted, matchesCancelled, active7, active30, dau, wau, goodAttendance, totalAttendance, grouped] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: dayStart, lt: dayEnd } } }),
      this.prisma.match.count({ where: { deletedAt: null, createdAt: { gte: dayStart, lt: dayEnd } } }),
      this.prisma.match.count({ where: { deletedAt: null, status: 'COMPLETED' } }),
      this.prisma.match.count({ where: { deletedAt: null, status: 'CANCELLED' } }),
      distinctUsers(d7, dayEnd),
      distinctUsers(d30, dayEnd),
      distinctUsers(dayStart, dayEnd),
      distinctUsers(d7, dayEnd),
      this.prisma.attendanceRecord.count({ where: { finalizedAt: { not: null }, status: { in: ['ON_TIME', 'LATE'] } } }),
      this.prisma.attendanceRecord.count({ where: { finalizedAt: { not: null } } }),
      this.prisma.match.groupBy({ by: ['cityId'], where: { deletedAt: null, createdAt: { gte: d30, lt: dayEnd } }, _count: { _all: true } }),
    ]);

    const cities = await this.prisma.city.findMany({ where: { id: { in: grouped.map((g) => g.cityId) } }, select: { id: true, nameUz: true } });
    const nameById = new Map(cities.map((c) => [c.id, c.nameUz]));
    const activityByCity = grouped
      .map((g) => ({ cityId: g.cityId, city: nameById.get(g.cityId) ?? 'Unknown', matches: g._count._all }))
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 10);

    const data = {
      totalUsers, newUsers, activeUsers7d: active7, activeUsers30d: active30, dau, wau,
      matchesCreated, matchesCompleted, matchesCancelled,
      attendancePct: totalAttendance ? round2((goodAttendance / totalAttendance) * 100) : null,
      activityByCity,
    };
    await this.prisma.adminMetricsDaily.upsert({ where: { date: dayStart }, create: { date: dayStart, ...data }, update: data });
  }

  public async dashboard(): Promise<AdminDashboardResponse> {
    const rows = await this.prisma.adminMetricsDaily.findMany({ orderBy: { date: 'desc' }, take: 30 });
    const series = rows.slice().reverse().map((row) => this.toDto(row));
    return { latest: rows[0] ? this.toDto(rows[0]) : null, series };
  }

  private toDto(row: AdminMetricsDaily): AdminMetricsDailyDto {
    return {
      date: row.date.toISOString().slice(0, 10),
      totalUsers: row.totalUsers, newUsers: row.newUsers,
      activeUsers7d: row.activeUsers7d, activeUsers30d: row.activeUsers30d,
      dau: row.dau, wau: row.wau,
      matchesCreated: row.matchesCreated, matchesCompleted: row.matchesCompleted, matchesCancelled: row.matchesCancelled,
      attendancePct: row.attendancePct == null ? null : Number(row.attendancePct),
      activityByCity: row.activityByCity as AdminMetricsDailyDto['activityByCity'],
    };
  }
}
