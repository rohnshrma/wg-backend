# TASKS — next session

> Open work as of end of **2026-08-26 night → 2026-08-27** session. Full context for
> everything here lives in `ROADMAP.md` under "Ads LP shipped to production, and the
> three regressions that surfaced after". Read that section first — it explains *why*
> each of these is worded the way it is.
>
> State at handoff: `wg-frontend` `main` is at `770242b`, pushed and live on Vercel.
> 48/48 tests green, `tsc`/eslint/build clean. Nothing is half-finished — every item
> below is new work, not a resumption.

---

## 1. Accessibility

Lighthouse's two findings are **done** (`770242b`, deployed) — Accessibility **95 → 100**,
no remaining failed audits. Kept here only so nobody re-does them:

- [x] Footer disclaimer contrast — `text-white/30` composited to `#575D6A` on `#0F172A` = 2.70:1. Now `/50` = 5.23:1.
- [x] Hero form heading — `<h3>` directly after the `<h1>` → `<h2>`. The success-state heading ("You're in!") had the identical problem and was fixed with it; Lighthouse only saw the form one because it never submits the form. Live sequence is `h1 → h2 → h2 → h2 → h3`, zero skips.

### [ ] Open: does anything fail contrast **over the hero/CTA gradient**?

Lighthouse cannot evaluate contrast over a gradient, so it silently skips these — its 100
score does **not** mean they pass. Found while fixing the above and deliberately not acted on.

`gradient-hero` is `linear-gradient(135deg, #0F172A 0%, #0B395C 40%, #1672B8 100%)`.
Composited white text against each stop:

| class | over `#0F172A` | over `#0B395C` | over `#1672B8` |
|---|---|---|---|
| `text-white/40` (closing-CTA caption, `DataAnalyticsContent.tsx` ~line 772) | 3.81 | 3.23 | **2.04** |
| `text-white/65` (hero subhead — long-standing) | — | — | **3.08** |
| `text-white/70` (hero body copy — long-standing) | — | — | **3.33** |

**Why this is not a straightforward "bump the opacity" fix, and why I left it:**

1. The table is a *worst case*. It assumes the text sits over the gradient's lightest
   corner. At `135deg` the light end is bottom-right, and the CTA caption is centred — so
   the real background behind it may be much darker than `#1672B8`.
2. The same math condemns the hero's existing `/65` and `/70` body copy, which plainly
   reads fine on screen. **A model that flags text you can see is perfectly legible is a
   model that is wrong, not a bug list.**
3. Raising opacity makes it **worse** at the light end, not better — white on medium blue
   converges. Nothing below `/95` passes over `#1672B8`. So the instinctive fix is
   backwards, and shipping it would make the page uglier for no gain.

**Do this instead:** sample the *actual rendered pixel* behind each element rather than
modelling gradient stops — screenshot the deployed page, read the RGB directly under the
text at a few viewport widths, and compute the ratio against that. Only then decide whether
anything genuinely fails. If something does, the fix is likely a local scrim/darker overlay
behind that text, not a global opacity change.

Verify any a11y change by re-running Lighthouse locally (see §5).

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
