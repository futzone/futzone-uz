# Architecture decisions

## How to add a decision

Add the next sequential ADR with its ID, date, status, context, decision, and consequences. Supersede accepted decisions with a new linked ADR rather than silently rewriting them.

## ADR-001: Prisma over Drizzle

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** Futzone needs a typed ORM, migrations, relations, and broad NestJS support.
- **Decision:** Use Prisma instead of Drizzle.
- **Consequences:** Prisma is the data-model source of truth; advanced PostGIS and locking may require raw SQL.

## ADR-002: Yandex Maps over OpenStreetMap

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** Local map coverage and address quality are critical in Uzbekistan.
- **Decision:** Use Yandex Maps instead of an OpenStreetMap-based provider.
- **Consequences:** The product depends on Yandex APIs and credentials; map access should stay adaptable.

## ADR-003: PostgreSQL search before Meilisearch

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** MVP search does not justify another datastore and synchronization pipeline.
- **Decision:** Use PostgreSQL FTS with `pg_trgm`; consider Meilisearch only after scale requires it.
- **Consequences:** Search has lower operational cost, with relevance constrained to PostgreSQL capabilities.

## ADR-004: SSE before WebSocket

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** Initial realtime flows are primarily server-to-client notifications.
- **Decision:** Use SSE first and introduce WebSocket only for bidirectional needs.
- **Consequences:** MVP infrastructure is simpler; client actions continue over REST.

## ADR-005: Turborepo and pnpm monorepo

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** Web, admin, API, and shared packages must evolve together.
- **Decision:** Use pnpm workspaces orchestrated by Turborepo.
- **Consequences:** Scripts stay package-local while root tasks coordinate and cache execution.

## ADR-006: NestJS and Next.js App Router

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** Futzone needs a structured REST backend and SEO-capable server-rendered frontend.
- **Decision:** Use NestJS for the API and Next.js App Router for web applications.
- **Consequences:** Backend boundaries use Nest modules; frontend defaults to server components.

## ADR-007: PostGIS

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** Stadium distance queries and nearby-match ordering are core discovery features.
- **Decision:** Enable PostGIS for coordinates, spatial indexes, and distance queries.
- **Consequences:** PostgreSQL deployments require PostGIS; Prisma may need raw spatial queries.

## ADR-008: Redis and BullMQ

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** OTP limits, caching, reminders, and notifications need ephemeral state and durable jobs.
- **Decision:** Use Redis for cache/rate limits and BullMQ for background queues.
- **Consequences:** Redis is required; all jobs must be idempotent and use shared names.

## ADR-009: S3-compatible storage

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** Avatars, stadium photos, and generated images should not live on app disks.
- **Decision:** Use S3-compatible object storage, with MinIO locally.
- **Consequences:** Storage remains portable; uploads and cleanup need explicit lifecycle handling.

## ADR-010: Provider-agnostic SMS

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** Uzbekistan SMS vendors and commercial arrangements may change.
- **Decision:** Put delivery behind a provider-neutral interface with a mock development provider.
- **Consequences:** Auth avoids vendor coupling; adapters must preserve common delivery semantics.

## ADR-011: UUIDv7 identifiers

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** IDs need global uniqueness and better index locality than random UUIDv4.
- **Decision:** Use UUIDv7 primary keys.
- **Consequences:** All ID generation must consistently support UUIDv7.

## ADR-012: Integer UZS money

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** UZS prices must avoid floating-point errors.
- **Decision:** Store monetary values as integer UZS amounts.
- **Consequences:** APIs use integers and fractional UZS is unsupported.

## ADR-013: UTC storage

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** Scheduling must remain unambiguous while displaying local match times.
- **Decision:** Store timestamps in UTC and display in the stadium timezone, defaulting to Asia/Tashkent.
- **Consequences:** Boundaries require timezone-aware values and presentation performs local conversion.

## ADR-014: Multi-arch PostGIS development image

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** The `postgis/postgis:16-3.4` image is amd64-only, so Apple Silicon development hosts run it through slow and flaky QEMU emulation.
- **Decision:** Use `imresamu/postgis:16-3.4`, which supports native amd64 and arm64 execution while retaining the same PostgreSQL entrypoint and `/docker-entrypoint-initdb.d` behavior.
- **Consequences:** PostgreSQL runs natively on Apple Silicon, avoiding QEMU emulation flakiness while existing initialization scripts continue to work unchanged.

## ADR-015: Zod-to-OpenAPI bridge

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** API request DTOs use the shared Zod 3 schemas, while Nest Swagger reflection only understands class-based DTO metadata by default.
- **Decision:** Use `@asteasolutions/zod-to-openapi` to register Zod schemas as OpenAPI components and reference those components from controller decorators.
- **Consequences:** Runtime validation and API documentation share one schema source without introducing class-validator DTOs; newly exposed schemas must be registered with the OpenAPI registry.

## ADR-016: Tailwind CSS v4 CSS-first shared theme

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** Tailwind CSS v4 configures design tokens in CSS with `@theme`; the earlier JavaScript preset approach belongs to Tailwind v3 and cannot be the shared source of truth for v4 applications.
- **Decision:** Export a shared `@theme` stylesheet from `@futzone/config` and import it from each application stylesheet. This supersedes the JavaScript-preset approach.
- **Consequences:** Applications compose Tailwind and shared tokens through CSS imports; adding or changing shared tokens no longer requires a JavaScript Tailwind config.

## ADR-017: Russian admin locale — **Date:** 2026-07-22 — **Status:** Accepted — **Decision:** Keep the admin application single-locale in Russian with its message catalog local to `apps/admin`, without locale-prefixed routing or an admin namespace in `@futzone/i18n`.

## ADR-018: Opaque registration tokens

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** OTP verification for a new phone must return a short-lived signed registration token, while the privacy invariant forbids returning phone numbers from auth endpoints. A JWT containing the phone would expose it through its decodable payload.
- **Decision:** Registration JWTs contain only a random token ID and token type. Redis stores the ID-to-phone mapping for 15 minutes, and registration atomically consumes it with `GETDEL`.
- **Consequences:** Registration tokens are single-use and reveal no phone, while registration now requires Redis availability.

## ADR-019: Refresh-cookie scope and security

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** Refresh tokens must be delivered only as secure, httpOnly, same-site cookies and should not accompany unrelated requests.
- **Decision:** Set the refresh cookie with `Secure`, `HttpOnly`, `SameSite=Strict`, and path `/api/auth` in every environment. Tests forward the cookie header explicitly because secure cookies are not automatically sent over plain HTTP.
- **Consequences:** The production posture is identical in development; a browser-based local flow needs HTTPS termination, while API e2e remains deterministic.

## ADR-020: Pending avatar ownership key

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** Avatar processing jobs may be retried or finish out of order. The specification requires idempotency and forbids deleting the current avatar, but does not define concurrency ownership.
- **Decision:** Store the confirmed source object key in the private `avatar_upload_key` user column. A worker updates the avatar only when that key still matches its job, and clears it atomically with the update. A duplicate completed job is a no-op; a stale job cannot replace a newer confirmed upload.
- **Consequences:** One internal nullable column is added. Processing remains last-confirmed-upload-wins, and cleanup only occurs after a conditional update succeeds.

## ADR-024: Published match edit boundary

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** Phase 2 requires fields to become restricted after publication and explicitly requires schedule and stadium changes to remain possible with participant notification, but does not enumerate the complete editable set.
- **Decision:** While a match is `PUBLISHED` or `FULL`, permit only title, capacity, start time, duration, and venue/address/coordinate edits. Keep format, city, money, surface, level, join mode, and player requirements immutable, and reject edits after the match starts or is cancelled.
- **Consequences:** Material rules and pricing cannot change under confirmed participants. Owners may correct public presentation, capacity, timing, and venue; capacity remains bounded by computed occupancy, and schedule/venue changes create notification records.

## ADR-021: Exact-size signed avatar PUTs

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** S3 presigned PUT URLs do not support a POST-policy-style range condition. The flow must remain raw PUT and enforce a 5 MB cap during presign and confirm.
- **Decision:** The client declares its positive byte size (maximum 5 MB); the server signs that exact `Content-Length` into the PUT request. Confirmation independently checks the stored object's actual size.
- **Consequences:** Clients must send the declared `Content-Length`; altered sizes invalidate the signature, and oversized stored objects are rejected again at confirmation.

## ADR-022: Phase-1 public profile stat placeholders

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** PLAN.md requires public profile statistics but does not enumerate their exact fields; Phase 3 will supply real attendance and reputation data.
- **Decision:** Establish `matchesPlayed`, `goals`, `assists`, `attendancePercent`, `rating`, and `ratingsCount`. Counts are zero and not-yet-computable aggregates are null in Phase 1.
- **Consequences:** Clients can build against a stable stats object now; Phase 3 fills values without changing its shape.

## ADR-023: In-memory web access tokens with cookie-backed refresh

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** The browser needs a 15-minute access token for API calls, but persistent JavaScript-readable storage such as `localStorage` exposes bearer tokens to later XSS exfiltration. The rotating refresh token is already an httpOnly, narrowly scoped cookie.
- **Decision:** Keep the access token only in the web application's module memory. After a reload or on the first protected request, perform a single-flight `POST /api/auth/refresh` using the httpOnly cookie. On an authenticated request returning `UNAUTHORIZED`, refresh once and retry once; never persist the access token in browser storage.
- **Consequences:** Reloads require one refresh request and concurrent callers share it. Closing the page discards the access token, while the server-controlled refresh cookie restores a session without exposing either token to persistent JavaScript storage.

## ADR-025: Half-open match time windows

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** P2-03 forbids confirmed participation in overlapping matches but does not define whether touching time boundaries overlap.
- **Decision:** Treat match windows as half-open intervals `[startsAt, startsAt + durationMin)`. A match ending exactly when another begins does not overlap.
- **Consequences:** Back-to-back matches are permitted; every overlap query must use strict start-before-other-end comparisons.

## ADR-026: Explicit waitlist promotion state

- **Date:** 2026-07-22
- **Status:** Accepted
- **Context:** P2-04 requires promoted waitlist parties to confirm within 30 minutes. The existing `PENDING` participant status is generic and does not identify a timed seat offer or its owning expiry job.
- **Decision:** Add `PENDING_CONFIRMATION` to the shared `ParticipantStatus` contract and Prisma enum, with a nullable `promotionExpiresAt` timestamp on `MatchParticipant`. `WAITLISTED` rows retain their FIFO position; promotion changes only the status and expiry, and confirmation clears both the expiry and position.
- **Consequences:** Promotion expiry can compare both state and timestamp for idempotency. Pending offers remain distinct from manual join requests, and contracts remain the status source of truth.

### Seat holding during confirmation

- **Decision:** An unexpired `PENDING_CONFIRMATION` party holds `1 + guestCount` seats for new-join admission. Under the existing match-row lock, a new join is admitted only when its party fits after subtracting both confirmed occupancy and holds whose `promotionExpiresAt` is strictly in the future. Expired timestamps release their hold immediately, even before the expiry job processes the row. Confirmation itself continues to validate against confirmed occupancy so a party does not count its own hold twice.
- **FULL vs PUBLISHED:** Keep the match `PUBLISHED` while confirmed occupancy is below `totalSlots`, even when confirmed occupancy plus active holds reaches capacity. `FULL`, `occupiedSlots`, and `freeSlots` remain based exclusively on `CONFIRMED` participants; changing status based on holds would make browsing responses internally contradictory. Active holds are an admission constraint, not canonical occupancy.
- **Consequences:** Outsiders cannot steal an offered party's seats during its confirmation window, late expiry processing cannot strand capacity, and the public occupancy fields keep their established meaning.

## ADR-027: Invitation acceptance and consumption

- **Date:** 2026-07-23
- **Status:** Accepted
- **Context:** P2-05 defines named in-app invitations and shareable token links, but does not specify separate acceptance routes or whether a shareable link may admit multiple users.
- **Decision:** A named invitee accepts through the standard match join endpoint without receiving the secret token. A share-link holder accepts through an authenticated token endpoint, which delegates to the same locked join transaction. Every invitation row admits at most one participant and becomes `ACCEPTED` atomically with seating. Tokens are 256-bit opaque random values and are returned only by the private mint endpoint.
- **Consequences:** Named tokens never need to reach public clients, share links are bearer secrets and single-use, and capacity/requirements/overlap checks cannot be bypassed.

## ADR-028: Seed-only direct state materialization

- **Date:** 2026-07-23
- **Status:** Accepted
- **Context:** Demonstration data must span match states while the seed runs outside the application dependency graph and must not enqueue delayed jobs or notifications.
- **Decision:** The Prisma seed may materialize canonical Phase-2 match and participant states directly, solely for stable `phase2-*` fixtures. It must not seed Phase-3-only states, and every rerun replaces participant fixtures before recreating them so occupancy cannot drift.
- **Consequences:** Runtime code still changes status only through `MatchStateService`; seed fixtures are deterministic database setup rather than domain actions.

## ADR-029: Anonymous invite-only match shell

- **Date:** 2026-07-23
- **Status:** Accepted
- **Context:** Invite-only match details must not be exposed by the unauthenticated public API, but a human following a match link still needs a valid page and an invitation-only state. Phase 4 will formalize indexing policy.
- **Decision:** `GET /matches/:slug` returns a discriminated, reduced shell for published invite-only matches containing only the match ID, slug, title, city, format, start time, status, and invitation-only mode. The SSR page marks this shell `noindex, nofollow` and renders no venue, price, requirements, participants, owner controls, contact surface, or invitation token. Full invite-only details remain unavailable without a future authenticated member endpoint.
- **Consequences:** Shared links resolve to a useful privacy-safe page for anonymous visitors, public listings continue to exclude invite-only matches, and Phase 4 can apply its index policy without changing the shell contract.

## ADR-030: Early-cancellation boundary is non-penalizing

- **Date:** 2026-07-23
- **Status:** Accepted
- **Context:** P3-01 says leaving at least N hours before kickoff creates no attendance record, while leaving less than N hours before creates `CANCELLED_EARLY`.
- **Decision:** A departure exactly N hours before `startsAt` creates no record. Only departures strictly later than the cutoff create `CANCELLED_EARLY`.
- **Consequences:** Equality follows the specification's `≥ N` wording and conservatively avoids reputation damage.

## ADR-031: Unresolved disputes retain escalation state at finalization

- **Date:** 2026-07-23
- **Status:** Accepted
- **Context:** P3-02 requires every record to finalize at 72 hours or on resolution, while also allowing unresolved disputes to escalate to an admin.
- **Decision:** At 72 hours, finalize an unresolved record but retain `disputeStatus = OPEN`. After that point only an admin may resolve it; owner/assistant resolution is closed. An admin resolution amends the status and keeps the record finalized.
- **Consequences:** The explicit finalization deadline is honored without losing escalation state. P3-04 must recompute affected stats after an admin overturns a finalized record.

## ADR-032: Rating report scope and delete-then-re-rate identity

- **Date:** 2026-07-23
- **Status:** Accepted
- **Context:** P3-09 requires a report row usable by Phase-5 moderation but does not define a generic multi-target report schema or who may report public comments. P3-03 also combines soft deletion with a uniqueness constraint and explicitly supports delete-then-re-rate.
- **Decision:** Model P3-09 reports narrowly as rating-comment reports with `ratingId`, authenticated `reporterId`, a trimmed non-empty reason capped at 500 characters, and a unique reporter/rating pair. Any authenticated user may report a visible rating; match participation is not required. Soft-deleting a rating sets `deletedAt` and `REMOVED`; a later re-rate revives the same unique row with replacement scores, comment, status, and creation timestamp.
- **Consequences:** Three-report auto-hide cannot be inflated by one account, Phase 5 has durable reporter and reason data, public moderation is not restricted to former teammates, and delete-then-re-rate works without weakening database uniqueness or retaining multiple current identities for one pair.

## ADR-033: Reputation aggregate precision and badge denominators

- **Date:** 2026-07-23
- **Status:** Accepted
- **Context:** P3-04 fixes the reputation formulas but does not specify persisted decimal scale or rounding. P3-05 defines an organizer cancellation percentage without defining which owned matches count as organized, and guest no-shows must reflect on their inviter despite guests having no attendance record.
- **Decision:** Perform every aggregate with Prisma `Decimal`, then round persisted percentages and averages half-up to two decimal places (`attendancePct` as `Decimal(5,2)`, rating averages as `Decimal(3,2)`). Count every finalized attendance record in `matchesPlayed` and in the attendance-percentage denominator, including `REMOVED_BY_OWNER`; add `guestNoShowCount` to the inviter's materialized `noShow` count without adding synthetic attendance records to the percentage denominator. Count every non-draft, non-deleted owned match as organized, and use cancelled matches within that same set as the Trusted Organizer numerator.
- **Consequences:** Read paths receive stable display-ready decimals without binary floating-point drift. Guest conduct can prevent Perfect Attendance without altering the canonical record-based attendance formula. Drafts do not inflate organizer history, while published matches that are later cancelled remain visible in its cancellation rate.

## ADR-034: Finished-match retention anchor and sitemap staging

- **Date:** 2026-07-23
- **Status:** Accepted
- **Context:** P4-10 requires finished matches to remain live for at least 30 days and then return 410, but the current match model has no status-transition timestamp. It also requires city and stadium sitemap partitions while P4-09, which creates those landing pages, is explicitly owned by another implementation.
- **Decision:** Anchor the retention window to the scheduled match end (`startsAt + durationMin`), and expire finished lifecycle statuses at the exact 30-day boundary. Publish all five sitemap partitions now, but keep the city and stadium partitions empty until their P4-09 pages exist; never advertise known 404 URLs.
- **Consequences:** Retention is deterministic without a schema migration, rescheduling before kickoff moves the anchor naturally, and sitemap indexes can be deployed independently of landing pages without directing crawlers to nonexistent content.

## ADR-035: Shared dynamic segment for landings and detail pages

- **Date:** 2026-07-25
- **Status:** Accepted
- **Context:** P4-09 specifies both a city landing at `/[locale]/matches/[city]` and a match page at `/[locale]/matches/[slug]`, and both a city-stadiums landing at `/[locale]/stadiums/[city]` and a stadium page at `/[locale]/stadiums/[slug]`. Next.js App Router cannot declare two different dynamic parameters at the same path position, so `matches/[city]` and `matches/[slug]` (and the stadium pair) collide as routes. It also specifies SSG/ISR for landings, but the web build runs without the API reachable (the repo convention, established by the `/matches` discovery page, is `force-dynamic` to avoid build-time API coupling).
- **Decision:** Serve each colliding pair from a single dynamic segment and disambiguate at request time by exact city-slug match: in `/[locale]/matches/[slug]` and `/[locale]/stadiums/[segment]`, if the segment equals a known city slug it renders the landing, otherwise the detail page (404 if neither). This is unambiguous because match and stadium slugs are minted with a trailing id suffix (`…-{city}-{idSuffix}`) and can never equal a bare city slug. Landings are `force-dynamic` server-rendered (fresh every request, which satisfies the ≤5-minute freshness requirement) rather than ISR-prerendered, keeping the build free of any live-API dependency. These pages fulfil the deferred condition in ADR-034, so the city and stadium sitemap partitions now resolve to live URLs.
- **Consequences:** The spec's exact URLs are preserved without a routing conflict; the cities loader is memoized with `cache()` so `generateMetadata` and the page share one fetch; landings lose static caching in exchange for a build that never contacts the API and full SSR HTML for crawlers. A future move to true ISR would require splitting the segments onto non-colliding paths.

## ADR-036: Latin slugs with Cyrillic transliteration

- **Date:** 2026-07-25
- **Status:** Accepted
- **Context:** P4-11 requires a decision on how uz ⇄ uz-Cyrl affects slugs. A match or stadium is one entity across four locales, and its public URL must be stable and shareable regardless of the visitor's locale. Names may be entered in Uzbek Cyrillic, but the previous `slugify` only kept `[a-z0-9]`, so a Cyrillic name collapsed to the `stadium` fallback.
- **Decision:** Slugs are always Latin and there is a single canonical slug per entity across all locales — never a per-locale or Cyrillic slug. Slug generation first transliterates Uzbek Cyrillic to Latin (`transliterateUzCyrlToLatin` in `apps/api/src/common/slug.ts`), then lowercases, drops modifier letters (`gʻ`→`g`, `oʻ`→`o`), and replaces any remaining non-alphanumerics with hyphens. The same shared `slugify` is used by stadium creation; match slugs already derive from the (Latin) city slug plus format, date and id suffix. The locale switcher preserves the full current URL (path and query), so switching locale keeps the same slug and active filters.
- **Consequences:** URLs are locale-independent and stable; a Cyrillic-entered stadium name now yields a meaningful Latin slug (e.g. `Миллий` → `milliy`) instead of a fallback; there is no slug migration when a user changes their display locale. Transliteration is unit-tested (`slug.spec.ts`) per the phase's mandatory tests.

## ADR-037: MVP notification types are the closed set; manager-awareness events are deferred

- **Date:** 2026-07-25
- **Status:** Accepted
- **Context:** P5-01 wires the `notify()` service into the Phase 2–3 `TODO(notify)` markers. The phase file's Part A defines exactly 15 MVP notification types, but the prose task list also gestures at notifying managers when a participant joins an AUTO match, when a promoted party confirms, and when a participant leaves, plus notifying a participant that they were removed. None of these four events has a matching type in the 15-value set, and the hard rule keeps `Notification.type` validated against `NotificationTypeSchema` — inventing new types would expand Phase 5's agreed scope.
- **Decision:** Treat the 15 MVP types as the closed contract for this phase. Wire every `TODO(notify)` whose event maps cleanly to a type (`JOIN_REQUEST_RECEIVED`, `JOIN_APPROVED`/`JOIN_REJECTED`, `MATCH_INVITE`, `WAITLIST_PROMOTED`, `MATCH_UPDATED`, `ATTENDANCE_MARKED`). Do not emit a notification for the four manager-awareness / removed-participant events that lack a type; leave an inline comment referencing this ADR at each site instead of a bare TODO. The rating auto-hide signal stays deferred to P5-08 (moderator queue), as noted in the handoff.
- **Consequences:** The String `type` column can never diverge from the contract, and the notification sweep in P5-02/P5-03 covers a well-defined set. If product later wants "someone joined/left your match" or "you were removed" notifications, that is a deliberate type-set extension (new enum values + payload schemas + i18n keys) rather than an accidental one, and the commented call sites mark exactly where to add them.

## ADR-038: SSE authenticated by access token in the query string

- **Date:** 2026-07-26
- **Status:** Accepted
- **Context:** P5-02 needs a live notification stream (ADR-004 chose SSE). The browser `EventSource` API cannot set request headers, so the standard `Authorization: Bearer <access>` scheme the REST API uses is unavailable on the stream endpoint. The only credentials `EventSource` transmits automatically are cookies, and the app's only cookie is the httpOnly refresh token — which the access guard deliberately does not accept.
- **Decision:** Authenticate `GET /me/notifications/stream` with the short-lived (15-min) access token passed as a `?token=` query parameter, verified by a dedicated `SseAuthGuard` that otherwise mirrors `AuthGuard` (signature, `type === 'access'`, user existence, suspend/ban checks). The web client fetches a fresh token via `apiClient.ensureAccessToken()` immediately before opening the stream and reconnects with a new token on error, so an expired token never persists in a long-lived URL.
- **Consequences:** The stream works within `EventSource`'s constraints without exposing a long-lived credential. The access token can appear in server/proxy access logs for the stream request; this is bounded by its 15-minute lifetime and is an accepted MVP trade-off. Moving to WebSocket later (ADR-004's escape hatch) would allow header-based auth and supersede this. In-app delivery and the unread badge do not depend on the stream — they resync over REST — so a blocked or dropped stream degrades to poll-on-open rather than breaking the centre.

## ADR-039: Push localized at send time; reminders are match-level

- **Date:** 2026-07-26
- **Status:** Accepted
- **Context:** P5-03 adds Web Push and 24h/2h reminders. Two questions arise. (1) The in-app centre renders notification text from `type` at display time so a locale switch re-localizes history (ADR from P5-02), but a Web Push notification is drawn by the service worker, which has no next-intl runtime and fires when the app may not be open. (2) The phase prose says reminders are "cancel on cancel/leave", yet a reminder is one event delivered to many participants.
- **Decision:** Localize push text on the server at send time using the recipient's stored `User.locale`, drawing on the **same** templates the web uses — the `notifications` namespace now lives in the shared `@futzone/i18n` package, consumed by the web (merged into its catalogs) and by the API (`push-content.ts`). The service worker just renders the `title`/`body` it receives. Reminders are scheduled per match (24h and 2h before `startsAt`), (re)scheduled on publish and on schedule edits, and cancelled on match cancellation; a window already in the past is skipped. "Leave" needs no reminder cancellation because the reminder job notifies only participants still `CONFIRMED` at fire time, and it is idempotent (recipients who already received that reminder are skipped on retry).
- **Consequences:** Push text matches the user's chosen language without the service worker needing an i18n runtime, and there is a single source of notification copy. Changing locale after a push was delivered does not retro-localize that OS notification (unavoidable and expected), while the in-app centre entry for the same event still re-localizes. Reminders never double-send and naturally exclude players who left. VAPID keys are optional config: with them unset, push is disabled and only in-app/SSE delivery runs.
