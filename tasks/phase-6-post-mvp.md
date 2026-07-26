# Phase 6 — Post-MVP Roadmap (do NOT implement during MVP)

This file exists so MVP architecture doesn't paint us into a corner. Each item lists the future feature and what (if anything) MVP must keep in mind for it. No tasks here are actionable until the MVP ships and the team re-prioritizes.

## 6.1 Match chat
Private per-match chat for confirmed participants (opens on join, read-only after completion, retention limit). **MVP hook:** none needed — SSE infra from notifications is reusable; consider WebSocket upgrade then.

## 6.2 Teams
Persistent teams (roster, captain, team profile, team-vs-team matches). **MVP hook:** `MatchParticipant` already has a `role`; team matches would add `teamId` columns — avoid assumptions that a match has exactly one owner-side pool of individuals baked into *UI copy only*, not schema.

## 6.3 Tournaments
Brackets/round-robins across multiple matches. Builds on teams. **MVP hook:** none.

## 6.4 Stadium booking & partnerships
Stadium owners as a user type, real availability calendars, booking a slot creates the match. **MVP hook:** `Stadium.status` flow already exists; keep stadium data normalized (done).

## 6.5 Payments
Per-player fee collection via Payme/Click/Uzum, escrow until match completion, no-show forfeits deposit — a powerful attendance incentive. **MVP hook:** money already integer-UZS; keep `perPlayerFeeUzs` semantically "informational price" in MVP copy so adding "paid via app" doesn't break meaning.

## 6.6 Mobile app
React Native (or Flutter) client on the same REST API. **MVP hook:** the API is already versioned (`/v1`), token auth works headless, push architecture must add FCM/APNs channel beside web-push (NotificationService channel abstraction from P5-01 covers this).

## 6.7 Search scale-out
Meilisearch/Elasticsearch when Postgres FTS strains (rough trigger: >50k active matches or p95 > 300 ms). Sync via CDC or transactional outbox. **MVP hook:** keep the search endpoint behind one service class so the engine can be swapped.

## 6.8 Advanced reputation
Position-weighted ratings, decay of old ratings, organizer-specific score, anomaly detection for rating rings. **MVP hook:** `UserStats` is a recomputable projection — formulas can change without migration pain (already the case).

## 6.9 Growth features
Referral links, weekly recurring matches auto-clone (was in the original idea list — deliberately deferred: cloning interacts with reminders/waitlists and is cheap to add once those are stable), "share to Telegram" deep integration, city expansion playbooks.

## 6.10 Telegram bot
Uzbekistan-specific: a bot mirroring match discovery + join + notifications where users already live. Potentially *the* highest-leverage post-MVP item for this market — evaluate right after launch. **MVP hook:** headless-friendly API (done), notification channel abstraction (done).
