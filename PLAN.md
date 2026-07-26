# Futzone — Master Implementation Plan

> **Purpose of this document set:** This is the entrypoint for AI coding agents (Claude Code, Cursor, etc.) building Futzone. Read this file first, then `CLAUDE.md` for coding conventions, then execute phase files in `tasks/` in order. Each phase file is self-contained and sized to be given to an agent as a unit of work.

## 1. Product summary

Futzone (futzone.uz) is a community platform for amateur football players in Uzbekistan. It solves three problems: finding a game to join, filling your own game with reliable players, and knowing who you can trust — via attendance tracking and multi-criteria reputation.

It is **not** a classifieds board. The core value is the trust system: every match produces attendance records and peer ratings, which feed player reputation, which owners use to accept or reject join requests.

**Languages:** `uz` (Latin), `uz-Cyrl`, `ru`, `en`. **Primary market:** Uzbekistan cities, starting with Tashkent.

## 2. Tech stack (decided)

| Area | Choice | Notes |
| --- | --- | --- |
| Frontend | Next.js (App Router) + TypeScript | SSR for public match pages (SEO-critical) |
| UI | Tailwind CSS + shadcn/ui | |
| Backend | NestJS + TypeScript | REST API; OpenAPI spec generated |
| Database | PostgreSQL 16+ | Single primary DB |
| ORM | **Prisma** | Decided (over Drizzle) |
| Geo | PostGIS extension | Distance search, "near me" sort |
| Text search | PostgreSQL FTS + `pg_trgm` | Meilisearch/Elastic only post-scale |
| Cache / queue | Redis + BullMQ | OTP rate limits, notification jobs, reminders |
| File storage | S3-compatible (e.g. MinIO locally) | Avatars, stadium photos, OG images |
| SMS / OTP | Local UZ SMS provider (e.g. Eskiz.uz / Play Mobile) behind a provider-agnostic interface | Mock provider in dev |
| Realtime | SSE first (simpler); WebSocket if needed later | Waitlist promotions, join notifications |
| Maps | **Yandex Maps** | Decided (over OSM); better UZ coverage |
| i18n | next-intl | 4 locales, `hreflang` |
| Monorepo | Turborepo + pnpm workspaces | |
| Admin | Separate Next.js app in monorepo (`apps/admin`) | |
| Monitoring | Sentry + structured JSON logs (pino) | |
| Deploy | Docker Compose + Nginx | CI via GitHub Actions |

## 3. Monorepo layout

```text
futzone/
├── apps/
│   ├── web/          # Next.js public app (players)
│   ├── api/          # NestJS backend
│   └── admin/        # Next.js admin panel
├── packages/
│   ├── ui/           # shared shadcn-based components
│   ├── contracts/    # zod schemas + generated API types, shared FE/BE
│   ├── config/       # eslint, tsconfig, tailwind presets
│   └── i18n/         # message catalogs for uz, uz-Cyrl, ru, en
├── infrastructure/   # docker-compose, nginx, migrations tooling, CI
└── tasks/            # (this planning repo) phase files for agents
```

## 4. Domain model overview

Core entities (full schemas live in the phase files):

- **User** — phone (unique, never public), name, username (unique), avatar, bio, city, position (`GK|DEF|MID|FWD|UNIVERSAL`), locale, phoneVerifiedAt, role (`USER|ADMIN|MODERATOR`), status (`ACTIVE|WARNED|SUSPENDED|BANNED`)
- **Stadium** — name, city, district, address, geo point, surface, photos, status (`PENDING|APPROVED|REJECTED`) — user-submitted, admin-approved
- **Match** — owner, title, format (5x5..11x11), totalSlots, date/time, duration, stadium (or free-text location + coords), pricing (field price, per-player fee), surface, level, joinMode (`AUTO|MANUAL|INVITE_ONLY`), requirements (minRating, minAttendancePct, allowNewPlayers, neededPositions, ageGroup `YOUTH|ADULT|MIXED`, verifiedPhoneOnly), status (state machine below), slug
- **MatchParticipant** — match, user, role (`OWNER|ASSISTANT|PLAYER`), status (`PENDING|CONFIRMED|DECLINED|LEFT|REMOVED|WAITLISTED`), guestCount, joinedAt, waitlistPosition
- **Guest** — belongs to a participant (responsibility chains to the inviter); counted in seat math; no rating of their own
- **JoinRequest / Invitation** — for MANUAL and INVITE_ONLY flows
- **AttendanceRecord** — participant, status (`ON_TIME|LATE|NO_SHOW|CANCELLED_EARLY|EXCUSED|REMOVED_BY_OWNER`), markedBy, disputedAt, disputeResolution
- **Rating** — one per (rater → ratee) per match; criteria: discipline, punctuality, fairPlay, teamPlay, overall (1–5 each) + optional comment; visibility flags for moderation
- **Report / Dispute** — targets a user, comment, or match; moderator workflow
- **Notification** — in-app + push channel records
- **AuditLog** — every admin/moderator action

### Match state machine (canonical — do not deviate)

```text
DRAFT → PUBLISHED ⇄ FULL → STARTED → FINISHED → ATTENDANCE_PENDING → RATING_PENDING → COMPLETED
DRAFT | PUBLISHED | FULL → CANCELLED
```

- `FULL → PUBLISHED` happens when a seat frees up (someone leaves / is removed).
- `STARTED` is triggered by time (scheduled job) or manually by owner.
- Transitions are enforced in **one** service (`MatchStateService`); nothing else mutates `match.status`.

### The #1 business rule — seat capacity

Seat count is **never a stored counter**. Occupied seats = `SUM(1 + guestCount)` over participants with status `CONFIRMED` (owner included if playing). Every join/leave/guest-change runs inside a serializable transaction (or `SELECT ... FOR UPDATE` on the match row) that recomputes occupancy and rejects if it would exceed `totalSlots`. Concurrent joins on the last seat must be race-safe — this is covered by a mandatory concurrency test in Phase 2.

### Reputation rules (canonical)

- Attendance % = share of `ON_TIME + LATE + EXCUSED` (LATE may weigh e.g. 0.5 for the "reliability score") over all finalized attendance records.
- Rating aggregate uses **Bayesian weighted average**: `(C·m + Σratings) / (C + n)` with global mean `m` and confidence constant `C` (start C=5) — so 1×5.0 never outranks 50×4.8.
- Users with < 3 ratings display **"New player"**, never a number.
- Only mutual participants of a `RATING_PENDING`/`COMPLETED` match can rate each other; one rating per pair per match; no self-rating; blocked/removed ratings excluded from aggregates.

## 5. Privacy invariants (apply everywhere)

- Phone numbers are never exposed in any API response, page, or sitemap — contact happens through in-app mechanisms.
- Public profile shows: avatar, name, username, bio, city, position, join date, verified badge, stats, badges, public comments. Nothing else.
- Private/invite-only match details and all personal data are `noindex` and excluded from public API without auth.

## 6. Phase plan

Execute in order. Each file lists prerequisites, deliverables, and acceptance criteria.

| Phase | File | Scope | Key outputs |
| --- | --- | --- | --- |
| 0 | `tasks/phase-0-foundation.md` | Monorepo, Docker, DB, CI, skeleton apps | Running dev environment, empty-but-wired apps |
| 1 | `tasks/phase-1-auth-users.md` | Phone OTP auth, sessions, profiles | Register/login, profile CRUD, avatar upload |
| 2 | `tasks/phase-2-matches.md` | Match CRUD, state machine, join flows, guests, waitlist | The core product loop |
| 3 | `tasks/phase-3-attendance-ratings.md` | Attendance marking, disputes, ratings, badges, reputation | Trust system live |
| 4 | `tasks/phase-4-discovery-seo.md` | Search/filter/sort, PostGIS, i18n, SSR match pages, SEO | Organic acquisition ready |
| 5 | `tasks/phase-5-notifications-admin.md` | Notifications, reminders, admin panel, moderation, audit log | Operable product |
| 6 | `tasks/phase-6-post-mvp.md` | Roadmap only: chat, teams, tournaments, booking, payments, mobile | Not for MVP implementation |

**MVP = Phases 0–5.** Phase 6 is documented so architectural decisions today don't block it, but no Phase 6 code is written for MVP.

## 7. Definition of done (global)

A phase is done only when: all acceptance criteria in its file pass; unit tests cover the listed business rules; e2e happy paths pass; API endpoints appear in the OpenAPI spec; all user-facing strings exist in all 4 locales (English fallback allowed pre-launch, keys must exist); no lint/type errors; and the seed script demonstrates the new features with realistic data.
