# Phase 3 — Attendance, Ratings & Reputation

**Goal:** The trust system: owners mark attendance, players rate each other, profiles show reputation, owners see it at join time. This is Futzone's moat — correctness over speed.

**Prerequisites:** Phase 2 complete.

> **Note on notifications:** as in Phase 2, mark every notification call site with `TODO(notify)` — Phase 5 wires real delivery.

## Data model (Prisma)

```prisma
model AttendanceRecord {
  id, matchId, participantId @unique,
  status    AttendanceStatus  // ON_TIME LATE NO_SHOW CANCELLED_EARLY EXCUSED REMOVED_BY_OWNER
  markedById, markedAt,
  disputeStatus DisputeStatus? // OPEN UPHELD OVERTURNED
  disputeNote?, disputeResolvedById?, finalizedAt?
}
// Guests do not get records; a guest no-show reflects on the inviter via a
// guestNoShowCount on the inviter's AttendanceRecord (Int @default(0)).

model Rating {
  id, matchId, raterId, rateeId,
  discipline Int, punctuality Int, fairPlay Int, teamPlay Int, overall Int, // 1..5
  comment String? @db.VarChar(500),
  status RatingStatus @default(ACTIVE), // ACTIVE HIDDEN REMOVED
  createdAt
  @@unique([matchId, raterId, rateeId])
}

model UserStats {   // materialized per user, recomputed by worker
  userId @id,
  matchesPlayed, matchesOrganized,
  onTime, late, noShow, cancelledEarly, excused,
  attendancePct Decimal?,      // null until >=1 finalized record
  bayesAvg Decimal?,           // null until >=3 active ratings
  ratingCount, lastFiveAvg Decimal?,
  updatedAt
}

model Badge { id, code @unique, ... }        // static catalog
model UserBadge { userId, badgeCode, awardedAt, @@unique([userId, badgeCode]) }
```

## Canonical rules

- **Attendance window:** opens at `FINISHED` (match → `ATTENDANCE_PENDING`). Owner/assistant marks each participant. When all marked (or 48h passes → unmarked default to `ON_TIME`, never penalize by default), match → `RATING_PENDING`.
- **Early-cancel is automatic:** a participant who leaves ≥ N hours before start (N = 6, config) never gets a record for that match at all; leaving < N hours creates a pre-filled `CANCELLED_EARLY` record. `NO_SHOW` is only ever set by owner/assistant.
- **Disputes:** player gets a notification per record; can dispute within 72h with a note; owner may amend, else escalates to admin (Phase 5 UI; API + status now). Records finalize at 72h or on resolution — only finalized records enter stats.
- **Rating window:** open during `RATING_PENDING`, closes 7 days after finish → match `COMPLETED`. Only participants with a record other than `NO_SHOW`/`REMOVED_BY_OWNER` may rate. One rating per (rater, ratee) per match, no self-rating, immutable after submit (delete+re-rate within window allowed).
- **Aggregation (worker, event-driven + nightly reconcile):**
  - `attendancePct = (onTime + excused + 0.5·late) / totalFinalized · 100`
  - `bayesAvg = (C·m + Σoverall) / (C + n)` with `C = 5`, `m` = global mean of active ratings (recomputed nightly, cached).
  - `HIDDEN`/`REMOVED` ratings and ratings from banned users are excluded.
  - `< 3` active ratings → `bayesAvg = null` → UI shows **"New player"**.

## Tasks

- [x] **P3-01 Attendance API.** Owner/assistant: `GET /matches/:id/attendance` (sheet), `PUT /matches/:id/attendance/:participantId {status, guestNoShowCount?}`. Auto-transition to `RATING_PENDING` when complete; 48h fallback job. Early-leave hook in Phase-2 leave endpoint updated to create `CANCELLED_EARLY` records per the rule above.
- [x] **P3-02 Dispute API.** `POST /attendance/:recordId/dispute {note}` (participant, ≤72h), `POST /attendance/:recordId/resolve {status}` (owner amend or admin), finalization job.
- [x] **P3-03 Ratings API.** `GET /matches/:id/ratable` (who I can rate + already-rated flags), `POST /matches/:id/ratings {rateeId, criteria..., comment?}`, `DELETE` own rating within window. Window-close job → `COMPLETED`.
- [x] **P3-04 Stats worker.** BullMQ consumer on `attendance.finalized` / `rating.changed` events recomputing `UserStats` for affected users; nightly full reconcile job; global-mean cache in Redis.
- [x] **P3-05 Badges engine.** Rule-driven awards evaluated in the stats worker: `Reliable Player` (attendance ≥ 90%, ≥ 10 matches), `10 Matches` / `50 Matches`, `Perfect Attendance` (≥ 15 matches, 0 no-shows), `Trusted Organizer` (≥ 10 organized, < 10% cancelled), `Fair Play` (fairPlay avg ≥ 4.5 over ≥ 10 ratings). Badges never revoked in MVP.
- [x] **P3-06 Join-flow integration.** Phase-2 requirement checks (`minRating`, `minAttendancePct`) now read real `UserStats`; users with null stats pass only if `allowNewPlayers`. Owner warning card (P2-06) now shows real numbers, e.g. "Attended 6 of 10 matches (60%). Last 5 ratings avg: 2.4."
- [x] **P3-07 Profile page (full).** Public profile now renders: matches played/organized, attendance breakdown (on-time/late/no-show/cancelled-early), attendance %, Bayesian rating + count (or "New player"), badges, recent matches, public comments (paginated, report button stub). Own-profile view adds private hints (pending ratings to give).
- [x] **P3-08 Web: attendance & rating UIs.** Owner attendance sheet (one-tap statuses, guests counter per inviter); player "rate your teammates" flow (post-match card with 5 criteria sliders/stars + comment); dispute dialog from the notification.
- [x] **P3-09 Comment reports.** `POST /ratings/:id/report {reason}` — stores a Report row for Phase-5 moderation; ≥3 distinct reports auto-hides (`HIDDEN`) pending review.
- [x] **P3-10 Seed.** Extend seed with finished matches, attendance history, ratings — including one user with poor stats to demo the warning card, and one "New player".

## Acceptance criteria

- Full loop in UI: match finishes → owner marks attendance → players rate → stats/badges update on both profiles → next join shows the warning card with real data.
- Unmarked attendance defaults to ON_TIME at 48h (no silent penalties).
- A player with 1×5.0 rating ranks below a player with 50 ratings averaging 4.8 (Bayesian assertion).
- Dispute flow changes a NO_SHOW to EXCUSED and stats recompute.

## Mandatory tests

- Unit: Bayesian formula (edge cases: 0, 1, 3 ratings; hidden ratings excluded), attendancePct with LATE weighting, early-cancel time-boundary (exactly N hours), rating-window boundaries, badge rule matrix.
- e2e: cannot rate before RATING_PENDING / after COMPLETED / self / non-participant / NO_SHOW participant; duplicate rating rejected; dispute → recompute; report auto-hide at 3.
