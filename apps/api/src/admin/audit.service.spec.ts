import type { Prisma } from '../generated/prisma';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('writes on the provided transaction client with before/after/reason folded into metadata', async () => {
    const create = jest.fn(async (_args: { data: unknown }) => ({ id: 'audit-1' }));
    const tx = { auditLog: { create } } as unknown as Prisma.TransactionClient;
    const service = new AuditService();

    await service.record(tx, {
      actorId: 'admin-1', action: 'USER_BAN', targetType: 'User', targetId: 'user-1',
      before: { status: 'ACTIVE' }, after: { status: 'BANNED' }, reason: 'spam',
    });

    expect(create).toHaveBeenCalledTimes(1);
    const data = (create.mock.calls[0]![0] as unknown as { data: { actorId: string; action: string; targetType: string; targetId: string; metadata: Record<string, unknown> } }).data;
    expect(data).toMatchObject({ actorId: 'admin-1', action: 'USER_BAN', targetType: 'User', targetId: 'user-1' });
    expect(data.metadata).toEqual({ before: { status: 'ACTIVE' }, after: { status: 'BANNED' }, reason: 'spam' });
  });

  it('omits metadata entirely when nothing extra is supplied', async () => {
    const create = jest.fn(async (_args: { data: unknown }) => ({ id: 'audit-2' }));
    const tx = { auditLog: { create } } as unknown as Prisma.TransactionClient;
    await new AuditService().record(tx, { actorId: 'a', action: 'X', targetType: 'T', targetId: 't' });
    const data = (create.mock.calls[0]![0] as unknown as { data: { metadata?: unknown } }).data;
    expect(data.metadata).toBeUndefined();
  });
});
