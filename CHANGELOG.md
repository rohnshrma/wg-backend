# Changelog

Notable changes to the backend. Full context and rationale for each entry lives in `ROADMAP.md`; this file is a scannable index.

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
