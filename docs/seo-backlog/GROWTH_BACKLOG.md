# WebiGeeks — Growth Backlog

> **DEPLOYED 2026-08-06** — the internal-linking fixes and `/mern-course-gurugram` are live on webigeeks.com, confirmed via direct curl verification (title, canonical, full schema stack incl. a real `AggregateRating`, sitemap entry, reciprocal links, Footer now correctly listing all 12 courses instead of the stale 6). See updated line items below.
>
> Companion to `MASTER_TASK_BOARD.md` (technical SEO — now ~8.5-9/10, treat as finished unless a regression turns up). This board covers the growth mandate: topical authority, programmatic SEO, GBP, backlinks, AI search visibility, content calendar, conversion. Organized by theme, not by literal department — one agent (this one) executes against it, prioritizing by real ROI rather than working phase-by-phase in the order requested.

**Target keywords (Top 3 goal):** MERN Course Gurugram · Python Course Gurugram · Full Stack Course Gurugram · Coding Institute Gurugram · Programming Classes Gurugram · Power BI Training Gurugram · Data Analytics Course Gurugram

---

## Decision log

### D1 — Rejected: URL-per-neighborhood/fee/duration programmatic pages
The growth brief asked for pages like `/python-course-sector-14`, `/python-course-near-huda-city-centre`, `/python-course-near-sikanderpur`, `/python-course-fees`, `/python-course-duration`, `/python-placement`. **Not building these as separate URLs.**

**Why:** WebiGeeks has one physical campus. Splitting one location's information across a dozen near-identical thin pages — swapping only a neighborhood or fact-fragment per URL — is the exact pattern Google's spam policies label *scaled content abuse* / doorway pages. The realistic outcome isn't 10 ranking pages, it's a site-wide algorithmic trust penalty that drags down pages that deserve to rank. This isn't a conservative guess — it's the standard failure mode of programmatic SEO done without genuine per-page differentiation.

**What ships instead:** one real, differentiated location page per course (`/[course]-course-gurugram`), each with unique local content (campus context, metro access, local FAQs, real testimonials) — not a template with find-and-replace. Neighborhood/metro mentions live as *content* inside that page (legitimate, normal local SEO), not as their own indexable URLs. Fee/duration/placement information stays on the canonical course page as the single source of truth, cross-linked rather than forked.

### D2 — No fabricated content, ever
Every new page, FAQ, testimonial reference, or stat this backlog produces is either pulled from real data (the `Course`/`Testimonial`/`Blog` collections, `siteConfig`) or clearly generic/informational (a roadmap, a definition, a comparison of publicly-known facts) with no invented specifics. No invented student names, placement numbers, salary figures, or "case studies." If a deliverable needs a number that doesn't exist yet (e.g., a real backlink count, real GBP review count), it's marked `[TODO: source this]`, not filled in with something plausible-sounding.

### D3 — GBP, outreach, and social content are drafts, not actions
I don't have API/login access to Google Business Profile, LinkedIn, or any outreach inbox. Everything under Phase 4/5 below is a **ready-to-use draft** for the user (or whoever manages these accounts) to review and post/send — not something posted or sent autonomously.

---

## Theme: Topical Authority & Content Depth (Content Strategist / Topical Authority Engineer)

Real content already exists and is deep (16-module curricula, real FAQs, real projects) for the flagship courses — the gap is that it's siloed on one page per course with no surrounding topic cluster (roadmap, interview prep, salary/career content, comparisons).

| Item | Status | Note |
|---|---|---|
| MERN topic cluster: roadmap/interview-prep/career content | TODO | Highest-value cluster — MERN is the flagship, 7-month, highest fee course |
| Python topic cluster | TODO | Second priority — shortest, cheapest course = highest funnel volume |
| Course comparison content ("MERN vs Python: which first?") | TODO | Real commercial-investigation keyword gap identified in the original audit |
| Glossary page (real terms already in `technologies[]` across all 12 courses) | TODO | Cheap to build from existing data, genuine AI-search/entity value |
| Placement/Success Stories page | TODO | Carried over from `MASTER_TASK_BOARD.md` H6 — real testimonial data exists, unused as a standalone page |

## Theme: Local SEO & Programmatic Pages (Local SEO Lead / Programmatic SEO Engineer / Information Architect)

| Item | Status | Note |
|---|---|---|
| Location page for all 12 live courses | **DONE** (2026-08-06), confirmed live 2026-08-07 | Deployed and re-verified via direct `curl` against production (all 12 in `/sitemap.xml`, unique titles, self-canonical). Refactored onto a shared template (`src/data/locationPages.ts` + `src/components/location-pages/CourseLocationPage.tsx`) rather than 12 hand-duplicated files — see the commit for the differentiation approach (real per-course facts, not a mail-merge) |
| `/full-stack-course-gurugram` (distinct positioning angle from `/mern-course-gurugram`, same underlying course) | TODO | Not built — a genuine second angle on MERN needs different framing to avoid overlapping too closely with the existing MERN page, deferred rather than rushed |
| `/best-coding-institute-gurugram` — positioning/comparison page | TODO | Distinct intent from a single-course page; legitimate standalone page, not a doorway |
| `/coding-classes-sector-14` | REJECTED as separate URL, folded into location pages' campus-context copy | Same reasoning as D1 — one campus doesn't need its own neighborhood page distinct from the course pages that already mention Sector-14 |
| Internal link graph: Related Courses cross-links | **DONE** (this session) | `courses/[slug]` now cross-links 3 related courses by shared technology tags |
| Internal link graph: Footer course list | **DONE** (this session) | Was hardcoded to 6 of 12 live courses; now dynamic, all 12 |
| Internal link graph: Navbar course dropdown audit | TODO | Not checked this session — verify it doesn't have the same staleness bug as the old Footer |

## Theme: Google Business Profile (GBP Manager)

| Item | Status | Note |
|---|---|---|
| GBP content pack (descriptions, services, FAQs, sample posts, posting cadence) | **DONE** (this session) | See `webigeeks/GBP_CONTENT_PACK.md` — draft only, needs the user (or GBP owner) to actually post |
| Review acquisition workflow | Drafted in the content pack | Operational, not code — needs a real person to run it |
| Photo strategy | Drafted in the content pack | Needs real campus/classroom photos, not stock images |

## Theme: Backlinks & Digital PR (Digital PR Manager / Backlink Outreach Manager)

| Item | Status | Note |
|---|---|---|
| Outreach strategy + email templates | **DONE** (this session) | See `webigeeks/BACKLINK_OUTREACH_STRATEGY.md` — targets are real, specific organizations to research and contact; no outreach was sent |
| Outreach tracking sheet | Drafted (structure only, in the same doc) | Needs a real spreadsheet/CRM to actually track — this is a header/column spec, not populated data |

## Theme: AI Search Visibility (AI Search Engineer)

Mostly inherited from the completed technical work — `Course`/`FAQPage`/`Organization`/`BreadcrumbList` schema is live, which is the foundation AI answer engines lean on.

| Item | Status | Note |
|---|---|---|
| Direct-answer opening sentence per course page | TODO | Recommended in the original audit §08, not yet implemented — one sentence per course page stating what it is/who it's for, before the marketing copy |
| Comparison-table content (structured, LLM-chunkable) | TODO | Overlaps with the course-comparison content above |
| FAQPage schema on the new location page | **DONE** (this session) | 4 genuinely new local FAQs, not duplicated from the course page |

## Theme: Content Calendar (Content Strategist)

| Item | Status | Note |
|---|---|---|
| 6-month calendar | **DONE** (this session) | See `webigeeks/CONTENT_CALENDAR.md` |
| 12-month calendar | TODO | Deferred — 6 months of real, specific work is more useful right now than 12 months of speculation |

## Theme: Conversion Optimization (CRO Expert)

Not audited this session in depth — flagged for a follow-up pass rather than rushed alongside everything else above.

| Item | Status | Note |
|---|---|---|
| Hero/CTA/trust-signal audit | TODO | Original audit touched this lightly (§05 content gaps); needs its own focused pass |
| WhatsApp CTA prominence check | TODO | `FloatingButtons.tsx` exists — not evaluated for prominence/placement this session |

## Theme: Analytics (Analytics Engineer)

| Item | Status | Note |
|---|---|---|
| Verify GA4 tracks the new location page | TODO | Phase 9 (Analytics) was marked DONE in `wg-backend/ROADMAP.md` — confirm the new `/mern-course-gurugram` route is actually captured, not assumed |
| Rank tracking for the 7 target keywords | TODO | No rank-tracking tool connected this session — needs Search Console or a third-party tool set up before "Top 3" progress can be measured at all |

---

## What's genuinely done this session vs. drafted vs. still open

- **Shipped as real code, committed locally** (5 commits — 4 frontend, 1 backend — pending your `git push` confirmation, same policy as the technical session): Related Courses cross-links, dynamic Footer course list, the `/mern-course-gurugram` page + sitemap entry, and a real bug fix (duplicated brand suffix in page titles, caught via live verification and fixed in both the new page and the still-pending course-metadata seed script before it could ship to 12 pages at once).
- **Shipped as reviewable documents**: `CONTENT_CALENDAR.md`, `GBP_CONTENT_PACK.md`, `BACKLINK_OUTREACH_STRATEGY.md`.
- **QA performed, not just claimed:** `tsc --noEmit` clean, `eslint` clean on every changed file, a full `next build` against a live local backend + reseeded real course data, and live `curl` verification of the rendered title tag, JSON-LD, Related Courses links, Footer link count, and the reciprocal course-page → location-page link — this is what caught the title bug above.
- **Explicitly not attempted this session**: the other 4 location pages (real writing work, not mechanical — doing one well beats four rushed), 12-month calendar, CRO audit, rank tracking setup. Logged above so nothing gets lost, not silently dropped.

## Environment note (not SEO, but real)

Mid-session, the local dev MongoDB (`.devdata/mongo`) came up empty despite normally persisting across restarts — traced to repeatedly stopping it with `Stop-Process -Force`, which is a hard kill and doesn't give WiredTiger a chance to flush/close cleanly, unlike the graceful `SIGINT` the script's shutdown handler expects. Reseeded via `wg-backend/src/scripts/seedCourses.ts` and switched to a non-forceful `Stop-Process` for the rest of this session. Worth remembering for next time this environment is used for local QA.
