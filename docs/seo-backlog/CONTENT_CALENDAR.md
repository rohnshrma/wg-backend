# WebiGeeks — 6-Month Content Calendar

> **Update 2026-08-06:** all 12 location pages originally spread across Months 1-3 below shipped together in one session instead (see `GROWTH_BACKLOG.md`) — the user asked to keep going through the full course catalogue rather than the paced rollout this calendar assumed. The month-by-month breakdown below is left as-is for the reasoning behind the *order* (which pages would have mattered most first), but treat Months 1-3's location-page items as done, and the freed-up time as available to pull forward from Month 4+ instead.

> Mapped to the real keyword clusters from the original SEO audit (§04), prioritized by how much of the underlying content already exists (cheaper to ship, faster to rank) and how directly each item targets the 7 primary KPI keywords. No traffic numbers are fabricated below — I don't have Search Console or a keyword-volume tool connected, so "expected value" is qualitative (which real gap it closes), not a made-up number. Get Search Console connected (see `GROWTH_BACKLOG.md`, Analytics theme) before trusting any traffic projection anyone gives you for this plan.

**Cadence:** roughly one location page + one blog post per month. This is deliberately not aggressive — two rushed, thin pieces a month do less for topical authority than one well-researched one, and every piece here needs a real person (or me, next session) to actually write it well, not just generate a template.

---

## Month 1

| | |
|---|---|
| **Location page:** `/python-course-gurugram` | Second course after MERN — cheapest, shortest course (2-3 months, ₹15,000) means the highest fresher/career-switcher search volume of anything in the catalogue. Targets "Python course Gurugram," "Python training institute Gurgaon" directly. |
| **Blog:** "MERN Stack vs Python Full Stack: Which Should You Learn First in 2026?" | Real comparison-intent gap identified in the audit. Cross-links both new location pages and both course pages — this single post does double duty as an internal-linking hub between your two flagship courses. |

## Month 2

| | |
|---|---|
| **Location pages:** `/data-analytics-course-gurugram` + `/power-bi-training-gurugram` | Power BI is an explicit named KPI keyword but currently only exists as a tag inside the Data Analytics course — this gives it its own real page. Both ship together since they share a lot of real overlapping content (Power BI is literally Module 8 of the Data Analytics curriculum). |
| **Blog:** "How Much Does a Full Stack Developer Earn in Gurugram? A 2026 Guide" | Real informational-intent gap. **Guardrail:** any salary figures used must be sourced (e.g. cited from a real, linkable source like Glassdoor/AmbitionBox/Naukri aggregate data) or phrased as ranges with a citation — never invented numbers presented as fact. |

## Month 3

| | |
|---|---|
| **Location page:** `/full-stack-course-gurugram` | Broader positioning page for the "Full Stack Course Gurugram" KPI keyword specifically (distinct search intent from "MERN," even though it's the same underlying course) — a real, defensible second angle on the same course, not a duplicate. |
| **Page:** `/best-coding-institute-gurugram` | Legitimate standalone positioning/comparison page — directly targets "Coding Institute Gurugram" and "best coding institute" intent. Needs real differentiation copy (small batches, real address, genuine placement process) — not generic claims. |

## Month 4

| | |
|---|---|
| **Page:** Glossary (technical terms glossary) | Built from data that already exists — every course's real `technologies[]` list — so this is cheap to produce and immediately useful for AI-search citation (definitions are exactly what gets pulled into AI Overviews/Perplexity answers). |
| **Page:** Placement / Success Stories (`GROWTH_BACKLOG.md` H6) | Real testimonial data (`companyPlaced`, `salaryPackage`, `rating`) already exists in the DB, unused as a standalone indexable page — this is a trust/EEAT page as much as an SEO page. |

## Month 5

| | |
|---|---|
| **MERN topic cluster:** Interview Questions + Career Roadmap | Real content grounded in the actual 16-module curriculum already written for the course — this is "repackaging what you already teach," not new invented content. Both link back to `/courses/mern-stack-development` and `/mern-course-gurugram`. |
| **Blog:** "Best Programming Language to Learn for a Career Switch in 2026" | Real informational-intent gap from the audit, naturally cross-links MERN/Python/Java/C++ course pages — a genuine hub piece. |

## Month 6

| | |
|---|---|
| **Python topic cluster:** Interview Questions + Career Roadmap | Same treatment as Month 5's MERN cluster, mirrored for the second flagship course. |
| **Review month — no new content.** Re-pull Search Console data (assuming it's connected by now), check which of the last 5 months' pages are actually gaining impressions/clicks, and use that real data to decide Month 7+ rather than guessing forward another 6 months blind. |

---

## Why this order, specifically

1. **Location pages before topic-cluster content** — the KPI is "Top 3 for [course] Gurugram," and right now there's exactly one page (`/mern-course-gurugram`) that can plausibly win that query shape. Closing that gap for the other named KPI keywords (Python, Data Analytics, Power BI, Full Stack) is higher-leverage than deepening content that's already reasonably strong.
2. **Data Analytics + Power BI bundled in Month 2** because they share real source content — building them together is genuinely more efficient, not corner-cutting.
3. **Comparison/informational blog posts interleaved, not batched** — a comparison post that cross-links two location pages is worth more once both pages exist, so pairing them (Month 1: Python page + MERN-vs-Python post) compounds rather than being two disconnected pieces.
4. **Glossary and Placement pages in Month 4** because they're the cheapest real content to produce (built from existing DB fields) — a natural place to bank a quick win between two heavier location-page months.
5. **Topic clusters (interview questions/roadmap) last** because they're the most content-heavy to do well, and by Month 5 there should be real Search Console data informing whether MERN or Python is actually the better first investment — don't guess that order 6 months out.
