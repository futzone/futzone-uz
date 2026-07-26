# Futzone

Community platform for amateur football players in Uzbekistan (futzone.uz). Find a game to
join, fill your own game with reliable players, and know who you can trust — through attendance
tracking and multi-criteria peer reputation.

**Languages:** Uzbek (Latin), Uzbek (Cyrillic), Russian, English · **Primary market:** Tashkent → Uzbekistan.

> The core value is the trust system: every match produces attendance records and peer ratings,
> which feed player reputation, which organizers use to accept or reject join requests. It is
> **not** a classifieds board.

## Status

MVP feature-complete — Phases 1–5 implemented (auth & profiles, matches & participation,
attendance & ratings, discovery & SEO, notifications & admin panel). See `PLAN.md` for the
product spec and `tasks/` for the per-phase breakdown.

## Tech stack

| Area | Choice |
| --- | --- |
| Frontend | Next.js (App Router) + TypeScript, Tailwind CSS |
| Backend | NestJS + TypeScript (REST, OpenAPI) |
| Database | PostgreSQL 16 + PostGIS |
| ORM | Prisma |
| Cache / queues | Redis + BullMQ |
| Realtime | Server-Sent Events |
| File storage | S3-compatible (MinIO locally) |
| Notifications | Web Push (VAPID), SMS (OTP) |
| Monorepo | Turborepo + pnpm |

## Repository layout

```
apps/
  api/        NestJS API (auth, matches, attendance, ratings, notifications, admin)
  web/        Next.js public site + PWA (4 locales)
  admin/      Next.js admin panel (ADMIN/MODERATOR, Russian)
packages/
  contracts/  Zod schemas shared by API + clients (single source of DTO truth)
  i18n/        Shared message catalogs
  ui/          Shared UI components (shadcn/ui based)
  config/      Shared tsconfig / eslint presets
infrastructure/ Docker Compose for Postgres, Redis, MinIO, Mailpit, mock SMS
tasks/          Phase-by-phase implementation specs
PLAN.md         Product & architecture master plan
CLAUDE.md       Coding conventions & hard rules
DECISIONS.md    Architecture decision records (ADRs)
```

## Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io) 9+
- Docker (for the local infrastructure)

## Quick start

```sh
# 1. Install dependencies
pnpm install

# 2. Environment files (edit as needed)
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env

# 3. Start infrastructure (Postgres, Redis, MinIO, Mailpit, mock SMS)
pnpm run docker:up

# 4. Apply migrations and seed demo data
pnpm --filter @futzone/api exec prisma migrate deploy
pnpm run db:seed

# 5. Run everything in watch mode (api + web + admin)
pnpm dev
```

### Ports

| Service | URL |
| --- | --- |
| Web (public site) | http://localhost:3000 |
| Admin panel | http://localhost:3001 |
| API | http://localhost:4000 |
| API docs (Swagger) | http://localhost:4000/docs |
| MinIO console | http://localhost:9001 |
| Mailpit (email) | http://localhost:8025 |

Infra host ports (Postgres 5432, Redis **6380**, MinIO 9000/9001, Mailpit 1025/8025, mock SMS
4010) are documented in `infrastructure/README.md` and overridable via `.env`.

## Signing in (local)

Auth is phone + OTP. In development the SMS provider is a mock that logs each code — read it with:

```sh
docker logs -f futzone-mock-sms
```

Enter a phone number in the web/admin login, then copy the printed `OTP` code.

### Seeded accounts

`pnpm run db:seed` creates 20 demo players with phones `+998990000001` … `+998990000020`.
To exercise the admin panel, promote a couple of accounts to staff roles:

```sh
DATABASE_URL="postgresql://futzone:futzone_dev_password@localhost:5432/futzone?schema=public" \
  pnpm --filter @futzone/api exec tsx -e "import{PrismaClient}from'./src/generated/prisma';const p=new PrismaClient();await p.user.update({where:{phone:'+998990000001'},data:{role:'ADMIN'}});await p.user.update({where:{phone:'+998990000002'},data:{role:'MODERATOR'}});await p.\$disconnect()"
```

The admin panel (http://localhost:3001) accepts only `ADMIN` / `MODERATOR` accounts.

## Testing

```sh
pnpm turbo typecheck lint test    # types, lint, unit tests (all packages)
pnpm --filter @futzone/api run test:e2e   # API end-to-end (needs infra running)
```

The API e2e suite runs against a live `futzone_test` database:

```sh
DATABASE_URL="postgresql://futzone:futzone_dev_password@localhost:5432/futzone_test?schema=public" \
  pnpm --filter @futzone/api exec prisma migrate deploy
```

## Documentation

- **`PLAN.md`** — product summary, domain model, privacy rules, phase roadmap
- **`CLAUDE.md`** — coding conventions and non-negotiable rules
- **`DECISIONS.md`** — architecture decision records
- **`tasks/`** — self-contained phase specs (each maps to a set of commits)
