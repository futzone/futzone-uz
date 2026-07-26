# Futzone — AI Agent Planning Bundle

Havaskor futbolchilar platformasi (futzone.uz) uchun AI agentlarga mo'ljallangan reja to'plami.

## Fayllar

| Fayl | Nima uchun |
| --- | --- |
| `PLAN.md` | Bosh reja: mahsulot, stack, domen modeli, fazalar. Agent birinchi shuni o'qiydi. |
| `CLAUDE.md` | Agent qoidalari va kod konventsiyalari. Repo ildiziga qo'yiladi. |
| `tasks/phase-0-foundation.md` | Monorepo, Docker, CI, skeleton |
| `tasks/phase-1-auth-users.md` | Phone OTP auth, profillar |
| `tasks/phase-2-matches.md` | O'yin yaratish, state machine, join, mehmonlar, waitlist |
| `tasks/phase-3-attendance-ratings.md` | Davomat, rating, reputatsiya, badge |
| `tasks/phase-4-discovery-seo.md` | Qidiruv, filter, PostGIS, SEO, i18n |
| `tasks/phase-5-notifications-admin.md` | Bildirishnomalar, admin panel, moderatsiya |
| `tasks/phase-6-post-mvp.md` | Keyingi bosqichlar (faqat roadmap) |

## Qanday ishlatiladi

1. Yangi repo oching, `PLAN.md`, `CLAUDE.md` va `tasks/` papkasini ildizga ko'chiring.
2. Agentga (Claude Code / Cursor) ayting: *"Read PLAN.md and CLAUDE.md, then implement tasks/phase-0-foundation.md"*.
3. Har bir faza tugagach acceptance criteria'larni o'zingiz tekshiring, keyin keyingi fazani bering.
4. Faza fayllari checklist (`[ ]`) shaklida — agent bajargan sari belgilab boradi.
5. MVP = Faza 0–5. Faza 6 kod yozish uchun emas, faqat kelajak uchun.

## Muhim

- Eng xavfli qism — Faza 2'dagi joy hisoblash (seat capacity). U yerdagi "Mandatory tests" bo'limidagi concurrency testi hech qachon o'chirilmasligi kerak.
- SMS provider (Eskiz.uz va h.k.) credentials — bu ops ishi, agent mock provider bilan ishlaydi.
- Yandex Maps API key kerak bo'ladi (Faza 2'dan boshlab).
