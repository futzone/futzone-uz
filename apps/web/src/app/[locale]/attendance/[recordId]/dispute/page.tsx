import { setRequestLocale } from 'next-intl/server';
import { DisputeDialog } from '@/components/dispute-dialog';

export default async function AttendanceDisputePage({ params }: { params: Promise<{ locale: string; recordId: string }> }) {
  const { locale, recordId } = await params; setRequestLocale(locale);
  return <main className="px-4 py-12"><DisputeDialog recordId={recordId} /></main>;
}
