import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import type { Prisma } from '../generated/prisma';

export interface AuditEntry {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  // Writes the audit row on the CALLER'S transaction client so it commits atomically with the
  // mutation it records. before/after/reason live in the metadata JSON (the column-level filters
  // in the audit viewer are actor/action/target/date).
  public record(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<{ id: string }> {
    const metadata: Record<string, unknown> = { ...(entry.metadata ?? {}) };
    if (entry.before !== undefined) metadata.before = entry.before;
    if (entry.after !== undefined) metadata.after = entry.after;
    if (entry.reason != null) metadata.reason = entry.reason;
    return tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: Object.keys(metadata).length ? (metadata as Prisma.InputJsonValue) : undefined,
      },
      select: { id: true },
    });
  }
}
