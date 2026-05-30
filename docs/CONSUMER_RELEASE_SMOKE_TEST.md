# Consumer release smoke test (manual)

Human-runnable deploy verification. Complements automated Playwright coverage mapped in [CONSUMER_FLOWS.md §7](./CONSUMER_FLOWS.md#7-e2e-map-living-contracts); E2E does not replace this checklist for production sign-off.

Use this after a production or staging deploy when consumer write paths, estate health recompute, trust UI, transfer-strategy modeling, gifting history UI, or planning-topic copy changed (Sessions 100–127).

**Time:** ~20–30 minutes for the full checklist · ~10 minutes for the **Core** section only.

**Who:** A real test account (not a paying client). Estate tier recommended so all sections apply.

---

## Sprint 14 Manual Smoke Sign-off

Date: 2026-05-23  
Account: `e2e-consumer@mywealthmaps.test` (Estate tier) — seed via `npm run seed:e2e`  
Environment: https://estate-planner-gules.vercel.app  
Tester: Manual

### Result: PASSED ✅

- **Sections 1–3:** ✅
- **Sections 4–7** (all estate routes): ✅
- **Section 8** (My Estate Strategy + Scenarios): ✅
- **Section 9** (Advisor recommendation): ⏭️ Skipped — needs linked advisor
- **Section 10** (Gifting, Strategies & Trusts): ✅ E2E 19/19 confirmed
- **Section 11** (Estate Summary planning topics): ✅

### Bugs logged and fixed

- ✅ Admin Portal visible to consumer account — fixed `f4e9160`
- ✅ Asset form save button not reachable without zoom-out — fixed `f4e9160`

### Post-launch (not blockers)

- **Sprint P-1 + P-2 (2026-06-02):** Pre-launch perf shipped (`5c24160`, `47a38f3`) — Promise.all, indexes, debounce, next/font, recommendations cache, projections cache-first, auth dedup. Re-verify dashboard TTFB after deploy; remaining ceiling is estate composition read model ([PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md)).
- **Before open signups (non-code):** [LEGAL_TODO.md](./LEGAL_TODO.md) + C-4 manual Stripe walkthrough ([BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md)); go-live day: signup → **confirm email** → login → dashboard
- E2E staging flakiness under parallel workers — re-run with `--workers=1`

### Sprint 17 — production drip verify

Use **`npm run verify:drip`** (DB check) instead of a Resend inbox.

| Check | Command |
|-------|---------|
| Step 1 (immediate) | `npm run verify:drip -- --email e2e-drip@mywealthmaps.test` |
| Step 2 (day 3+) | Same — script flags overdue if `drip_step_2_sent_at` missing |
| All recent captures | `npm run verify:drip -- --all` |

**Setup:** Capture `e2e-drip@mywealthmaps.test` via `/assess` or homepage email capture. Exit code **0** = on schedule; **1** = missing step 1 or overdue steps.

Schedule reference: `lib/emails/drip-templates.ts` (day 3 step 2, day 7 step 3).

---

## Before you start

| Item | Notes |
|------|--------|
| Browser | Chrome or Safari, logged out to start |
| Account | Consumer with an existing household and some assets already entered |
| Tier | **Estate (tier 3)** for My Family + Titling; **Retirement (tier 2)+** for Allocation |
| Baseline | Open **Dashboard** and note **Estate Readiness Score** (0–100) and any **Action Items** |
| Waitlist mode | If waitlist is on (default on Production), public **Get started** goes to `/waitlist` — set `PUBLIC_SIGNUP_OPEN=true` or use invite URL to test full signup (see [LAUNCH_CHECKLIST.md § Opening signups — go-live flip](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip)) |

**Pass criteria for “recompute worked”:** Within ~10 seconds of a successful save, refresh Dashboard — score, gaps, or action items should **change or stay consistent** (not silently stale). If nothing ever updates after multiple saves, flag for engineering (check `RECOMPUTE_SECRET` / `NEXT_PUBLIC_APP_URL` in Vercel — see [LAUNCH_CHECKLIST.md § Vercel Production env vars](./LAUNCH_CHECKLIST.md#vercel-production-env-vars-required-before-sprint-15-go-live)).

---

## Test data setup (staging / pre-Sprint 14)

Run once per environment before acquisition sections B and D. Idempotent.

```bash
set -a && source .env.local && set +a
npm run seed:e2e
# Copy printed block → .env.test
```

- **Consumer:** `e2e-consumer@mywealthmaps.test` / `E2eTest!2026Mwm` (estate tier 3).
- **Advisor portal:** `e2e-advisor@mywealthmaps.test` — linked to Johnson client `e2e-client.johnson@mywealthmaps.test`.
- **Attorney portal:** `e2e-attorney@mywealthmaps.test` — newsletter kit on `/attorney`.
- **Referral smoke:** `?ref=e2eadv01` · `?aref=e2eatt01` (from `.env.test`).

Legacy one-off seeds (`seed-test-attorney.ts`, `seed-test-consumer-estate.ts`) superseded by `seed:e2e` — see [E2E_TEST_RESET.md](./E2E_TEST_RESET.md).

For production go-live env vars (not seed scripts), see [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).

---

## Core (~10 min) — run every deploy

### 1. Login and dashboard

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 1.1 | Go to `/login`, sign in | Redirects to `/dashboard` | ☐ |
| 1.2 | Dashboard loads | Greeting (“Good morning/afternoon/evening”), **Estate Readiness Score** shows a number 0–100 | ☐ |
| 1.2b | If household has conflicts | Severity pill chips under greeting in **`DashboardIntroSection`** (🚨 critical / ⚠️ warnings + **See details →**); no duplicate mid-page banner; titling badges in estate summary collapsible | ☐ |
| 1.3 | Scroll dashboard | **Tax exposure hero** (red/amber) + **four metric tiles** + checklist and **tax snapshot** two-col (WA: exemption $3M, portability note, state taxable, state tax); Financial/Retirement/Estate Summary collapsibles below; disclaimer at bottom | ☐ |
| 1.4 | Sidebar footer | **My Advisor**, **My Attorney** (tier 2+), and **Manage Subscription** in footer (not main Overview list) | ☐ |
| 1.4b | Sidebar Overview | Only **Profile** and **Estate Summary** — no Education / Assessment / Find Advisor / Find Attorney | ☐ |
| 1.4c | Active planning group | **Your plan** badge on Financial, Retirement, or Estate header when that group is unlocked | ☐ |
| 1.5 | Inline disclaimers visible | ⚠️ Manual | — | Confirm disclaimer text visible on: dashboard (below readiness score), /projections, /monte-carlo, /estate-tax (under Federal Estate Tax card), /my-estate-strategy (below horizon table), strategies tab, /print PDF page 1, homepage + `DisclaimerBanner` footer | ☐ |

### 2. Financial save (consumer API + recompute)

> **Automated (§2.4):** `tests/e2e/consumer/consumer-core-recompute.spec.ts` — POST asset, poll `estate_health_scores.computed_at` (15s), dashboard net worth/readiness. Run on each staging deploy; manual steps 2.1–2.3 optional spot-check.

Pick **one** module you already use (Assets is simplest).

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 2.1 | Go to **Assets** (`/assets`) | Page loads, list or empty state | ☐ |
| 2.2 | **Add** a small test asset (e.g. “Smoke Test CD”, $10,000) or **edit** an existing value | Save succeeds, no red error banner | ☐ |
| 2.3 | Row appears / updates in the table without a full page error | ☐ |
| 2.4 | Return to **Dashboard**, hard refresh (⌘⇧R / Ctrl+Shift+R) | Net worth and/or readiness score reflect the change (or action items update) | ☐ manual · ✅ E2E |

**Optional repeat:** Edit one row on **Income** or **Expenses** — same expectations.

### 3. Profile save

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 3.1 | Go to **Profile** (`/profile`) | Form loads: **Household**, person column(s), **Household Planning** (filing status + state only); **no** SS claiming, PIA, retirement age, longevity, or deduction inputs | ☐ (automated: `consumer-profile-spouse-layout.spec.ts` — slim profile) |
| 3.1b | Type your name in **Your Name** | Person column header updates live (not stuck on “You”) | ☐ (automated: `consumer-profile-spouse-layout.spec.ts`) |
| 3.1c | Toggle **Include spouse / partner** | Second column appears on desktop (`sm+`); stacks on narrow viewport | ☐ (automated: `consumer-profile-spouse-layout.spec.ts`) |
| 3.2 | Change household name, **Save Profile** | Success, no error | ☐ (automated: `consumer-profile-save.spec.ts`) |
| 3.3 | Refresh Dashboard | Still loads; no 500 | ☐ |

### 3.4 Inline profile prompts (deferred fields)

Requires a test account with missing SS or planning fields, or use e2e fixture after service-role clear (automated in `consumer-profile-field-prompt.spec.ts`).

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 3.4a | `/scenarios` with longevity unset | Gold **Personalize your projection** card; save persists age | ☐ (automated) |
| 3.4b | `/scenarios` with `deduction_mode` = null, select **Custom** | Custom amount field appears; save persists | ☐ (automated) |
| 3.4c | `/scenarios` with `deduction_mode` = **standard** (explicit) | No deduction prompt | ☐ (automated) |
| 3.4d | `/social-security` with SS claiming + PIA unset | Per-person prompt; save updates PIA on calculator | ☐ (automated) |
| 3.4e | **Remind me later** on either prompt | Hidden for session; returns next visit if still unset | ☐ (automated) |

**Go-live command:** `npm run test:e2e:go-live-profile` — see [GO_LIVE_E2E.md](./GO_LIVE_E2E.md).

---

## Estate planning (~10 min) — new consumer API paths

### 4. Estate health check

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 4.1 | Go to `/health-check` (or complete flow if prompted) | Five yes/no questions | ☐ |
| 4.2 | Answer all questions, submit **See My Estate Readiness Score →** | Redirects to Dashboard | ☐ |
| 4.3 | Dashboard | Score or document-related gaps update vs baseline | ☐ |

### 5. My Family (tier 3)

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 5.1 | Go to **My Family** (`/my-family`) | Page loads | ☐ |
| 5.2 | **Add family member** — name + relationship, save | Modal closes, person appears in list | ☐ |
| 5.3 | **Edit** that person (e.g. toggle “Include as beneficiary”), save | List updates | ☐ |
| 5.4 | **Delete** the test person, confirm | Removed from list | ☐ |
| 5.5 | Dashboard refresh | No errors; beneficiary-related messaging may update | ☐ |

### 6. Titling & beneficiaries (tier 3)

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 6.1 | Go to **Titling & Beneficiaries** (`/titling`) | Assets / real estate / insurance sections load | ☐ |
| 6.2 | **Set Title** on an asset (or RE / life policy): change title type, titling, save | Modal closes; card reflects new title | ☐ |
| 6.3 | On an item with **Add beneficiary**, add a **primary** beneficiary at 100% | Saves, beneficiary shows on card | ☐ |
| 6.4 | Refresh page (F5) | Title + beneficiary still there | ☐ |
| 6.5 | **Edit** allocation % or **Delete** the test beneficiary | Saves without error | ☐ |
| 6.6 | Dashboard refresh | Readiness score or titling/beneficiary gaps may change | ☐ |

### 7. Asset allocation (tier 2+)

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 7.1 | Go to **Asset Allocation** (`/allocation`) | Charts / sliders load | ☐ |
| 7.2 | Set stocks + bonds + cash = **100%**, save target mix | “Saved” or success state; no validation error | ☐ |
| 7.3 | Try saving **≠ 100%** | Error or disabled save (should not persist invalid mix) | ☐ |

---

## Optional (~5 min) — if you use these features

### 8. My Estate Strategy / base case

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 8.1 | Go to **My Estate Strategy** | Page loads | ☐ |
| 8.2 | If offered, **generate** or refresh base case | Completes without error; horizons/charts populate | ☐ |
| 8.3 | **Scenarios** (`/scenarios`) — adjust B or C, wait for chart, click **Save** on a column | “Saved” feedback; no error toast | ☐ |

### 9. Advisor recommendation (if linked to an advisor)

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 9.1 | Dashboard — **strategy recommendation** panel | Visible if advisor assigned | ☐ |
| 9.2 | **Accept** or **Decline** one item | UI updates after refresh; no console errors | ☐ |

### 10. Gifting, Strategies & Trusts (tier 3)

Run sub-sections independently if time-boxed; step IDs are stable for failure notes.

#### 10a. Trusts & Documents

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 10.1 | Go to **Gifting, Strategies & Trusts** (sidebar) | Opens with **Trusts & Documents** tab (or switch to it) | ☐ |
| 10.2 | **Trusts & Documents** — **+ Add Trust**, save a test trust | Trust appears in table; no error | ☐ |
| 10.3 | **Edit** and **Delete** the test trust | Updates / removes; dashboard refresh OK | ☐ |
| 10.4 | Visit `/trust-will` | Redirects to `/my-estate-trust-strategy?tab=trusts` | ☐ |
| 10.5 | **Common planning topics** sections show prevalence labels (not “High Priority”) | Educational disclaimer visible | ☐ |

#### 10b. Gifting scenarios

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 10.6 | Save a **named** gifting scenario (Gifting tab) | Appears in saved list | ☐ |
| 10.7 | **Remove** only that named scenario | Others remain | ☐ |

#### 10c. Transfer Strategies (sandbox, SLAT, ILIT, DAF)

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 10.7a | **Transfer Strategies** tab — top sections | **Strategy Sandbox** and **In My Plan** visible above strategy pills | ☐ |
| 10.8 | **SLAT** (MFJ household only) | Pill clickable; save contribution (e.g. $100,000), funding source, optional notes | ☐ |
| 10.8b | After save | Row in **Strategy Sandbox** (amber dot on pill); green summary “SLAT funded: …”; **About this strategy** collapsed; estate composition **unchanged** until promoted | ☐ |
| 10.8b2 | **Add to plan** on sandbox row | Row moves to **In My Plan**; composition/horizons reflect outside reduction | ☐ |
| 10.8c | **Edit** then **Remove** / **Return to sandbox** / **Withdraw** | Reversal updates estate; withdrawn row in Strategy history |
| 10.8d | Delete logged gift after **Save to my plan** | Warning modal: delete only vs delete + withdraw plan | ☐ |
| 10.9 | **Transfer Strategies** tab → **ILIT** | If policies exist: dropdown + save; else manual coverage amount + amber note linking to Insurance | ☐ |
| 10.9b | After save | Green summary “ILIT funded: …”; dashboard refresh updates estate/strategy totals | ☐ |
| 10.9c | **Remove from plan** | Row cleared; no console errors | ☐ |
| 10.11 | **Transfer Strategies** → **DAF** | Save DAF or direct charitable amount; appears in **Strategy Sandbox** first | ☐ |
| 10.11b | **Add to plan** then **Edit** / **Remove** | Promote moves to In My Plan; remove clears row; horizons refresh after promote | ☐ |
| 10.11c | **Roth Conversion** (`/roth`) | Stat cards + insight + **WhatIfPanel** (all four cells react to slider; Alan: **−$15K** lifetime extra cost at $50K/yr, **Delay is better**, IRA at RMD drops). Balance above grouped table. Emerald rows + CTA when conversions &gt; 0 | ☐ |
| 10.11d | **Social Security** (`/social-security`) | Hero elected cards + insight (survivor **$4,888/mo** for Alan) · cumulative chart (blue elected crosses gray FRA ~age 84) · claiming tables with bar column · spousal section unchanged below. **Prod 2026-05-30:** programmatic verify on Alan household; visual once post-deploy | ☐ |
| 10.11e | **RMD Calculator** (`/rmd`) | Hero lifetime + peak · status cards **Alan 9 yr / Cathi 16 yr away** · decade navigator · inflection highlights · legend | ☐ |
| 10.11f | **Dashboard cleanup + Script A** | Bypass alert **$645,463** between tiles and checklist · intro **Estate readiness** pill · no mid-page conflict banner · allocation downstream note | ☐ |
| 10.11g | **Estate Tax Snapshot** (`/estate-tax`) | Composition waterfall · Current/With strategies toggle · strategy panel (Alan WA) · $0-tax user — waterfall only, no panel | ☐ |

#### 10d. Gift History

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 10.10 | **Gifting** tab → **Gift History** | Gifts grouped by year; split years show **Gift Split Elected ✓** (if Form 709 filed on annual gifts) | ☐ |
| 10.10b | MFJ account, year with annual gifts, no split | **Split available — file Form 709** on year header (not shown for single filers) | ☐ |

#### 10e. Charitable Giving

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 10.12 | **Charitable Giving** tab | Four summary cards load; sub-tabs **Planning topics** · **Deduction Detail** · **Donation History** | ☐ |
| 10.12b | **Planning topics** — profile with no RPC recommendations | “No topics to display at this time based on your profile inputs” (not an error) | ☐ |
| 10.13 | **Log a Donation** (cash), then **Donation History** sub-tab | Row appears; delete works | ☐ |
| 10.14 | **Save to my plan →** on total donated (when &gt; $0) | Success message; dashboard/strategy refresh OK | ☐ |

### 11. Estate Summary planning topics (tier 1+ with estate data)

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 11.1 | Dashboard → expand **Estate Summary** | **Common planning topics** (not “Planning Gaps”) if topics exist | ☐ |
| 11.2 | Group headers use educational labels | No red “High Priority” headers | ☐ |

---

## Public routes (no dashboard sidebar) — Sprint 1–2

Open while logged out or in a private window unless noted:

| Step | URL | Expected | Pass? |
|------|-----|----------|-------|
| P.1 | `/assess` | Assessment loads; shared public top nav; no app sidebar | ☐ |

### Assessment restore (friction sprint smoke)

1. Complete `/assess` while logged out (answer all questions, receive score)
2. Click **Create account** from the gated gap report
3. Complete signup
4. Confirm: assessment results are restored and displayed (not a blank state)
5. Confirm: gap report / next steps visible immediately after auth

| P.1b | Assessment restore after signup (steps above) | Results + gap report visible | ☐ |

**Prerequisite:** `PUBLIC_SIGNUP_OPEN=true` — as of 2026-05-27 deploy, `/signup` redirects to `/waitlist` (307), so steps 2–5 cannot run on production until go-live flip. Code path unchanged: `mwm_pending_assessment` → `assessment_results` insert on `/assess` mount when authed (`_assess-client.tsx`).

**Post-deploy check (2026-05-27, commit `548d42a`):** `/assess` loads (200). Full restore smoke **blocked by waitlist** — record as pre-launch blocker, not a regression from this sprint.
| P.2 | `/find-advisor` | Directory loads; public top nav | ☐ |
| P.3 | `/find-attorney` | Directory loads; public top nav | ☐ |
| P.4 | `/education` (logged in or out) | Education header only — **no** marketing `PublicNav`; no app sidebar | ☐ |
| P.5 | `/advisor-directory` | Redirects to `/find-advisor` | ☐ |
| P.6 | `/` (signed out) | $2M–$30M hero copy; life event quick-start card | ☐ |
| P.7 | `/pricing` | Professional-fees positioning copy | ☐ |
| P.8 | `/event/selling-a-business` | Event page: hero, action plan, assessment teaser, no 404 | ☐ |
| P.9 | `/event/death-of-spouse` | Same pattern; attorney/advisor CTAs if applicable | ☐ |
| P.10 | Education link contract | `EDUCATION_LINK_BASE_URL=https://mywealthmaps.com node scripts/validate-education-links.mjs` — 22 published modules → 200, 3 unpublished → 404, hub/decision-tree/glossary/prep-sheet → 200 | ☐ |

**Tier-gate spot-check (tier 1 account):** `/social-security`, `/roth`, `/my-family` show `UpgradeBanner` with personalized copy when `state_primary` is set on household (fallback to generic copy otherwise).

---

## Import automated tests (Sprint F-2)

```bash
npm run test:import:unit          # header detection, sheets, aliases (no auth)
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:import:api  # API tests (tier 2+ user in .env.test)
```

Requires F-2 migration on test DB. API tests use `tests/fixtures/import/` and optional `SUPABASE_SERVICE_ROLE_KEY` for cleanup/traceability.

---

## Import data — Sprint F-1 (tier 2+) ✅ passed production 2026-06-02

Migration `20260602140000_sprint_f1_ingestion_jobs.sql` applied; schema cleanup consolidated to `file_name` / `file_type`. Use tier 2+ test account.

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| I.1 | `/import` (tier 1 account) | Upgrade banner; tier 2 required | ☐ |
| I.2 | `/import` (tier 2+ account) | **SupportedFormats** (broker CSV, multi-sheet Excel, single CSV) visible first; persona + CSV template downloads above drop zone; CSV/XLSX drop zone | ☐ |
| I.3 | Upload `public/templates/import-sample.csv` | Parse succeeds; review step shows headers + auto field map; target table `assets` | ☐ |
| I.4 | Commit import | Success message; rows appear in `assets`; job history shows `committed` | ☐ |

### Import F-2 — manual (optional if automated tests pass)

Requires F-2 migration `20260602150000_sprint_f2_import_traceability.sql`. Automated coverage: `npm run test:import:unit` + `npm run test:import:api`.

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| I.5 | Upload broker/preamble CSV (`tests/fixtures/import/preamble.csv`) | Header detected below preamble; mapping correct | ☐ |
| I.6 | Upload multi-sheet `.xlsx` | Sheet picker; switching sheet re-parses without re-upload | ☐ |
| I.7 | Edit a cell at review step, then commit | Committed row reflects edit | ☐ |
| I.8 | Re-import row matching existing asset | 409 duplicate warning → skip non-duplicates or import all | ☐ |
| I.9 | SQL after commit | `ingestion_job_id` set on new rows for that job | ☐ |

---

## Acquisition & attribution — Sprint 13+ ✅ passed staging (May 2026)

**Status:** Sections **A–G passed** on https://estate-planner-gules.vercel.app (Sprint 13).
Sprint 14 continues with **Core 1–3** and **estate 4–7** below.

Requires test listings from `seed-test-advisor.ts` / `seed-test-attorney.ts` (see **Test data setup**).

### A. Advisor referral click logging

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| A.1 | Visit `/event/selling-a-business?ref={advisor_referral_code}` (use a real code from `advisor_directory`) | Page loads; no error | ☐ |
| A.2 | In Supabase: `select * from referral_clicks where listing_type='advisor' order by created_at desc limit 1;` | Row exists with correct `referral_code` and non-null `advisor_directory_id` | ☐ |

### B. Attorney referral click logging

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| B.1 | Visit `/event/selling-a-business?aref={attorney_referral_code}` (use a real code from `attorney_listings`) | Page loads; no error | ☐ |
| B.2 | In Supabase: `select * from referral_clicks where listing_type='attorney' order by created_at desc limit 1;` | Row exists with correct `attorney_listing_id` | ☐ |

### C. Signup attribution — advisor referral code

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| C.1 | In a private window: visit `/event/selling-a-business?ref={advisor_referral_code}` | Referral tracker fires; `mwm_referral_code` set in sessionStorage | ☐ |
| C.2 | Create a new test account via `/signup` | Signup succeeds | ☐ |
| C.3 | In Supabase: `select referral_code from profiles where id = {new_user_id};` | `referral_code` matches the advisor code used in C.1 | ☐ |
| C.4 | In Supabase: check `funnel_events` for `account_created` event with `properties->>'advisor_referral_code'` set | Row exists | ☐ |

### D. Signup attribution — attorney referral code

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| D.1 | In a private window: visit `/event/selling-a-business?aref={attorney_referral_code}` | `mwm_attorney_referral_code` set in sessionStorage | ☐ |
| D.2 | Create a new test account | Signup succeeds | ☐ |
| D.3 | In Supabase: `select attorney_referral_code from profiles where id = {new_user_id};` | `attorney_referral_code` matches the attorney code from D.1 | ☐ |

### E. Drip sequence verification

Instead of checking a Resend inbox manually, verify via DB:

1. Capture a test email via `/assess` or homepage signup form  
   Use: `e2e-drip@mywealthmaps.test` (or any test address)

2. Check step 1 fired (immediate):

```bash
set -a && source .env.local && set +a
npx tsx scripts/verify-drip-sequence.ts --email e2e-drip@mywealthmaps.test
```

3. Check step 2 fired (day 3+): same command — script shows `✅ sent` or `⚠️ overdue`

4. Check all recent captures:

```bash
npm run verify:drip -- --all
```

Exit code **0** = on schedule. Exit code **1** = overdue steps found.

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| E.1 | Submit event assess with a fresh email (e.g. `e2e-drip@mywealthmaps.test`) | Email capture succeeds; no error | ☐ |
| E.2 | Run `verify:drip -- --email {test_email}` within 2 minutes of capture | Step 1 shows `✅ sent` | ☐ |
| E.3 | After day 3, re-run same command | Step 2 shows `✅ sent` (not `⚠️ overdue`) | ☐ |

### F. Life-event context on advisor connect

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| F.1 | As a test consumer: visit `/event/serious-diagnosis`, complete the event assess (log the event) | Event logged in `life_events` | ☐ |
| F.2 | Connect to a test advisor via `/my-advisor` | Connection request sent | ☐ |
| F.3 | As the test advisor: accept the connection in the advisor portal | Connection accepted | ☐ |
| F.4 | As the test advisor: view the client Overview tab in `/advisor/clients/[clientId]` | Life event context (`serious-diagnosis`) visible in client overview | ☐ |

### G. Event slug coverage (all 24)

Spot-check at least 8 slugs across both content files. Full automated check preferred.

| Slug | Status | Pass? |
|------|--------|-------|
| `/event/selling-a-business` | Original 8 | ☐ |
| `/event/death-of-spouse` | Original 8 | ☐ |
| `/event/serious-diagnosis` | Original 8 | ☐ |
| `/event/receiving-inheritance` | Original 8 | ☐ |
| `/event/divorce` | Original 8 | ☐ |
| `/event/approaching-retirement` | Original 8 | ☐ |
| `/event/large-rsu-vest` | Original 8 | ☐ |
| `/event/new-child-grandchild` | Original 8 | ☐ |
| (4 Sprint 5 slugs of your choice) | Sprint 5 | ☐ |
| `/event/rmd-start-age` | Age trigger; hero mentions **72–75** by birth year (not “at 73” only) | ☐ |
| `/event/medicare-eligibility` | Age trigger | ☐ |
| `/event/social-security-timing` | Age trigger | ☐ |

---

## Acquisition & attribution sign-off

| Field | Value |
|-------|--------|
| Tester name | |
| Date | |
| Environment | ☐ Staging ☐ Production-like |
| Sections A–F | ☐ Pass ☐ Fail (note which steps failed) |
| Section G slug coverage | of 24 slugs verified 200 |
| Issues found | |

---

## Quick regression (navigation only)

Open each URL while logged in; expect a real page (not 404), main heading visible:

| Page | URL | Pass? |
|------|-----|-------|
| Dashboard | `/dashboard` | ☐ |
| Assets | `/assets` | ☐ |
| Liabilities | `/liabilities` | ☐ |
| Income | `/income` | ☐ |
| Expenses | `/expenses` | ☐ |
| Real estate | `/real-estate` | ☐ |
| Projections | `/projections` | Readiness empty state vs partial chart + inline prompts after scenarios-only profile fill (2026-05-29) | ☐ |
| Profile | `/profile` | ☐ |
| Scenarios | `/scenarios` | ☐ |
| Titling | `/titling` | ☐ |
| Gifting, Strategies & Trusts | `/my-estate-trust-strategy?tab=trusts` | ☐ |
| Trust redirect | `/trust-will` → trust tab | ☐ |

---

## Sign-off

| Field | Value |
|-------|--------|
| Tester name | |
| Date | |
| Environment | ☐ Production ☐ Staging ☐ Local |
| Deploy / commit (if known) | |
| **Core** (sections 1–3) | ☐ Pass ☐ Fail |
| **Estate planning** (sections 4–7) | ☐ Pass ☐ Fail ☐ Skipped (tier) |
| **Optional** (8–11) | ☐ Pass ☐ Fail ☐ N/A |
| **Acquisition & attribution** (sections A–G) | ☐ Pass ☐ Fail ☐ Skipped (pre-Sprint 13) |
| Supabase referral queries | ☐ Advisor loop proven ☐ Attorney loop proven |
| Issues found | |

---

## What to report when something fails

1. **URL** and what you clicked  
2. **Exact error message** (screenshot helps)  
3. Whether it happens **after refresh** or only before  
4. Browser (Chrome/Safari) and mobile vs desktop  
5. For save failures: open browser **Network** tab, find the failing request (`/api/consumer/...`), note **status code** (401, 403, 500)

---

## Related automated tests

Engineers can run the **complete Playwright suite** with `.env.test`:

```bash
npm run test:e2e:complete -- --workers=1   # consumer + advisor + public + attorney
npm run test:e2e:consumer -- --workers=1   # 137 consumer tests alone
```

See [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) (commands, env, seeds) and [CONSUMER_FLOWS.md §7](./CONSUMER_FLOWS.md#7-e2e-map-living-contracts) (spec index). **280 automated tests** cover route regression, profile + inline prompts (`npm run test:e2e:go-live-profile`), sidebar contract, profile/asset/health-check UI, estate-tier gates, referral API, all `/event/[slug]` pages, and most consumer write APIs — **not** a substitute for this manual pass on a real account (dollar math, Stripe C-4, drip inbox, full signup→Supabase attribution).

`consumer-strategy-writes.spec.ts` soft-deletes all Playwright-named `strategy_line_items` in `afterEach` on the fixture household (`PLAYWRIGHT_HOUSEHOLD_ID` / David Chen). The charitable composition case waits 2s after DAF POST then polls `POST /api/estate-composition` for up to 20s (`after > beforeTotal`) so async `afterHouseholdWrite` recompute can complete. If manual testing overlaps those scenario names (`Playwright *`, `daf`/`charitable` at `base`), re-run e2e or delete those rows before relying on estate composition totals.

For acquisition & attribution tests, the Supabase queries in sections A–D of the
"Acquisition & attribution" section above are the authoritative verification method.
No Playwright spec covers the full `?ref=` → Supabase → `profiles` path end-to-end;
manual verification is required for Sprint 14 sign-off.
