# LAUNCH_CHECKLIST.md
# My Wealth Maps — Production Go-Live
# Last updated: May 2026 (Sprint 15 — waitlist mode live; go-live env matrix updated)

---

## Purpose

Single source of truth for everything required before going live on `mywealthmaps.com`.

Two sections:
1. **Product readiness gates** — feature/quality bars that must be met before any consumer sees the app
2. **Technical go-live steps** — Vercel, DNS, Resend, Search Console ops run on launch day

> ⚠️ **Go-live gate:** Section 2 does not begin until every Section 1 checkbox is checked
> AND the full CONSUMER_RELEASE_SMOKE_TEST manual pass (including the new acquisition/attribution
> rows added in Sprint 13) is signed off. No exceptions.

Do not execute Section 2 until all Section 1 items are checked.

**Related docs:** [NEXT_SESSION.md](./NEXT_SESSION.md) · [ROADMAP.md](./ROADMAP.md) · [DECISION_LOG.md](./DECISION_LOG.md)

---

## Section 1 — Product readiness gates

These must be complete before launch. Update status as sprints close them.

### Distribution & attribution

- [x] **Signup referral attribution** — `mwm_referral_code` and `mwm_attorney_referral_code` persisted from sessionStorage to `profiles` + `funnel_events` on account creation (`app/(auth)/signup/_signup-form.tsx`; migration `20260529000000_profiles_referral_attribution.sql`)
- [x] **Advisor referral loop proven (staging)** — sections A/C passed Sprint 13; `?ref=` → `referral_clicks` verified
- [x] **Attorney referral loop proven (staging)** — sections B/D passed Sprint 13; test listing + `?aref=` verified
- [x] **Life event context on advisor connection** — `pickConnectionLifeEvent()` at accept; `advisor_clients.connection_life_event_*`; visible on advisor client Overview (Sprint 9/10)

### Email drip

- [x] **All 24 event slugs have custom drip sequences** — `DripEventSlug` union + `EVENT_SEQUENCES` cover all 24 slugs (`lib/emails/drip-templates.ts`, Sprint 9)
- [x] **Age-triggered slugs in drip union** — `rmd-start-age`, `medicare-eligibility`, `social-security-timing` in union with custom sequences (age cron + drip aligned)
- [ ] **Drip smoke test on production** — trigger step 1 via event assess email capture; confirm delivery from `hello@mywealthmaps.com`; confirm steps 2 and 3 fire on schedule via cron

### Core planning loop

- [x] **RMD start age by birth year** — `getRmdStartAge` (72 / 73 / 75); advisor Retirement tab + projection/dashboard/RMD calculator aligned (verify 1960+ cohort shows age **75**)
- [x] **Business succession planning page** — minimal intake shipped (Path A); sidebar link live; tier 3 (Sprint 10)
- [x] **Invite-your-advisor onboarding** — `/onboarding/invite-advisor`; `onboarding_invite_advisor_completed_at` (Sprint 10)
- [x] **Mobile nav audit** — dashboard off-canvas drawer on `<lg` shipped (Sprint 12); full route-by-route audit post-launch
- [x] **Projections + Lifetime Snapshot** — `PlanningSurfaceNav` + distinct descriptions on each surface (Sprint 11)
- [x] **Charitable Giving empty state** — personalized topics from household when no donations (Sprint 11)
- [x] **Scenarios page discoverability** — “Open Scenarios” card on `/projections` (Sprint 11)

### A/B tests & personalization

- [x] **A/B decision criteria defined** — DECISION_LOG: `tier_upgraded`, 50 events/variant or 4 weeks, owner Alan (Sprint 10)
- [x] **`ab_upgrade_copy` collapsed** — personalized only (no pre-launch traffic); `lib/analytics/abTests.ts` removed (Sprint 12)
- [x] **`ab_assessment_gate` collapsed** — score_visible only; assess always shows scores to logged-out users (Sprint 12)
- [x] **`EVENT_UPGRADE_COPY`** — 24/24 slugs verified via `scripts/verify-event-upgrade-copy.ts` (Sprint 12)

### Segment-specific features

- [x] **Segment-specific dashboard alerts** — business $5M/$10M threshold alert; multi-state real estate probate risk alert (Sprint 12)
- [x] **Per-milestone upgrade copy** — upgrade copy (Sprint 7) + custom drip sequences for age-milestone slugs (Sprint 9)

### Quality & polish

- [x] **In-app copy audit** — dashboard, public event/assess, planning surfaces, landing, share links (Sprint 12)
- [x] **Extended smoke test written (Sprint 13)** — CONSUMER_RELEASE_SMOKE_TEST.md acquisition &
  attribution sections A–G (`?ref=`, `?aref=`, signup attribution, drip step 1, event slugs,
  life-event-on-connect)
- [x] **"Referral loop proven" definition confirmed** — exact Supabase queries in
  CONSUMER_RELEASE_SMOKE_TEST.md and DECISION_LOG.md (advisor + attorney `referral_clicks`)
- [x] **Test account seed scripts (Sprint 13)** — `seed-test-attorney.ts`, `seed-test-advisor.ts`,
  `seed-test-consumer-estate.ts` (idempotent). Run on staging before Sprint 14 smoke; codes in
  NEXT_SESSION.md § Sprint 14 test account references.
- [x] **`rmd-start-age` event copy** — hero, assess, drip, newsletter labels use birth-year range
  (72/73/75); SEO title/description may still say 73 for search intent (`lib/events/content-sprint5.ts`,
  `lib/emails/drip-templates.ts`).

- [x] **App URL in emails** — `lib/app-url.ts` `getAppUrl()` on email routes (Sprint 9)
- [x] **Digital Assets tier gate** — `FEATURE_TIERS['digital-assets'] = 2` + `UpgradeBanner` on page (Sprint 9)
- [ ] **Attorney referral production test** — run `npx tsx scripts/seed-test-attorney.ts` (or register manually); confirm `referral_code` on listing; sign in as `test-attorney-portal@rolobe.resend.app` → `/attorney` newsletter kit renders; confirm `?aref=` click logs in `referral_clicks`
- [ ] **End-to-end smoke test** — new consumer signup → household setup → assessment → email capture → drip step 1 → advisor connection → advisor portal view; all steps verified on production URL

**Sprint 14 manual smoke (2026-05-23):** Core §1–3, estate §4–7, §8, §11 **passed** on staging; §9 skipped (needs linked advisor); §10 E2E 19/19; bugs fixed `f4e9160`. See CONSUMER_RELEASE_SMOKE_TEST.md sign-off block.

---

## Section 2 — Technical go-live steps

Run these on launch day after all Section 1 gates are checked. Do not run early.

### Opening signups — go-live flip

The site is in waitlist mode by default on `VERCEL_ENV=production`. To open signups:

1. In **Vercel → Settings → Environment Variables → Production**, add:
   - `PUBLIC_SIGNUP_OPEN` = `true`
2. **Redeploy** (recommended after any Production env change; required if you also changed `NEXT_PUBLIC_*` vars — those are baked into the client bundle at build time)
3. **Verify on production:**
   - `https://mywealthmaps.com/signup` → shows signup form (not `/waitlist` redirect)
   - `https://mywealthmaps.com` → **Get Started** goes to `/signup`
   - `https://mywealthmaps.com/login` → still works
   - `/signup?invite=…` still works for advisor/attorney/firm invites
4. Run post-cutover smoke — **Core §1–3** on production ([CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md))

**To re-enable waitlist mode:** remove `PUBLIC_SIGNUP_OPEN` from Vercel Production and redeploy.

**Implementation:** `lib/waitlist-mode.ts`, `middleware.ts` (runtime `/signup` → `/waitlist` redirect; renamed from `proxy.ts` in `3ceb125` to fix Next.js Turbopack empty middleware manifest), `app/(auth)/signup/page.tsx` (backup redirect), `app/(public)/waitlist/`, `getSignupHref()` on public CTAs.

**Pre-launch (current):** waitlist is on by default on Vercel Production — no env vars required. Optionally set `WAITLIST_MODE=true` / `NEXT_PUBLIC_WAITLIST_MODE=true` for explicit control or local dev. Invite/token signups bypass the gate: `?invite=`, `?invite_token=` + `?firm_id=`, `?connectionToken=`.

Do **not** flip `PUBLIC_SIGNUP_OPEN` until Section 1 product gates and production drip smoke are signed off.

### Code

- [x] **`app/robots.ts`** — permissive rules in repo (Sprint 9); confirm deployed at `https://mywealthmaps.com/robots.txt` before Search Console submission
- [ ] **`app/layout.tsx`** — no change needed; `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` already wired via env

### Vercel Production env vars (required before Sprint 15 go-live)

Set in **Vercel dashboard → Settings → Environment Variables → Production**, then redeploy.
Check each row in the dashboard before domain cutover. Full matrix is the **go-live source of truth**
for ops (also in [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md#production-environment-variables-sprint-15-go-live)).

| Variable | Where it's needed | Status to verify |
|----------|-------------------|------------------|
| `NEXT_PUBLIC_APP_URL` | Sitemap, drip links, referral URLs, estate-health recompute `fetch` | Currently preview URL — **update to `https://mywealthmaps.com` at launch** |
| `RECOMPUTE_SECRET` | Estate health recompute after consumer/strategy saves (`afterHouseholdWrite`) | Must match value in local `.env.local`; quoted if value contains `!` or `#` |
| `RESEND_API_KEY` | Email drip delivery (`/api/email/drip`, capture flows) | Confirm set |
| `INTERNAL_API_KEY` | Drip + cron internal calls (server-to-server auth) | Confirm set |
| `CRON_SECRET` | `/api/cron/notifications` and `/api/cron/age-triggers` (Vercel cron + optional GH manual) | Confirm set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase (browser, Playwright) | Confirm set |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin queries (webhooks, drip, signup side effects) | Confirm set (often via Vercel Supabase integration) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Search Console meta tag in `app/layout.tsx` | **Set at launch only** — content from Google HTML tag method |
| `WAITLIST_MODE` | `middleware.ts` + server signup redirect | Optional — default on in Production |
| `NEXT_PUBLIC_WAITLIST_MODE` | Client `getSignupHref()` CTAs | Optional — redeploy when changed |
| `PUBLIC_SIGNUP_OPEN` | Opens public signup at go-live | Set `true` at go-live |

**Checklist (Production environment only):**

- [ ] `NEXT_PUBLIC_APP_URL` → `https://mywealthmaps.com`
- [ ] `RECOMPUTE_SECRET` → matches local secret; recompute smoke passes after deploy
- [ ] `RESEND_API_KEY` → confirm set
- [x] `INTERNAL_API_KEY` → confirmed set on Vercel Production (Sprint 13)
- [ ] `CRON_SECRET` → confirm set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` → confirm set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` → confirm set
- [ ] `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` → set at launch; meta tag visible in page source
- [ ] **At go-live:** set `PUBLIC_SIGNUP_OPEN=true` → redeploy → confirm `/signup` open

**Not required in Vercel Production:**

- `SUPABASE_URL` — used only by local/staging seed scripts (`seed-test-attorney.ts`,
  `seed-test-advisor.ts`, `seed-test-consumer-estate.ts`). Vercel’s Supabase integration sets URL/keys;
  do not add a separate `SUPABASE_URL` for production deploys.

**Seed scripts (staging / local only — not Vercel env):**

```bash
set -a && source .env.local && source .env.test && set +a
npx tsx scripts/seed-test-advisor.ts
npx tsx scripts/seed-test-attorney.ts
npx tsx scripts/seed-test-consumer-estate.ts
```

### Domain & DNS

- [ ] **Custom domain** — `mywealthmaps.com` attached in Vercel and SSL active
- [ ] **DNS cutover** — A/CNAME records pointing to Vercel
- [ ] **Redeploy** after `NEXT_PUBLIC_APP_URL` change — sitemap, drip links, referral URLs all use this value

### Resend (email)

- [ ] **Verify domain** `mywealthmaps.com` in Resend — SPF/DKIM DNS records added and verified
- [ ] **Confirm `from` address** — `hello@mywealthmaps.com` in `app/api/email/drip/route.ts`
- [ ] **Confirm any other Resend sends** use verified domain

### Search Console

- [ ] **Add property** — URL-prefix for `https://mywealthmaps.com`
- [ ] **Verify ownership** — meta tag method; `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` env var triggers tag in `app/layout.tsx`
- [ ] **Submit sitemap** — Sitemaps → `https://mywealthmaps.com/sitemap.xml` → Submit
- [ ] **Spot-check indexing requests** — manually request indexing for priority event URLs: `/event/selling-a-business`, `/event/death-of-spouse`, `/event/approaching-retirement`, `/event/estate-tax-law-change`, `/event/serious-diagnosis`

### Supabase prod migrations (confirm applied)

**Sprint 13:** 67 migrations applied — local and remote in sync (incl. `20260601000000`). Re-verify before prod cutover if new migrations land in Sprint 14.

- [x] Through `20260601000000_advisor_directory_referral_code_trigger.sql` (Sprint 13 verify)
- [ ] Final prod spot-check before Sprint 15 go-live (no new migrations in Sprint 14 without sign-off)
- [ ] Attorney referral code trigger: `attorney_listings_referral_code_trigger` (Sprint 8; backfill via `seed-test-attorney.ts` if absent)

---

## Pre-launch state (current — Sprint 15)

| Area | Status | Blocks launch? |
|------|--------|----------------|
| Migrations | 67 applied (Sprint 13) | Re-check if Sprint 14 adds any |
| Acquisition smoke A–G | **Passed** staging | — |
| Smoke §2.4 (recompute) | **Automated** — `consumer-core-recompute.spec.ts` | Run on deploy |
| Manual smoke §1–3 | ✅ Passed 2026-05-23 | — |
| Manual smoke §4–7 | ✅ Passed 2026-05-23 | — |
| Manual smoke §8, §11 | ✅ Passed 2026-05-23 | — |
| Admin Portal consumer visibility | ✅ Fixed f4e9160 2026-05-23 | — |
| Asset form save button viewport | ✅ Fixed f4e9160 2026-05-23 | — |
| Dashboard/profile slow renders | Post-launch performance ticket | No |
| E2E consumer suite | ✅ 41 passed; staging flakiness confirmed not regressions | Re-run with `--workers=1` if red |
| `INTERNAL_API_KEY` | Vercel Production ✅ | — |
| Public URL / Search Console | Preview URL; Sprint 15 cutover | Section 2 |
| Production env var matrix | Documented § Section 2 | Sprint 15 |
| Optional smoke §9 | Skipped — needs linked advisor | No |
| Drip steps 2–3 | Not verified | Section 1 remainder |
| Section 1 product gates | Sprint 14 smoke + bugs closed | Drip prod smoke + E2E path remain |
| Waitlist mode | **On** — public signup → `/waitlist` | Disable at go-live (§ Section 2) |

---

## Completion log

| Date | Sprint | Notes |
|------|--------|-------|
| May 2026 | Sprint 8 | Attorney referral migration applied; trigger confirmed |
| May 2026 | Sprint 9 | Signup referral attribution — profiles + funnel_events |
| May 2026 | Sprint 9 | Drip — all 24 event slugs; RMD cohorts; life-event-on-connect; Digital Assets tier 2; getAppUrl audit |
| May 2026 | Sprint 10 | Business succession minimal; invite-advisor onboarding; A/B criteria; CONNECTED_ADVISOR_CLIENT_STATUSES |
| May 2026 | Sprint 12 | A/B collapse; persona alerts; mobile drawer; full copy audit |
| May 2026 | Sprint 13 | **Closed** — 67 migrations; E2E 51/0/1; A–G passed; seeds; INTERNAL_API_KEY; RMD copy + advisor trigger blockers fixed |
| May 2026 | Sprint 14 | **Closed** — smoke §1–11 passed; bugs fixed `f4e9160`; E2E 41 passed (staging flakiness `--workers=1`) |
| May 2026 | Sprint 15 | Waitlist mode shipped (`7afaedb`, `bb9a191`); runtime proxy redirect + force-dynamic signup |
| — | — | _Record launch date and who verified Search Console / domain + Vercel Production env vars + waitlist disabled_ |
