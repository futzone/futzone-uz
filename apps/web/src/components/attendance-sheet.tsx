'use client';

import { AttendanceStatus, type AttendanceSheetEntry, type MarkAttendanceBody } from '@futzone/contracts';
import { Button, Card, Input } from '@futzone/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { mapErrorCodeToMessage } from '@/lib/api/errors';

const statuses = [AttendanceStatus.ON_TIME, AttendanceStatus.LATE, AttendanceStatus.NO_SHOW, AttendanceStatus.EXCUSED] as const;

export function AttendanceSheet({ matchId, initial }: { matchId: string; initial: AttendanceSheetEntry[] }) {
  const t = useTranslations(); const [entries, setEntries] = useState(initial); const [message, setMessage] = useState('');
  const mark = async (entry: AttendanceSheetEntry, status: MarkAttendanceBody['status'], guestNoShowCount = entry.record?.guestNoShowCount ?? 0) => {
    try {
      const record = await apiClient.markAttendance(matchId, entry.participantId, { status, ...(entry.guestCount ? { guestNoShowCount } : {}) });
      setEntries((current) => current.map((item) => item.participantId === entry.participantId ? { ...item, record } : item));
      setMessage(t('attendance.saved'));
    } catch (error) { setMessage(error instanceof ApiClientError ? mapErrorCodeToMessage(error.code, t) : t('attendance.failed')); }
  };
  return <Card className="p-6"><h2 className="text-xl font-semibold">{t('attendance.title')}</h2><div className="mt-4 space-y-4">{entries.map((entry) => <div key={entry.participantId} className="rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{entry.firstName} {entry.lastName} <span className="text-sm text-muted-foreground">@{entry.username}</span></p>{entry.guestCount ? <label className="flex items-center gap-2 text-sm">{t('attendance.guestNoShows')}<Input className="w-20" type="number" min={0} max={entry.guestCount} value={entry.record?.guestNoShowCount ?? 0} onChange={(event) => void mark(entry, entry.record?.status === 'CANCELLED_EARLY' ? 'ON_TIME' : entry.record?.status ?? 'ON_TIME', Math.min(entry.guestCount, Math.max(0, Number(event.target.value))))} /></label> : null}</div><div className="mt-3 flex flex-wrap gap-2">{statuses.map((status) => <Button key={status} size="sm" variant={entry.record?.status === status ? 'default' : 'outline'} onClick={() => void mark(entry, status)}>{t(`attendance.status.${status}`)}</Button>)}</div></div>)}</div>{message ? <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p> : null}</Card>;
}
