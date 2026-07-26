import { Injectable } from '@nestjs/common';
import type { AdminAuditItem, AdminAuditListResponse, AdminAuditQuery } from '@futzone/contracts';
import { Prisma, type AuditLog } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { auditToCsv } from './audit-csv';

type AuditRow = AuditLog & { actor: { username: string } };
const CSV_CAP = 10_000;

@Injectable()
export class AdminAuditService {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(query: AdminAuditQuery): Promise<AdminAuditListResponse> {
    const where = this.where(query);
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit, include: { actor: { select: { username: true } } } }),
    ]);
    return { items: rows.map((row) => this.toItem(row)), total, page: query.page, pageSize: query.limit, totalPages: Math.ceil(total / query.limit) };
  }

  public async exportCsv(query: AdminAuditQuery): Promise<string> {
    const rows = await this.prisma.auditLog.findMany({ where: this.where(query), orderBy: { createdAt: 'desc' }, take: CSV_CAP, include: { actor: { select: { username: true } } } });
    return auditToCsv(rows.map((row) => this.toItem(row)));
  }

  private where(query: AdminAuditQuery): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.actorId) where.actorId = query.actorId;
    if (query.action) where.action = query.action;
    if (query.targetType) where.targetType = query.targetType;
    if (query.targetId) where.targetId = query.targetId;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }
    return where;
  }

  private toItem(row: AuditRow): AdminAuditItem {
    const metadata = (row.metadata ?? null) as Record<string, unknown> | null;
    const reason = metadata && typeof metadata.reason === 'string' ? metadata.reason : null;
    return {
      id: row.id, actorId: row.actorId, actorUsername: row.actor.username,
      action: row.action, targetType: row.targetType, targetId: row.targetId,
      reason, metadata, createdAt: row.createdAt.toISOString(),
    };
  }
}
