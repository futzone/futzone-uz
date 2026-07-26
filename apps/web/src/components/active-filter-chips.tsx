import type { City } from '@futzone/contracts';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  activeFilters,
  formatShortLabel,
  hasActiveFilters,
  removeFilter,
  serializeMatchFilters,
  type ActiveFilter,
  type MatchFilters,
} from '@/lib/match-filters';

const href = (filters: MatchFilters): string => {
  const query = serializeMatchFilters(filters).toString();
  return query ? `/matches?${query}` : '/matches';
};

/** Server-rendered removable chips for every active filter; each chip is a plain link so filtered URLs stay shareable and work without JS. */
export async function ActiveFilterChips({ filters, cities }: { filters: MatchFilters; cities: City[] }) {
  if (!hasActiveFilters(filters)) return null;
  const t = await getTranslations();
  const cityName = (slug: string) => cities.find((city) => city.slug === slug)?.name ?? slug;

  const label = (entry: ActiveFilter): string => {
    const value = entry.value ?? '';
    switch (entry.key) {
      case 'city': return cityName(value);
      case 'district': return value;
      case 'date': return t(`matches.list.${value}`);
      case 'dateFrom': return `${t('matches.filter.from')}: ${value}`;
      case 'dateTo': return `${t('matches.filter.to')}: ${value}`;
      case 'format': return formatShortLabel(value);
      case 'level': return t(`matches.wizard.levels.${value}`);
      case 'surface': return t(`matches.wizard.surfaces.${value}`);
      case 'joinMode': return t(`matches.wizard.joinModes.${value}`);
      case 'position': return t(`positions.${value}`);
      case 'minFreeSlots': return `${t('matches.filter.minFreeSlots')}: ${value}`;
      case 'onlyAvailable': return t('matches.filter.onlyAvailable');
      case 'favoritesOnly': return t('matches.filter.favoritesOnly');
      case 'priceMin': return `${t('matches.filter.priceMin')}: ${value}`;
      case 'priceMax': return `${t('matches.filter.priceMax')}: ${value}`;
      case 'startHourFrom': return `${t('matches.filter.startHour')} ${t('matches.filter.from')}: ${value}`;
      case 'startHourTo': return `${t('matches.filter.startHour')} ${t('matches.filter.to')}: ${value}`;
      case 'nearLat': return t('matches.filter.nearMe');
      case 'q': return `“${value}”`;
      default: return value;
    }
  };

  const entries = activeFilters(filters);
  return <div className="flex flex-wrap items-center gap-2" aria-label={t('matches.filter.activeLabel')}>
    {entries.map((entry) => <Link key={`${entry.key}:${entry.value ?? ''}`} href={href(removeFilter(filters, entry.key, entry.value))} className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm hover:bg-muted/70">
      <span>{label(entry)}</span>
      <span aria-hidden className="text-muted-foreground">×</span>
      <span className="sr-only">{t('matches.filter.remove')}</span>
    </Link>)}
    <Link href="/matches" className="text-sm text-muted-foreground underline-offset-4 hover:underline">{t('matches.filter.clearAll')}</Link>
  </div>;
}
