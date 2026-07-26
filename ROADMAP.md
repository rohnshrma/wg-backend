# WebiGeeks — Production Readiness Roadmap

> Single source of truth for phased completion of the WebiGeeks platform (frontend: `wg-frontend`, backend: `wg-backend`). Read this file at the start of any future session before resuming work.

## Critical context (read this first)
- Both repos previously had only a single bare "initial commit" (boilerplate) in git — **all real app work existed only as uncommitted local changes**. This was discovered and fixed on 2026-07-24: the real work was committed to `main` in both repos (commits `97ede80` backend, `83953c7` frontend). Going forward, commit regularly — don't let work sit uncommitted.
- No separate "Project Specification" or "Repository Audit" document exists — this file plus the live codebase is the working source of truth.
- Repos: `backend` → github.com/rohnshrma/wg-backend, `frontend` → github.com/rohnshrma/wg-frontend (separate git repos, not a monorepo).
- Admin login: `webigeeksofficial@gmail.com` / `Admin@123` (seed default from `backend/.env` `ADMIN_EMAIL`/`ADMIN_DEFAULT_PASSWORD` — change this in production).
- To run locally: MongoDB must be running (`brew services start mongodb-community` if needed), then `cd backend && npm run build && npm start` (port 5001), `cd frontend && npm run build && npm start` (port 3000). Avoid `npm run dev` in this sandbox — it hangs; use build+start instead.
- Backend has a real rate limiter (100 req/15min per IP general, 10/15min auth) — don't hammer it with rapid automated reloads during testing; it's in-memory so restarting the backend clears it.
- **Worktree gotcha (bit us on 2026-07-24/25):** if working in a git worktree under `.claude/worktrees/`, remember the running dev servers must be built+started from the same checkout you're editing. Building in a worktree but running `npm start` from `/Users/rohan/Desktop/webigeeks/frontend` (the real checkout) silently serves stale code with zero errors — very confusing to debug. Always confirm which checkout the live server is actually running from before trusting a "it's not showing up" result.
- **Low-memory machine gotcha (2026-07-25):** this machine runs low on free RAM during long sessions (many dev servers + browser + editor open at once). `git push` can fail with `pack-objects died of signal 10` (SIGBUS) under memory pressure even on a tiny repo. Fix: retry with `git -c pack.threads=1 -c pack.windowMemory=10m push ...`. Also: `next start` has been observed to silently die with no error in its log under the same pressure — if a "running" server stops responding, just check `ps aux | grep next-server` and restart it.

## Design — Three.js visual layer (added 2026-07-25)
- Added `src/components/three/` (`NeuralNetworkScene`, `FloatingShapes`, `Hero3DBackground`) using `three` + `@react-three/fiber` + `@react-three/drei`. Applied sitewide: full treatment on the homepage hero, a lighter "compact" accent on every other public page banner (About, Courses list/detail, Contact, Testimonials, Gallery, Blog list/detail, Login, Register).
- Real bug hit and fixed: mounting the WebGL canvas immediately on page load competed with each page's Framer Motion entrance animation for the main thread, visibly freezing the fade-in around ~15-20% progress indefinitely (reproduced via `getComputedStyle` on the animating element — opacity was frozen, not just slow). Fixed by delaying canvas mount ~900ms via `setTimeout`, plus trimming node/shape counts and fixing device pixel ratio to 1. If this resurfaces (e.g. on a slower device), check that delay first before assuming it's something else.
- This pulled in `three`, `@react-three/fiber`, `@react-three/drei` (~150 packages) as a deliberate trade-off over extending the app's existing dependency-free custom `BarChart` component — chosen because line/pie/3D visuals were needed, not just bars.

## Design — Full rebrand: real logo, colors, tagline (2026-07-25, DONE)

**STATUS: Committed and pushed to `main` on both repos** — frontend `874855f`, backend `f27508e` (color/tagline fixes) on top of `9f099b2` (roadmap). Verified working via browser (homepage, login, admin dashboard) before pushing.

**What triggered it:** user supplied the real logo (`/Users/rohan/Downloads/Untitled design.png`) and asked for the actual brand colors to be used sitewide, plus confirmed tagline "Your AI Skill Partner" (replacing the placeholder "Training & Development").

**Exact brand colors extracted via pixel sampling (not eyeballed):**
- Blue `#1672B8` → replaces old purple primary (`#6C3CE1`) everywhere.
- Gray `#606062` → replaces old sky-blue secondary (`#0EA5E9`) everywhere.
- Full computed scale (50/100/200/500/600/700/900 + dark/light variants) is in `frontend/src/app/globals.css` under `@theme`. Orange accent (`#F97316`/`#EAB308`) was deliberately kept unchanged — it's a CTA color, not tied to the logo, and still reads well against the new blue/gray.

**Logo assets created** (from the source PNG, background chroma-keyed to transparent):
- `frontend/public/images/logo.png` — full lockup (mark + "WEBIGEEKS" wordmark), for large placements.
- `frontend/public/images/logo-mark.png` — icon-only crop (no wordmark), used in every navbar/sidebar/header slot next to the existing styled "WebiGeeks" text.
- `frontend/public/images/icon-512.png` + `frontend/src/app/favicon.ico` — regenerated from the mark, centered on a padded square canvas. **Not yet visually confirmed in an actual browser tab icon** — worth a quick look.

**Everywhere the logo/tagline/colors were swapped in:** `Navbar.tsx` (desktop + mobile), `Footer.tsx`, `admin/layout.tsx` sidebar, `dashboard/layout.tsx` sidebar, `LoginContent.tsx`, `RegisterContent.tsx`, `ForgotPasswordContent.tsx`, `ResetPasswordContent.tsx` (both the big decorative-panel icon and the small compact header icon on each), `config/site.ts` tagline field, `app/layout.tsx` metadata (title/siteName/twitter/theme-color), `about/page.tsx` + `gallery/page.tsx` meta descriptions, and the Three.js components' hardcoded hex colors (`NeuralNetworkScene`, `FloatingShapes`, `Hero3DBackground`, `admin/analytics/page.tsx` chart colors). Backend: `emailService.ts` (header/footer/welcome-email text) and `generateReceiptPdf.ts` (header + footer text) had their "Training & Development" text updated.

**Verified working via browser** (after a bad stretch of screenshot-tool flakiness that turned out to be stale/dead browser tab state, not a code bug — fixed by closing stale tabs and opening a fresh tab group): homepage hero (logo, tagline, blue gradient, neural network + orange floating shape, popup form now blue), Login page (logo badge, blue decorative panel), Admin dashboard (sidebar logo, blue welcome banner, stat card icons).

**Remaining gaps:**
1. **Minor cosmetic nit:** on the admin dashboard, the "Courses" stat tile and "Monthly Admissions" chart bar now render in the new dark gray secondary color and look a bit flat/heavy compared to before (when secondary was a bright sky blue). Not broken, just a visual judgment call — could lighten to a mid-gray tint if it reads as too dark in practice.
2. Favicon/tab-icon not visually double-checked in an actual browser chrome (only generated + spot-checked as a PNG).
3. `npm audit` shows some high-severity advisories in transitive deps pulled in by `recharts` and `@react-three/*` — not investigated, likely fine for a training-site admin panel but worth a look before considering this production-hardened (Phase 10/11 territory).

## Phase Status Overview

| Phase | Name | Status | Notes |
|---|---|---|---|
| 1 | Authentication, Security, RBAC | AUDITED, FIXED | Audited 2026-07-25: fixed a mass-assignment vuln in `PUT /api/students/:id`, added rate limiting to change-password, removed JWT from response bodies, added zod validation to the student profile route. See Phase 1 section below. |
| 2 | Public Website | SPOT-CHECKED OK, CMS WIRED | Testimonials/Gallery/Blog now read real backend data (2026-07-25) — see CMS section below. Home/Courses/About/Contact/Register still only smoke-tested (2026-07-24). |
| 3 | Courses Module | SPOT-CHECKED OK | Admin course list (10 courses) + edit form load correctly. |
| 4 | Student Registration | AUDITED | Audited 2026-07-25 — structurally sound; only defect was the mass-assignment issue shared with Phase 1, now fixed. |
| 5 | Student Dashboard | AUDITED, OK | Audited 2026-07-25 — every page (Overview, Course, Payments, Documents, Notifications, Profile) reviewed against its source; all fully wired to real endpoints, no mock data, no broken links. |
| 6 | Admin Dashboard | SPOT-CHECKED OK, CMS WIRED | Home dashboard, Students, Leads, Payments, Notifications, Settings load without errors. Testimonials/Gallery/Blogs admin CRUD built out 2026-07-25 (previously non-functional stubs) — see CMS section below. |
| 7 | Communication (Email/WhatsApp) | IN PROGRESS | Gmail SMTP app password configured 2026-07-23, not yet end-to-end verified with a real send. WhatsApp Cloud API onboarding blocked by Meta "Onboarding failure" (CSP/fetch error in embedded Quickstart flow) — unresolved as of 2026-07-24. Requires the account owner present (Meta business identity/2FA) — not something to attempt unattended. |
| 8 | Payments | SPOT-CHECKED OK | Admin payments list (2 records) renders correctly. Full payment/Razorpay flow not tested. |
| 9 | Analytics | DONE | Completed 2026-07-24. Backend + frontend build clean, verified against real running app with real data via browser. |
| 10 | Performance/SEO/Accessibility | NOT STARTED | |
| 11 | Testing | IN PROGRESS | Started 2026-07-25 — Jest+supertest+mongodb-memory-server backend suite and Vitest+RTL frontend suite added, scoped to auth/RBAC and the new CMS routes/pages. Not yet app-wide coverage. |
| 12 | Deployment | NOT STARTED | Needs a hosting/infra decision (provider, domain, production secrets) — a business call, not something to infer or scaffold unattended. |

---

## Phase 1 audit + CMS wiring — Security hardening, Testimonials/Gallery/Blog (2026-07-25)

**Trigger:** continuing the roadmap in autonomous mode — picked the highest-value concrete work: audit Phases 1/4/5 (all marked NOT AUDITED) and close the previously-flagged gap where Testimonials/Gallery/Blog had full backend CRUD but zero frontend wiring (public pages hardcoded, admin pages non-functional stubs).

**Security fixes (`wg-backend`):**
- **Mass-assignment vuln fixed**: `PUT /api/students/:id` (`student.controller.ts`) previously did `Student.findByIdAndUpdate(id, { $set: req.body })` for a logged-in student's own record with no field allowlist — a student could set `status: 'approved'`, `isProfileLocked: false`, `totalPaid`, `admissionId`, etc. on themselves. Fixed with `pickSelfEditableFields()`, an explicit allowlist; admins still get full-field access. **Verified live**: registered a test student, attempted to self-set `status`/`isProfileLocked`/`totalPaid`/`admissionId` via the API — all silently ignored; a legitimate field (`fullName`) still went through.
- `PUT /api/auth/change-password` was missing the `authLimiter` that `verify-password` already had — added.
- Login/register/reset/change-password no longer return the JWT in the response body (cookie is the sole auth channel) — confirmed via `wg-frontend/src/lib/api.ts` that the frontend never read the body token, so this was pure unnecessary XSS exposure with nothing depending on it.
- Added a zod validation schema (`validations/student.validation.ts`) to the student profile route, matching the existing `auth.validation.ts` pattern (previously relied solely on Mongoose `required` checks).
- Added the backend's first ESLint config (`.eslintrc.json` — legacy format, since the installed ESLint is 8.57.x, not flat-config-native) — `npm run lint` was previously a silent no-op with zero config despite the deps being installed. Fixed the handful of findings (unused imports, one `no-namespace` false-positive on the standard Express `Request` type-augmentation pattern).

**CMS wiring (`wg-frontend` + `wg-backend`):**
- Public `/testimonials`, `/gallery`, `/blog`, `/blog/[slug]` now fetch real data server-side via `lib/{testimonials,gallery,blog}.ts` (same ISR pattern as the existing `lib/courses.ts` — ISR revalidate 60s), replacing hardcoded placeholder arrays. Empty states added for when there's no content yet.
- Admin `/admin/testimonials`, `/admin/gallery`, `/admin/blogs` — built out full list/create/edit/delete UIs (previously static unwired stubs), reusing the existing `admin/courses` list-page and `ConfirmDeleteModal` conventions.
- Backend: added `GET /admin/all` (testimonials, gallery) and `GET /admin/all` + `GET /admin/:id` (blogs) admin-only listing endpoints, since the public endpoints filter to `isActive`/`isPublished` only — mirrors the existing `courses/admin/all` pattern.
- `next.config.ts`: added `images.remotePatterns` for `res.cloudinary.com` so gallery/blog/testimonial images can use `next/image` (previously unset — no remote image rendering was configured anywhere in the app).
- **Verified live end-to-end** via browser + API: created a real testimonial through the admin UI, confirmed it appeared on the public page after ISR revalidation; created a blog post via API (Cloudinary not configured in this dev environment, so the UI upload step itself couldn't be exercised — see below) and confirmed it rendered correctly on both the admin edit page and the public detail page including cover image, tags, and metadata.

**Known limitation — Cloudinary not configured in this environment:** image uploads (`DocumentUploadField` → `/api/upload/image`) return a graceful 503 rather than crashing, by existing design (`assertCloudinaryConfigured`), but this means the gallery/testimonial/blog *upload* UI paths themselves weren't exercised end-to-end here — only verified via direct API calls with a pre-existing image URL. Needs real Cloudinary credentials in `.env` to fully verify the upload flow.

**Dev environment note:** this checkout had no `.env` and no local MongoDB (this appears to be a fresh machine/checkout, distinct from the one referenced elsewhere in this file). Set up a local-only dev MongoDB via `mongodb-memory-server` (`scripts/devMongo.ts` — run with `npx ts-node scripts/devMongo.ts`, binds to `mongodb://127.0.0.1:27017/webigeeks`, persists to `.devdata/` which is gitignored) plus a dev-only generated `JWT_SECRET`. This is separate from the `mongodb-memory-server` instance the test suite spins up per-run.

**Frontend lint — pre-existing debt, out of scope this pass:** `npm run lint` in `wg-frontend` has 55 pre-existing errors (confirmed via `git stash` against the last committed baseline, before this session's changes) — mostly `@typescript-eslint/no-explicit-any` in `catch` blocks and a stricter `react-hooks/set-state-in-effect`/`react-hooks/purity` ruleset flagging the app's universal `useEffect(() => { fetchX() }, [])` data-fetching pattern (used in `useAuth.ts`, every dashboard/admin page, and `Math.random()` in the Three.js scene). New CMS files follow the same established convention rather than inventing an inconsistent one-off style. Fixing this properly means touching core auth/rendering code across ~15 files — flagged as Phase 10/11 cleanup, not attempted here to avoid destabilizing critical paths for a lint-only pass.

**Explicitly not attempted (need the user present):**
- Phase 7 WhatsApp Cloud API onboarding — blocked on an interactive Meta Business account flow tied to the user's own identity/2FA.
- Phase 12 Deployment — needs a hosting/infra decision and production secrets, a business call.

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
