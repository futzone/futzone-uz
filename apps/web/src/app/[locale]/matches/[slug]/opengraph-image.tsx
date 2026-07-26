import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ApiClient, ApiClientError } from '@/lib/api/client';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  let match;
  try {
    match = await new ApiClient(process.env.NEXT_PUBLIC_API_URL).match(slug, locale, { next: { revalidate: 300 } });
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Tashkent',
  }).format(new Date(match.startsAt));
  const [t, common] = await Promise.all([
    getTranslations({ locale, namespace: 'matches.seo' }),
    getTranslations({ locale, namespace: 'common' }),
  ]);
  const detail = match.visibility === 'PUBLIC'
    ? `${match.stadium?.name ?? match.city.name} · ${t('freeSlots', { freeSlots: match.freeSlots })}`
    : match.city.name;
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#071b15', color: '#fff', padding: 72 }}>
      <div style={{ display: 'flex', fontSize: 38, color: '#67e8a5' }}>{common('appName')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', fontSize: 86, fontWeight: 700 }}>{match.format.slice(1)} × {match.format.slice(1)}</div>
        <div style={{ display: 'flex', fontSize: 42 }}>{date}</div>
        <div style={{ display: 'flex', fontSize: 34, color: '#d1fae5' }}>{detail}</div>
      </div>
    </div>,
    size,
  );
}
