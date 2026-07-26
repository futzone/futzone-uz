export type StadiumFixture = Readonly<{
  name: string;
  slug: string;
  citySlug: string;
  latitude: number;
  longitude: number;
  status: 'APPROVED';
}>;

export const stadiumFixtures = [
  {
    name: 'Milliy Stadium',
    slug: 'milliy-stadium',
    citySlug: 'tashkent',
    latitude: 41.2794,
    longitude: 69.212,
    status: 'APPROVED',
  },
  {
    name: 'Pakhtakor Markaziy Stadium',
    slug: 'pakhtakor-markaziy-stadium',
    citySlug: 'tashkent',
    latitude: 41.3153,
    longitude: 69.2606,
    status: 'APPROVED',
  },
  {
    name: 'Lokomotiv Stadium',
    slug: 'lokomotiv-stadium-tashkent',
    citySlug: 'tashkent',
    latitude: 41.3614,
    longitude: 69.3964,
    status: 'APPROVED',
  },
] as const satisfies readonly StadiumFixture[];
