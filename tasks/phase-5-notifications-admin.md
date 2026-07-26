# Phase 5 — Notifications, Admin Panel & Moderation

**Goal:** Close the loops: users get notified about everything that matters; admins can operate the platform. After this phase the MVP is launchable.

**Prerequisites:** Phase 4 complete.

## Part A — Notifications

### Model

```prisma
model Notification {
  id, userId, type NotificationType, // enum below
  payload Json,            // typed per-type in contracts
  matchId?, readAt?, createdAt
}
model PushSubscription { id, userId, endpoint @unique, keys Json, userAgent, createdAt }
model NotificationPreference { userId @id, perTypeChannelFlags Json } // in-app always on; push opt-out per type
```

**Types (MVP):** `JOIN_REQUEST_RECEIVED`, `JOIN_APPROVED`, `JOIN_REJECTED`, `MATCH_INVITE`, `WAITLIST_PROMOTED` (30-min confirm!), `MATCH_UPDATED` (time/place change), `MATCH_CANCELLED`, `MATCH_REMINDER_24H`, `MATCH_REMINDER_2H`, `ATTENDANCE_MARKED`, `ATTENDANCE_DISPUTE_RESOLVED`, `RATING_WINDOW_OPEN`, `NEW_RATING_RECEIVED`, `REPORT_RESOLVED`, `ACCOUNT_WARNING`.

### Tasks

- [x] **P5-01 Notification service.** Single `notify(userId, type, payload)` API used by all modules; writes the row, fans out to enabled channels via BullMQ. Replace every "stub/hook" left in Phases 2–3 with real calls (grep for `TODO(notify)` — earlier phases must have used this marker).
- [x] **P5-02 In-app center.** Bell + unread badge (SSE stream), notification list page, mark-read/mark-all. Localized templates (all 4 locales) rendered from `type + payload` at display time (not stored pre-rendered — locale switch safe).
- [x] **P5-03 Web Push (PWA).** Service worker, manifest, install prompt; VAPID web-push from the worker; permission UX with per-type preference screen. Reminder jobs: schedule 24h/2h jobs on publish, reschedule on edit, cancel on cancel/leave.
- [x] **P5-04 Match chat — EXCLUDED from MVP** (Phase 6). Confirm no dangling UI promises it. — Confirmed: no chat/messaging references anywhere in web or api.

## Part B — Admin panel (`apps/admin`)

Admin auth: same OTP auth, restricted to `role in (ADMIN, MODERATOR)`; session cookie scoped to admin app; every mutation writes `AuditLog{actorId, action, targetType, targetId, before, after, reason?, createdAt}` in-transaction.

### Tasks

- [x] **P5-05 Dashboard.** Cards + charts: total/active users (7d/30d), matches created/completed/cancelled, global attendance %, DAU/WAU growth, activity by city. Powered by nightly-aggregated `AdminMetricsDaily` table (no live heavy queries). — Metric cards + activity-by-city + 30-day series delivered; the series is exposed for richer trend charts.
- [x] **P5-06 Users module.** Search (username/phone-last-4/name), profile detail (incl. match + rating + report history), actions: warn (with message → notification), suspend (until date), ban, un-ban, mark phone verified. Reason mandatory on every action.
- [x] **P5-07 Matches module.** Search/filter, detail with participants + audit trail, actions: edit, force-cancel (participants auto-notified), flag-as-suspicious queue. — Edit is API + audited (e2e); admin UI covers search/detail/flag/force-cancel (edit form is a follow-up).
- [x] **P5-08 Moderation queue.** Unified inbox: rating-comment reports (from P3-09), attendance dispute escalations (from P3-02), stadium submissions (from P2-01). Actions: hide/restore/delete comment, uphold/overturn dispute, approve/reject stadium. Resolution notifies the involved users. — Reports → REPORT_RESOLVED to reporters; disputes → ATTENDANCE_DISPUTE_RESOLVED to participant; stadium submitter has no MVP notification type (ADR-037), audited only.
- [x] **P5-09 Audit log viewer.** Filterable by actor/action/target/date; read-only; export CSV.
- [x] **P5-10 Roles.** MODERATOR sees moderation queue + users (warn only); ADMIN sees everything. Permission matrix test. — Server-enforced via @Roles/RolesGuard (e2e matrix test) + role-filtered admin nav and ADMIN-only action buttons.

## Acceptance criteria

- Every notification type fires end-to-end from its real trigger (scripted e2e sweep) and renders localized in all 4 locales.
- Waitlist promotion push arrives and the 30-min confirm flow works on mobile PWA.
- Cancelling a match notifies all confirmed + waitlisted participants and cancels reminder jobs.
- Every admin mutation produces a correct AuditLog row (asserted generically via test helper).
- Moderator cannot ban; admin can (permission matrix e2e).

## Mandatory tests

- Unit: reminder scheduling/rescheduling/cancellation; template rendering per locale; preference filtering.
- e2e: notification sweep (one per type); audit-log-on-every-mutation helper; report → hide → restore flow; dispute escalation → admin overturn → stats recompute (cross-phase regression).

## Launch checklist (end of MVP)

- [ ] Real SMS provider credentials wired + tested with a real UZ number
- [ ] Sentry DSNs, log shipping, uptime monitor
- [ ] Docker production compose + Nginx TLS + backups (pg_dump nightly + WAL)
- [ ] Rate limits reviewed at production values
- [ ] Seed removed from prod path; admin bootstrap script (first ADMIN via env)
- [ ] Legal pages: privacy policy & terms (uz/ru minimum), consent checkbox at registration
