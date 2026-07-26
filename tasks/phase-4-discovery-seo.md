# Phase 4 — Discovery, Search & SEO

**Goal:** Players find matches fast (filters, geo, sort), and Google finds Futzone (SSR, structured data, landings, 4-locale hreflang).

**Prerequisites:** Phase 3 complete (sort-by-organizer-trust needs UserStats).

## Tasks

### Search & filtering (API)

- [x] **P4-01 Match search endpoint.** `GET /matches` with query params, all combinable:
  - `city`, `district`, `dateFrom/dateTo` + shortcuts `today|tomorrow|week`
  - `format` (multi), `level` (multi), `surface` (multi)
  - `minFreeSlots`, `onlyAvailable` (freeSlots > 0), `joinMode`
  - `priceMin/priceMax` (per-player fee), `startHourFrom/To`
  - `position` (matches with that position in `neededPositions` or unrestricted)
  - `nearLat/nearLng/radiusKm` (PostGIS `ST_DWithin` on match/stadium location)
  - `q` — text over title/stadium/address via FTS + `pg_trgm` (uz/ru unaccent config)
  - Only `PUBLISHED|FULL` matches are searchable; `onlyAvailable` excludes FULL.
  - Cursor pagination.
- [x] **P4-02 Sorting.** `sort=` `soonest` (default), `nearest` (requires nearLat/lng), `newest`, `mostFreeSlots`, `organizerTrust` (owner bayesAvg desc, nulls last), `priceAsc|priceDesc`.
- [x] **P4-03 Indexes & performance.** Composite indexes for the hot filter paths (city+status+startsAt), GiST on locations, GIN for FTS + trgm. Seed 1k matches locally; p95 search < 150 ms asserted in a perf smoke test.

### Web discovery UX

- [x] **P4-04 Filter UI.** Filter panel (sheet on mobile, sidebar on desktop) covering every P4-01 param; chips for active filters; URL-synced state (shareable filtered links); "Near me" uses browser geolocation.
- [x] **P4-05 Map view.** Toggle list ⇄ Yandex Map with clustered match pins; pin popup = mini match card.
- [x] **P4-06 Favorites.** Favorite stadiums + favorite organizers (star buttons; `GET /me/favorites`; filter "favorites only"). Lightweight — two join tables.

### SEO

- [x] **P4-07 SSR + meta for match pages.** `/[locale]/matches/[slug]` fully SSR (already built in P2-10 — audit that no auth-gated fetch blocks anonymous SSR). Dynamic `<title>`/description ("5×5 futbol, Chilonzor, 21-iyul 19:00 — 3 ta joy bor"), canonical, per-locale `hreflang` (uz, uz-Cyrl, ru, en + x-default), dynamic OG image (satori/`@vercel/og`: format, date, stadium, free slots).
- [x] **P4-08 JSON-LD.** `SportsEvent` schema on match pages (name, startDate, location w/ geo, offers = per-player fee, organizer as Person w/o personal data); `BreadcrumbList` site-wide; `Person` (public fields only) on profiles.
- [x] **P4-09 Landing pages.** SSG/ISR: `/[locale]/matches/[city]` (city landing: upcoming matches + intro copy per locale), `/[locale]/stadiums`, `/[locale]/stadiums/[city]`, `/[locale]/stadiums/[slug]` (stadium page: info, map, upcoming matches there). ISR revalidate ≤ 5 min.
- [x] **P4-10 Sitemap & robots.** Split sitemaps (static, cities, stadiums, matches, players) regenerated on schedule; robots.txt disallows admin, join tokens, settings, API. **Index policy:** PUBLISHED/FULL public matches indexed; INVITE_ONLY matches `noindex`; finished matches stay live ≥ 30 days with "match finished" state (no 404 — preserves SEO), then gone → 410.
- [x] **P4-11 i18n content pass.** Every discovery/SEO surface has real (not machine-placeholder) copy keys in all 4 locales; locale switcher preserves the current URL; Cyrillic transliteration helper for uz ⇄ uz-Cyrl slugs decided and recorded in DECISIONS.md (slugs stay Latin, single slug per match across locales).

## Acceptance criteria

- Combined filter (city + today + 5x5 + onlyAvailable + price range + sort=nearest) returns correct results and a shareable URL reproduces them.
- Anonymous curl of a match page returns full HTML with title, meta, JSON-LD, hreflang (no client-side-only content for the core data).
- Lighthouse SEO ≥ 95 on match page, city landing, stadium page.
- No phone number, join token, or private match appears in any sitemap/rendered public page (automated assertion).

## Mandatory tests

- Unit: query-builder for filters (each param + combinations), slug transliteration.
- e2e: geo search returns distance-ordered results from seeded coordinates; onlyAvailable excludes FULL; INVITE_ONLY pages send noindex; finished-match page shows finished state, not 404.
