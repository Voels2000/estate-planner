# LAUNCH_CHECKLIST.md
# My Wealth Maps — Production Go-Live
# Last updated: 2026-05-25 (Sprint C-6 closed; Sprint 17 go-live prep)

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

**Related docs:** [BUSINESS_READINESS_PLAN.md](./BUSINESS_READINESS_PLAN.md) (WA business + compliance readiness) · [NEXT_SESSION.md](./NEXT_SESSION.md) · [ROADMAP.md](./ROADMAP.md) · [DECISION_LOG.md](./DECISION_LOG.md)

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

### Data deletion & WCPA (Sprint C-6)

- [ ] **`deletion_audit_log` and `deletion_schedule` tables live** — migration `20260625120000_sprint_c6_deletion_compliance.sql` applied in production (verify with SQL in [COMPLIANCE_CALENDAR.md](./COMPLIANCE_CALENDAR.md))
- [ ] **30-day post-cancellation deletion automated** — Stripe `customer.subscription.deleted` webhook schedules; `GET /api/cron/process-deletions` at 2am UTC (`vercel.json`); reactivation cancels pending schedule
- [ ] **Admin portal Data & Compliance tab live** — `/admin` → Scheduled Deletions, Audit Log, Execute Deletion (dry-run default)
- [ ] **Plan-change guard verified** — consumer → advisor upgrade does **not** schedule deletion (active Stripe sub + role checks in webhook and cron; see `lib/compliance/deletionGuards.ts`)
- [ ] **CLI script** — `scripts/gdpr-delete-user.ts` delegates to `lib/compliance/deleteUser.ts` (same path as admin + cron)

- [ ] **Attorney referral production test** — run `npx tsx scripts/seed-test-attorney.ts` (or register manually); confirm `referral_code` on listing; sign in as `test-attorney-portal@rolobe.resend.app` → `/attorney` newsletter kit renders; confirm `?aref=` click logs in `referral_clicks`
- [ ] **End-to-end smoke test** — new consumer signup → household setup → assessment → email capture → drip step 1 → advisor connection → advisor portal view; all steps verified on production URL

**Sprint 14 manual smoke (2026-05-23):** Core §1–3, estate §4–7, §8, §11 **passed** on staging; §9 skipped (needs linked advisor); §10 E2E 19/19; bugs fixed `f4e9160`. See CONSUMER_RELEASE_SMOKE_TEST.md sign-off block.

---

## Section 2 — Technical go-live steps

Run these on launch day after all Section 1 gates are checked. Do not run early.

### Opening signups — go-live flip

The site is in waitlist mode by default on `VERCEL_ENV=production`. Do **not** flip `PUBLIC_SIGNUP_OPEN` until Section 1 product gates, **legal review** ([LEGAL_TODO.md](./LEGAL_TODO.md)), **C-4 manual Stripe walkthrough** ([BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md)), and production drip smoke are signed off.

#### Pre-go-live — legal and config (before go-live day)

Complete before flipping Supabase Auth or `PUBLIC_SIGNUP_OPEN`:

- [ ] **Counsel sign-off** — ToS §10 (disclaimers), §11 (liability cap), §13 (arbitration). **Handoff:** flag those three sections; ask for one consolidated redline — [LEGAL_TODO.md § Counsel handoff](./LEGAL_TODO.md#counsel-handoff--how-to-send-the-tos). Apply redlines + TODO placeholder find-and-replace in **one final commit** before go-live.
- [ ] **Email aliases** — privacy@, security@, legal@ forwarding to monitored inbox
- [ ] **Stripe Dashboard** — `invoice.upcoming` webhook enabled; Customer Portal cancellation enabled; receipt emails on
- [ ] **C-4 manual walkthrough** — signup → paid → receipt → self-serve cancel ([BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md))

#### Pre-go-live — keep Supabase Auth settings OFF

These are **runtime switches** in the Supabase Dashboard (Authentication → Settings). They take effect immediately for all **new** signups once enabled:

- Email confirmations → **OFF** until go-live
- Secure email change → **OFF** until go-live
- Minimum password length → leave at current value (not 12) until go-live

**Why:** Test accounts and seed scripts bypass email verification intentionally. Turning these on now would break local dev, preview smoke, and seeded users.

**Compliance code on `main`:** C-2b through C-5 merged — including `/auth/callback`, confirm-email flow, billing disclosures, `/privacy`, `/terms`. Safe to deploy; auth dashboard switches stay OFF until go-live day.

**Sprint C-3:** Phase 1 (RLS) `236890c`; Phase 1b + Phase 3 (auth callback, MFA, security headers) `56a4407` — **merged on `main`**. Verify on staging before go-live; no separate branch merge required.

#### Go-live sequence (exact order — do not reorder)

Run on launch day after all Section 1 gates are checked.

**1. Supabase Dashboard first**

In **Authentication → Settings**:

- [ ] Email confirmations → **ON**
- [ ] Secure email change → **ON**
- [ ] Minimum password length → **12**

**2. Verify auth callback on staging**

- [ ] Confirm production/preview build includes `/auth/callback` (on `main` since `56a4407`)
- [ ] Test signup → confirm email → login on **staging** with a fresh address

**3. Flip `PUBLIC_SIGNUP_OPEN` in Vercel Production**

- [ ] Vercel → Settings → Environment Variables → Production → `PUBLIC_SIGNUP_OPEN` = `true`
- [ ] **Redeploy** (required after Production env change)

**4. Verify signup surfaces**

- [ ] `https://mywealthmaps.com/signup` → signup form (not `/waitlist` redirect)
- [ ] `https://mywealthmaps.com` → **Get Started** → `/signup`
- [ ] `https://mywealthmaps.com/login` → still works
- [ ] `/signup?invite=…` still works for advisor/attorney/firm invites

**5. End-to-end smoke with a fresh email**

- [ ] Run **Core §1–3** on production ([CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md))
- [ ] Use a **fresh email address** and confirm the full flow: signup → confirm email → login

**To re-enable waitlist mode:** remove `PUBLIC_SIGNUP_OPEN` from Vercel Production and redeploy. (Supabase auth settings can stay ON — new signups will still require verification if the env var is removed and waitlist redirect is active.)

**Implementation:** `lib/waitlist-mode.ts`, `middleware.ts` (runtime `/signup` → `/waitlist` redirect; renamed from `proxy.ts` in `3ceb125` to fix Next.js Turbopack empty middleware manifest), `app/(auth)/signup/page.tsx` (backup redirect), `app/(public)/waitlist/`, `getSignupHref()` on public CTAs.

**Pre-launch (current):** waitlist is on by default on Vercel Production — no env vars required. Optionally set `WAITLIST_MODE=true` / `NEXT_PUBLIC_WAITLIST_MODE=true` for explicit control or local dev. Invite/token signups bypass the gate: `?invite=`, `?invite_token=` + `?firm_id=`, `?connectionToken=`.

### Code

- [x] **`app/robots.ts`** — permissive rules deployed at `https://mywealthmaps.com/robots.txt` (2026-05-24)
- [x] **`app/layout.tsx`** — no change needed; Search Console verified via Cloudflare (meta tag env not required)
- [x] **UX Language Audit (Sprint C-2b)** — All consumer-facing strings audited; `audit-ux-language.sh` 0 findings; all `DISCLAIMER_STRINGS` surfaces wired. Completed: 2026-05-24 (`788aa08`)
- [x] **RLS security (Sprint C-3 Phase 1)** — `20260602000000_sprint_c3_rls_fixes.sql` applied or ready to push; advisor joins `active` + `accepted`. Completed: 2026-06-02 (`236890c`)
- [x] **Auth + security (Sprint C-3 Phase 1b + Phase 3)** — `/auth/callback`, confirm-email, MFA middleware, security headers, PII logging. Completed: 2026-06-02 (`56a4407`)
- [x] **Billing disclosures (Sprint C-4 — code)** — RCW 19.316, FTC cancel, renewal reminders (`462bda9`). **Manual:** Stripe Dashboard + walkthrough — [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md)
- [x] **Privacy + Terms (Sprint C-5 — code)** — `/privacy`, `/terms`, footer links, sitemap (`2e1dff3`, `695a860`). **Manual:** [LEGAL_TODO.md](./LEGAL_TODO.md) — placeholders + counsel sign-off

### Vercel Production env vars (Sprint 15 go-live — verified 2026-05-24)

Set in **Vercel dashboard → Settings → Environment Variables → Production**, then redeploy.
Check each row in the dashboard before domain cutover. Full matrix is the **go-live source of truth**
for ops (also in [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md#production-environment-variables-sprint-15-go-live)).

| Variable | Where it's needed | Status to verify |
|----------|-------------------|------------------|
| `NEXT_PUBLIC_APP_URL` | Sitemap, drip links, referral URLs, estate-health recompute `fetch` | ✅ `https://mywealthmaps.com` (2026-05-24) |
| `RECOMPUTE_SECRET` | Estate health recompute after consumer/strategy saves (`afterHouseholdWrite`) | ✅ Verified (2026-05-24) |
| `RESEND_API_KEY` | Email drip delivery (`/api/email/drip`, capture flows) | ✅ Verified (2026-05-24) |
| `INTERNAL_API_KEY` | Drip + cron internal calls (server-to-server auth) | ✅ Verified (2026-05-24) |
| `CRON_SECRET` | `/api/cron/notifications` and `/api/cron/age-triggers` (Vercel cron + optional GH manual) | ✅ Verified (2026-05-24) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase (browser, Playwright) | ✅ Verified (2026-05-24) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin queries (webhooks, drip, signup side effects) | ✅ Verified (2026-05-24) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Search Console meta tag in `app/layout.tsx` | **Not needed** — verified via Cloudflare domain provider (2026-05-24) |
| `WAITLIST_MODE` | `middleware.ts` + server signup redirect | Optional — default on in Production |
| `NEXT_PUBLIC_WAITLIST_MODE` | Client `getSignupHref()` CTAs | Optional — redeploy when changed |
| `PUBLIC_SIGNUP_OPEN` | Opens public signup at go-live | **Pending** — legal review + C-4 manual verify + Stripe production |

**Checklist (Production environment only):**

- [x] `NEXT_PUBLIC_APP_URL` → `https://mywealthmaps.com` (2026-05-24)
- [x] `RECOMPUTE_SECRET` → matches local secret; recompute smoke passes after deploy (2026-05-24)
- [x] `RESEND_API_KEY` → confirmed set (2026-05-24)
- [x] `INTERNAL_API_KEY` → confirmed set on Vercel Production (2026-05-24)
- [x] `CRON_SECRET` → confirmed set (2026-05-24)
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY` → confirmed set (2026-05-24)
- [x] `SUPABASE_SERVICE_ROLE_KEY` → confirmed set (2026-05-24)
- [x] `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` → **not needed**; Search Console verified via Cloudflare (2026-05-24)
- [ ] **Open signups:** set `PUBLIC_SIGNUP_OPEN=true` → redeploy → confirm `/signup` open (go-live day — after legal + C-4 manual verify)

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

- [x] **Custom domain** — `mywealthmaps.com` attached in Vercel and SSL active (2026-05-24)
- [x] **DNS cutover** — A/CNAME records pointing to Vercel (2026-05-24)
- [x] **Redeploy** after `NEXT_PUBLIC_APP_URL` change — sitemap, drip links, referral URLs all use this value (2026-05-24)

### Resend (email)

- [x] **Verify domain** `mywealthmaps.com` in Resend — SPF/DKIM DNS records added and verified (2026-05-24)
- [x] **Confirm `from` address** — `hello@mywealthmaps.com` in `app/api/email/drip/route.ts` (2026-05-24)
- [x] **Confirm any other Resend sends** use verified domain (2026-05-24)

### Search Console

- [x] **Add property** — URL-prefix for `https://mywealthmaps.com` (2026-05-24)
- [x] **Verify ownership** — via Cloudflare domain provider (not meta tag / `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`) (2026-05-24)
- [x] **Submit sitemap** — Sitemaps → `https://mywealthmaps.com/sitemap.xml` → Submit (2026-05-24)
- [x] **Spot-check indexing requests** — manually request indexing for priority event URLs: `/event/selling-a-business`, `/event/death-of-spouse`, `/event/approaching-retirement`, `/event/estate-tax-law-change`, `/event/serious-diagnosis` (2026-05-24)

### Supabase prod migrations (confirm applied)

**Sprint 13:** 67 migrations applied — local and remote in sync (incl. `20260601000000`).

- [x] Through `20260601000000_advisor_directory_referral_code_trigger.sql` (Sprint 13 verify)
- [x] Final prod spot-check before Sprint 15 go-live (2026-05-24)
- [x] Attorney referral code trigger: `attorney_listings_referral_code_trigger` (Sprint 8; backfill via `seed-test-attorney.ts` if absent) (2026-05-24)

---

## Production state (current — post Sprint 15 cutover, compliance code complete)

| Area | Status | Blocks open signups? |
|------|--------|----------------------|
| Domain / DNS / SSL | ✅ Live `mywealthmaps.com` (2026-05-24) | — |
| Vercel Production env vars | ✅ Verified (2026-05-24) | — |
| Search Console | ✅ Verified via Cloudflare; sitemap submitted (2026-05-24) | — |
| Resend domain | ✅ Verified (2026-05-24) | — |
| Post-cutover smoke §1–3 | ✅ Passed production (2026-05-24) | — |
| Waitlist mode | ✅ Active — public signup → `/waitlist` | — |
| Compliance code (C-2b–C-5) | ✅ All on `main` — see commit log in [NEXT_SESSION.md](./NEXT_SESSION.md) | — |
| Sprint C-3 RLS (Phase 1) | ✅ `236890c` — push migration to production if not applied | Yes (data isolation) |
| LEGAL_TODO + counsel sign-off | ☐ Open — 3 TODO placeholders; ToS §10/§11/§13 | **Yes** |
| Sprint C-4 manual verify | ☐ Stripe Dashboard + production walkthrough | **Yes** |
| Stripe production billing | ☐ Production keys; checkout + webhook | **Yes** |
| Open signups (`PUBLIC_SIGNUP_OPEN`) | **Pending** — go-live day after blockers cleared | Yes |
| Section 1 remainder | Drip prod smoke steps 2–3; E2E path; attorney referral prod test | No (waitlist gate) |
| Dashboard/profile slow renders | ✅ Sprint P-1 + P-2 shipped (`5c24160`, `47a38f3`); remaining ceiling → estate composition read model | No |

### Sprint 17 — remaining (non-code)

| Item | Owner | Notes |
|------|-------|-------|
| **LEGAL_TODO.md** | You | Counsel handoff + one-commit legal update — [§ Counsel handoff](./LEGAL_TODO.md#counsel-handoff--how-to-send-the-tos) |
| **Stripe Dashboard config** | You | invoice.upcoming, portal cancel, receipts |
| **C-4 manual walkthrough** | You | [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) |
| **Stripe production billing** | You | Production keys; checkout + webhook |
| **Go-live day ops** | You | Supabase Auth ON → verify callback → `PUBLIC_SIGNUP_OPEN=true` → Core §1–3 smoke |
| **Drip step 2 check** | Ops | `consumer21@rolobe.resend.app` |
| **Sprint P-2 pre-launch refactors** | ✅ `47a38f3` — recommendations cache, projections cache-first, auth dedup — [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) |

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
| May 2026 | Sprint 15 | Waitlist mode shipped (`7afaedb`, `bb9a191`, `3ceb125`); runtime middleware redirect + force-dynamic signup |
| 2026-05-24 | Sprint 15 | **Closed** — Domain live, DNS cutover complete, Search Console verified via Cloudflare, sitemap submitted, waitlist mode active, post-cutover smoke §1–3 passed. Open signups pending billing setup — set `PUBLIC_SIGNUP_OPEN=true` in Vercel Production + redeploy when ready. |
| 2026-06-02 | Sprint P-2 | **Closed** — Pre-launch perf refactors (`47a38f3`); migration `20260602130000_sprint_p2_recommendations_cache.sql`. |
| 2026-06-02 | Sprint P-1 | **Closed** — Performance quick wins (`5c24160`); indexes applied in prod. |
| 2026-06-02 | Sprint C-3 | **Closed** — RLS (`236890c`); auth callback, MFA, security headers (`56a4407`); docs (`cda2ccc`, `d854c05`). |
| 2026-06-02 | Sprint C-4 | **Code complete** — billing disclosures (`462bda9`); manual Stripe walkthrough remains. |
| 2026-06-02 | Sprint C-5 | **Code complete** — Privacy Policy, Terms of Service, footer, sitemap (`2e1dff3`, `695a860`); [LEGAL_TODO.md](./LEGAL_TODO.md) remains. |
| 2026-05-24 | Sprint 16 | **Closed** — C-2b UX language audit complete (`788aa08`). Go-live prep carried to Sprint 17. |
| 2026-05-24 | Sprint 15 cont. | Preview waitlist mode enabled; sitemap XML fixed (`73648e5`); middleware infra bypass added; test accounts cleaned up (`3f732e3`); dev workflow established (local → preview → production) |
