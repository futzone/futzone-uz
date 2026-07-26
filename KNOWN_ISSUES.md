# Known issues

Defects that are understood or recently resolved. Each entry records what was verified, what was ruled out, and where the fix belongs.

## KI-001 — `notFound()` renders the 404 page but responds HTTP 200 (`apps/web`)

**Status:** resolved 2026-07-22. Cause: segment-wide `loading.tsx` forced streaming, committing a 200 before `notFound()`.

**Original symptom** — verified against a fresh production build (`next build && next start`) before the resolution:

| URL | Actual | Expected |
| --- | --- | --- |
| `/uz/players/nobody_here_xyz` (API returns 404) | 200 | 404 |
| `/uz/this-route-does-not-exist` | 200 | 404 |
| `/de` (unsupported locale) | 500 | 404 |
| `/nothing-at-all` | 307 | 307 ✓ |
| `/uz/players/aziz_karimov` | 200 | 200 ✓ |
| `/uz/settings` anonymous | 307 → `/uz/login?returnTo=…` | ✓ |
| `/uz`, `/uz-Cyrl`, `/ru`, `/en` | 200 | 200 ✓ |

The default Uzbek not-found content rendered, but the HTTP status was wrong. `/de` additionally returned 500 with `Error: Invalid locale` thrown from `src/i18n/request.ts`. After the status fix, production verification passed all 12 status checks; a follow-up revealed that non-Uzbek 404s still used the Uzbek catalog, which was then fixed in the URL-aware root boundary.

**Ruled out** (do not re-investigate):

- Not the API — `GET /api/users/nobody_here_xyz` correctly returns 404 `{"code":"NOT_FOUND"}`.
- Not the `notFound()` call sites — already called outside the `catch` block and outside `Promise.all`; the boundary demonstrably renders.
- Not the custom middleware — replacing `src/middleware.ts` with a bare `createMiddleware(routing)` and rebuilding produced identical statuses.
- Not a dev-mode artifact — reproduces in the production build.
- Adding `app/[locale]/[...rest]/page.tsx`, a locale-independent `app/not-found.tsx`, and a pass-through root `app/layout.tsx` each changed behaviour but none fixed the status.

**Why it matters:** a soft 404 lets crawlers index unlimited junk profile URLs, which directly undermines Phase 4's SEO work (P4-10 owns the index policy and the finished-match 404/410 rules).

**Resolution:** removed the `[locale]` segment-wide loading boundary, scoped the required Suspense boundary to the login page, and changed invalid-locale handling in `src/i18n/request.ts` to call `notFound()`. Production tracing showed that Next renders the root not-found boundary even for failures under `[locale]`; the root boundary now selects a validated locale catalog from the URL and falls back safely to the default locale. The unused `[locale]/not-found.tsx` was deleted to avoid implying that it handles localized failures.

**Regression check** once fixed — run against a fresh production build and expect every row of the table above to match the Expected column.
