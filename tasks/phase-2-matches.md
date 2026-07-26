# Phase 2 — Matches: creation, state machine, join flows, guests, waitlist

**Goal:** The core product loop — create a match, publish it, players join (auto/manual/invite), guests counted, waitlist when full. This is the highest-risk phase; the concurrency rules here are the most important code in the product.

**Prerequisites:** Phase 1 complete.

> **Note on notifications:** real delivery ships in Phase 5. Wherever this phase says "notification hook, stubbed", write the in-app Notification row via a placeholder call and mark the site with a `TODO(notify)` comment — Phase 5 (P5-01) greps for this marker.

## Data model (Prisma)

```prisma
model Stadium {
  id, slug, nameUz/nameRu/nameEn, cityId, district, address,
  location  Unsupported("geography(Point,4326)"),
  surface   Surface   // GRASS ARTIFICIAL INDOOR
  photos    String[]
  status    StadiumStatus @default(PENDING) // PENDING APPROVED REJECTED
  createdById, createdAt
}

model Match {
  id, slug @unique,          // e.g. toshkent-5x5-21-iyul-1900-ab3f
  ownerId, title,
  format      String         // "5x5".."11x11"
  totalSlots  Int            // derived from format at creation, editable down to current occupancy
  startsAt    DateTime       // UTC
  durationMin Int
  cityId, stadiumId?,        // stadiumId OR freeform address+coords
  address?, location?,
  fieldPriceUzs Int, perPlayerFeeUzs Int,
  surface Surface, level Level,   // BEGINNER AMATEUR INTERMEDIATE STRONG
  joinMode JoinMode,              // AUTO MANUAL INVITE_ONLY
  // requirements (all optional):
  minRating Decimal?, minAttendancePct Int?, allowNewPlayers Boolean @default(true),
  neededPositions Position[], ageGroup AgeGroup @default(MIXED), verifiedPhoneOnly Boolean @default(false),
  status MatchStatus @default(DRAFT),
  cancelledReason?, createdAt, deletedAt?
}

model MatchParticipant {
  id, matchId, userId,
  role   ParticipantRole    // OWNER ASSISTANT PLAYER
  status ParticipantStatus  // PENDING CONFIRMED DECLINED LEFT REMOVED WAITLISTED
  guestCount Int @default(0)
  waitlistPosition Int?
  joinedAt, leftAt?
  @@unique([matchId, userId])
}

model JoinRequest { id, matchId, userId, message?, status (PENDING|APPROVED|REJECTED|WITHDRAWN), decidedById?, decidedAt?, createdAt }
model Invitation { id, matchId, inviterId, inviteeId?, token @unique, status (PENDING|ACCEPTED|DECLINED|EXPIRED), expiresAt }
```

## Canonical rules

1. **Occupancy** = Σ `(1 + guestCount)` over participants with status `CONFIRMED`. Never stored. Exposed as computed field on every match response (`occupiedSlots`, `freeSlots`).
2. **Every seat mutation** (join, approve, leave, remove, guestCount change, totalSlots edit) runs in one transaction: `SELECT ... FOR UPDATE` on the match row → recompute occupancy → validate → write → if occupancy hit/left `totalSlots`, transition FULL/PUBLISHED via `MatchStateService` in the same transaction.
3. **State machine** (`MatchStateService`, the only mutator of `match.status`):
   - `DRAFT → PUBLISHED` (owner action; validates required fields)
   - `PUBLISHED ⇄ FULL` (automatic, from rule 2)
   - `PUBLISHED|FULL → STARTED` (BullMQ scheduled job at `startsAt`, or owner manual)
   - `STARTED → FINISHED` (job at `startsAt + durationMin`, or owner manual)
   - `FINISHED → ATTENDANCE_PENDING → RATING_PENDING → COMPLETED` (Phase 3 wires the last two)
   - `DRAFT|PUBLISHED|FULL → CANCELLED` (owner or admin, reason required)
   - Anything else throws `INVALID_MATCH_TRANSITION`.

## Tasks

- [x] **P2-01 Stadiums module.** CRUD for user-submitted stadiums (created as `PENDING`; only `APPROVED` appear publicly — admin approval UI comes in Phase 5, an API-level approve endpoint guarded to ADMIN role ships now). `GET /stadiums?city=` list. Seed stays approved.
- [x] **P2-02 Match create/edit (API).** `POST /matches` (creates DRAFT), `PATCH /matches/:id` (owner; editable fields restricted once PUBLISHED — startsAt/stadium changes after publish trigger participant notification hooks, stubbed until Phase 5), `POST /matches/:id/publish`, `POST /matches/:id/cancel`. Slug generation: `{city}-{format}-{date}-{time}-{shortid}`. Owner options at creation: `ownerPlays: boolean`, `ownerGuestCount: number` → creates the OWNER participant row (CONFIRMED, guestCount) inside the same transaction.
- [x] **P2-03 Join flow (API).** `POST /matches/:id/join {guestCount, message?}`:
    1. lock match row; 2. check status is PUBLISHED; 3. check user has no other CONFIRMED participation overlapping the same time window (`OVERLAPPING_MATCH` error); 4. check owner requirements (minRating/minAttendancePct read from Phase-3 fields — until Phase 3 lands they are null and skipped; verifiedPhoneOnly, allowNewPlayers enforced now); 5. AUTO → CONFIRMED (capacity permitting) ; MANUAL → JoinRequest PENDING; INVITE_ONLY → reject without valid invitation; 6. if capacity would be exceeded → offer waitlist (`MATCH_FULL` + `waitlistAvailable: true`).
    Also: `POST /matches/:id/leave`, `PATCH /matches/:id/participants/me {guestCount}` (re-validates capacity), owner endpoints `POST .../participants/:userId/remove`, `POST .../requests/:id/approve|reject` (approve re-runs the full capacity check).
- [x] **P2-04 Waitlist.** `POST /matches/:id/waitlist` (join queue, FIFO with `waitlistPosition`), leave-waitlist. When a CONFIRMED seat frees while FULL: promote the first waitlisted user whose `1+guestCount` fits → their status becomes CONFIRMED **only after they confirm within 30 min** (notification hook, stubbed to in-app record until Phase 5) — auto-promote directly for MVP if simpler: **decision:** MVP promotes to `PENDING_CONFIRMATION` with 30-min TTL job; on expiry, next in line. Skipped users keep their position.
- [x] **P2-05 Invitations.** Owner invites by username (in-app) or shareable token link `futzone.uz/join/{token}` (7-day expiry). Accepting runs the standard join transaction. Invitee joining an INVITE_ONLY match must hold a valid invitation.
- [x] **P2-06 Owner requirements & warning card.** On MANUAL requests, owner sees requester summary: attendance %, last-5 rating average, no-show count (all null-safe pre-Phase-3 → shows "New player"). A warning banner renders when attendance < 70% or avg < 3.0 — informational only, decision stays with the owner.
- [x] **P2-07 Assistant role.** `POST /matches/:id/assistants {userId}` (must be a CONFIRMED participant; max 2). Assistants get owner powers except: cancel match, edit price, remove owner, assign assistants.
- [x] **P2-08 Scheduled transitions.** BullMQ delayed jobs on publish: `match.start` at `startsAt`, `match.finish` at end. Rescheduled on edit; cancelled on cancel. Jobs idempotent (check current status first).
- [x] **P2-09 Web: match creation wizard.** Multi-step: (1) basics — title, format (slots auto-computed, shown), level, surface; (2) when & where — date/time, city, stadium picker with Yandex Map + free-address fallback, map pin; (3) money — field price, per-player fee (auto-suggest = fieldPrice / totalSlots, editable); (4) rules — joinMode, requirements, ownerPlays + guest count; (5) review → publish (or save draft).
- [x] **P2-10 Web: match page.** SSR page `/[locale]/matches/[slug]`: all match info, map, participant list (avatars, positions; guests shown as "+N with {username}"), occupancy bar, contextual CTA (Join / Request / Waitlist / Leave / Full / Invited-only / Cancelled banner), owner panel (edit, publish, cancel, requests inbox, participant management, invite dialog).
- [x] **P2-11 Web: matches list (basic).** `/[locale]/matches` — city + date chips (Today/Tomorrow/This week), card grid with occupancy, price, level, time. (Full filter/sort engine comes in Phase 4 — build the card + list shell now.)
- [x] **P2-12 Seed matches.** ~15 matches across statuses, formats, join modes, with participants/guests/waitlists.

## Acceptance criteria

- A user can create → publish → another user joins (auto) → match fills → third user waitlists → someone leaves → waitlisted user is promoted (pending-confirmation flow) — all through the web UI.
- MANUAL flow: request → owner sees summary card → approve/reject works; approve on a now-full match fails cleanly with `MATCH_FULL`.
- Overlapping-time join is rejected.
- Cancelling a match cancels its scheduled jobs.

## Mandatory tests

- **Concurrency (non-negotiable):** e2e firing 10 parallel joins (some with guests) at a match with 3 free slots — assert occupancy never exceeds `totalSlots`, losers get `MATCH_FULL`. Run 20 iterations in CI.
- Unit: full state-machine transition table (valid + invalid); occupancy computation incl. owner + guests; waitlist promotion ordering incl. skip-when-doesnt-fit.
- e2e: join/leave/guest-edit capacity re-validation; invitation token expiry; assistant permission matrix.
