# WebiGeeks — Production Readiness Roadmap

> Single source of truth for phased completion of the WebiGeeks platform (frontend: `wg-frontend`, backend: `wg-backend`). Read this file at the start of any future session before resuming work.

## Critical context (read this first)
- Both repos previously had only a single bare "initial commit" (boilerplate) in git — **all real app work existed only as uncommitted local changes**. This was discovered and fixed on 2026-07-24: the real work was committed to `main` in both repos (commits `97ede80` backend, `83953c7` frontend). Going forward, commit regularly — don't let work sit uncommitted.
- No separate "Project Specification" or "Repository Audit" document exists — this file plus the live codebase is the working source of truth.
- Repos: `backend` → github.com/rohnshrma/wg-backend, `frontend` → github.com/rohnshrma/wg-frontend (separate git repos, not a monorepo).
- Admin login: `webigeeksofficial@gmail.com` / `Admin@123` (seed default from `backend/.env` `ADMIN_EMAIL`/`ADMIN_DEFAULT_PASSWORD` — change this in production).
- To run locally: MongoDB must be running (`brew services start mongodb-community` if needed), then `cd backend && npm run build && npm start` (port 5001), `cd frontend && npm run build && npm start` (port 3000). Avoid `npm run dev` in this sandbox — it hangs; use build+start instead.
- Backend has a real rate limiter (100 req/15min per IP general, 10/15min auth) — don't hammer it with rapid automated reloads during testing; it's in-memory so restarting the backend clears it.

## Phase Status Overview

| Phase | Name | Status | Notes |
|---|---|---|---|
| 1 | Authentication, Security, RBAC | NOT AUDITED | Password reset flow (cookie-based JWT auth) exists and was committed 2026-07-24; not yet feature-audited. |
| 2 | Public Website | SPOT-CHECKED OK | Home/Courses/About/Testimonials/Gallery/Blog/Contact/Register all render without errors (2026-07-24 smoke test). See known gap below re: Testimonials data wiring. |
| 3 | Courses Module | SPOT-CHECKED OK | Admin course list (10 courses) + edit form load correctly. |
| 4 | Student Registration | NOT AUDITED | |
| 5 | Student Dashboard | NOT AUDITED | Briefly glimpsed via accidental autofill login — Overview page rendered fine, not deliberately tested. |
| 6 | Admin Dashboard | SPOT-CHECKED OK | Home dashboard, Students, Leads, Payments, Testimonials, Gallery, Notifications, Settings all load without errors. |
| 7 | Communication (Email/WhatsApp) | IN PROGRESS | Gmail SMTP app password configured 2026-07-23, not yet end-to-end verified with a real send. WhatsApp Cloud API onboarding blocked by Meta "Onboarding failure" (CSP/fetch error in embedded Quickstart flow) — unresolved as of 2026-07-24. |
| 8 | Payments | SPOT-CHECKED OK | Admin payments list (2 records) renders correctly. Full payment/Razorpay flow not tested. |
| 9 | Analytics | DONE | Completed 2026-07-24. Backend + frontend build clean, verified against real running app with real data via browser. |
| 10 | Performance/SEO/Accessibility | NOT STARTED | |
| 11 | Testing | NOT STARTED | No automated test suite exists yet. |
| 12 | Deployment | NOT STARTED | |

---

## Phase 9 — Analytics (DONE, 2026-07-24)

**Scope:** Charts, Reports, Conversion Analytics, Revenue Analytics, Student Analytics.

**What was built:**
- Backend: refactored `analytics.routes.ts` logic into `analyticsService.ts` + `analytics.controller.ts`. Added `GET /api/analytics/students` (status/payment-mode/gender breakdown, dues, enrollment trend). Extended `/leads` with `conversionBySource` + `monthlyConversion`. Added new `GET /api/analytics/revenue/payment-methods` endpoint (kept `/revenue` itself backward-compatible as a plain array — see bug note below).
- Frontend: new `/admin/analytics` page using `recharts` (chosen over extending the app's existing dependency-free custom `BarChart` component, per explicit decision — trade-off: ~500 new packages incl. a few high-severity npm audit advisories in transitive deps, but full line/pie chart support). Added "Analytics" sidebar link. 8 charts covering all four sub-areas.

**Bug found and fixed during this work:** My first pass changed `/analytics/revenue`'s response shape from a plain array to `{byMonth, byPaymentMethod}`, which broke the **real, already-existing** admin dashboard home page (`admin/page.tsx`), which consumes `/analytics/revenue` directly as an array (`revenue.find(...)` → `TypeError: b.find is not a function`, blank dashboard). This only surfaced because the git-history discovery above meant my first implementation pass was built against a bare-boilerplate baseline that didn't have this real consumer. Fixed by keeping `/revenue` as a plain array and moving the payment-method breakdown to its own endpoint. **Lesson: always check real running-app consumers of an endpoint before changing its response shape, not just git history.**

**Known follow-ups:**
- Single-category pie charts (e.g. "Student Status" when only one status exists in the data) render as a thin wedge instead of a full circle — cosmetic Recharts quirk, not a data bug (legend/tooltip are correct). Will look better once there's more varied real data.
- No automated tests added (Phase 11 territory).

---

## 2026-07-24 full-app smoke test (post Phase 9)

Ran a read-only click-through of every admin section and public page against the real running app (both servers built + started from real, now-committed code). **16/16 pages passed** — no crashes, no console exceptions tied to any tested page.

**Gap found (not a crash, worth planning for):** The public `/testimonials` page shows 3 hardcoded placeholder testimonials (Priya Sharma, Rahul Patel, Sneha Kulkarni) regardless of the admin Testimonials CRUD state (which was empty during this test). The public page appears to not be wired to the backend testimonials data yet. Same likely applies to `/gallery` and `/blog` public pages, which rendered placeholder/gradient cards consistent with their empty admin-side lists — worth confirming during a Phase 2/6 audit pass whether these are meant to go live yet or are intentional placeholders for a still-empty CMS.

**Minor testing artifact (not an app bug):** one navigation to `/admin/courses` bounced to `/login` mid-session (cookie/session dropped once) — re-login fixed it immediately and courses worked fine after. Worth a second look if it recurs during real usage, but wasn't reproducible.

---

## Phase 7 — Communication (in progress, paused)

- Gmail SMTP: app password set in `backend/.env`. Not yet verified end-to-end with an actual test send.
- WhatsApp Cloud API: app "webiGeeks messaging app" exists in Meta developer console, business portfolio "WebiGeeks" selected. The embedded WhatsApp Quickstart signup repeatedly fails with "Onboarding failure" — Chrome DevTools showed the root cause: `Uncaught (in promise) TypeError: Failed to fetch. Refused to connect because it violates the document's Content Security Policy.` Tried: retry, incognito (unconfirmed whether extensions were actually fully disabled). **Resume by:** confirm a genuinely clean browser profile (extensions off via chrome://extensions, not just Incognito), or try the direct path: business.facebook.com → Business Settings → Accounts → WhatsApp Accounts → Add → "Create a WhatsApp account" (a different code path than the failing embedded Quickstart).
- `backend/.env`: `SMTP_PASS` is set; `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID` still empty.
