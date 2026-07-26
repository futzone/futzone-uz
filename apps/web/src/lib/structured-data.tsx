import type { PublicMatchDetail, PublicProfile } from '@futzone/contracts';

type JsonLdPrimitive = string | number | boolean | null;
export type JsonLd = JsonLdPrimitive | { readonly [key: string]: JsonLd } | readonly JsonLd[];

export function serializeJsonLd(value: JsonLd): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function breadcrumbJsonLd(items: ReadonlyArray<{ name: string; url: string }>): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function sportsEventJsonLd(
  match: PublicMatchDetail,
  options: { url: string; organizerLabel: string },
): JsonLd {
  const venue = match.stadium;
  const latitude = venue?.latitude ?? match.latitude;
  const longitude = venue?.longitude ?? match.longitude;
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: match.title,
    startDate: match.startsAt,
    url: options.url,
    eventStatus: match.status === 'CANCELLED'
      ? 'https://schema.org/EventCancelled'
      : match.status === 'FINISHED' || match.status === 'ATTENDANCE_PENDING' || match.status === 'RATING_PENDING' || match.status === 'COMPLETED'
        ? 'https://schema.org/EventCompleted'
        : 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: venue?.name ?? match.address ?? match.city.name,
      address: venue?.address ?? match.address ?? match.city.name,
      ...(latitude !== null && longitude !== null ? {
        geo: { '@type': 'GeoCoordinates', latitude, longitude },
      } : {}),
    },
    offers: {
      '@type': 'Offer',
      price: match.perPlayerFeeUzs,
      priceCurrency: 'UZS',
      availability: match.freeSlots > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/SoldOut',
      url: options.url,
    },
    organizer: { '@type': 'Person', name: options.organizerLabel },
  };
}

export function personJsonLd(profile: PublicProfile, url: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: `${profile.firstName} ${profile.lastName}`,
    alternateName: `@${profile.username}`,
    description: profile.bio,
    image: profile.avatarUrl,
    url,
    address: profile.city ? { '@type': 'PostalAddress', addressLocality: profile.city.name } : null,
  };
}

export function JsonLdScript({ data }: { data: JsonLd }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
