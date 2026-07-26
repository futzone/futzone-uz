# Phase 0 — Foundation

**Goal:** A running local dev environment: monorepo, Docker services, empty-but-wired apps, CI, and shared tooling. No product features yet.

**Prerequisites:** none.

## Tasks

- [x] **P0-01 Monorepo scaffold.** Turborepo + pnpm workspaces with `apps/web`, `apps/api`, `apps/admin`, `packages/ui`, `packages/contracts`, `packages/config`, `packages/i18n`. Shared tsconfig/eslint/prettier presets in `packages/config`. Root scripts: `dev`, `build`, `lint`, `typecheck`, `test`.
- [x] **P0-02 Docker dev stack.** `infrastructure/docker-compose.yml` with: PostgreSQL 16 + PostGIS image, Redis 7, MinIO, Mailpit (optional), and a `mock-sms` container (tiny HTTP server that logs OTP codes — dev stand-in for the SMS provider). Healthchecks on all services. `.env.example` for every app.
- [x] **P0-03 NestJS skeleton (`apps/api`).** Nest app with: config module (validated env via zod), Prisma module (Postgres connection, PostGIS enabled via migration `CREATE EXTENSION postgis; CREATE EXTENSION pg_trgm;`), pino structured logging, global exception filter emitting typed error codes, health endpoint `/health` (checks DB + Redis), Swagger/OpenAPI at `/docs` (dev only), global validation pipeline wired to zod DTOs from `packages/contracts`.
- [x] **P0-04 Next.js skeleton (`apps/web`).** App Router, Tailwind + shadcn/ui from `packages/ui`, next-intl wired with the 4 locales (`uz` default, `uz-Cyrl`, `ru`, `en`) and locale-prefixed routing (`/uz/...`), typed API client generated from OpenAPI (or a thin fetch wrapper typed by `packages/contracts`), base layout with header/footer placeholders.
- [x] **P0-05 Admin skeleton (`apps/admin`).** Separate Next.js app, single locale (ru or en), login page placeholder, protected layout shell. No public indexing (global `noindex`, robots disallow).
- [x] **P0-06 Contracts package.** `packages/contracts` exporting: zod schemas namespace (empty for now, structure in place), shared enums (`Position`, `MatchStatus`, `JoinMode`, `AttendanceStatus`, `ParticipantStatus`, `Surface`, `Level`, `AgeGroup`, error-code union), BullMQ job-name constants.
- [x] **P0-07 CI pipeline.** GitHub Actions: install → lint → typecheck → test → build on every PR; Docker image builds for `api`, `web`, `admin` on main. Cache pnpm store. Fail on any warning-level lint escape hatch (`--max-warnings 0`).
- [x] **P0-08 Seed + reset tooling.** `pnpm db:migrate`, `db:seed`, `db:reset` scripts. Seed creates 2 cities (Tashkent, Samarkand) and 3 approved stadiums with real coordinates as fixture data.
- [x] **P0-09 DECISIONS.md** created at root with the stack decisions from PLAN.md §2 recorded as ADR-style entries.

## Acceptance criteria

- `docker compose up` + `pnpm dev` gives: web on :3000, admin on :3001, api on :4000, all healthchecks green.
- `/health` returns DB + Redis status; `/docs` renders.
- Visiting `/uz`, `/ru`, `/uz-Cyrl`, `/en` on web renders the layout in the right locale.
- CI is green on a fresh clone.

## Mandatory tests

- API e2e: health endpoint; one round-trip through a sample zod-validated endpoint (create a throwaway `/ping` DTO to prove the validation pipeline, remove in Phase 1).
