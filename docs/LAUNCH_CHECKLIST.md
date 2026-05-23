# LAUNCH_CHECKLIST.md
# My Wealth Maps — Production Go-Live
# Last updated: May 2026 (Sprint 13 current; Sprint 12 closed)

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
- [ ] **Advisor referral loop proven** — at least one advisor has shared links and a click has resolved correctly in `referral_clicks` (manual verification in Supabase)
- [ ] **Attorney referral loop proven** — at least one attorney row exists in `attorney_listings` with a `referral_code`; `?aref=` click resolves correctly in `referral_clicks`
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
- [ ] **Extended smoke test written (Sprint 13)** — CONSUMER_RELEASE_SMOKE_TEST.md must include
  test rows for: `?ref=` referral logging, `?aref=` attorney referral logging, signup attribution
  (both profile columns), drip step 1 delivery, all 24 event slug 200-responses, and
  life-event-on-connect advisor portal visibility. Must be written before Sprint 14 begins.
- [ ] **"Referral loop proven" definition confirmed** — exact Supabase queries for advisor and
  attorney referral verification documented in the smoke test before Sprint 14 begins.

- [x] **App URL in emails** — `lib/app-url.ts` `getAppUrl()` on email routes (Sprint 9)
- [x] **Digital Assets tier gate** — `FEATURE_TIERS['digital-assets'] = 2` + `UpgradeBanner` on page (Sprint 9)
- [ ] **Attorney referral production test** — register a test attorney, confirm `referral_code` auto-generated by trigger, confirm portal newsletter kit renders, confirm `?aref=` click logs correctly
- [ ] **End-to-end smoke test** — new consumer signup → household setup → assessment → email capture → drip step 1 → advisor connection → advisor portal view; all steps verified on production URL

---

## Section 2 — Technical go-live steps

Run these on launch day after all Section 1 gates are checked. Do not run early.

### Code

- [x] **`app/robots.ts`** — permissive rules in repo (Sprint 9); confirm deployed at `https://mywealthmaps.com/robots.txt` before Search Console submission
- [ ] **`app/layout.tsx`** — no change needed; `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` already wired via env

### Vercel Production env vars

Set in Vercel dashboard → Settings → Environment Variables (Production only), then redeploy:

- [ ] `NEXT_PUBLIC_APP_URL` → `https://mywealthmaps.com`
- [ ] `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` → content value from Google HTML tag method
- [ ] `RESEND_API_KEY` → confirm set
- [ ] `INTERNAL_API_KEY` → confirm matches drip + cron callers
- [ ] `CRON_SECRET` → confirm set for `/api/cron/notifications` and `/api/cron/age-triggers`

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

- [ ] `20260521000000_create_life_events.sql`
- [ ] `20260522000000_advisor_referrals.sql`
- [ ] `20260523000000_funnel_events.sql`
- [x] `20260523000001_app_config_ab_tests.sql` (superseded: `20260531000000_remove_ab_test_app_config.sql` removes A/B rows)
- [ ] `20260524000000_email_captures_drip.sql`
- [ ] `20260528000000_attorney_referrals.sql` (Sprint 8 — ✅ confirmed applied)
- [ ] `20260529000000_profiles_referral_attribution.sql` (Sprint 9)
- [ ] **`20260530000000_sprint9_10_gates.sql`** (Sprint 9/10 — **required** for invite-advisor gate, succession intake, connection life-event columns)
- [ ] Attorney referral code trigger confirmed: `attorney_listings_referral_code_trigger` (✅ confirmed Sprint 8)

---

## Pre-launch state (current — Sprint 13)

| Area | Status | Blocks launch? |
|------|--------|----------------|
| Crawlers | `app/robots.ts` permissive rules in repo; verify on prod domain after deploy | Section 2 only |
| Email drip | All 24 slugs have custom sequences in code; prod smoke test still required | Yes — Sprint 14 |
| Sitemap | `app/sitemap.ts` ready; sitemap line in `robots.ts` | Section 2 only |
| Search Console | Not set up — Sprint 15 only | Section 2 only |
| Public URL | `NEXT_PUBLIC_APP_URL` still on Vercel preview URL | Section 2 only |
| Email drip `from` | `hello@mywealthmaps.com` — domain must be verified in Resend at launch | Section 2 only |
| Attorney referral | Migration applied ✅; trigger live ✅; no attorney rows in prod yet | Yes — Sprint 14 |
| Advisor referral | Code live; loop unproven in production | Yes — Sprint 14 |
| Life-event-on-connect | Shipped (Sprint 9/10) | Verify in Sprint 14 smoke |
| Digital Assets tier | Shipped — tier 2 + `FEATURE_TIERS` | — |
| App URLs in email | Shipped — `getAppUrl()` | — |
| Business succession | Shipped — minimal intake (Sprint 10) | — |
| Invite-your-advisor | Shipped — onboarding step (Sprint 10) | Apply migration on prod |
| A/B test decision criteria | Defined in DECISION_LOG (Sprint 10) | Sprint 12 implements winners |
| Persona alerts (business + RE) | Shipped Sprint 12 | `lib/dashboard/personaAlerts.ts` |
| Projections / scenarios / charitable | Sprint 11 scope | Yes — before launch |
| Extended smoke test (referral/drip/attribution rows) | Not written | Yes — Sprint 13 |
| RMD start age by birth year | Shipped (`getRmdStartAge` 72/73/75) | Verify in Sprint 14 smoke |

---

## Completion log

| Date | Sprint | Notes |
|------|--------|-------|
| May 2026 | Sprint 8 | Attorney referral migration applied; trigger confirmed |
| May 2026 | Sprint 9 | Signup referral attribution — profiles + funnel_events |
| May 2026 | Sprint 9 | Drip — all 24 event slugs; RMD cohorts; life-event-on-connect; Digital Assets tier 2; getAppUrl audit |
| May 2026 | Sprint 10 | Business succession minimal; invite-advisor onboarding; A/B criteria; CONNECTED_ADVISOR_CLIENT_STATUSES |
| May 2026 | Sprint 12 | A/B collapse; persona alerts; mobile drawer; full copy audit |
| — | — | _Record launch date and who verified Search Console / domain_ |
