# CLAUDE.md — Agent rules for Futzone

Rules for any AI agent working in this repository. Read `PLAN.md` first for product context. Work on exactly one phase file from `tasks/` at a time, in order.

## Workflow

1. Read the assigned `tasks/phase-N-*.md` fully before writing code.
2. Implement tasks in the listed order — later tasks assume earlier ones.
3. After each task: run typecheck, lint, and the relevant tests before moving on.
4. Do not start a task from a later phase, even if it seems easy. Flag gaps instead.
5. If a spec detail is ambiguous, check `PLAN.md` §4 (domain model) and §5 (privacy). If still ambiguous, make the conservative choice, and record it in `DECISIONS.md` at repo root.
6. Update the phase file's checklist (`[ ]` → `[x]`) as you complete tasks.

## Hard rules (never violate)

- **Seat capacity is computed, never stored.** All join/leave/guest mutations go through a transaction that locks the match row and recomputes occupancy. (PLAN.md §4)
- **Match status changes only through `MatchStateService`.** Invalid transitions throw.
- **Phone numbers never leave the backend** except to the SMS provider and to the owning user's own profile-settings endpoint.
- **All admin/moderator mutations write an AuditLog row** in the same transaction.
- **Ratings:** only mutual match participants, one per pair per match, no self-rating, only after `RATING_PENDING`. Aggregates are Bayesian; <3 ratings renders "New player".
- **Money values** are stored as integer UZS (no floats).
- **Dates/times** are stored UTC; match-local display uses the stadium's timezone (Asia/Tashkent for MVP, but keep the column).
- No `any` in TypeScript except in test fixtures with a comment. No skipped tests committed.

## Code conventions

- **API:** NestJS modules mirror the domain list in PLAN.md §4. DTOs validated with zod via `packages/contracts` — the same schemas type the frontend client. REST, plural nouns (`/matches/:id/participants`), OpenAPI decorators mandatory.
- **DB:** Prisma schema is the single source of truth. Every schema change = a committed migration. Table/column names snake_case via `@@map`. Soft-delete (`deletedAt`) for User, Match, Rating, Comment; hard delete only via admin purge jobs.
- **IDs:** UUIDv7 primary keys. Public URLs use slugs for matches/stadiums, usernames for profiles.
- **Errors:** typed error codes (`MATCH_FULL`, `ALREADY_JOINED`, `RATING_WINDOW_CLOSED`, ...) in `packages/contracts`; the frontend maps codes to localized messages — never display raw backend messages.
- **Frontend:** App Router with server components by default; client components only for interactivity. All strings through next-intl keys — no hardcoded user-facing text in any locale.
- **Tests:** Vitest (unit, packages + web), Jest + Supertest (api e2e), one Playwright smoke flow per phase. Business rules listed under "Mandatory tests" in each phase file are non-negotiable.
- **Queues:** every BullMQ job idempotent (safe to re-run); job names in `packages/contracts`.
- **Commits:** conventional commits, one logical change per commit, reference the task ID (e.g. `feat(matches): P2-04 waitlist promotion`).

## Security defaults

- OTP: 6 digits, 2-min expiry, max 5 verify attempts, per-phone and per-IP rate limits (Redis), constant-time compare.
- Sessions: short-lived JWT access (15 min) + rotating refresh token (httpOnly cookie); refresh reuse detection revokes the family.
- Standard guards: helmet, CORS allowlist, global rate limiting, input size limits, file-type sniffing on uploads.
- Authorization is resource-based: e.g. only `OWNER`/`ASSISTANT` participants mark attendance; checks live in guards/policies, not controllers.

## Definition of done for any task

Code + migration + tests + i18n keys + OpenAPI updated + seed data updated (when the feature is demo-able) + checklist ticked.
