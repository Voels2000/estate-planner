# Consumer release smoke test (manual)

Human-runnable deploy verification. Complements automated Playwright coverage mapped in [CONSUMER_FLOWS.md §7](./CONSUMER_FLOWS.md#7-e2e-map-living-contracts); E2E does not replace this checklist for production sign-off.

Use this after a production or staging deploy when consumer write paths, estate health recompute, trust UI, transfer-strategy modeling, gifting history UI, or planning-topic copy changed (Sessions 100–127).

**Time:** ~20–30 minutes for the full checklist · ~10 minutes for the **Core** section only.

**Who:** A real test account (not a paying client). Estate tier recommended so all sections apply.

---

## Before you start

| Item | Notes |
|------|--------|
| Browser | Chrome or Safari, logged out to start |
| Account | Consumer with an existing household and some assets already entered |
| Tier | **Estate (tier 3)** for My Family + Titling; **Retirement (tier 2)+** for Allocation |
| Baseline | Open **Dashboard** and note **Estate Readiness Score** (0–100) and any **Action Items** |

**Pass criteria for “recompute worked”:** Within ~10 seconds of a successful save, refresh Dashboard — score, gaps, or action items should **change or stay consistent** (not silently stale). If nothing ever updates after multiple saves, flag for engineering (check `RECOMPUTE_SECRET` / `NEXT_PUBLIC_APP_URL` in Vercel — see [LAUNCH_CHECKLIST.md § Vercel Production env vars](./LAUNCH_CHECKLIST.md#vercel-production-env-vars-required-before-sprint-15-go-live)).

---

## Test data setup (staging / pre-Sprint 14)

Run once per environment before acquisition sections B and D. Idempotent.

```bash
# Test attorney listing + referral_code
set -a && source .env.local && set +a && npx tsx scripts/seed-test-attorney.ts

# Playwright consumer account → estate tier (tier 3)
set -a && source .env.local && source .env.test && set +a && npx tsx scripts/seed-test-consumer-estate.ts
```

- **Attorney:** `test-attorney@mywealthmaps.test` — script prints `referral_code` for `?aref=` in sections B and D.
- **Consumer:** uses `PLAYWRIGHT_CONSUMER_EMAIL` from `.env.test` — no new user created.
- **Advisor `?ref=`:** use a real `referral_code` from `advisor_directory` (no dedicated seed script).

For production go-live env vars (not seed scripts), see [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).

---

## Core (~10 min) — run every deploy

### 1. Login and dashboard

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 1.1 | Go to `/login`, sign in | Redirects to `/dashboard` | ☐ |
| 1.2 | Dashboard loads | Greeting (“Good morning/afternoon/evening”), **Estate Readiness Score** shows a number 0–100 | ☐ |
| 1.2b | If household has conflicts | Dismissible **conflict banner** below greeting (before scrolling); severity chips under intro; **See details ↓** jumps to estate conflicts | ☐ |
| 1.3 | Scroll dashboard | **Net Worth** section visible; **Your Estate Summary** callout (gross estate, headroom, taxes) below net worth; disclaimer at bottom | ☐ |
| 1.4 | Sidebar footer | **My Advisor**, **My Attorney** (tier 2+), and **Manage Subscription** in footer (not main Overview list) | ☐ |
| 1.4b | Sidebar Overview | Only **Profile** and **Estate Summary** — no Education / Assessment / Find Advisor / Find Attorney | ☐ |
| 1.4c | Active planning group | **Your plan** badge on Financial, Retirement, or Estate header when that group is unlocked | ☐ |

### 2. Financial save (consumer API + recompute)

Pick **one** module you already use (Assets is simplest).

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 2.1 | Go to **Assets** (`/assets`) | Page loads, list or empty state | ☐ |
| 2.2 | **Add** a small test asset (e.g. “Smoke Test CD”, $10,000) or **edit** an existing value | Save succeeds, no red error banner | ☐ |
| 2.3 | Row appears / updates in the table without a full page error | ☐ |
| 2.4 | Return to **Dashboard**, hard refresh (⌘⇧R / Ctrl+Shift+R) | Net worth and/or readiness score reflect the change (or action items update) | ☐ |

**Optional repeat:** Edit one row on **Income** or **Expenses** — same expectations.

### 3. Profile save

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 3.1 | Go to **Profile** (`/profile`) | Form loads with your household data | ☐ |
| 3.2 | Change a harmless field (e.g. note or retirement age), **Save** | Success, no error | ☐ |
| 3.3 | Refresh Dashboard | Still loads; no 500 | ☐ |

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

#### 10c. Transfer Strategies (SLAT, ILIT, DAF)

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 10.8 | **Transfer Strategies** tab → **SLAT** (MFJ household only) | Pill clickable; save contribution (e.g. $100,000), funding source, optional notes | ☐ |
| 10.8b | After save | Green summary “SLAT funded: …”; pill shows active dot; **About this strategy** collapsed | ☐ |
| 10.8c | **Edit** then **Remove from plan** | Form returns; pill inactive | ☐ |
| 10.9 | **Transfer Strategies** tab → **ILIT** | If policies exist: dropdown + save; else manual coverage amount + amber note linking to Insurance | ☐ |
| 10.9b | After save | Green summary “ILIT funded: …”; dashboard refresh updates estate/strategy totals | ☐ |
| 10.9c | **Remove from plan** | Row cleared; no console errors | ☐ |
| 10.11 | **Transfer Strategies** → **DAF** | Save DAF or direct charitable amount; summary **Charitable giving: $X/yr**; pill active | ☐ |
| 10.11b | **Edit** / **Remove from plan** | Works; horizons/estate totals refresh | ☐ |

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
| P.2 | `/find-advisor` | Directory loads; public top nav | ☐ |
| P.3 | `/find-attorney` | Directory loads; public top nav | ☐ |
| P.4 | `/education` (logged in) | Public top nav + education header; no app sidebar | ☐ |
| P.5 | `/advisor-directory` | Redirects to `/find-advisor` | ☐ |
| P.6 | `/` (signed out) | $2M–$30M hero copy; life event quick-start card | ☐ |
| P.7 | `/pricing` | Professional-fees positioning copy | ☐ |
| P.8 | `/event/selling-a-business` | Event page: hero, action plan, assessment teaser, no 404 | ☐ |
| P.9 | `/event/death-of-spouse` | Same pattern; attorney/advisor CTAs if applicable | ☐ |

**Tier-gate spot-check (tier 1 account):** `/social-security`, `/roth`, `/my-family` show `UpgradeBanner` with personalized copy when `state_primary` is set on household (fallback to generic copy otherwise).

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

### E. Drip step 1 delivery

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| E.1 | Submit event assess on `/event/selling-a-business/assess` with a fresh email address | Email capture succeeds; no error | ☐ |
| E.2 | Check inbox (or Resend dashboard) within 2 minutes | Drip step 1 email received from `hello@mywealthmaps.com` | ☐ |
| E.3 | In Supabase: `select drip_step_1_sent_at from email_captures where email = '{test_email}';` | `drip_step_1_sent_at` is not null | ☐ |

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
| Projections | `/projections` | ☐ |
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

Engineers can run `npm run test:e2e:consumer` with `.env.test` (see `playwright.config.ts`). That covers login, dashboard UI, and a subset of consumer APIs — **not** a substitute for this manual pass on a real account.

`consumer-strategy-writes.spec.ts` soft-deletes all Playwright-named `strategy_line_items` in `afterEach` on the fixture household (`PLAYWRIGHT_HOUSEHOLD_ID` / David Chen). The charitable composition case waits 2s after DAF POST then polls `POST /api/estate-composition` for up to 20s (`after > beforeTotal`) so async `afterHouseholdWrite` recompute can complete. If manual testing overlaps those scenario names (`Playwright *`, `daf`/`charitable` at `base`), re-run e2e or delete those rows before relying on estate composition totals.

For acquisition & attribution tests, the Supabase queries in sections A–D of the
"Acquisition & attribution" section above are the authoritative verification method.
No Playwright spec covers the full `?ref=` → Supabase → `profiles` path end-to-end;
manual verification is required for Sprint 14 sign-off.
