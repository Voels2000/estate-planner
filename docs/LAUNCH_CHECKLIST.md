# LAUNCH_CHECKLIST.md
# My Wealth Maps — Production Go-Live
# Last updated: 2026-05-30 (PDF export path wiring)

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

**Related docs:** [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) (legal/business/ops blockers) · [BUSINESS_READINESS_PLAN.md](./BUSINESS_READINESS_PLAN.md) (WA business + compliance readiness) · [LEGAL_TODO.md](./LEGAL_TODO.md) · [NEXT_SESSION.md](./NEXT_SESSION.md) · [ROADMAP.md](./ROADMAP.md) · [DECISION_LOG.md](./DECISION_LOG.md)

---

## Section 1 — Product readiness gates

These must be complete before launch. Update status as sprints close them.

### Distribution & attribution

- [x] **Signup referral attribution** — `mwm_referral_code` and `mwm_attorney_referral_code` persisted from sessionStorage to `profiles` + `funnel_events` on account creation (`app/(auth)/signup/_signup-form.tsx`; migration `20260529000000_profiles_referral_attribution.sql`)
- [x] **Advisor referral loop proven (staging)** — sections A/C passed Sprint 13; `?ref=` → `referral_clicks` verified
- [x] **Attorney referral loop proven (staging)** — sections B/D passed Sprint 13; test listing + `?aref=` verified
- [x] **Life event context on advisor connection** — `pickConnectionLifeEvent()` at accept; `advisor_clients.connection_life_event_*`; visible on advisor client Overview (Sprint 9/10)
- [x] **Ask advisor about strategy (AF-1)** — connected consumer notifies advisor from Transfer Strategies education cards; advisor **Client Strategy Questions** on client Overview (`a255616`)
- [x] **Setup progress onboarding (OB-3)** — `SetupProgressCard` on dashboard; wizard gate only when no data; Tier 1 import during onboarding
- [x] **Persona-based onboarding (2026-05-29)** — `/onboarding/persona`; migration `20260530100000_onboarding_persona.sql`
- [x] **Prospect Mode polish (2026-05-29)** — `/prospect` DB tax config, PDF export, intake CTA; advisor role on send-intake-request
- [x] **Mobile review mode (2026-05-29)** — alert banner, stacked rec buttons, table scroll wrappers
- [x] **Health score narrative (2026-05-29)** — `HealthScoreBadge` on dashboard, my-estate-strategy, health-check completion, advisor client list, meeting prep; canonical labels; stale recalculate prompt
- [x] **Advisor first-client playbook (2026-05-29)** — 3-option empty state, 3-step localStorage playbook, needs-attention panel, `first_client_connected` notification
- [ ] **Acquisition sprint migration (2026-05-29)** — apply `20260530110000_attorney_intake_requests.sql`; run Tracks 1–3 manual smoke (see NEXT_SESSION)

### Email drip

- [x] **All 24 event slugs have custom drip sequences** — `DripEventSlug` union + `EVENT_SEQUENCES` cover all 24 slugs (`lib/emails/drip-templates.ts`, Sprint 9)
- [x] **Age-triggered slugs in drip union** — `rmd-start-age`, `medicare-eligibility`, `social-security-timing` in union with custom sequences (age cron + drip aligned)
- [ ] **Drip smoke test on production** — trigger step 1 via event assess email capture; confirm delivery from `hello@mywealthmaps.com`; confirm steps 2 and 3 fire on schedule via cron

### Core planning loop

- [x] **RMD start age by birth year** — `getRmdStartAge` (72 / 73 / 75); advisor Retirement tab + projection/dashboard/RMD calculator aligned (verify 1960+ cohort shows age **75**)
- [x] **Business succession planning page** — minimal intake shipped (Path A); sidebar link live; tier 3 (Sprint 10)
- [x] **Invite-your-advisor onboarding** — `/onboarding/invite-advisor`; `onboarding_invite_advisor_completed_at` (Sprint 10)
- [x] **Mobile nav audit** — dashboard off-canvas drawer on `<lg` shipped (Sprint 12); mobile review layer (alert banner, rec cards, table scroll) shipped 2026-05-29
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
- [x] **Pre-launch E2E baseline (profile + growth API, 2026-05-27)** — `consumer-profile-spouse-layout.spec.ts` (4 tests: section headers, live person1 header, spouse toggle + live spouse header, `sm:grid-cols-2`); `consumer-growth-assumptions-api.spec.ts` (empty-body 400 always; round-trip PATCH + revert when `PLAYWRIGHT_HOUSEHOLD_ID` set). Run: `npx dotenv -e .env.test -- npx playwright test tests/e2e/consumer/consumer-profile-spouse-layout.spec.ts tests/e2e/consumer/consumer-growth-assumptions-api.spec.ts --project=consumer --workers=1`. Enable skipped round-trip: `npm run seed:e2e` → copy `PLAYWRIGHT_HOUSEHOLD_ID` to `.env.test` ([E2E_TEST_RESET.md](./E2E_TEST_RESET.md)).
- [x] **Post-deploy partial PATCH smoke (inline profile prompts, 2026-05-27)** — verified on production (SS + retirement/longevity). Third case (custom deduction) + UI prompts: `npm run test:e2e:go-live-profile`.
- [ ] **Go-live pre-flight (final gate before `PUBLIC_SIGNUP_OPEN`)** — [GO_LIVE_E2E.md](./GO_LIVE_E2E.md): `npm run test:e2e:go-live-profile` then `npm run test:e2e:consumer -- --workers=1`. Then [Prospect + Mobile manual smoke](#prospect--mobile-review-mode-manual-smoke-2026-05-29) (Track 1 before Track 2).
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
- [x] **Tier gating consistency (pre-launch)** — `FEATURE_TIERS` aligned to page gates; `hasFeatureAccess` on sidebar + all gated pages (2026-05-27)

### Data deletion & WCPA (Sprint C-6) ✅ verified 2026-05-25

- [x] **`deletion_audit_log` and `deletion_schedule` tables live** — `20260625120000_sprint_c6_deletion_compliance.sql` applied
- [x] **30-day post-cancellation deletion automated** — webhook schedules; `GET /api/cron/process-deletions` 2am UTC; cron smoke `{"processed":0,"message":"No deletions due"}`
- [x] **Admin portal Data & Compliance tab live** — `/admin` → Scheduled Deletions, Audit Log, Execute Deletion
- [x] **Plan-change guard** — `lib/compliance/deletionGuards.ts` in webhook + cron
- [x] **CLI script** — `scripts/gdpr-delete-user.ts` → `deleteUser`
- [x] **`deleteUser.ts` production hardening** — FK scan (`firms`, `firm_members`, `change_log` + full list), orphan Auth handling, hard/soft delete fallback, post-deletion verification (`aea4bf6`, `3cdd9b5`)
- [x] **`verify:deletion` script** — `npm run verify:deletion -- --email user@example.com` — must PASS before WCPA response
- [x] **Auth table clean** — 9 accounts (4 founder + 5 `@mywealthmaps.test`); all `@rolobe.resend.app` retired
- [ ] **`verify:deletion` tested** — dry-run account deleted and verified PASS on staging/production
- [ ] **No soft-deleted Auth rows** — `SELECT … FROM auth.users WHERE deleted_at IS NOT NULL` returns 0 rows

### Compliance reminders (Sprint C-7) ✅ verified 2026-05-25

- [x] **`privacy_requests` table live** — `20260625170000_sprint_c7_privacy_requests.sql` applied (`due_at` DEFAULT +45 days)
- [x] **`COMPLIANCE_EMAIL`** — `avoels@comcast.net` in Vercel Production
- [x] **Compliance reminders cron** — 8am UTC; manual test via **`https://www.mywealthmaps.com`** (apex redirect strips `Authorization`)
- [x] **In-app privacy intake** — `/settings/security` → Privacy Rights + confirmation email
- [x] **Admin Privacy Requests tab** — status updates via PATCH `/api/admin/deletions`
- [x] **Resend senders verified** — `hello@`, `noreply@`, `privacy@` → Comcast inbox

- [ ] **Attorney referral production test** — run `npm run seed:e2e` (or register manually); confirm `referral_code` on listing; sign in as `e2e-attorney@mywealthmaps.test` → `/attorney` newsletter kit renders; confirm `?aref=` click logs in `referral_clicks`
- [ ] **Attorney billing (2026-05-29)** — apply `20260529130000_attorney_drip_columns.sql`; create Stripe Attorney Starter/Growth prices; set `STRIPE_PRICE_ATTORNEY_*`; test `/attorney/billing` checkout in test mode; confirm webhook sets `attorney_tier`; smoke free-tier upgrade prompts (client cap, PDF, doc dashboard blur)
- [ ] **Persona onboarding migration (2026-05-29)** — apply `20260530100000_onboarding_persona.sql`; smoke fresh signup → profile → persona screen → wizard (persona headline) → dashboard insight card
- [ ] **Health Score + Advisor Playbook manual smoke (2026-05-29)** — [18-step checklist below](#health-score--advisor-playbook-manual-smoke-2026-05-29)
- [ ] **Prospect + Mobile manual smoke (2026-05-29)** — [19-step checklist below](#prospect--mobile-review-mode-manual-smoke-2026-05-29); Track 1 (prospect/PDF/intake) before Track 2 (mobile)
- [ ] **PDF narrative engine manual smoke (2026-05-30)** — [checklist below](#pdf-narrative-engine-manual-smoke-2026-05-30)
- [ ] **Attorney drip cron (ops)** — ~3 days after first real attorney signup: run SQL in [SPRINT_IMPORT_ATTORNEY.md § Post-ship ops](./SPRINT_IMPORT_ATTORNEY.md#post-ship-ops); confirm `attorney_drip_step_2_sent_at` populates; step 3 by day 7 after step 1
- [ ] **End-to-end smoke test** — new consumer signup → household setup → assessment → email capture → drip step 1 → advisor connection → advisor portal view; all steps verified on production URL

**Sprint 14 manual smoke (2026-05-23):** Core §1–3, estate §4–7, §8, §11 **passed** on staging; §9 skipped (needs linked advisor); §10 E2E 19/19; bugs fixed `f4e9160`. See CONSUMER_RELEASE_SMOKE_TEST.md sign-off block.

### Health Score + Advisor Playbook manual smoke (2026-05-29)

**Track 1 — Health score narrative (steps 1–8):** dashboard score + context; `/my-estate-strategy` badge; health-check completion labels; advisor client list badge; meeting prep delta + context; stale indicator (set `computed_at` 31 days ago in SQL, confirm recalculate prompt).

**Track 2 — Advisor activation (steps 9–18):** fresh advisor with 0 clients → 3-option empty state; connect first client → playbook panel + `first_client_connected` notification; auto-complete steps 1–3 (client view, strategy tab, recommendation send); needs-attention panel when score &lt; 50 or high alerts.

See playbook script in session notes / [NEXT_SESSION.md](./NEXT_SESSION.md).

### PDF narrative engine manual smoke (2026-05-30)

**Route:** Advisor client workspace → **Meeting Prep** tab OR header **Export estate report**.

| # | Check | Pass |
|---|--------|------|
| 1 | **Header — Export estate report** — opens narrative multi-page PDF (not one-page brief) | [ ] |
| 2 | **Header — Meeting brief** — legacy one-pager still works (`?type=brief`) | [ ] |
| 3 | **Top alerts block** — up to 3 open items above Export & Reports on Meeting Prep tab | [ ] |
| 4 | **Export PDF Report** (tab) — same narrative cover as header export | [ ] |
| 5 | **Cover — executive summary** — plain-English paragraph | [ ] |
| 6 | **Cover — tax callout** — styled block (`clear`, `sunset_risk`, or `exposed`) | [ ] |
| 7 | **Cover — gifting bar** — when gross estate ≥ $1M | [ ] |
| 8 | **Action items page** — grouped by theme with impact + next step | [ ] |
| 9 | **In-tab Prepare for Meeting → Print/PDF** — modal brief only (not full narrative — expected) | [ ] |

### Security hardening post-deploy browser smoke (2026-05-29)

**Prod deploy:** migrations `20260629120000` + `20260629130000` applied; `estate-monte-carlo` edge function deployed. SQL verify: `scripts/verify-security-sprint-20260629.sql`. **API routes restored (2026-05-30):** conflicting dynamic segments under `/api/documents/` fixed (`af12ff0`); `/api/health` live.

**Automated — passed 7/7 on prod 2026-05-30:** `npm run test:e2e:security-smoke`

```bash
npx dotenv -o -e .env.test -- npx playwright test tests/e2e/public/security-sprint-post-deploy.spec.ts --project=public --workers=1
npx dotenv -o -e .env.test -- npx playwright test tests/e2e/consumer/security-sprint-rpc-pages.spec.ts --project=consumer --workers=1
npx dotenv -o -e .env.test -- npx playwright test tests/e2e/advisor/security-sprint-monte-carlo.spec.ts --project=advisor --workers=1
```

E2E equivalents: `e2e-advisor@mywealthmaps.test` + Michael Johnson client; `e2e-consumer@mywealthmaps.test` for RPC pages.

#### Manual checks (`@mywealthmaps.test` or production accounts)

| # | Check | Pass |
|---|--------|------|
| 1 | **Monte Carlo** — `e2e-advisor@mywealthmaps.test` → Johnson household → Strategy → Run Monte Carlo → P10/P50/P90 visible; Network tab: no 401/403 on `estate-monte-carlo` | [x] |
| 2 | **Consumer RPCs** — `e2e-consumer@mywealthmaps.test` → `/estate-tax` and `/my-estate-trust-strategy?tab=gifting` load with data (no blank page / console 403) | [x] |
| 3 | **Referral rate limit** — on `/event/selling-a-business`, DevTools Console (see [GO_LIVE_E2E § Security smoke](./GO_LIVE_E2E.md#security-hardening-post-deploy-smoke-2026-05-29)) → `{ 200: ~60, 429: ~5 }` for fake ref `test123` | [x] |
| 4 | **Telemetry auth** — logged out / incognito Console → `POST /api/telemetry/horizon-input-missing` → **401** | [x] |

### Prospect + Mobile Review Mode manual smoke (2026-05-29)

**Automated pre-check (CI/local):** `npm run test:import:unit` (24/24); ESLint on sprint files; TypeScript (excluding pre-existing `consumer-import.spec.ts`).

**Not automated** — requires advisor login, Resend inbox, DevTools 390px. Run **Track 1 first** (more moving parts).

#### Track 1 — Prospect mode

| # | Step | Pass |
|---|------|------|
| 1 | Log in as `e2e-advisor@mywealthmaps.test` | [ ] |
| 2 | Navigate to `/prospect` (or Prospect Mode tab) | [ ] |
| 3 | Fill: California, $5M–$15M, Married, Business owner, Age 58, Name "Test Prospect" | [ ] |
| 4 | Submit — tax figures render; **sunset delta** visible (CA has no state estate tax — card should not appear) | [ ] |
| 4b | *(Optional)* Re-run with **WA** or **OR** — state tax card appears with non-zero figure | [ ] |
| 5 | Federal tax current law is NOT zero (DB-backed exemption) | [ ] |
| 6 | Click "Download opportunity summary" — print dialog after ~500ms | [ ] |
| 7 | PDF header shows "Prepared by [advisor name]" | [ ] |
| 8 | Sunset delta banner appears in PDF | [ ] |
| 9 | Enter `e2e-consumer-tier1@mywealthmaps.test` → Send intake invitation | [ ] |
| 10 | Email arrives at `avoels@comcast.net` (BCC) | [ ] |
| 11 | `/advisor/prospect` redirects cleanly to `/prospect` | [ ] |

#### Track 2 — Mobile review mode

| # | Step | Pass |
|---|------|------|
| 12 | DevTools → iPhone 12 (390px) → `/dashboard` | [ ] |
| 13 | Mobile alert banner appears if open alerts exist for test account | [ ] |
| 14 | No horizontal overflow on dashboard cards | [ ] |
| 15 | `/projections` — year-by-year table scrolls horizontally | [ ] |
| 16 | `/rmd` — table scrolls horizontally | [ ] |
| 17 | `/scenarios` — comparison table scrolls horizontally | [ ] |
| 18 | Advisor recommendation Accept/Decline buttons full-width stacked (not side-by-side) | [ ] |
| 19 | Hamburger menu → tap nav item → drawer closes | [ ] |

**Verify federal_tax_config (if step 5 fails):**
```sql
SELECT scenario_id, estate_exemption_individual, estate_exemption_married
FROM federal_tax_config WHERE scenario_id IN ('current_law', 'sunset_2026');
```

---

## Section 2 — Technical go-live steps

Run these on launch day after all Section 1 gates are checked. Do not run early.

### Opening signups — go-live flip

The site is in waitlist mode by default on `VERCEL_ENV=production`. Do **not** flip `PUBLIC_SIGNUP_OPEN` until Section 1 product gates, **legal review** ([LEGAL_TODO.md](./LEGAL_TODO.md)), **C-4 manual Stripe walkthrough** ([BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md)), and production drip smoke are signed off.

#### Pre-go-live — legal and config (before go-live day)

Complete before flipping Supabase Auth or `PUBLIC_SIGNUP_OPEN`:

- [ ] **`handle_new_user` trigger in production** — Apply `20260526000001_handle_new_user_trigger.sql` and **`20260527130500_fix_signup_subscription_defaults.sql`** before flipping `PUBLIC_SIGNUP_OPEN`. Verify: fresh signup → `profiles.subscription_status = 'none'`, `consumer_tier = 1` (not signup-time `trialing`).
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
- [x] **RLS policy fix (pre-launch)** — `20260527150000_prelaunch_rls_household_scope.sql` on prod (`1f41ce1`); GST via `/api/advisor/gst-entry` (`7cab1be` — deploy app); `verify-loose-rls-policies.sql` → 0 rows; post-fix CSV in `docs/audits/`
- [ ] **RLS isolation smoke (manual)** — Two consumers + connected advisor/client; confirm cross-household reads return `[]` — `docs/audits/README.md`
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
| `CRON_SECRET` | All Vercel crons (`notifications`, `age-triggers`, `process-deletions`, `compliance-reminders`) | ✅ Verified (2026-05-24) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase (browser, Playwright) | ✅ Verified (2026-05-24) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin queries (webhooks, drip, signup side effects) | ✅ Verified (2026-05-24) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Search Console meta tag in `app/layout.tsx` | **Not needed** — verified via Cloudflare domain provider (2026-05-24) |
| `WAITLIST_MODE` | `middleware.ts` + server signup redirect | Optional — default on in Production |
| `NEXT_PUBLIC_WAITLIST_MODE` | Client `getSignupHref()` CTAs | Optional — redeploy when changed |
| `PUBLIC_SIGNUP_OPEN` | Opens public signup at go-live | **Pending** — legal review + C-4 manual verify + Stripe production |
| `COMPLIANCE_EMAIL` | `/api/cron/compliance-reminders` ops alerts (overdue deletions, WCPA SLAs) | ✅ `avoels@comcast.net` (2026-05-25) |

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

**Current (2026-05-26):** **76** timestamped migration files in `supabase/migrations/` (excludes `VERIFY_session27_migrations.sql` and `reference/`). Repo through `20260626120000` (UX-2 gap statuses). Remote may lag — confirm applied list below.

- [ ] **`20260626120000_advisor_gap_statuses.sql`** — UX-2 advisor gap workflow; apply before advisor portal UX-2 deploy
- [ ] **`20260526000000_onboarding_wizard_fields.sql`** — OB-1 wizard columns; apply before OB-1 deploy
- [ ] **`20260527130500_fix_signup_subscription_defaults.sql`** — Signup `none` + free Tier 1; backfill orphan `trialing` rows without Stripe sub
- [x] Through `20260601000000_advisor_directory_referral_code_trigger.sql` (Sprint 13 verify)
- [x] Final prod spot-check before Sprint 15 go-live (2026-05-24)
- [x] Attorney referral code trigger: `attorney_listings_referral_code_trigger` (Sprint 8; backfill via `seed-test-attorney.ts` if absent) (2026-05-24)

---

## Advisor Integration (launch + manual billing)

### Code (automated — already works)
- [x] `advisor_clients` connected status → Tier 3 access via `getUserAccess()`
- [x] Dashboard tier split fixed — `_dashboard-body` uses `access.tier` not `profile.consumer_tier`
- [x] `subscription_status = 'advisor_managed'` treated as Tier 3
- [x] **Advisor P0 bundle (2026-05-27):** unified billing handoff via `lib/advisor/applyAdvisorConnectionBilling.ts` on invite accept, link-pending, and accept-request; signup/email callback preserves `next=/invite/{token}`; dashboard calls `POST /api/advisor/link-pending` on load; consumer email invite via `POST /api/consumer/invite-advisor` (replaces mailto on `/onboarding/invite-advisor` and `/my-advisor`); `/invite/expired` page; advisor pre-registration claim at `/advisor/connect/[token]`
- [x] **Advisor P1 bundle (2026-05-27):** disconnect/resubscribe via `restoreConsumerBillingOnDisconnect` (`POST /api/consumer/disconnect-advisor`, `DELETE /api/advisor/remove-client`); seat limits on invite + accept (`lib/advisor/advisorClientLimits.ts`); advisor empty-state CTA + first-connection playbook; consumer `AdvisorConnectedBanner` on dashboard; meeting prep email deliverable (`POST /api/advisor/share-meeting-prep`)

### Manual process for first advisors
- [ ] Advisor account setup: set `profiles.role = 'advisor'` in Supabase (or advisor self-signup via consumer invite deep link)
- [ ] **Advisor firm billing:** invoice directly until Stripe firm products are live (see [§ Stripe — Advisor & B2B2C](#stripe--advisor--b2b2c-billing-prior-to-go-live) below)
- [x] When advisor takes on consumer client with active subscription — **automated on connect** when `STRIPE_SECRET_KEY` present (sets `advisor_managed`, Tier 3, `cancel_at_period_end`)
- [x] When advisor connection ends — **automated in app** (`restoreConsumerBillingOnDisconnect`: restore tier, clear `advisor_managed`, resume Stripe if paused, resubscribe email when needed)

### Verify before first advisor onboarding
- [ ] Advisor-connected consumer sees Stage 3 dashboard (not Stage 1)
- [ ] Tier 3 consumer on `/dashboard` — tax snapshot shows state exemption + portability note (WA: $3M, "Individual only · no portability"); hero **View strategies →** / **View tax snapshot** links work (`EstateSummaryHeroAndMetrics`, not legacy beige card)
- [ ] Advisor portal fully functional for connected advisor
- [ ] Consumer can disconnect advisor from `/my-advisor` → tier restored + resubscribe email when applicable
- [ ] After disconnect: consumer reverts to `previous_consumer_tier` (or Tier 1 if advisor-managed)
- [ ] Advisor invite blocked at client limit (same as accept-request)
- [x] Meeting prep → “Email brief to client” delivers Resend email + in-app notification
- [x] Advisor activation drip (day 0 / 3 / 7) + competitive value prop banner on `/advisor`

### Post-launch automation (Advisor adoption package — still Stripe Dashboard)
- [ ] Stripe products for advisor firm tiers ($149/mo starter, $349/mo growth) — **code references test IDs in `lib/tiers.ts`; create live products on go-live day**
- [x] Automated subscription pause on advisor connection (app + Stripe API)
- [x] Automated consumer resubscribe prompt on advisor disconnect (email + notification)
- [x] Seat count enforcement on invite + accept (app-side; not yet tied to paid firm subscription)
- [ ] Advisor billing portal tied to firm subscription (Stripe Customer Portal for advisor/firm customer)

---

### Stripe — Advisor & B2B2C billing (prior to go-live)

**No new consumer Stripe products are required** for advisor-managed clients — connected consumers get Tier 3 via `subscription_status = 'advisor_managed'` (not a separate Stripe price).

**Required before advisor B2B2C flows in production:**

| Item | Stripe Dashboard action | App dependency |
|------|-------------------------|----------------|
| Consumer checkout (existing) | 6 consumer prices (Phase 1/2 below) | Connect + disconnect pause/resume use `STRIPE_SECRET_KEY` |
| Webhook `customer.subscription.updated` | Must be enabled | Webhook **skips** `advisor_managed` profiles (no overwrite) |
| API access | Live/test secret key in env | `applyAdvisorConnectionBilling`, `restoreConsumerBillingOnDisconnect` |
| Customer Portal | Cancel + update payment method enabled | Consumer self-serve after disconnect if subscription lapsed |

**Create before billing advisor firms (Month 2 / when invoicing stops):**

| Product | Suggested price | Code reference |
|---------|-----------------|----------------|
| Advisor Firm — Starter | $149/mo | `ADVISOR_FIRM_PRICE_IDS.starter` in `lib/tiers.ts` |
| Advisor Firm — Growth | $349/mo | `ADVISOR_FIRM_PRICE_IDS.growth` |
| Advisor Firm — Enterprise | Custom / seat | `ADVISOR_FIRM_PRICE_IDS.enterprise` |

- [ ] Create **3 advisor firm products** in Stripe test mode (then live on go-live day)
- [ ] Record test `price_…` IDs → update env or replace test IDs in `lib/tiers.ts` before production
- [ ] Verify `POST /api/stripe/firm-checkout` with test advisor account
- [ ] **Manual at launch:** invoice first advisors until firm checkout is verified end-to-end
- [ ] **Not required at launch:** separate Stripe product for “advisor-managed consumer” (handled in app DB)

**B2B2C verification (test mode, after consumer Phase 1):**

- [ ] Consumer on paid Estate plan → advisor accepts invite → Stripe sub shows `cancel_at_period_end=true`; profile `advisor_managed` + Tier 3
- [ ] Consumer disconnects → tier restored; if sub was paused, `cancel_at_period_end=false` OR resubscribe email to `/billing?plan=estate`
- [ ] Consumer on free Tier 1 → advisor connect → Tier 3, no Stripe change
- [ ] Webhook: subscription events do **not** downgrade `advisor_managed` consumers

---

## Stripe Setup (required before `PUBLIC_SIGNUP_OPEN=true`)

**Source of truth in code:** `lib/billing/stripePrices.ts` · Checkout: `app/api/stripe/checkout/route.ts` · Webhook: `app/api/stripe/webhook/route.ts` · Disclosures walkthrough: [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md)

**Consumer pricing (Sprint 4):**

| Tier | Monthly | Annual (billed yearly) | Trial |
|------|---------|------------------------|-------|
| Financial (1) | $29/mo | $290/yr ($24/mo equiv) | None |
| Retirement (2) | $79/mo | $790/yr ($66/mo equiv) | None |
| Estate (3) | $149/mo | $1,490/yr ($124/mo equiv) | **14 days** (monthly + annual) |

> ⚠️ **Do not use live Stripe keys for testing.** Complete **Phase 1 (test mode)** on staging/preview with `sk_test_` / `pk_test_` first. Switch to live keys only on go-live day after Phase 1 passes.

### App behavior (env vars)

| Behavior | Detail |
|----------|--------|
| Monthly prices | `STRIPE_PRICE_*_MONTHLY` env vars, or legacy test monthly IDs in code if unset (local dev only) |
| Annual prices | **Requires all three** `STRIPE_PRICE_*_ANNUAL` env vars — no legacy fallback |
| Monthly/annual toggle | Shown on `/billing` and `/pricing` only when `isAnnualBillingConfigured()` is true (server reads env). If annual IDs missing, toggle is **hidden** and monthly plans render (avoids application error) |
| Tier after payment | Webhook sets `consumer_tier` via `getTierFromPriceId(priceId)`; `subscription_status` mirrors Stripe (`trialing` during Estate trial) |
| Post-checkout redirect | Consumers → `/dashboard?checkout=success` or `/profile?checkout=success` (not `/terms/accept`) |
| Dashboard access | `subscription_status = 'trialing'` grants access (Stripe 14-day Estate trial) |
| Orphan auth users | `npm run repair:orphaned-user -- <email>` if `profiles` row missing |

---

### Phase 1 — Test mode (sandbox) — complete before live keys

**Where:** Stripe Dashboard → toggle **Test mode** ON (top right).

#### 1. Products and prices (test mode)

Create **three products** (Stripe → Products):

1. **My Wealth Maps — Financial** — financial planning
2. **My Wealth Maps — Retirement** — retirement planning
3. **My Wealth Maps — Estate** — estate planning

For **each** product, create **two recurring prices**:

| Lookup key (recommended) | Amount | Interval | Trial |
|--------------------------|--------|----------|-------|
| `financial_monthly` | $29.00 USD | Monthly | — |
| `financial_annual` | $290.00 USD | Yearly | — |
| `retirement_monthly` | $79.00 USD | Monthly | — |
| `retirement_annual` | $790.00 USD | Yearly | — |
| `estate_monthly` | $149.00 USD | Monthly | **14 days** |
| `estate_annual` | $1,490.00 USD | Yearly | **14 days** |

- [ ] 3 products created in **test mode**
- [ ] 6 prices created with amounts above
- [ ] Estate monthly + annual prices have **14-day trial** configured in Stripe
- [ ] Record all six test `price_…` IDs (copy from each price in Dashboard)

#### 2. Environment variables — staging / preview / local

Set in **Vercel Preview** (and `.env.local` for local checkout tests):

```bash
# Test keys only (sk_test_… / pk_test_…)
STRIPE_SECRET_KEY=sk_test_…
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…   # from test-mode webhook endpoint (step 3)

STRIPE_PRICE_FINANCIAL_MONTHLY=price_…
STRIPE_PRICE_FINANCIAL_ANNUAL=price_…
STRIPE_PRICE_RETIREMENT_MONTHLY=price_…
STRIPE_PRICE_RETIREMENT_ANNUAL=price_…
STRIPE_PRICE_ESTATE_MONTHLY=price_…
STRIPE_PRICE_ESTATE_ANNUAL=price_…

# Attorney B2B2C (after consumer products created)
STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY=price_…
STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY=price_…

STRIPE_CUSTOMER_PORTAL_URL=https://billing.stripe.com/p/login/test_…
```

- [ ] All 10 variables set on staging/preview (not production yet)
- [ ] Attorney price env vars set when attorney products exist (`STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY`, `STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY`)
- [ ] Redeploy preview after env change
- [ ] `/billing` shows **monthly/annual toggle** (confirms all three annual IDs present)
- [ ] `/pricing` shows toggle and annual copy (“2 months free”)

#### 3. Webhook — test mode

Stripe Dashboard → Developers → Webhooks → **Add endpoint** (test mode):

| Field | Value |
|-------|--------|
| URL (preview/staging) | `https://<your-preview-host>/api/stripe/webhook` |
| URL (local, optional) | `stripe listen --forward-to localhost:3000/api/stripe/webhook` |
| Events | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.upcoming` |

- [ ] Test webhook endpoint created
- [ ] Signing secret copied to `STRIPE_WEBHOOK_SECRET` on preview
- [ ] Stripe Dashboard shows **successful** delivery after a test checkout (green check)

#### 4. Customer Portal — test mode

Stripe → Settings → Billing → Customer portal (test mode):

- [ ] Cancel subscriptions **enabled**
- [ ] Switch plans **enabled** (between consumer tiers if configured)
- [ ] Update payment method **enabled**
- [ ] Cancellation collects reason
- [ ] Portal login link copied to `STRIPE_CUSTOMER_PORTAL_URL` (test URL)

#### 5. Other Stripe Dashboard (test) — C-4

- [ ] **invoice.upcoming** enabled for renewal reminders (webhook handler in app)
- [ ] Receipt emails / branding reviewed
- [ ] Manual walkthrough: [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) on preview with test card `4242 4242 4242 4242`

#### 6. Functional verification — test keys only

Run on **preview** with test mode keys and all six price IDs set:

- [ ] **Financial monthly** ($29) → checkout completes → `consumer_tier` = 1, `subscription_status` = `active`
- [ ] **Retirement monthly** ($79) → `consumer_tier` = 2
- [ ] **Estate monthly** ($149) → `consumer_tier` = 3, `subscription_status` = `trialing`, 14-day trial in Stripe
- [ ] **Annual toggle** → Financial annual ($290) checkout works → tier 1 maintained
- [ ] **Estate annual** ($1,490) → trial starts if configured on annual price
- [ ] **Customer portal** — “Manage existing subscription” opens portal; update payment method works
- [ ] **Cancel** — self-serve cancel shows disclosure; access through period end; webhook updates profile
- [ ] **Upgrade path** — tier 1 user → gated page → `/billing?returnTo=…` → subscribe → return URL works
- [ ] Webhook signature verification passes (failed signatures rejected in logs)

---

### Phase 2 — Live mode (production) — go-live day only

**Prerequisite:** Phase 1 fully checked. Legal + [LEGAL_TODO.md](./LEGAL_TODO.md) cleared.

#### 1. Duplicate catalog in live mode

Stripe Dashboard → toggle **Test mode** OFF → repeat product/price creation in **live mode** (same names, amounts, lookup keys, Estate 14-day trial).

- [ ] 3 live products + 6 live prices created (new `price_…` IDs — **not** the test IDs)
- [ ] Record all six **live** price IDs separately from test

#### 2. Environment variables — Vercel Production

Replace test values with **live** values (never mix test price IDs with live secret key):

```bash
STRIPE_SECRET_KEY=sk_live_…
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…   # live webhook endpoint secret

STRIPE_PRICE_FINANCIAL_MONTHLY=price_…   # live IDs only
STRIPE_PRICE_FINANCIAL_ANNUAL=price_…
STRIPE_PRICE_RETIREMENT_MONTHLY=price_…
STRIPE_PRICE_RETIREMENT_ANNUAL=price_…
STRIPE_PRICE_ESTATE_MONTHLY=price_…
STRIPE_PRICE_ESTATE_ANNUAL=price_…

STRIPE_CUSTOMER_PORTAL_URL=https://billing.stripe.com/p/login/…   # live portal
```

- [ ] All production env vars updated
- [ ] **Redeploy** Vercel Production after env change
- [ ] Confirm `/billing` annual toggle visible on production (all six live price IDs present)

#### 3. Webhook — live mode

- [ ] Live endpoint: `https://mywealthmaps.com/api/stripe/webhook`
- [ ] Same five events as test mode
- [ ] Live signing secret in production `STRIPE_WEBHOOK_SECRET`
- [ ] Dashboard shows verified deliveries after one real checkout

#### 4. Customer Portal — live mode

- [ ] Live portal configured (same settings as test)
- [ ] `STRIPE_CUSTOMER_PORTAL_URL` updated to live login link

#### 5. Production smoke (minimal real charge)

- [ ] One **live** subscription test with a real card (smallest tier or cancel immediately after verify)
- [ ] Confirm `profiles.consumer_tier`, `subscription_plan`, `subscription_status` in Supabase prod
- [ ] Refund or cancel test subscription in Stripe if desired

> After live smoke: set `PUBLIC_SIGNUP_OPEN=true` per [Opening signups — go-live flip](#opening-signups--go-live-flip).

---

### Sandbox → production cutover checklist (summary)

| Step | Test mode | Live mode |
|------|-----------|-----------|
| Products + 6 prices | ✅ Phase 1 | ✅ Phase 2 (new IDs) |
| API keys | `sk_test_` / `pk_test_` | `sk_live_` / `pk_live_` |
| Price env vars | Test `price_…` IDs | Live `price_…` IDs |
| Webhook URL | Preview or `stripe listen` | `https://mywealthmaps.com/api/stripe/webhook` |
| Webhook secret | Test `whsec_…` | Live `whsec_…` |
| Customer portal URL | Test portal link | Live portal link |
| End-to-end checkout | Test card 4242… | One real card smoke |
| Flip signups | — | `PUBLIC_SIGNUP_OPEN=true` |

---

### Code verification (shipped on `main`)

- [x] `lib/billing/stripePrices.ts` — six price configs; `getPriceConfig`, `getTierFromPriceId`, `isAnnualBillingConfigured`
- [x] Checkout uses `getPriceConfig()` + Estate `trial_period_days: 14`
- [x] Webhook sets `consumer_tier` + `subscription_status` from Stripe
- [x] Billing + pricing: $29/$79/$149; annual toggle when annual env vars set
- [x] `UpgradeBanner` pricing + trial copy
- [x] Annual toggle hidden when any `STRIPE_PRICE_*_ANNUAL` missing (no client crash)
- [x] TERMS-2: trial checkout `no_payment_required` on `/terms/accept` fallback
- [x] TERMS-3: `trialing` in dashboard `hasAccess`
- [x] TERMS-5: Stripe success URL → dashboard/profile (not `/terms/accept`)
- [x] TERMS-1: signup T&C checkbox before `PUBLIC_SIGNUP_OPEN=true` (legal)
- [x] Section F: soft backfill banner for users without `terms_accepted_at`

### Go/no-go (Stripe)

- [ ] Phase 1 complete on preview with **test** keys
- [ ] [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) walkthrough signed off
- [ ] Phase 2 live catalog + env vars + webhook on production
- [ ] One live checkout smoke passed
- [ ] **Do not** point production at test price IDs or test secret keys

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
| Stripe production billing | ☐ Phase 1 test complete → Phase 2 live keys + 6 prices — [§ Stripe Setup](#stripe-setup-required-before-public_signup_opentrue) | **Yes** |
| Open signups (`PUBLIC_SIGNUP_OPEN`) | **Pending** — go-live day after blockers cleared | Yes |
| Section 1 remainder | Drip prod smoke steps 2–3; E2E path; attorney referral prod test | No (waitlist gate) |
| Dashboard/profile slow renders | ✅ Sprint P-1 + P-2 shipped (`5c24160`, `47a38f3`); remaining ceiling → estate composition read model | No |

### Sprint 17 — remaining (non-code)

| Item | Owner | Notes |
|------|-------|-------|
| **LEGAL_TODO.md** | You | Counsel handoff + one-commit legal update — [§ Counsel handoff](./LEGAL_TODO.md#counsel-handoff--how-to-send-the-tos) |
| **Stripe Phase 1 (test mode)** | You | [§ Stripe Setup — Phase 1](./LAUNCH_CHECKLIST.md#phase-1--test-mode-sandbox--complete-before-live-keys) — 6 prices + preview env + webhook |
| **C-4 manual walkthrough** | You | [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) on preview |
| **Stripe Phase 2 (live mode)** | You | [§ Stripe Setup — Phase 2](./LAUNCH_CHECKLIST.md#phase-2--live-mode-production--go-live-day-only) — go-live day only |
| **Go-live day ops** | You | Supabase Auth ON → verify callback → `PUBLIC_SIGNUP_OPEN=true` → Core §1–3 smoke |
| **Drip step 2 check** | Ops | `npm run verify:drip -- --email e2e-drip@mywealthmaps.test` |
| **Sprint P-2 pre-launch refactors** | ✅ `47a38f3` — recommendations cache, projections cache-first, auth dedup — [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) |

---

## Completion log

| Date | Sprint | Notes |
|------|--------|-------|
| 2026-05-30 | PDF export path wiring | **Closed** — shared `loadAdvisorExportWiring`; API `?type=report`; header Export estate report + Meeting brief split |
| 2026-05-30 | PDF narrative engine | **Closed** — rule-based cover + action items; `fetchNarrativePdfFields` parallel fetch; Meeting Prep top alerts; manual smoke checklist added |
| 2026-05-30 | Prod API route fix + security smoke | **Closed** — `af12ff0` documents slug conflict (`[household_id]` vs `[id]`); all `/api/*` routes respond; `npm run test:e2e:security-smoke` 7/7 on prod; [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) added |
| 2026-05-29 | RPC guards + attorney RLS + edge auth | **Deployed prod** — migrations + `estate-monte-carlo` on `fnzvlmrqwcqwiqueevux`; SQL verified; browser smoke passed 2026-05-30 |
| 2026-05-29 | Security + CI + dead code | **Closed** — email route gates, household access, CI workflow, 37 unit tests, 4 E2E specs |
| 2026-05-29 | Health Score + Advisor Playbook | **Closed** — `feat(health-score)` unified badge + context; `feat(advisor)` first-client playbook + needs-attention; migration timestamp renames |
| 2026-05-29 | Prospect + Mobile Review | **Closed** — `feat(prospect)` DB tax config, PDF, intake CTA; `feat(mobile)` review banner, rec cards, table scroll; manual smoke checklist added |
| 2026-05-29 | TERMS-2/3/5 billing fixes | Trial checkout access; direct post-Stripe redirect; `repair-orphaned-user` script (`48e7326`) |
| 2026-05-28 | Stripe go-live docs + annual toggle guard | LAUNCH_CHECKLIST Phase 1/2 sandbox→production; `isAnnualBillingConfigured()` hides toggle |
| 2026-05-28 | Advisor dashboard tier fix | `_dashboard-body` uses `getUserAccess().tier`; LAUNCH_CHECKLIST advisor manual billing |
| 2026-05-28 | Sprint 4 consumer pricing | **Code complete** — $29/$79/$149 + annual; Estate 14-day trial; `stripePrices.ts`; billing + pricing toggle; LAUNCH_CHECKLIST Stripe section |
| May 2026 | Sprint 8 | Attorney referral migration applied; trigger confirmed |
| May 2026 | Sprint 9 | Signup referral attribution — profiles + funnel_events |
| May 2026 | Sprint 9 | Drip — all 24 event slugs; RMD cohorts; life-event-on-connect; Digital Assets tier 2; getAppUrl audit |
| May 2026 | Sprint 10 | Business succession minimal; invite-advisor onboarding; A/B criteria; CONNECTED_ADVISOR_CLIENT_STATUSES |
| May 2026 | Sprint 12 | A/B collapse; persona alerts; mobile drawer; full copy audit |
| May 2026 | Sprint 13 | **Closed** — 67 migrations; E2E 51/0/1; A–G passed; seeds; INTERNAL_API_KEY; RMD copy + advisor trigger blockers fixed |
| May 2026 | Sprint 14 | **Closed** — smoke §1–11 passed; bugs fixed `f4e9160`; E2E expanded to **259 tests** in 42 files ([PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md)); staging `--workers=1` |
| May 2026 | Sprint 15 | Waitlist mode shipped (`7afaedb`, `bb9a191`, `3ceb125`); runtime middleware redirect + force-dynamic signup |
| 2026-05-24 | Sprint 15 | **Closed** — Domain live, DNS cutover complete, Search Console verified via Cloudflare, sitemap submitted, waitlist mode active, post-cutover smoke §1–3 passed. Open signups pending billing setup — set `PUBLIC_SIGNUP_OPEN=true` in Vercel Production + redeploy when ready. |
| 2026-06-02 | Sprint P-2 | **Closed** — Pre-launch perf refactors (`47a38f3`); migration `20260602130000_sprint_p2_recommendations_cache.sql`. |
| 2026-05-30 | Roth bracket headroom | **Closed** — `runRothAnalysis` federal headroom fix; `/roth` display context; unit tests. |
| 2026-05-30 | Dashboard polish | **Closed** — three-state progression (`b71af63`); allocation card removed from Financial Summary (`7e8bf00`); consolidated alert panel. |
| 2026-05-28 | Flow & perf Sprint 19a | **Closed** — allocation refresh-only save; dashboard assessment prefetch; Meeting Prep instant brief + refresh (`b7a15dd`). |
| 2026-05-28 | Flow & perf Sprints K–O | **Closed** — consumer refresh, Recharts/PDF lazy, dashboard Suspense, advisor alerts batch, shells + composition tags (`90d167a`–`3524581`). |
| 2026-05-27 | Post-launch perf program | **Closed** — Sprints B–J (prefetch, lazy fetch, advisor split, profile gates, billing links, loading/error shells). |
| 2026-05-27 | Post-launch perf Sprint J | **Closed** — `/complete` + `/estate-tax` loading/error shells. |
| 2026-05-27 | Post-launch perf Sprint H | **Closed** — `loading.tsx` skeletons on monte-carlo, allocation, scenarios, social-security, projections. |
| 2026-05-27 | Post-launch perf Sprint G | **Closed** — sidebar tier-locked nav items link to `/billing?returnTo=…`. |
| 2026-05-27 | Post-launch perf Sprint F | **Closed** — profile gate consistency via `requireHouseholdRecord`; trust-strategy empty state → redirect. |
| 2026-05-27 | Post-launch perf Sprint E | **Closed** — insurance/businesses forms use `router.refresh()` instead of full reload. |
| 2026-05-27 | Post-launch perf Sprint D | **Closed** — advisor client tab `dynamic()` code-split; domicile tab mount refetch removed. |
| 2026-05-27 | Post-launch perf Sprint C | **Closed** — Scenarios lazy B/C projection fetch; skip mount waterfalls when only Base Case viewed. |
| 2026-05-27 | Post-launch perf Sprint B | **Closed** — Monte Carlo + Allocation server prefetch; shared loaders; eliminate mount waterfalls on `/monte-carlo` and `/allocation`. |
| 2026-05-27 | Post-launch perf Sprint A | **Closed** — advisor tab loader alignment; strategy line-item dedupe; trust composition dedupe; Meeting Prep fixes; upgrade banner cache read. |
| 2026-05-27 | Post-launch perf | **Closed** — StrategyTab server hydration; SS/setup/charitable prefetch; composition cache (`20260527180000`); trust-strategy loading/error + notification off render. |
| 2026-06-02 | Sprint P-1 | **Closed** — Performance quick wins (`5c24160`); indexes applied in prod. |
| 2026-06-02 | Sprint C-3 | **Closed** — RLS (`236890c`); auth callback, MFA, security headers (`56a4407`); docs (`cda2ccc`, `d854c05`). |
| 2026-06-02 | Sprint C-4 | **Code complete** — billing disclosures (`462bda9`); manual Stripe walkthrough remains. |
| 2026-06-02 | Sprint C-5 | **Code complete** — Privacy Policy, Terms of Service, footer, sitemap (`2e1dff3`, `695a860`); [LEGAL_TODO.md](./LEGAL_TODO.md) remains. |
| 2026-05-25 | Sprint UX-1 | **Closed** — Life events hub `/events` + in-app picker (`6fb73e6`) |
| 2026-05-25 | Auth cleanup | Auth table clean (9 accounts); deleteUser FK hardening (`aea4bf6`, `3cdd9b5`); verify-deletion script |
| 2026-05-25 | Design Phase 1–3 | **Closed** — tokens + sidebar + indigo sweep (`d173b00`, `249bf85`, `7a1a121`, `a10299b`, `37f3f0a`) |
| 2026-05-25 | OB-1 | **Closed** — onboarding wizard + extended profile (`b1c7b49`, `fd00b69`) |
| 2026-05-25 | OB-2 | **Closed** — tier-aware onboarding narrative (`bccef99`) |
| 2026-05-25 | AF-1 | **Closed** — ask-advisor notification + advisor Strategy Questions (`a255616`) |
| 2026-05-25 | OB-3 | **Closed** — SetupProgressCard, data-inferred wizard, wizard gate `hasAnyData`, onboarding import for Tier 1 (`3376134`) |
| 2026-05-26 | OB-3b / SU-1 | **Closed** — sidebar unlock, `hasHousehold` layout fix, superuser bypass (`6d2bff3`, `1660f27`, `d50a982`, `3c0d28b`) |
| 2026-05-26 | NAV-1 | **Closed** — active nav indicator + Financial Planning auto-expand (`be92947`) |
| 2026-05-26 | Advisor perf | **Closed** — roster batched net worth + parallel client load (`8c526de`) |
| 2026-05-25 | DB trigger | `handle_new_user` migration on `main` (`1133b4f`) — **apply to production before go-live** |
| 2026-05-24 | Sprint 15 cont. | Preview waitlist mode enabled; sitemap XML fixed (`73648e5`); middleware infra bypass added; test accounts cleaned up (`3f732e3`); dev workflow established (local → preview → production) |
