import type { AdminAuditItem } from '@futzone/contracts';
import { auditToCsv } from './audit-csv';

const base: AdminAuditItem = {
  id: '00000000-0000-0000-0000-000000000001', actorId: '00000000-0000-0000-0000-0000000000a1',
  actorUsername: 'admin1', action: 'USER_BAN', targetType: 'User', targetId: '00000000-0000-0000-0000-0000000000b2',
  reason: 'spam', metadata: null, createdAt: '2026-07-26T10:00:00.000Z',
};

describe('auditToCsv', () => {
  it('emits an RFC-4180 header and one row per entry', () => {
    const csv = auditToCsv([base]);
    const [header, row] = csv.split('\r\n');
    expect(header).toBe('createdAt,actorUsername,action,targetType,targetId,reason');
    expect(row).toBe('2026-07-26T10:00:00.000Z,admin1,USER_BAN,User,00000000-0000-0000-0000-0000000000b2,spam');
  });

  it('quotes and escapes fields with commas, quotes or newlines', () => {
    const csv = auditToCsv([{ ...base, reason: 'said "hi", then left\nabruptly' }]);
    expect(csv.split('\r\n')[1]).toContain('"said ""hi"", then left\nabruptly"');
  });

  it('renders an empty reason as an empty field, not the string null', () => {
    const csv = auditToCsv([{ ...base, reason: null }]);
    expect(csv.split('\r\n')[1]?.endsWith(',')).toBe(true);
  });
});
