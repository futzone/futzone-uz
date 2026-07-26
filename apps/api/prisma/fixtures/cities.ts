export type CityFixture = Readonly<{
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
}>;

export const cityFixtures = [
  { name: 'Tashkent', slug: 'tashkent', latitude: 41.2995, longitude: 69.2401 },
  { name: 'Samarkand', slug: 'samarkand', latitude: 39.627, longitude: 66.975 },
] as const satisfies readonly CityFixture[];
