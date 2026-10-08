# Changelog

Notable changes to the backend. Full context and rationale for each entry lives in `ROADMAP.md`; this file is a scannable index.

## 2026-10-08

- **New**: admin can pause/resume a student's account (`PATCH /api/students/:id/pause`, `/resume`). Pausing records a required reason on `Student` (`isPaused`/`pauseReason`/`pausedAt`/`pausedBy`) and sends an email the admin previews and can edit (subject + body) before it goes out — `sendAccountPausedEmail` renders it in a new red/`danger`-themed variant of the shared email template. The copy never attributes the action to "the admin"; it's phrased institutionally. Login is **not** blocked — the student can still sign in; the frontend shows a blocking popup with the reason and support contact details instead.
- `POST /api/auth/login` and `GET /api/auth/me` now include `isPaused`/`pauseReason` on the returned `user` for students (joined from `Student`), so the frontend can show the popup right after login and again on any later page load.
- Added `account_paused` / `account_resumed` to `Notification.type`; an in-app notification is created on both pause and resume for the record.
- Tests: `tests/student.test.ts` covers login succeeding while paused with the reason surfaced in both the login and `/auth/me` responses, double-pause/double-resume guards, validation, and non-admin access being rejected.

## 2026-09-15

- **Bug fix**: website leads never appeared in the admin "Enquiry Pipeline" — `Lead` (what every public form writes) and `Enquiry` (what the pipeline reads) were two separate models with no sync between them. `POST /api/leads` now auto-creates a matching `Enquiry` (source `website`, owned by the earliest active admin, skips if an active enquiry for that mobile already exists).
- Raised `inquiryLimiter` from an undocumented 5/hour to 30/hour per IP — 5 was silently exhausted by normal multi-form browsing.
- Fixed a `Lead.source` TS-interface/enum drift (`'sticky_cta'` was missing from the interface only).
- See `ROADMAP.md` "Enquiry Pipeline never received website leads" for full detail, including production verification steps.

## 2026-08-19

- **Bug fix**: CORS allowlist didn't include the new `webigeeks.in` ads domain — every real browser lead submission from it failed with a 500 (`curl`/Postman testing couldn't catch this since those send no `Origin` header). Added `https://webigeeks.in` / `https://www.webigeeks.in` to `allowedOrigins` in `app.ts`.
- Added `DELETE /api/leads/:id` (admin-only) — no delete route existed for leads before this.
- See `ROADMAP.md` "Data Analytics ads landing page + webigeeks.in launch" for full detail, plus an important note on `~/Desktop/webigeeks` and `~/dev/webigeeks` checkout health.

## 2026-07-25

- **Security fix**: closed a mass-assignment vulnerability in `PUT /api/students/:id` that let a student self-assign `status`, `isProfileLocked`, `totalPaid`, `admissionId`, etc. on their own record. Students are now restricted to an explicit field allowlist; admins retain full access.
- **Security fix**: added rate limiting to `PUT /api/auth/change-password` (previously missing, inconsistent with the rest of the auth surface).
- **Security fix**: removed the JWT from auth response bodies (login/register/reset/change-password) — the httpOnly cookie is now the sole auth channel.
- Added zod request validation to the student profile update route.
- Added the project's first ESLint config (`.eslintrc.json`) — `npm run lint` was previously a no-op.
- Added `GET /testimonials/admin/all`, `GET /gallery/admin/all`, `GET /blogs/admin/all`, `GET /blogs/admin/:id`, and `PUT /gallery/:id` — admin-only listing/editing endpoints needed to power the new admin CMS UIs (public endpoints filter to active/published only).
- Added `scripts/devMongo.ts` — a local-only dev MongoDB via `mongodb-memory-server`, for machines without a system MongoDB install.
- Added a Jest + supertest + mongodb-memory-server test suite covering auth, RBAC, the mass-assignment fix, and CMS CRUD.
