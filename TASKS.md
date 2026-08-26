# TASKS — next session

> Open work as of end of **2026-08-26 night → 2026-08-27** session. Full context for
> everything here lives in `ROADMAP.md` under "Ads LP shipped to production, and the
> three regressions that surfaced after". Read that section first — it explains *why*
> each of these is worded the way it is.
>
> State at handoff: `wg-frontend` `main` is at `8ad8e17`, pushed and live on Vercel.
> 48/48 tests green, `tsc`/eslint/build clean. Nothing is half-finished — every item
> below is new work, not a resumption.

---

## 1. Two accessibility fixes (small, safe, do first)

Found by the local Lighthouse run. Accessibility is 95; these two are what's between it and ~100.

- [ ] **Footer disclaimer fails contrast.** "*Terms and conditions apply. See counselor for details." is `#575d6a` on `#0f172a` = **2.7:1**, below the 4.5 minimum.
      `DataAnalyticsContent.tsx`, footer, the `text-white/30` class. Bump until it passes — check the computed ratio, don't just eyeball it.
- [ ] **Heading order skips a level.** The hero form's `<h3>` "Get Your Free Demo + Career Roadmap" follows the `<h1>` with no `<h2>` between (`HeroDemoForm.tsx`).
      Change the tag, keep the visual size with classes. Don't renumber the section `<h2>`s to accommodate it — they're correct.

Verify by re-running Lighthouse locally (see §5 for the command).

---

## 2. Broken link in blog content — **not a code fix**

- [ ] `/mern-stack-course-gurugram` returns **404**. Linked from the blog post
      `job-finding-strategies-that-actually-work-in-2026-the-psychology-and-the-smart-play-2`.
      The real route is `/mern-course-gurugram`, and the same post already links that correctly elsewhere.

The bad string appears **nowhere in `src/`** — it lives in the post body in the database.
Fix it in `/admin/blogs`, not in a commit. Doing it through the backend API instead means a
**write to production content**, so get explicit sign-off first.

This was the only 404 on the site: all 34 sitemap URLs and all 49 internal links found
across them were re-checked, and everything else is 200.

---

## 3. Third-party JavaScript / interactivity — **the big one, and it is not free**

Both audits independently point here: Ubersuggest mobile Interactivity **4576ms (POOR)**,
Lighthouse simulated TTI **6.2s**, TBT 250ms.

Cause is **353KB of Google tag JS, 201KB of it unused**:

| script | unused |
|---|---|
| `gtag/js?id=G-VJ4VWYYLQN` (GA4) | 172KB |
| `gtag/js?id=AW-16786302575` (Google Ads) | 181KB |

For scale, the largest first-party chunk is 72KB.

**Do not just defer both tags and call it a win.** The Ads tag fires the "Contact"
conversion (`reportContactConversion()` in `submitLead.ts`). Delaying it risks losing
conversion signal on fast bouncers, and on a paid page a lost conversion costs more than a
Lighthouse point. This is a trade, not an optimisation.

Suggested order:
- [ ] Measure first — how much of the 4576ms is actually the tags vs. Next hydration? Don't assume.
- [ ] Consider loading GA4 with a lower priority than the Ads tag, since only one of them affects revenue measurement.
- [ ] Whatever changes, **re-verify a real conversion fires afterwards** (submit a lead, confirm the `gtag('event','conversion')` call goes out) before shipping.

---

## 4. Decisions still waiting on the business, not on code

- [ ] **Does the hero scrubber earn its place on mobile?** It sits ~1.6 viewports down,
      below both the lead form and the CTA. The discovery hint now works (fires on reveal,
      not on mount), so it is no longer broken — the question is whether it's worth 188px
      of vertical space there. Answer with scroll-depth data, not taste. Cheap alternative
      if the answer is no: `hidden sm:block` on the panel.
- [ ] **`₹19,999` is now in structured data** (`page.tsx`, the Course `offers`). If the
      banner price changes, that must change with it — mismatched offer data is a
      structured-data violation, not cosmetic drift.
- [ ] **Vercel Preview deploys are failing** (`Error`, ~43s builds). Production is
      unaffected. Likely the deliberate `BACKEND_URL` change — Preview has no such env var,
      which was the accepted trade in the 2026-08-17 entry. Worth confirming that's all it
      is rather than assuming; if Preview should work, set `BACKEND_URL` for that environment.

---

## 5. Verification recipes (so the next session doesn't rediscover them)

**Lighthouse locally** — PSI's anonymous API quota and SEOptimer's free daily cap are both
easy to exhaust; this has neither limit:

```
npx --yes lighthouse@12 https://webigeeks.in/ \
  --only-categories=performance,seo,accessibility,best-practices \
  --form-factor=mobile --screenEmulation.mobile \
  --output=json --output-path=./lh.json \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu" --quiet
```

Then read **both** `largestContentfulPaint` and `observedLargestContentfulPaint` from the
`metrics` audit. Lighthouse defaults to simulated throttling, so the headline LCP is a
model of slow 4G, not what happened. Panicking at the simulated number without checking the
observed one wastes time.

**Browser checks:** assert `document.hidden === false` *inside* the measurement before
trusting any browser-derived number. An occluded tab doesn't just animate slowly — React
never finishes hydrating, so pages sit on `app/loading.tsx`, elements measure 0×0, and CLS
reads a meaningless 0. This cost ~40 minutes to diagnose once already; see the
occluded-tab bullet in `ROADMAP.md`'s "Critical context".

**Local lead submissions must go through :3000.** The backend's CORS allowlist is hardcoded
to port 3000 (`backend/src/app.ts`, `allowedOrigins`), so a verification server on any other
port gets `Not allowed by CORS` — a failure with nothing to do with the code under test.

**Before deploying any branch that has been alive more than a day:** `git fetch` and check
the **behind** count, not just ahead. See the near-miss in `ROADMAP.md` — an incoming commit
touching the same file nearly removed the Google Ads conversion tracking silently.
