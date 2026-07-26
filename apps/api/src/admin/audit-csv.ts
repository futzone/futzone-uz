import type { AdminAuditItem } from '@futzone/contracts';

const COLUMNS = ['createdAt', 'actorUsername', 'action', 'targetType', 'targetId', 'reason'] as const;

function escape(value: string): string {
  // Quote fields containing comma, quote or newline; double embedded quotes (RFC 4180).
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function auditToCsv(items: AdminAuditItem[]): string {
  const header = COLUMNS.join(',');
  const rows = items.map((item) => [
    item.createdAt, item.actorUsername, item.action, item.targetType, item.targetId, item.reason ?? '',
  ].map((cell) => escape(String(cell))).join(','));
  return [header, ...rows].join('\r\n');
}
