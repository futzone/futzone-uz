# Phase 1 — Auth & Users

**Goal:** Phone-OTP registration/login, sessions, and user profiles with avatar upload.

**Prerequisites:** Phase 0 complete.

## Data model (Prisma)

```prisma
model User {
  id              String    @id            // uuidv7
  phone           String    @unique        // E.164, e.g. +99890...
  phoneVerifiedAt DateTime?
  firstName       String
  lastName        String
  username        String    @unique        // 3-20, [a-z0-9_], lowercase
  avatarUrl       String?
  bio             String?   @db.VarChar(300)
  cityId          String?
  position        Position? // GK DEF MID FWD UNIVERSAL
  locale          String    @default("uz")
  role            UserRole  @default(USER)      // USER MODERATOR ADMIN
  status          UserStatus @default(ACTIVE)   // ACTIVE WARNED SUSPENDED BANNED
  suspendedUntil  DateTime?
  createdAt       DateTime  @default(now())
  deletedAt       DateTime?
}

model OtpRequest { id, phone, codeHash, purpose (REGISTER|LOGIN), expiresAt, attempts, consumedAt, createdAt, ip }
model Session    { id, userId, refreshTokenHash, family, expiresAt, revokedAt, userAgent, ip, createdAt }
model City       { id, slug, nameUz, nameUzCyrl, nameRu, nameEn, region, lat, lng, isActive }
```

## Tasks

- [x] **P1-01 SMS provider interface.** `SmsProvider` interface with `sendOtp(phone, code)`; implementations: `MockSmsProvider` (dev — logs + hits the mock-sms container) and `EskizSmsProvider` stub (config-selected; real credentials post-MVP are ops work, not code work). Provider chosen via env.
- [x] **P1-02 OTP request endpoint.** `POST /auth/otp` `{phone, purpose}`. Validates UZ phone format (+998...). Rate limits (Redis): max 3 sends per phone per 10 min, max 10 per IP per hour, min 60s between sends to same phone. Stores bcrypt hash of a 6-digit code, 2-min expiry. Response never reveals whether the phone is already registered.
- [x] **P1-03 OTP verify + register/login.** `POST /auth/verify` `{phone, code}`. Constant-time compare, max 5 attempts then the OTP is dead. If user exists → login (issue tokens). If not → returns a short-lived `registrationToken`; `POST /auth/register` `{registrationToken, firstName, lastName, username}` completes signup. Username availability check endpoint with `pg_trgm`-backed suggestions on conflict.
- [x] **P1-04 Sessions.** JWT access (15 min) + rotating refresh (30 days, httpOnly secure cookie, family-based reuse detection → revoke family). `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`. Nest guard + `@CurrentUser()` decorator. Suspended/banned users: refresh rejected with typed code.
- [x] **P1-05 Profile endpoints.** `GET /users/:username` (public shape — see privacy invariants; stats fields return zeros/null placeholders until Phase 3), `PATCH /me` (name, bio, city, position, locale), `PATCH /me/username` (rate-limited: once per 30 days). Phone is returned **only** by `GET /me/settings`.
- [x] **P1-06 Avatar upload.** `POST /me/avatar` — presigned S3 PUT flow; server-side type sniff (jpeg/png/webp), 5 MB cap, square-crop + resize to 512px worker job (BullMQ + sharp), old avatar cleanup.
- [x] **P1-07 Web: auth flow.** Phone input (UZ mask) → OTP screen (autofocus, resend countdown) → registration form (name, username with live availability, optional avatar/bio/position/city) → redirect. Login variant skips registration. City auto-suggest by browser geolocation (permission-gated), manual dropdown fallback.
- [x] **P1-08 Web: profile pages.** Public profile `/[locale]/players/[username]` (SSR) and own profile settings page. "New player" badge placeholder for stats.
- [x] **P1-09 Seed users.** 20 realistic seeded users across positions/cities with avatars.

## Acceptance criteria

- Full register + logout + login round trip works in the browser against dev stack, with OTP visible in mock-sms logs.
- Phone appears in **no** response except `GET /me/settings` (assert in e2e).
- Rate limits verifiably block abuse (e2e with Redis).
- Banned user cannot obtain a new access token.

## Mandatory tests

- Unit: OTP expiry, attempt exhaustion, constant-time verify path, username validation.
- e2e: register happy path; login happy path; refresh rotation + reuse-detection revokes family; phone-leak assertion across all Phase-1 endpoints.
