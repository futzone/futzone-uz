import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { StadiumCard } from '@/components/stadium-card';
import { getPathAlternateLinks } from '@/i18n/metadata';
import { Link } from '@/i18n/navigation';
import { ApiClient } from '@/lib/api/client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'stadiums' });
  return { title: t('title'), description: t('subtitle'), alternates: getPathAlternateLinks(locale, '/stadiums') };
}

export default async function StadiumsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const client = new ApiClient(process.env.NEXT_PUBLIC_API_URL);
  const [stadiums, cities, t] = await Promise.all([
    client.stadiums(undefined, { next: { revalidate: 300 } }),
    client.cities(locale),
    getTranslations('stadiums'),
  ]);
  const cityById = new Map(cities.map((city) => [city.id, city]));
  const byCity = new Map<string, typeof stadiums>();
  for (const stadium of stadiums) {
    const list = byCity.get(stadium.cityId) ?? [];
    list.push(stadium);
    byCity.set(stadium.cityId, list);
  }

  return <main className="mx-auto max-w-7xl px-4 py-10">
    <h1 className="text-3xl font-bold">{t('title')}</h1>
    <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
    {stadiums.length === 0 && <p className="mt-12 text-center text-muted-foreground">{t('empty')}</p>}
    {[...byCity.entries()].map(([cityId, cityStadiums]) => {
      const city = cityById.get(cityId);
      return <section key={cityId} className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">{city?.name ?? ''}</h2>
          {city && <Link href={`/stadiums/${city.slug}`} className="text-sm text-primary underline-offset-4 hover:underline">{t('viewCity', { city: city.name })}</Link>}
        </div>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{cityStadiums.map((stadium) => <StadiumCard key={stadium.id} stadium={stadium} locale={locale} />)}</div>
      </section>;
    })}
  </main>;
}
