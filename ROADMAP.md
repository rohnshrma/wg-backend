# WebiGeeks — Production Readiness Roadmap

> Single source of truth for phased completion of the WebiGeeks platform (frontend: `wg-frontend`, backend: `wg-backend`). Read this file at the start of any future session before resuming work.

## Critical context (read this first)
- Both repos previously had only a single bare "initial commit" (boilerplate) in git — **all real app work existed only as uncommitted local changes**. This was discovered and fixed on 2026-07-24: the real work was committed to `main` in both repos (commits `97ede80` backend, `83953c7` frontend). Going forward, commit regularly — don't let work sit uncommitted.
- No separate "Project Specification" or "Repository Audit" document exists — this file plus the live codebase is the working source of truth.
- Repos: `backend` → github.com/rohnshrma/wg-backend, `frontend` → github.com/rohnshrma/wg-frontend (separate git repos, not a monorepo).
- Admin login: `webigeeksofficial@gmail.com` — password is no longer the `Admin@123` default (production refuses to boot with that value, see Phase 12). Current production password lives only in Render's `ADMIN_DEFAULT_PASSWORD` env var, not in this file or git.
- **Production is live** (since 2026-07-26): frontend on Vercel + custom domain `webigeeks.com`, backend on Render, DB on MongoDB Atlas. See Phase 12.
- To run locally: MongoDB must be running (`brew services start mongodb-community` if needed), then `cd backend && npm run build && npm start` (port 5001), `cd frontend && npm run build && npm start` (port 3000). Avoid `npm run dev` in this sandbox — it hangs; use build+start instead.
- Backend has a real rate limiter (100 req/15min per IP general, 10/15min auth) — don't hammer it with rapid automated reloads during testing; it's in-memory so restarting the backend clears it.
- **Worktree gotcha (bit us on 2026-07-24/25):** if working in a git worktree under `.claude/worktrees/`, remember the running dev servers must be built+started from the same checkout you're editing. Building in a worktree but running `npm start` from `/Users/rohan/Desktop/webigeeks/frontend` (the real checkout) silently serves stale code with zero errors — very confusing to debug. Always confirm which checkout the live server is actually running from before trusting a "it's not showing up" result.
- **Low-memory machine gotcha (2026-07-25):** this machine runs low on free RAM during long sessions (many dev servers + browser + editor open at once). `git push` can fail with `pack-objects died of signal 10` (SIGBUS) under memory pressure even on a tiny repo. Fix: retry with `git -c pack.threads=1 -c pack.windowMemory=10m push ...`. Also: `next start` has been observed to silently die with no error in its log under the same pressure — if a "running" server stops responding, just check `ps aux | grep next-server` and restart it.
- **iCloud Desktop sync gotcha (2026-07-26):** this checkout lives under `~/Desktop`, which has iCloud "Desktop & Documents" sync enabled. This actively corrupts large `node_modules` trees — observed as `ERR_INVALID_PACKAGE_CONFIG` on random `package.json` files (truncated mid-write) and a `.next` build cache getting an iCloud conflict-duplicate folder (`app 3/`) that broke the build with `ENOTEMPTY`. Plain filesystem ops (`rm -rf`, `git commit`) can also silently stall for minutes under sync pressure — that's not a hang, just wait it out or check `ps aux` for real CPU activity before assuming something's broken. Fix when it actually corrupts files: delete and reinstall (`rm -rf node_modules && npm install`, `rm -rf .next`). Proper long-term fix (not done): move the project out of `~/Desktop` or exclude `node_modules`/`.next` from iCloud sync.

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
| 1 | Authentication, Security, RBAC | AUDITED, FIXED | Audited 2026-07-25: fixed a mass-assignment vuln in `PUT /api/students/:id`, added rate limiting to change-password, removed JWT from response bodies, added zod validation to the student profile route. **2026-07-26**: fixed a cross-site auth cookie bug found in production (see Phase 12) and implemented Google OAuth 2.0 sign-in (passport-google-oauth20) — see Phase 1 section below. |
| 2 | Public Website | SPOT-CHECKED OK, CMS WIRED | Testimonials/Gallery/Blog now read real backend data (2026-07-25) — see CMS section below. Home/Courses/About/Contact/Register still only smoke-tested (2026-07-24). |
| 3 | Courses Module | SPOT-CHECKED OK | Admin course list (10 courses) + edit form load correctly. |
| 4 | Student Registration | AUDITED | Audited 2026-07-25 — structurally sound; only defect was the mass-assignment issue shared with Phase 1, now fixed. |
| 5 | Student Dashboard | AUDITED, OK | Audited 2026-07-25 — every page (Overview, Course, Payments, Documents, Notifications, Profile) reviewed against its source; all fully wired to real endpoints, no mock data, no broken links. |
| 6 | Admin Dashboard | SPOT-CHECKED OK, CMS WIRED | Home dashboard, Students, Leads, Payments, Notifications, Settings load without errors. Testimonials/Gallery/Blogs admin CRUD built out 2026-07-25 (previously non-functional stubs) — see CMS section below. |
| 7 | Communication (Email/WhatsApp) | EMAIL DONE, WHATSAPP NOT STARTED | **2026-07-26**: email verified end-to-end in production with a real send (`✉️ Email sent to ...` in Render logs) — required upgrading Render to the Starter plan, since Render blocks outbound SMTP ports on the free tier. Notification sends were also made fire-and-forget so a flaky SMTP provider can't block API responses (see Phase 12). WhatsApp Cloud API onboarding still blocked by Meta "Onboarding failure" (CSP/fetch error in embedded Quickstart flow) — unresolved, requires the account owner present (Meta business identity/2FA). |
| 8 | Payments | SPOT-CHECKED OK | Admin payments list (2 records) renders correctly. Full payment/Razorpay flow not tested. |
| 9 | Analytics | DONE | Completed 2026-07-24. Backend + frontend build clean, verified against real running app with real data via browser. |
| 10 | Performance/SEO/Accessibility | NOT STARTED | |
| 11 | Testing | IN PROGRESS | Started 2026-07-25 — Jest+supertest+mongodb-memory-server backend suite and Vitest+RTL frontend suite added, scoped to auth/RBAC and the new CMS routes/pages. Not yet app-wide coverage. |
| 12 | Deployment | DONE | **2026-07-26**: deployed to production — frontend on Vercel + custom domain `webigeeks.com`, backend on Render (Starter plan), DB on MongoDB Atlas. See Phase 12 section below for the real bugs hit and fixed along the way. |

---

## Phase 12 — Deployment, and the auth bugs it surfaced (DONE, 2026-07-26)

**Trigger:** user asked to deploy the site to production, then to fix a custom domain, then reported registration/login "not working" on the live site — three real, separate bugs were found and fixed this way that never showed up in local dev.

**Infra:**
- Backend → Render (`wg-backend`, Starter plan, Oregon), auto-deploys on push to `main`.
- Frontend → Vercel (`wg-frontend`), auto-deploys on push to `main`, custom domain `webigeeks.com` + `www.webigeeks.com` (GoDaddy DNS, A records → `76.76.21.21`).
- Database → MongoDB Atlas (user-provided cluster), replacing the local `mongodb://localhost:27017` dev connection.
- Railway was tried first for the backend but its free trial had expired and required a paid plan before creating any project — switched to Render instead.

**Bug 1 — TypeScript build failing only on Render, not locally:** `NODE_ENV=production` set as a build-time env var made `npm install` skip devDependencies (typescript included), so Render's build fell back to some other/newer `tsc` that rejected the project's `tsconfig.json` (`moduleResolution: "node"`, `baseUrl`, non-relative `paths` — all since deprecated/removed in newer TypeScript). Fixed by changing the Render build command to `npm install --include=dev && npm run build`.

**Bug 2 — admin registration/notifications appeared broken (actually just very slow):** Render's containers have no outbound IPv6 route; Gmail's SMTP server resolves to an IPv6 address first, so the connection attempt failed with `ENETUNREACH`, and other attempts hung for nodemailer's full 2-minute default timeout — the registration endpoint awaited that before responding, so it looked hung/broken even though it eventually succeeded. Fixed two ways: forced the SMTP transport to IPv4 with 10s timeouts (`config/email.ts`), and made non-critical notification sends (welcome email, password reset, admission approved/rejected, new lead, payment received) fire-and-forget instead of blocking the response — a real design improvement independent of the network issue. Separately, Render was found to fully block outbound SMTP ports on the free tier (changelog-confirmed) — upgrading to Starter was required for email to actually send at all, not just fail fast.

**Bug 3 — login succeeded (200 + Set-Cookie) but every subsequent request looked unauthenticated:** two stacked causes. First, the auth cookie was `SameSite=Lax` while frontend (`webigeeks.com`) and backend (`wg-backend-dgtd.onrender.com`) are different domains — fixed by making it `SameSite=None; Secure` in production (`auth.controller.ts`, `authCookieOptions`). That alone wasn't enough: even with `SameSite=None`, the cookie is *third-party* from the browser's perspective (different registrable domains), and Chrome's third-party cookie blocking silently drops it regardless of `SameSite`. **Real fix:** added a Next.js rewrite (`next.config.ts`) proxying `webigeeks.com/api/*` to the Render backend server-side, so the browser only ever talks to `webigeeks.com` and the cookie becomes first-party. This meant `NEXT_PUBLIC_API_URL` had to become a relative `/api` for browser calls — which in turn broke server-side data fetching at build time (SSG has no running proxy to resolve a relative URL against), fixed by centralizing the URL logic in a new `frontend/src/lib/apiBaseUrl.ts` that picks a relative path in the browser and the real backend URL (`BACKEND_URL` env var) server-side, imported by all 11 files that previously read `NEXT_PUBLIC_API_URL` directly.

**Also fixed/added this session:**
- Production refuses to boot with the well-known default `ADMIN_DEFAULT_PASSWORD` (`Admin@123`) — this validation already existed in `config/env.ts`; deploying just surfaced it for the first time. Real password generated and set as a Render env var, not committed anywhere.
- Google OAuth 2.0 sign-in implemented end-to-end and verified working: `passport-google-oauth20` strategy (`backend/src/config/passport.ts`), `GET /api/auth/google` + `/api/auth/google/callback` routes, `User` model now supports Google-only accounts (`googleId` field, `password` conditionally required, auto-links to an existing email/password account by email). The frontend already had an unused `GoogleSignInButton.tsx` component from an earlier, never-finished pass — wired it into both `/login` and `/register`. Google's OAuth callback URL had to point at `webigeeks.com/api/auth/google/callback` (proxied), not the Render URL directly, for the same first-party-cookie reason as Bug 3 — the Google Cloud Console "Authorised redirect URIs" needed updating to match.
- Removed a duplicate logo on `/login` and `/register` (a mobile-only logo block repeated the navbar's logo directly above the form).

**Known follow-ups:**
- WhatsApp notifications remain unconfigured (env vars blank) — separate from this session's work, see Phase 7.
- No CI/CD beyond Render/Vercel's own auto-deploy-on-push — no test gate before deploy.
- The `~/Desktop` iCloud sync issue (see gotchas above) cost significant time this session re-installing corrupted `node_modules`/`.next` — worth fixing properly (move the repo, or exclude `node_modules`/`.next` from sync) before the next long session.

---

## Checkpoint — full end-to-end test pass on production (2026-07-26)

**Trigger:** after all of Phase 12's fixes, did a full click-through of the live site (`webigeeks.com`) to verify nothing was still broken, using real browser automation (not just curl) — registration, login, logout, admin panel, lead capture, session persistence.

**Result: everything tested passed, no new bugs found.** Specifically verified live:
- Public pages (Home, Courses, About, Testimonials, Gallery, Blog, Contact) all render without errors.
- Contact page lead form: submitted a real test lead → confirmed it appeared correctly in `/admin/leads` with all fields (name, contact, course, source, status, date). This exercises the full path: frontend form → proxied API call → backend → MongoDB Atlas → admin read.
- Student registration → auto-login → `/dashboard` redirect, sidebar nav (Overview/Profile/My Course/Payments/Notifications/Documents) all load.
- Logout correctly clears the session; navigating back to `/dashboard` afterward correctly bounces to `/login?redirect=...` (confirms the auth-cookie fix from earlier in Phase 12 is holding up, not just working once).
- Admin login, `/admin/leads`, `/admin/students` (shows real pre-existing student records correctly), `/admin/courses` (correctly empty).
- All test data created during this pass (one lead, one student account) was deleted from Atlas afterward — production data untouched.

**Two things flagged, explicitly NOT bugs, decision pending from the user (ask before touching):**
1. **Courses/Gallery/Blog are empty in production** — fresh Atlas DB, nothing seeded. Testimonials already has real entries (someone added them via admin already). Backend has an existing `npm run seed:courses` script that's never been run against production. Gallery/Blog need real photos/articles from the user — not something to fabricate.
2. **Contact form's "Course of Interest" `<select>` is `required` but fails silently on submit if left on the placeholder** — no custom error shown, relies entirely on the browser's native validation tooltip. Whether this is worth a custom-error fix, given native tooltips do work for real users, is genuinely unclear — asked the user, got interrupted mid-question, **no decision made yet**. Don't assume either way; ask first.

**If resuming this exact spot from a different machine:** both repos are clean and fully pushed (`wg-backend` @ `55b2698`, `wg-frontend` @ `73b4e3f`, at time of writing) — `git pull` on both gets you current. No local-only work exists anywhere.

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
