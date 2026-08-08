# WebiGeeks — Master SEO Task Board

> Product backlog derived from the 2026-08-06 SEO audit (score 3.9/10). Goal: 9+/10 across Technical, Local, AI Search, Performance, Accessibility. This board is the single source of truth for SEO engineering work — update status as tasks move, don't re-audit from scratch.
>
> Repos: `wg-frontend` (Next.js 16.2.9, Vercel), `wg-backend` (Express/MongoDB, Render). Production auto-deploys from `main` on push in both — **local commits are safe, `git push` to `main` is a production deploy and needs explicit go-ahead each time.**
>
> **DEPLOYED 2026-08-06 17:53 UTC** — both repos pushed to `origin/main` and live in production. All CRITICAL/HIGH items below marked DONE are now confirmed live on webigeeks.com, not just committed. See "Post-deploy verification" below.
>
> **DEPLOYED AGAIN 2026-08-07 evening** — `feature/seo-8-audit` branch (both repos) merged to `main` and deployed. A fresh 31-URL production crawl (not a re-read of this board) found three sitewide defects invisible to prior single-page spot-checks: identical Open Graph/Twitter tags on every page (og:title/description/url all matched the homepage's, regardless of what page was shared), missing self-canonical on 19 of 31 pages, and FAQPage schema absent on 7 of 12 courses. First two fully fixed and verified live; FAQ fix built and verified on local dev for 5 of 7 target courses, blocked on production DB credentials same as C4. Also: fixed the H7 robots-tag conflict properly (see H7 below), added direct-answer sentences (homepage + all 12 course pages) for AI Overviews/LLM browsing, linked all 12 location pages from the sitewide footer, added a self-canonical to the homepage, and re-confirmed L3's hydration error is no longer reproducible (live browser console check against production, zero errors). Full evidence and updated scorecard (6.9 → 7.2/10) in the SEO Audit artifact, v2.0.

Status legend: `TODO` · `IN PROGRESS` · `DONE` · `BLOCKED` · `NEEDS DECISION` (business call, not engineering)

---

## CRITICAL

### C1 — No location keyword anywhere in metadata/H1
- **Problem:** "Gurugram"/"Gurgaon" appears nowhere in any title, meta description, or H1 sitewide — only in the footer address string.
- **SEO impact:** This is the primary reason the site won't rank for any "[course] in Gurugram" query — local relevance signal is absent.
- **Difficulty:** Low (copy change, no architecture risk)
- **Estimated gain:** High — highest ROI item on the board
- **Dependencies:** None
- **Owner:** Technical SEO Agent
- **Status:** DONE (2026-08-06) — root layout title/description/OG/Twitter rewritten with Gurugram targeting; verified live via `curl localhost:3000/`. Course-detail metaTitle still needs C4 (admin CMS entry) to get "Gurugram" next to each course name specifically — sitewide template only appends "WebiGeeks Gurugram" as a suffix.
- **Acceptance criteria:** Homepage title/description mention Gurugram; course detail pages have Gurugram-targeted metaTitle populated

### C2 — Zero structured data anywhere in the codebase
- **Problem:** No `application/ld+json` anywhere. No Organization, LocalBusiness, Course, or FAQPage schema.
- **SEO impact:** No rich results eligibility, no entity graph signal for Google/AI Overviews/ChatGPT/Perplexity.
- **Difficulty:** Medium (new component + wiring per page type)
- **Estimated gain:** High
- **Dependencies:** None
- **Owner:** Technical SEO Agent + Local SEO Agent
- **Status:** DONE (2026-08-06) — `JsonLd` component, `EducationalOrganization` (root), `Course`+`FAQPage` (course detail), `BreadcrumbList` (course + blog detail), `BlogPosting` (blog detail). Verified live: fetched a real course page and parsed all 4 emitted `<script type="application/ld+json">` blocks as valid JSON with correct `@type`s. Not yet run through Google's actual Rich Results Test (needs a public URL, not localhost).
- **Acceptance criteria:** All four schema types validate on validator.schema.org and Google Rich Results Test

### C3 — Broken Open Graph image
- **Problem:** `/images/og-image.jpg` referenced in metadata, doesn't exist in `public/images/`.
- **SEO impact:** Every shared link (WhatsApp, LinkedIn, Instagram — primary referral channel for a coaching institute) renders broken.
- **Difficulty:** Low
- **Estimated gain:** Medium (CTR/trust on social shares, not a direct ranking factor)
- **Dependencies:** None
- **Owner:** Technical SEO Agent
- **Status:** DONE (2026-08-06) — `app/opengraph-image.tsx` via `next/og` (Satori, bundled with Next.js, no external asset/sharp needed). Verified: `next build` statically generated it with no errors, `curl -I /opengraph-image` returns `200 image/png`.
- **Acceptance criteria:** Facebook Sharing Debugger / Twitter Card Validator render an image for webigeeks.com

### C4 — Course pages have no Gurugram-targeted metaTitle/metaDescription
- **Problem:** `Course.metaTitle`/`metaDescription` are optional CMS fields; empty for most/all of the 12 live courses, falling back to placeless `"${title} Course"`.
- **SEO impact:** Single highest-leverage on-page fix — no deploy required, pure content.
- **Difficulty:** Low (content entry) — script prepared, **not run against production without explicit confirmation**
- **Estimated gain:** High
- **Dependencies:** None
- **Owner:** Local SEO Agent
- **Status:** DONE — SHIPPED TO PRODUCTION (2026-08-07, evening). User provided the production Atlas connection string directly (Render's Web Shell turned out not to have the repo checked out — no `.git`, no `dist`, `src/scripts/` only had `devMongo.ts` — so the script was run from a local terminal instead, connecting directly to Atlas). Node's `mongodb+srv://` SRV DNS lookup failed in this sandbox (`querySrv ECONNREFUSED`) even though plain `nslookup` resolved it fine — worked around by resolving the 3 shard hosts + TXT record (`authSource`/`replicaSet`) manually and connecting with a direct `mongodb://` URI instead. Dry-run against production confirmed all 12/12 real course documents had empty metaTitle/metaDescription (matching what production was already showing live); ran `--apply`; verified via the backend's single-course API endpoint (`GET /api/courses/power-bi`) that the write landed, then confirmed all 12 course pages render their new Gurugram-targeted `<title>` live on webigeeks.com after each page's 60s ISR data-cache window elapsed.
- **Acceptance criteria:** Met — all 12 course documents have non-empty, Gurugram-targeted `metaTitle`/`metaDescription`, confirmed live on production.

### C5 — No location-specific landing pages
- **Problem:** No `/mern-course-in-gurugram`-style page exists for any target keyword.
- **SEO impact:** High — this is literally what every ranking competitor (Ducat, Croma Campus, APTRON) does to win.
- **Difficulty:** Medium (new pages, needs real distinct copy to avoid duplicate-content risk against the matching `/courses/[slug]` page)
- **Estimated gain:** High
- **Dependencies:** C1, C2 patterns (reused)
- **Owner:** Content Authority Agent + Local SEO Agent
- **Status:** DONE (2026-08-06, this line was stale — board said TODO but the work shipped later the same day per `GROWTH_BACKLOG.md` and `webigeeks_seo_initiative` memory). **Re-verified live 2026-08-07** via direct `curl` against production: all 12 `/[course]-course-gurugram` URLs are in `/sitemap.xml`, each returns a unique `<title>`, and `/mern-course-gurugram` has a self-canonical (not pointing at `/courses/mern-stack-development`) plus full JSON-LD (`Course`, `FAQPage`, `BreadcrumbList`, `AggregateRating`).
- **Acceptance criteria:** Met — 12 location pages live (all live courses), each with unique copy, `Course`+`FAQPage` schema, and self-canonical.

### C6 — Graphic Designing / UI-UX courses don't exist
- **Problem:** Two target keywords have no product behind them at all.
- **SEO impact:** Cannot rank content for a course that isn't offered.
- **Difficulty:** N/A — business decision
- **Estimated gain:** N/A until decided
- **Dependencies:** None
- **Owner:** Executive Agent (business decision, not engineering)
- **Status:** NEEDS DECISION — build the course offering, or drop these two keywords from the target list
- **Acceptance criteria:** Decision recorded; if "build," a Course document + course page + this task board updated with a new C-series item

---

## HIGH

### H1 — sitemap.ts always reports lastModified as "now"
- **Problem:** `new Date()` evaluated fresh on every request for every URL, regardless of real change.
- **SEO impact:** Erodes crawler trust in the lastModified signal, wastes crawl budget.
- **Difficulty:** Low
- **Owner:** Technical SEO Agent
- **Status:** DONE (2026-08-06) — now uses real `course.updatedAt`/`post.updatedAt`. Verified live: `/sitemap.xml` shows distinct real timestamps per course (e.g. `2026-08-01T09:42:...` vs `2026-08-01T18:18:...`), not a single "now" value repeated.
- **Acceptance criteria:** `/sitemap.xml` lastModified values differ per URL and match actual DB timestamps

### H1a — Backend course list endpoint strips updatedAt/createdAt
- **Problem:** `course.controller.ts`'s `getAllCourses` `.select()` projection doesn't include `updatedAt`/`createdAt`, so `getCourses()` (used by sitemap + course listing) always returns `undefined` for both.
- **SEO impact:** Would silently break H1's fix with `Invalid Date` in the sitemap if not fixed first.
- **Difficulty:** Low (one-line backend fix)
- **Owner:** Technical SEO Agent
- **Status:** DONE (2026-08-06) — added to the `.select()` projection. Backend `tsc --noEmit` clean; confirmed live via the sitemap now carrying real per-course timestamps (would be `Invalid Date` if this were still broken).
- **Acceptance criteria:** `GET /api/courses` response includes `updatedAt`/`createdAt` on every course

### H2 — Blog posts missing from sitemap.xml
- **Problem:** `sitemap.ts` never loops blog slugs, only includes the `/blog` listing page.
- **SEO impact:** Any published post is orphaned from the sitemap, relies entirely on internal links to get crawled.
- **Difficulty:** Low
- **Owner:** Technical SEO Agent
- **Status:** DONE (2026-08-06) — same fix as H1. Not live-verified against a real published post (local dev DB currently has zero blog posts), but the code path is identical to the verified course-entry loop and passed the build.
- **Acceptance criteria:** Every published blog post's URL appears in `/sitemap.xml`

### H3 — No breadcrumbs anywhere
- **Problem:** No breadcrumb component, no `BreadcrumbList` schema.
- **SEO impact:** Weaker hierarchy signal to crawlers, missed common rich-result in education SERPs.
- **Difficulty:** Low-Medium
- **Owner:** Technical SEO Agent
- **Status:** DONE (2026-08-06) — shipped on course detail and blog detail pages. Verified live on a course page: visible nav renders (`aria-label="Breadcrumb"` present) and `BreadcrumbList` JSON-LD parses correctly with Home → Courses → [course] hierarchy.
- **Acceptance criteria:** Breadcrumb rich result eligible per Google Rich Results Test on both page types

### H4 — Heavy client-side 3D bundle loads unconditionally on 12 different pages
- **Problem:** `Hero3DBackground` (three.js + `@react-three/fiber` + `@react-three/drei`) is statically imported — no `next/dynamic` anywhere in the codebase — on home, about, contact, courses listing, course detail, testimonials, gallery, blog listing, blog detail, login, and register.
- **SEO impact:** Real Core Web Vitals (LCP/INP) risk on mobile — a confirmed Google ranking factor. Component already has a smart 900ms-deferred WebGL mount, but that doesn't help initial bundle size.
- **Difficulty:** Low (mechanical, 12 call sites, same pattern each)
- **Owner:** Performance Agent
- **Status:** DONE (2026-08-06) — all 11 call sites (recounted precisely during implementation, not 12) converted to `next/dynamic(..., { ssr: false })`. Build succeeded; three.js is no longer statically imported anywhere per repo-wide grep. Real before/after bundle-size diff and Lighthouse re-run still outstanding (see Open Items #1).
- **Acceptance criteria:** three.js/`@react-three/*` no longer appear in the initial/shared JS chunk in the Next.js build output; real Lighthouse re-run recommended to confirm LCP/INP improvement (not measured this session — see Open Items)

### H5 — Auth utility pages are indexable
- **Problem:** `/login`, `/register`, `/forgot-password`, `/reset-password/[token]` not disallowed in `robots.txt` and not noindexed.
- **SEO impact:** Thin/duplicate-shaped pages diluting crawl budget and topical focus. Low severity individually.
- **Difficulty:** Low
- **Owner:** Technical SEO Agent
- **Status:** DONE (2026-08-06) — added to `robots.ts` disallow list + `robots: { index: false }` on all four pages. Verified live: `curl /robots.txt` shows all four paths disallowed.
- **Acceptance criteria:** Google Search Console URL Inspection shows these as excluded/disallowed

### H7 — Invalid course slugs return HTTP 200 instead of 404 (soft-404)
- **Problem:** Found 2026-08-07 during a live status-check, not in the original audit. `/courses/[any-invalid-slug]` (e.g. `/courses/graphic-designing`, `/courses/ui-ux-design`, or literally any nonexistent slug) renders a "Course Not Found" page but the server responds `HTTP 200`, not `404`. Confirmed via `curl -o /dev/null -w "%{http_code}"` against production for multiple invalid slugs.
- **SEO impact:** Classic soft-404 — Google Search Console flags these, they can get indexed as thin/duplicate "Course Not Found" pages, and it wastes crawl budget across the entire `/courses/*` path space (any typo'd or old backlinked slug is crawlable forever). Also directly relevant to C6: once Graphic Designing/UI-UX courses are decided, whichever way that goes, this bug means their URLs currently look "live" to a crawler despite having no content.
- **Difficulty:** Low for the mitigation shipped; Medium for a true 404 status (architecture trade-off, see below)
- **Owner:** Technical SEO Agent
- **Status:** PARTIALLY FIXED (2026-08-07). Root cause investigated via Next.js 16's own docs (`node_modules/next/dist/docs/.../loading.md#status-codes`): this app's course detail route already called `notFound()` correctly — the 200 is Next 16's **documented default behavior for streamed responses**, since the HTTP status can't be changed after the response has started streaming. Next.js compensates by auto-injecting `<meta name="robots" content="noindex">`, which Google's own guidance confirms prevents indexing regardless of the 200 status — so this was never actually an indexation risk. What *was* a real bug: `generateMetadata`'s not-found branch didn't override the root layout's default `robots: {index, follow}`, so the page shipped **two conflicting robots meta tags** (one noindex, one index/follow). Fixed by adding `robots: { index: false, follow: false }` to that branch (`(public)/courses/[slug]/page.tsx`) — verified locally, now emits a single consistent noindex signal. **Not fixed: the HTTP status itself is still 200**, not 404. Getting a true 404 requires checking slug existence in `proxy.ts` (Next 16's renamed `middleware.ts`) before the response starts streaming — this repo has no proxy/middleware today, and adding one means every course-page request pays an extra existence-check round trip (the docs explicitly warn against fetching full content in proxy). That's a real perf/architecture trade-off, not a mechanical fix, so it's left as a decision below rather than done silently.
- **Acceptance criteria (partially met):** ✅ No conflicting robots meta tags. ⬜ `curl -o /dev/null -w "%{http_code}" webigeeks.com/courses/<invalid-slug>` still returns `200`, not `404` — open decision: is the noindex-mitigated 200 acceptable (Search Console may still log a "soft 404" note even though it won't index), or is a proxy-based existence check with its added per-request backend load worth building?

### H6 — No Placement Assistance / Success Stories page
- **Problem:** Real placement data (`Testimonial.companyPlaced`/`salaryPackage`) exists in the DB but only surfaces in a homepage carousel — no indexable, linkable page.
- **SEO impact:** Trust/EEAT signal buried where it can't be crawled as its own page or linked to from course pages.
- **Difficulty:** Medium (new page + likely a small new query/endpoint)
- **Owner:** Content Authority Agent
- **Status:** TODO — deferred past this session
- **Acceptance criteria:** `/placements` or `/success-stories` page live, linked from nav/footer and every course page

---

## MEDIUM

### M1 — No Google Maps embed / real geo-coordinates
- **Problem:** `siteConfig.contact.mapUrl` is a short link only; no lat/long anywhere for schema's `geo` property.
- **Owner:** Local SEO Agent
- **Status:** BLOCKED — needs the real coordinates pulled from the Google Business Profile listing (not something obtainable without access); `Organization` schema will ship with a `TODO`-marked placeholder pending this
- **Acceptance criteria:** Real `latitude`/`longitude` in `Organization` schema; embedded map on `/contact`

### M2 — No GBP integration signals on-site
- **Problem:** No link to the Google Business Profile, no review widget, no "Find us on Google" CTA.
- **Owner:** Local SEO Agent (operational, not code)
- **Status:** TODO — operational task for the business owner, not an engineering task
- **Acceptance criteria:** GBP link live in footer/contact; active posting cadence established

### M3 — No Faculty/Instructor pages
- **Owner:** Content Authority Agent
- **Status:** TODO — deferred past this session
- **Acceptance criteria:** At least one Faculty page live with real instructor bios/credentials

### M4 — No course comparison content
- **Owner:** Content Authority Agent
- **Status:** TODO — deferred past this session
- **Acceptance criteria:** At least one "X vs Y" comparison page/post live

### M5 — Location landing pages beyond the initial 4
- **Owner:** Content Authority Agent + Local SEO Agent
- **Status:** TODO — blocked behind C5's initial rollout proving the pattern works
- **Acceptance criteria:** Java, SQL, C/C++ location pages live

---

## LOW

### L1 — Blog post content quality not audited
- **Problem:** Not enumerated this session — the blog is DB-driven and live posts weren't reviewed against a thin-content/keyword-stuffing checklist.
- **Owner:** QA Agent
- **Status:** TODO
- **Acceptance criteria:** Every published post reviewed against the content checklist in the original audit §05

### L2 — Home page duplicates Navbar/Footer/FloatingButtons instead of using the (public) layout group
- **Problem:** `app/page.tsx` rendered its own `Navbar`/`Footer`/`FloatingButtons` rather than living inside `app/(public)/layout.tsx` like every other public route.
- **Owner:** Executive Agent (architecture judgment call)
- **Status:** DONE (2026-08-06) — this "just a maintainability smell" turned out to have a real symptom: the navbar's animated active-link underline (framer-motion `layoutId`) behaved oddly specifically on the Home <-> other-page transition, because Home's separate Navbar instance meant the underline's shared-element animation had to bridge an unmount/remount instead of animating within one persisted component, the way it already did smoothly between e.g. About and Courses. Moved Home to `app/(public)/page.tsx`, deleted `app/page.tsx`. Verified with a real browser (claude-in-chrome): clicked Home->About and About->Home, confirmed clean underline placement both directions, no lingering artifacts. Also build-verified (all 53 routes intact) and curl-verified (exactly one nav/footer/main on Home, no duplication).
- **Acceptance criteria:** Met — single persisted Navbar/Footer instance across all public routes including Home.

---

## QA record (2026-08-06)

All of C1, C2, C3, H1, H1a, H2, H3, H4, H5 above were implemented, then validated in this order before being marked DONE:
1. `tsc --noEmit` clean in both `wg-frontend` and `wg-backend`.
2. `eslint` run against every changed file — zero new errors/warnings introduced (a few pre-existing errors in untouched parts of the codebase were left alone, out of scope). One real self-caught issue (unused `Breadcrumbs` import left in `courses/[slug]/page.tsx`) found and fixed.
3. Started the local dev MongoDB (`wg-backend/scripts/devMongo.ts`, persists in `.devdata/mongo`), built + started the backend, then ran a full `next build` — required for `/blog`, `/courses`, and `/sitemap.xml` to statically prerender, since they fetch from the API at build time.
4. `next build` succeeded; started `next start` and `curl`-verified `/robots.txt`, `/sitemap.xml`, `/opengraph-image`, the homepage, and a course detail page directly — not just "it compiled."
5. All temporary local processes (Mongo, backend, frontend) stopped afterward given the known low-RAM constraint on this machine (see `webigeeks_env_gotchas` memory).

## Real Lighthouse measurement (2026-08-06, follow-up — closes Open Item #1)

Ran `npx lighthouse` (mobile) against both the live production homepage (unchanged code — nothing has been pushed yet) and the local build with this session's fixes, to replace the earlier estimate with real numbers:

| Metric | Production (live, unchanged) | Local build (with fixes) |
|---|---|---|
| Performance score | 58/100 | 53/100 — **not a clean comparison, see caveat below** |
| SEO score (Lighthouse's own category) | 100/100 | 100/100 |
| Accessibility | 90/100 | 90/100 |
| Best Practices | 96/100 | 100/100 |
| LCP | 3.9s | 4.8s |
| TBT (Total Blocking Time) | 2,314ms | 2,068ms |
| JS execution time (bootup-time) | 4.8s | 4.1s |
| Main-thread work | 8.0s | 6.9s |

**Caveat that matters:** production runs on Vercel's CDN/edge network; the local number ran on a raw `next start` Node process on this machine while MongoDB, the backend, and headless Chrome were all also running on it (a machine already flagged as low-RAM in `webigeeks_env_gotchas`). LCP and Speed Index are network/infra-dominated and **not attributable to the code change** from this comparison alone — that's why LCP looks worse locally despite less JS. The metrics that *are* fairly attributable (bootup-time, main-thread work, TBT) all moved the right direction by ~11-15%, consistent with the three.js code-splitting fix (H4) actually reducing JS execution cost. A real before/after needs a Vercel preview deployment, not a local run — that's the next verification step once this is pushed.

**Lighthouse's "SEO" category (100/100 both times) is not the same thing as this board's Local/On-Page SEO scores** — it's a shallow crawlability checklist (title present, meta description present, links crawlable, valid robots.txt) that doesn't check keyword relevance, structured data *content*, or local-search targeting at all. Don't read 100/100 here as contradicting the 2-3/10 On-Page/Local scores elsewhere on this board — they measure different things.

**Bonus finding, unrelated to this session's work:** production throws a live React hydration error (minified error #418 — server-rendered HTML not matching the client render) on every homepage load, which is also why production's Best Practices score (96) is lower than the local build's (100, no console errors). Pre-existing bug on currently-deployed code, not something this session touched. Added as L3 below.

### L3 — React hydration mismatch on the live homepage (new, found via Lighthouse)
- **Problem:** Production throws `Minified React error #418` in the browser console on every homepage load (confirmed via Lighthouse's `errors-in-console` audit against the live site). Error #418 means the server-rendered HTML didn't match what React expected to hydrate on the client, forcing a client-side re-render.
- **Impact:** Real (if usually minor) performance and correctness cost — React discards and re-renders the mismatched subtree. Also drags down the Best Practices score.
- **Difficulty:** Unknown until investigated — needs the non-minified dev build to see the real error text (the production/minified message only gives an error code + a docs link).
- **Owner:** Performance Agent
- **Status:** RE-EVALUATED 2026-08-07 evening — NOT REPRODUCIBLE. Live browser console check (claude-in-chrome) against production, two hard reloads: zero console errors, zero warnings of any kind. Not something this session fixed (no hydration-related code was touched) — it simply isn't recurring today. Left as a closed/monitor item rather than DONE, since the root cause was never identified and it could theoretically resurface.
- **Acceptance criteria:** Met as of 2026-08-07 — re-check if it's ever seen again.

### H8 — Open Graph, Twitter Card and canonical identical/missing sitewide
- **Problem:** Found 2026-08-07 via a fresh 31-URL production crawl (diffing every page's `<head>` against every other page's, not spot-checking one at a time). `og:title`/`og:description`/`og:url` and `twitter:title`/`twitter:description` were byte-identical across all 31 production URLs — every page inherited the homepage's values verbatim. Separately, 19 of 31 pages (all static pages + all 12 `/courses/[slug]` pages) had no `<link rel="canonical">` at all.
- **SEO impact:** Sharing any course or location page on WhatsApp/LinkedIn/Instagram showed the homepage's title, description and URL in the link preview, not the shared page's. Missing canonicals leave those 19 pages without a defensive signal against query-string duplicate-content variants.
- **Root cause:** Next.js metadata merging replaces `openGraph`/`twitter` objects wholesale rather than per-field — any page whose `generateMetadata`/`metadata` export omitted them inherited the root layout's values unchanged. No page had ever set its own.
- **Difficulty:** Low-Medium (one shared helper + mechanical per-page adoption across 21 files)
- **Owner:** Technical SEO Agent
- **Status:** DONE (2026-08-07) — added `wg-frontend/src/lib/seo.ts`'s `pageMetadata()` helper (derives `openGraph`/`twitter`/self-canonical from the same title/description every page already passes to Next's `title`/`description`), applied across all 7 static pages, both dynamic detail routes (`courses/[slug]`, `blog/[slug]`), all 12 location pages, and the root layout (homepage). Verified live: `/courses/power-bi` now shows its own og:title, not the homepage's; 31/31 sitemap URLs have a self-canonical (was 12/31).
- **Acceptance criteria:** Met — every page's OG/Twitter tags reflect its own content; every sitemap URL has a self-referencing canonical.

### H9 — 7 of 12 course pages have zero FAQs / no FAQPage schema
- **Problem:** Found 2026-08-07 via the same fresh crawl. Power BI, SQL, Java, C/C++, MS Excel, React JS and TypeScript course pages emit no `FAQPage` JSON-LD because the DB's `faqs` array is empty for those courses.
- **SEO impact:** No rich-result eligibility and no AI-search answer content for the majority of course pages.
- **Difficulty:** Low — content derived entirely from existing real fields (duration/mode/level/fees), no new authoring needed
- **Owner:** Technical SEO Agent + Local SEO Agent
- **Status:** DONE — SHIPPED TO PRODUCTION (2026-08-07, evening), same session as C4. Dry-run against production caught a real grammar bug before writing ("a intermediate-level course" — missing article agreement for React JS/TypeScript's `intermediate` level) — fixed in the script, re-dry-ran to confirm, then `--apply`. All 7/12 target courses matched in production (`react-js`/`typescript` don't exist in local dev but do in prod — that gap was a local-seed-data issue all along, not a real content gap). Verified: `FAQPage` schema now present and valid on all 7 course pages live on webigeeks.com.
- **Acceptance criteria:** Met — 12/12 course pages now have FAQs; the other 2 keyword targets (Graphic Designing, UI-UX) remain a business decision under C6, not a schema gap.

### H10 — Gurugram location pages had only one sitewide inbound link each
- **Problem:** Found 2026-08-07. Each of the 12 `/[course]-course-gurugram` pages had exactly one internal link pointing to it (from its matching `/courses/[slug]` page), plus the sitemap entry — nothing from the footer, navbar, or homepage.
- **SEO impact:** These are meant to be the site's strongest local-SEO asset; link-starving them relative to their importance weakens the internal PageRank signal they receive.
- **Difficulty:** Low
- **Owner:** Local SEO Agent
- **Status:** DONE (2026-08-07) — added a "Courses by Location in Gurugram" section to the sitewide Footer, sourced from the same `locationPages.ts` data `sitemap.ts` already reads (can't drift out of sync the way the old hardcoded course list did). Verified live: 12 distinct location-page hrefs present in the footer HTML on every page checked. Also audited the navbar for the same staleness risk (flagged unverified in `GROWTH_BACKLOG.md`) — it's a flat 7-item static list with no course sub-menu, nothing to fix there.
- **Acceptance criteria:** Met — all 12 location pages now have a sitewide inbound link in addition to their one course-page backlink.

### H11 — Real Google PageSpeed Insights report found further accessibility/technical issues
- **Problem:** 2026-08-07 late night — user ran an actual PageSpeed Insights scan (mobile + desktop) against production and shared both the live report and a desktop PDF export. Surfaced several real, previously-undiscovered issues: (1) `www.webigeeks.com` served the site directly with HTTP 200, no redirect to the canonical bare domain; (2) homepage heading order violated sequential descent (H1 → H3, skipping H2 — the Hero's embedded "Get Free Career Counseling" lead-capture card); (3) the course-picker `<select>` and name/phone/email inputs across the Hero, `InquiryPopup`, and `ExitIntentPopup` relied on placeholder text only, no real accessible name; (4) icon-only close buttons on both popups and the mobile nav drawer had no `aria-label`; (5) `--color-text-muted` (#94A3B8), a sitewide design token used in 51 files, computed to ~2.66:1 contrast against the site's white/near-white backgrounds — well under WCAG AA's 4.5:1 minimum; (6) Google's new experimental "Agentic browsing" Lighthouse category (checks AI-agent browsability) flagged the same select-element issue independently.
- **SEO/UX impact:** Real accessibility failures (screen readers, and now AI browsing agents per Google's own new category) plus a duplicate-content/link-equity leak via the unredirected www host.
- **Difficulty:** Low — all fixable at the token/component level, no architecture changes
- **Owner:** Technical SEO Agent + Accessibility
- **Status:** DONE (2026-08-07) — all fixed, merged (`fix/pagespeed-findings` → `main`), deployed, and re-verified live on production: `www.webigeeks.com` now returns `308` to the bare domain; homepage H2 count confirms correct heading structure; all four `aria-label`s confirmed present in the live HTML; the new `#64748b` contrast value confirmed in the live CSS bundle (old `#94a3b8` absent). The one item **not** fixed: Lighthouse's "Browser errors were logged to console" flag on Best Practices — investigated via a live browser console check on both `webigeeks.com` and `www.webigeeks.com`, found zero errors on either in a normal session (same conclusion as L3). Left open/monitor rather than fabricating a fix for something that doesn't reproduce.
- **Bonus fix, unrelated to PageSpeed:** found and fixed a real `vitest.config.ts` bug while re-running the test suite — its `exclude` list (`["node_modules", ".next", "tests-e2e"]`) is a literal string match, not a glob, so it didn't catch nested `node_modules` or test files inside a sibling git worktree at `.claude/worktrees/redesign-premium-ui-2026` (unrelated in-progress redesign work, left untouched — see below). This was inflating "npm test" output to 215 files / 69 false failures. Fixed to `["**/node_modules/**", ".next", "tests-e2e", ".claude/**"]`; back to the real baseline of 5 files / 26 tests, all passing.
- **Also found, not part of this item:** a stale `.next` build cache producing genuinely wrong output (compiled classes from a different branch's version of a component) — root cause not fully pinned down, but `rm -rf .next` before rebuilding resolved it. Worth remembering if a future session sees built output that doesn't match source.
- **Acceptance criteria:** Met for all 5 PageSpeed-derived fixes, confirmed via live production verification (not the local build). Console-error flag remains open/unreproducible.

### Note — unrelated in-progress work discovered on `redesign/premium-ui-2026`
2026-08-07 late night: found substantial **uncommitted** changes on a `redesign/premium-ui-2026` branch (Hero, Footer, Navbar, `globals.css`, `layout.tsx` rewritten; `InquiryPopup.tsx` deleted; new `SocialIcons.tsx`) plus a **separate git worktree** at `.claude/worktrees/redesign-premium-ui-2026` with its own checkout. Confirmed with the user this is their own real work, not something to touch. Safely stashed the uncommitted changes (`git stash push -u`, still recoverable via `git checkout redesign/premium-ui-2026 && git stash pop`) before switching back to `main` to do the PageSpeed fixes above — the redesign branch's working tree was left exactly as found otherwise. **Anyone resuming SEO/technical work on this repo should check `git branch`/`git worktree list` first** — there are now two parallel initiatives in flight (this SEO effort on `main`, and a full UI redesign on `redesign/premium-ui-2026`), and future audits/fixes should confirm which branch is actually meant to be live before assuming `main` is the only thing that matters.

## Open items / blockers (documented per "never leave the repo in a broken state")

1. ~~No live Lighthouse/PageSpeed measurement available~~ **RESOLVED 2026-08-06, then confirmed with a real production before/after after deploying.** See "Post-deploy verification" below — this is no longer an open item.
2. **C4's seed script is prepared but still not executed against production** — deploying the code doesn't populate the DB; this still needs the user's explicit go-ahead to run `--apply`, or the values can be entered by hand via `/admin/courses`. Course detail titles are live right now with the generic `"${title} Course | WebiGeeks Gurugram"` fallback, not the course-specific Gurugram copy from the table in the original audit.
3. ~~Nothing in this session was pushed to `origin/main`~~ **DEPLOYED 2026-08-06 17:53 UTC** — both repos pushed and confirmed live.
4. **C5 (location landing pages) and H6 (placements page) are real content-authoring work**, not mechanical fixes — still deferred, not part of this deploy.

## Post-deploy verification (2026-08-06, ~17:53 UTC)

Pushed both repos, polled production until the new deploy was live (Vercel: fast; Render: also fast, no cold-start delay observed), then re-verified everything directly against `webigeeks.com` — not inferred from the build:

- **Title, robots.txt, OG image, sitemap:** all confirmed live via `curl` — new Gurugram-targeted title, all 4 auth paths disallowed, `/opengraph-image` returns real `image/png`.
- **Schema on a real course page** (`/courses/mern-stack-development`): all of `EducationalOrganization`, `Course`, `CourseInstance`, `FAQPage`, `BreadcrumbList`, `PostalAddress` present — and `AggregateRating` is populated, meaning real production testimonials matched to this course, not an empty fallback.
- **Sitemap is still 19 URLs** (no blog entries) — confirmed this is correct, not a bug: production has zero published blog posts right now, same as local dev.

**Real, same-day, same-infrastructure Lighthouse before/after** (mobile, production, `webigeeks.com` — this is the clean comparison the earlier local-vs-prod one couldn't be):

| Metric | Before (this morning) | After (deployed) | Change |
|---|---|---|---|
| Performance score | 58/100 | **87/100** | +29 |
| TBT (Total Blocking Time) | 2,310ms | **300ms** | −87% |
| LCP | 3.9s | **2.7s** | −31% |
| JS execution (bootup-time) | 4.8s | **1.5s** | −69% |
| Main-thread work | 8.0s | **3.4s** | −57% |
| Speed Index | 3.5s | 4.4s | +0.9s (see note) |
| Accessibility / Best Practices / Lighthouse-SEO | 90 / 96 / 100 | 90 / 96 / 100 | unchanged |
| Console errors | 1 (React hydration #418) | 1 (same, pre-existing — L3) | unchanged |

H4 (the three.js code-splitting fix) is the clear driver here — TBT and main-thread work are exactly what removing that JS from the initial bundle should affect, and they moved the most. Speed Index ticking up slightly is a single-lab-run result, not a trend — worth a re-check but not a regression to chase yet given every other metric improved substantially. The pre-existing hydration error (L3) is unaffected either way, confirming it's unrelated to this session's changes.
5. **`Organization` schema's `geo` (lat/long) was deliberately left out entirely**, not stubbed with placeholder coordinates — shipping a wrong location is worse than omitting the field. See M1.
6. **BlogPosting/blog-sitemap code paths are build-verified but not live-verified** — the local dev database currently has zero published blog posts to test against.
