import type { PublicMatchDetail, PublicProfile, SeoManifest } from '@futzone/contracts';
import { describe, expect, it } from 'vitest';
import robots from '../src/app/robots';
import { matchMetadataText } from '../src/lib/match-metadata';
import { sitemapEntries, sitemapIndexXml, urlSetXml } from '../src/lib/sitemap';
import { breadcrumbJsonLd, personJsonLd, serializeJsonLd, sportsEventJsonLd } from '../src/lib/structured-data';
import en from '../src/i18n/catalogs/en.json';
import ru from '../src/i18n/catalogs/ru.json';
import uzCyrl from '../src/i18n/catalogs/uz-Cyrl.json';
import uz from '../src/i18n/catalogs/uz.json';

const match: PublicMatchDetail = {
  visibility: 'PUBLIC',
  id: '01984ac4-89a1-7000-8000-000000000001',
  slug: 'public-five',
  ownerId: '01984ac4-89a1-7000-8000-000000000002',
  title: 'Evening football',
  format: 'F5',
  totalSlots: 10,
  occupiedSlots: 7,
  freeSlots: 3,
  startsAt: '2026-07-21T14:00:00.000Z',
  durationMin: 90,
  cityId: '01984ac4-89a1-7000-8000-000000000003',
  stadiumId: '01984ac4-89a1-7000-8000-000000000004',
  address: null,
  latitude: null,
  longitude: null,
  fieldPriceUzs: 500000,
  perPlayerFeeUzs: 50000,
  surface: 'ARTIFICIAL_GRASS',
  level: 'AMATEUR',
  joinMode: 'AUTO',
  minRating: null,
  minAttendancePct: null,
  allowNewPlayers: true,
  neededPositions: [],
  ageGroup: 'MIXED',
  verifiedPhoneOnly: false,
  status: 'PUBLISHED',
  cancelledReason: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  city: { slug: 'tashkent', name: 'Chilonzor' },
  stadium: { slug: 'bunyodkor', name: 'Bunyodkor', address: 'Chilonzor', latitude: 41.28, longitude: 69.21 },
  participants: [],
};

const catalogs = { uz, 'uz-Cyrl': uzCyrl, ru, en } as const;
const translate = (locale: keyof typeof catalogs) => (key: string, values: Record<string, string | number | Date> = {}) => {
  const template = catalogs[locale].matches.seo[key as keyof typeof catalogs.en.matches.seo];
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
};

describe('match SEO metadata', () => {
  it.each(['uz', 'uz-Cyrl', 'ru', 'en'] as const)('localizes title and description with real free slots for %s', (locale) => {
    const metadata = matchMetadataText(match, locale, translate(locale));
    expect(metadata.title).toContain('3');
    expect(metadata.description).toContain('3');
    expect(metadata.title).toContain('5×5');
    expect(metadata.description).toContain('Bunyodkor');
  });
});

describe('JSON-LD', () => {
  it('builds valid SportsEvent, BreadcrumbList and public-only Person shapes', () => {
    const profile: PublicProfile = {
      avatarUrl: null, firstName: 'Bobur', lastName: 'Salimov', username: 'bobur_salimov', bio: 'Player',
      city: { id: match.cityId, slug: 'tashkent', name: 'Tashkent' }, position: 'MID',
      joinedAt: '2026-01-01T00:00:00.000Z', verified: true,
      stats: { matchesPlayed: 2, matchesOrganized: 0, onTime: 2, late: 0, noShow: 0, cancelledEarly: 0, excused: 0, attendancePct: 100, bayesAvg: null, ratingCount: 2, lastFiveAvg: 5 },
      badges: [], recentMatches: [], comments: { items: [], page: 1, pageSize: 5, total: 0, totalPages: 0 },
    };
    const blobs = [
      sportsEventJsonLd(match, { url: 'https://futzone.uz/en/matches/public-five', organizerLabel: 'Futzone organizer' }),
      breadcrumbJsonLd([{ name: 'Futzone', url: 'https://futzone.uz/en' }]),
      personJsonLd(profile, 'https://futzone.uz/en/players/bobur_salimov'),
    ];
    const serialized = blobs.map(serializeJsonLd);
    for (const blob of serialized) expect(() => JSON.parse(blob)).not.toThrow();
    expect(JSON.parse(serialized[0] ?? '{}')).toMatchObject({ '@type': 'SportsEvent', offers: { price: 50000, priceCurrency: 'UZS' }, organizer: { '@type': 'Person' } });
    expect(JSON.parse(serialized[1] ?? '{}')).toMatchObject({ '@type': 'BreadcrumbList', itemListElement: [{ position: 1 }] });
    expect(JSON.parse(serialized[2] ?? '{}')).toMatchObject({ '@type': 'Person', alternateName: '@bobur_salimov' });
    expect(serialized.join(' ')).not.toMatch(/\+998|phone|invitation.?token|verifiedPhoneOnly|ownerId/i);
  });

  it('omits GeoCoordinates rather than emitting malformed null coordinates', () => {
    const withoutCoordinates = { ...match, stadium: null, latitude: null, longitude: null, address: 'Known address' };
    const serialized = serializeJsonLd(sportsEventJsonLd(withoutCoordinates, {
      url: 'https://futzone.uz/en/matches/public-five',
      organizerLabel: 'Futzone organizer',
    }));
    expect(serialized).not.toContain('GeoCoordinates');
    expect(serialized).not.toMatch(/"latitude":null|"longitude":null/);
  });
});

describe('sitemaps and robots privacy', () => {
  const manifest: SeoManifest = {
    generatedAt: '2026-07-23T00:00:00.000Z',
    cities: [{ slug: 'tashkent', updatedAt: '2026-07-23T00:00:00.000Z' }],
    stadiums: [{ slug: 'bunyodkor', updatedAt: '2026-07-23T00:00:00.000Z' }],
    matches: [{ slug: 'public-five', updatedAt: '2026-07-23T00:00:00.000Z' }],
    players: [{ slug: 'bobur_salimov', updatedAt: '2026-07-23T00:00:00.000Z' }],
  };

  it('publishes split sitemap files and only privacy-filtered match records', () => {
    const xml = urlSetXml(sitemapEntries('matches', manifest, new URL('https://futzone.uz')));
    expect(sitemapIndexXml(new URL('https://futzone.uz'))).toMatch(/sitemaps\/static.*sitemaps\/cities.*sitemaps\/stadiums.*sitemaps\/matches.*sitemaps\/players/);
    expect(xml).toContain('/en/matches/public-five');
    expect(xml).not.toMatch(/invite|private|draft|cancelled|started|\+998|token/i);
    expect(sitemapEntries('cities', manifest)).toHaveLength(4);
    expect(sitemapEntries('stadiums', manifest)).toHaveLength(4);
  });

  it('disallows admin, join tokens, settings and API paths', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const disallowed = rules.flatMap((rule) => Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow]);
    expect(disallowed).toEqual(expect.arrayContaining(['/admin', '/*/admin', '/api', '/*/join/', '/*/settings']));
  });
});
