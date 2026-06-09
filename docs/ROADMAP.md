# ROADMAP.md
# My Wealth Maps — Sprint Roadmap
# Last updated: 2026-06-07 (L1–L4 complete; release routine; next M5/L5)

---

## How to use this document

**At the start of a session:** Read [NEXT_SESSION.md](./NEXT_SESSION.md) (current focus, paste block) and the "Current sprint" section below. Update item status as you work. Move completed sprints to the "Completed" section at the bottom.

**Status key:**
- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked — needs decision or dependency
- `[-]` Descoped — removed from this sprint, reason noted

---

## Current sprint

### Sprint — Codebase cleanup + perf/constants `[x]` **complete (2026-06-05)**

| Item | Status |
|------|--------|
| Dead code — `AssetAllocationSummary`, orphan `_attorney-client`, `buildAllocationContext` | `[x]` |
| Estate-tax page — drop unused asset/RE/business fetches (composition RPC only) | `[x]` |
| `/my-advisor` — multi-row `advisor_clients` safe (`.order('accepted_at').limit(1)`) | `[x]` |
| Constants — `lib/gifting/perRecipientLimit.ts` (annual exclusion limits) | `[x]` |
| Estate-tax — remove `$3M` bypass-trust fallback; use bracket exemption | `[x]` |
| PDF narrative — `firstTaxYearP10` from stored MC signal (fallback to band scan) | `[x]` |
| Perf — memo `EstateOutlookChart`, extract `MonteCarloFanChart`, scenarios row `Map` index | `[x]` |
| Fetch dedup — `getFullHouseholdForOwner` (`React.cache`) on dashboard | `[x]` |

---

### Sprint — MC Phase 3 UI wiring `[x]` **complete**

| Surface | Signal | Copy / UI | Status |
|---------|--------|-----------|--------|
| Strategy tab / `MonteCarloPanel` | `longevity_depletion_pct` | Depletion Risk tile (% below floor at death); green ≤20%, red >20% | `[x]` |
| Consumer `/estate-tax` | `wa_threshold_prob_by_year` | Probability sentence below state tax waterfall row | `[x]` |
| PDF cover narrative | `first_tax_year_p10` | Stored MC signal on `PDFReportData`; band-scan fallback | `[x]` |
| Projections `EstateOutlookChart` | `stateExemption` (`state_estate_tax_rules`) | Amber dashed threshold line + legend on fan chart | `[x]` |

**Prerequisite:** Phase 3 signals compute + store shipped (`runEstateMonteCarloAsync` + `loadScenarioMonteCarlo`).

**Voels smoke:** Depletion Risk 0% · fan chart amber line ~$2.19M · estate-tax “all simulated market scenarios” (pct 100).

---

### Sprint — MC Phase 3 signals (compute/store) `[x]` **complete**

| Item | Status |
|------|--------|
| Migration — `wa_threshold_prob_by_year`, `first_tax_year_p10`, `longevity_depletion_pct`, `depletion_floor_amount` | `[x]` `20260605110000` |
| `runEstateMonteCarloAsync` — P10–P90 ladder threshold prob, first tax year, depletion signal | `[x]` |
| `loadScenarioMonteCarlo` — unified loader returns all four fields | `[x]` |
| `MC_DEPLETION_FLOOR` constant (`500_000`) | `[x]` |
| Voels smoke — `first_tax_year_p10=2026`, `depletion=0`, `threshold_years=25` | `[x]` |
| UI surfaces (estate-tax, PDF confirm, Strategy, projections chart) | `[x]` three consumer/advisor surfaces shipped; PDF `first_tax_year_p10` confirm optional |

**State exemption source:** `stateBrackets[0].exemption_amount` (not hardcoded $3M).

---

### Sprint — Advisor Profile Settings UI `[~]` **partial — portal fallback shipped**

| Item | Status |
|------|--------|
| Migration — `profiles.firm_name`, `phone`, `firm_logo_url` | `[x]` `20260605100000` prod synced |
| Export wiring — `fetchAdvisorProfile` → `resolveAdvisorBranding` on PDF/brief | `[x]` |
| `fetchAdvisorProfile` debug logs removed | `[x]` `52ddc23` |
| Settings form — `/advisor/settings` + `PATCH /api/advisor/profile` (`full_name`, `firm_name`, `phone`) | `[x]` |
| Logo upload UI — `firm_logo_url` file upload | `[x]` `20260630120000` + `/api/advisor/profile/logo` |
| Portal UI fallback — `profiles.firm_name` when `firms.name` absent | `[x]` |
| PDF cover logo from `firm_logo_url` | `[x]` render on cover when HTTPS URL set |

**Scope:** Advisor-editable branding for export surfaces; replaces manual Supabase seed for new advisors.

**Verify:** `scripts/verify-advisor-settings-voels.ts` (API + PDF cover; browser UI needs MFA for `avoels@comcast.net`).

---

### Sprint — advisor export branding (recon) `[x]` **complete**

| Item | Status |
|------|--------|
| Recon — `profiles` vs `firms.name` vs `advisor_directory` | `[x]` |
| Voels seed — Alan `854051be…` `firm_name` + `phone` | `[x]` |
| Migration history sync (duplicate `20260529120000` → `20260529120500`) | `[x]` `11a867d` |
| Debug logs in `fetchAdvisorProfile` | `[x]` removed `52ddc23` |

**Note:** Portal + export both resolve firm label **`firms.name` → `profiles.firm_name`** via **`getAccessContext`** / **`resolveAdvisorBranding`**.

---

### Sprint — export gross alignment (Option A) `[x]` **complete**

| Item | Status |
|------|--------|
| `exportMappers` — `grossForExport` prefers `advisorHorizons.today.grossEstate` | `[x]` |
| `loadAdvisorExportWiring` + `page.tsx` — `todayGrossEstate` + narrative inputs aligned | `[x]` |
| `projectionChartRows` — per-year `estate_incl_home` unchanged | `[x]` |
| Voels — PDF cover gross ~$9.49M (Strategy Today), not year-0 ~$9.30M | `[x]` |

**Commit:** `d8cac06`

---

### Sprint — Projection Engine C→B Unification `[x]` **complete**

| Item | Status |
|------|--------|
| Death-year rows — `calculateStateEstateTax` + `resolveActiveStateTax` | `[x]` |
| `generate-base-case.ts` — `hasBypassTrust` from line items | `[x]` |
| MFJ first-death marital deduction unchanged | `[x]` |
| Voels smoke — death-year 2057 state tax $18,273,170 (zero diff vs engine B) | `[x]` |

---

### Sprint — Monte Carlo Integration `[x]` **complete**

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Schema — `percentiles_by_year`, unique `scenario_id`, export `calcEstateTax` | `[x]` |
| 1A/1B | `runEstateMonteCarloAsync` + fire-and-forget after `generateBaseCase` | `[x]` |
| 1C | `loadScenarioMonteCarlo` unified loader | `[x]` |
| 2A | Projections — `EstateOutlookChart` (`percentiles_by_year` SVG bands) | `[x]` |
| 2B | Strategy tab — at-death P10/P90 badge + `MonteCarloPanel` Last precomputed | `[x]` |
| 2C | PDF SVG polygon bands (`generatePDFReport`) | `[x]` |
| 2D | Narrative one-liner (`narrativeEngine`) | `[x]` |
| 3 | Signals — threshold prob, first tax year, longevity depletion (store only) | `[x]` |
| 3 UI | Surface signals on estate-tax, PDF, Strategy, projections | `[x]` |

**Commits (Phase 0–2D):** `e8b6745`, `d979459`, `fe53112`, `55646a2`, `197f341`, `548b3c7`, `f14af7e`, `aaf46b4`, `fc9cddd`.

---

### Next sprint candidates

| Item | Notes |
|------|-------|
| MC Phase 3 UI wiring | `[x]` `d3a2f81` |
| Portal `profiles.firm_name` fallback | `[x]` `8f7df08` |
| Base-case regenerate (all households) | `[x]` `a5b93e3` — migration `20260605130000` |
| StateTaxPanel multi-state | `[x]` `004c591` |
| PDF cover logo from `firm_logo_url` | `[x]` `556e773` |
| **Export federal → bracket engine B** | `[x]` — `computeFederalExportTax` + `federal_estate_tax_brackets` |
| **Federal flat 40% elimination (all surfaces)** | `[x]` — horizons, composability, Tax stress, MC, projection death-year, heuristics |
| **Logo file-upload UI** | `[x]` — `advisor-branding` bucket + settings upload |
| **Titling perf / memoization** | `[x]` — lookups + memoized warnings + `AssetTitlingCard` + modal code-split |
| **Titling list virtualization** | `[x]` — `VirtualTitlingCardList` + `@tanstack/react-virtual` (threshold 20) |
| **ATG intake + composition** | `[x]` — gifting tab section + `/api/consumer/adjusted-taxable-gifts` + RPC `20260701120000` |
| **Consumer MC full parity** | `[x]` — 7 advisor assumption fields on `/monte-carlo` |
| **Attorney portal collaboration v2** | `[x]` — requests inbox, matter workflow, doc requests, firm notes, settings |
| **Attorney weekly digest email** | `[x]` — cron §10 Fridays; gaps, doc requests, stale matter stage |
| **Engine B export standardization** | `[x]` — estate-plan PDF API + remove dead advisor `estateTax` RPC loader; trust guidance cache fallback |
| **Voels demo account sync** | `[x]` — `npm run sync:voels-demo` (comcast → outlook); `compare-voels-accounts.ts` |
| **Estate verification suite** | `[x]` — `npm run verify:estate` matrix + lifecycle + HTTP + Security UI |
| **E2E Johnson → advisor-client** | `[x]` — `e2e-advisor-client@`; Playwright `.auth/advisor-client.json` |
| **Go-live auth purge** | `[x]` — `npm run cleanup:purge`; 10 prod accounts; `deleteUser` table coverage |
| **Admin deletion email lookup** | `[x]` — Execute tab Look up → UUID; shortcuts from schedule/privacy |
| **Competitive scan H1–H4** | `[x]` — attorney FKs, import Phase A, e2e-smoke workflow, privileged MFA flag |
| **Competitive scan M1–M4** | `[x]` — household access sweep, consumer vault, post-deploy cron, Upstash rate limits |
| **Post-deploy Voels gate** | `[x]` — `npm run verify:post-deploy-voels`; daily cron self-heals MC + verify; `npm run smoke:mc-voels` |

**Recent commits (2026-06-05 → 07):** `bff7ecd` · `9488024` · `996a087` · `4d22809`

---

### Sprint — Voels demo account sync `[x]` **complete (2026-06-07)**

| Item | Status |
|------|--------|
| **`scripts/sync-voels-demo-accounts.ts`** + **`npm run sync:voels-demo`** | `[x]` |
| **`scripts/compare-voels-accounts.ts`** — diff comcast vs outlook totals | `[x]` |
| Prod sync run — asset + composition gross aligned (~$9.81M) | `[x]` |

**Workflow:** Edit **`avoels@comcast.net`** My Plan → run sync → **`avoels@outlook.com`** client view matches.

---

### Sprint — Engine B export standardization `[x]` **complete (2026-06-07)**

| Item | Status |
|------|--------|
| **`/api/export-estate-plan`** — Engine B via composition + brackets (no legacy RPCs) | `[x]` |
| Remove dead **`estateTax`** advisor loader + prop chain | `[x]` |
| **`loadTrustWillGuidance`** — cached composition fallback | `[x]` |
| **`scripts/verify-engine-b-tax-surfaces.ts`** | `[x]` |
| Regression grep in **`CALCULATION_ENGINES.md`** | `[x]` |

**Files:** `lib/export/buildEstatePlanPdfTaxPayload.ts`, `lib/export/loadEstatePlanPdfTaxPayload.ts`, `app/api/export-estate-plan/route.ts`, `lib/advisor/loaders.ts`, `lib/trusts/loadTrustWillGuidance.ts`

---

### Sprint — Estate verification suite (phases 1–4) `[x]` **complete (2026-06-07)**

| Item | Status |
|------|--------|
| **`npm run verify:estate`** — cross-surface matrix CLI | `[x]` |
| Golden fixtures + `--check-goldens` / `--update-goldens` | `[x]` |
| Strategy lifecycle probe (`--lifecycle`, e2e preset) | `[x]` |
| HTTP API scrape (`--http`) | `[x]` |
| **`POST /api/verify-estate-plan`** + Security settings UI | `[x]` |

**Files:** `lib/verify/*`, `scripts/verify-estate-suite.ts`, `tests/fixtures/estate-golden/`, `app/api/verify-estate-plan/route.ts`

---

### Sprint — Go-live auth purge + E2E Johnson retirement `[x]` **complete (2026-06-07)**

| Item | Status |
|------|--------|
| **`npm run cleanup:purge`** — delete unprotected auth users via WCPA path | `[x]` |
| **`GO_LIVE_PROTECTED`** — `david@gmail.com`, `stephen.a.voels@sbcglobal.net` | `[x]` |
| **`deleteUser.ts`** — extended table lists + missing-table skip | `[x]` |
| **`e2e-advisor-client@`** replaces Johnson; seed + Playwright auth | `[x]` |
| Prod purge — **10** accounts remain | `[x]` |

**Files:** `lib/compliance/deleteUser.ts`, `scripts/cleanup-test-accounts.ts`, `scripts/seed-e2e-lib.ts`, `tests/e2e/helpers/advisor-client.setup.ts`

---

**Shipped:** Engine B at death-year rows in **`estate-tax-projection.ts`**; **`generate-base-case.ts`** derives **`hasBypassTrust`** from line items. Voels death-year **2057** state tax **$18,273,170** (zero diff vs engine B). Regenerate base case per household to refresh stored **`outputs_s1_first`**.

**Commit:** `a2a5a38`

**Files:** `lib/calculations/estate-tax-projection.ts`, `lib/actions/generate-base-case.ts`, `lib/export/generatePDFReport.ts`

---

### Sprint — Pre-Monte Carlo Unification Audit ✅ (2026-06-05)

**Status:** Complete

| Domain | Scope | Status |
|--------|-------|--------|
| Domain 1 | State tax engine unification | ✅ |
| Domain 2 | Data flow (PDF page 3 + export Tax Analysis + projection death rows) | ✅ |
| Domain 3 | UX copy and tooltips | ✅ |
| Domain 4 | Voels smoke matrix | ✅ |
| Domain 5 | Documentation sync | ✅ (this sprint) |

**Commits:** `fc85ff8`, `8e8ef71`, `4bdda56`, `716ffba`, `a7ce6d9`, `d558f46`, `07300c8`, `e6dc48c`, `4372546`

---

### Domain 3 — tax term explainers (2026-06-01)

| Item | Status |
|------|--------|
| `lib/estate/taxTermExplainers.ts` (static + OBBBA formatters + dynamic ctx) | `[x]` |
| `InfoTooltip` UI primitive | `[x]` |
| `EstateReadinessCard` — six score subcategory labels | `[x]` |
| Dashboard tax hero — `EstateSummaryHeroAndMetrics` tile labels | `[x]` |
| `/estate-tax` — summary cards + waterfall labels | `[x]` |
| Advisor `StateTaxPanel` badge/table headers | `[x]` |
| Projections chart — Base case label + disclaimer | `[x]` |
| Gifting — `annual_exclusion` + `superfunding` tooltips | `[x]` |
| Hero `stateExemption` / `isMFJ` ctx (via `isMFJFilingStatus`) | `[x]` |

---

### Estate readiness explainers — InfoTooltip ✅ (2026-06-01)

| Item | Status |
|------|--------|
| Wire into `EstateReadinessCard` subcategory labels | `[x]` |
| Post-deploy smoke (consumer past onramp — six `?`, copy match) | `[ ]` |

---

### Domain 2 — display tax alignment (2026-06-01)

| Item | Status |
|------|--------|
| PDF page 3 metric cards — engine B federal + state + net | `[x]` |
| `exportMappers` — `fedTaxExport` / `stTaxExport` engine B | `[x]` 2026-06-05 |
| Export panel + Excel **Tax Analysis** same as PDF page 3 | `[x]` 2026-06-05 |
| `loaders.ts` — `stateBrackets` tax-year fallback | `[x]` 2026-06-05 |
| Projection death-year rows — engine C → B | `[x]` 2026-06-05 |
| `exportMappers` gross alignment — cover / Excel / narrative use `advisorHorizons.today.grossEstate` | `[x]` 2026-06-05 |

**Note:** Tax Analysis / export snapshot and **death-year projection rows** use engine B. PDF cover gross and narrative inputs use **Today composition gross** (Option A); **`projectionChartRows`** still per-year scenario output. Stored **`outputs_s1_first`** updates on next **`generateBaseCase`** per household.

---

### Domain 1 — estate MC engine B **← closed (2026-06-01)**

| Item | Status |
|------|--------|
| Horizons, PDF, Tax tab, consumer strategy, prospect | `[x]` 2026-05-29 |
| Estate MC — engine B + `stateBrackets` POST | `[x]` `fc85ff8` |
| MC footnote + Zero-Tax Paths label | `[x]` `4bdda56` |

---

### Sprint — Estate MC engine B state tax (2026-06-01) **← shipped**

| Item | Status |
|------|--------|
| `estate-monte-carlo.ts` — engine B per path; remove flat `stateEstateTaxRate` | `[x]` |
| Edge `estate-monte-carlo` — inlined engine B + POST fields | `[x]` |
| `MonteCarloPanel` + `StrategyTab` + `stateBrackets` hoist | `[x]` |
| `MonteCarloPanel` model-assumptions footnote | `[x]` |
| Zero-Tax Paths label (`success_rate` semantics) | `[x]` |
| `CALCULATION_ENGINES.md` + `DECISION_LOG.md` | `[x]` |
| `scripts/verify-estate-mc-voels-smoke.ts` | `[x]` |
| Edge redeploy prod | `[x]` |
| Voels browser smoke (POST + fan chart) | `[ ]` |

**Post-ship:** Voels Strategy → Run MC — POST has WA `stateBrackets`; P50 tax on simulated estate (not today gross).

---

### Sprint — PDF beneficiary summary page (2026-06-01) **← shipped**

| Item | Status |
|------|--------|
| `lib/advisor/beneficiaryHelpers.ts` — account-level groups + status | `[x]` |
| Wire raw `asset_beneficiaries` through `exportMappers` / export wiring | `[x]` |
| `PDFReportData.beneficiaryData` + conditional `beneficiary_summary` page | `[x]` |
| Estate tab local helper unchanged (different shape) | `[x]` |
| Voels smoke — 6-page PDF with beneficiary page | `[ ]` |

**Post-ship:** Voels `?type=report` — page order cover → snapshot → beneficiaries → tax → strategies → action items.

---

### Sprint — household_alerts trust title sentence case (2026-05-31) **← shipped**

| Item | Status |
|------|--------|
| `conflict-detector` — `Large estate without a trust` (matches `evaluateAlerts`) | `[x]` |
| PDF `enrichActionItems` — canonical title on trust enrichment | `[x]` |
| Remove `[dedup input]` debug log from `generatePDFReport.ts` | `[x]` |

---

### Sprint — PDF action-item dedupe key normalization (2026-05-31) **← shipped**

| Item | Status |
|------|--------|
| Sort enriched rows before dedupe (`dollarImpact` + `nextStep`) | `[x]` |
| `actionItemDedupeKey()` — strip filler words; 20-char stem | `[x]` |
| Near-duplicate trust titles share key (`largeestatetrust`) | `[x]` |
| Voels smoke — single trust alert under Documents & trust structure | `[ ]` |

---

### Sprint — Estate flow consumer view horizon fix (2026-05-31) **← shipped**

| Item | Status |
|------|--------|
| `horizonOverride` from `buildStrategyHorizons` — same source as tax table (not internal recompute) | `[x]` |
| Pass `selectedHorizons` from `_my-estate-strategy-client.tsx` → `ConsumerEstateFlowView` | `[x]` |
| Stale-fetch guard (`cancelled` flag) on tab switch | `[x]` |
| Tabs stay visible during load; inline spinner (no full-view unmount) | `[x]` |
| Prominent `graph.summary.gross_estate` above asset tiles | `[x]` |
| Horizon caption from local `horizon` state (not lagging `graph.horizonLabel`) | `[x]` |
| Post-ship smoke — Voels rapid tab click: Today → At Longevity → In 10 Years → ~$20.98M final | `[ ]` |

---

### Sprint — Estate flow horizon tabs (2026-05-31) **← shipped (engine pass)**

| Item | Status |
|------|--------|
| `findClosestOutputRow()` — nearest-year lookup (no 10y/20y → lastOutput collapse) | `[x]` |
| `at_longevity` uses `findAtDeathRow()` (aligned with Tax Horizons table) | `[x]` |
| `horizonLabel` on `EstateFlowGraph`; owner pill + summary scale to `computedGrossEstate` | `[x]` |
| Asset category tiles stay today's holdings + context note for projected horizons | `[x]` |
| Post-ship smoke — Voels: Today ~$9.6M vs At Longevity ~$96M owner pill | `[ ]` |

---

### Sprint — Score rationalization + dashboard UI (2026-05-29) **← shipped**

| Item | Status |
|------|--------|
| Sprint A — one consumer label (`Estate readiness`); retire completeness grade on consumer surfaces | `[x]` |
| Sprint A — `docs/SCORE_TAXONOMY.md` | `[x]` |
| Sprint B — `EstateReadinessCard` (benchmark bar, component pills, trend delta) | `[x]` |
| Sprint B — `PriorityAlertCard` + adaptive greeting + collapsed other alerts | `[x]` |
| Sprint B — `priorScore` + `openAlerts` in `_dashboard-body.tsx` | `[x]` |
| Sprint B follow-up — dedupe score from `EstateSummarySection`; ungate score cards on `estateHealthScore` | `[x]` |
| Sprint B follow-up — remove titling conflicts from `EstateSummarySection` collapsible | `[x]` |
| Post-ship smoke — Voels dashboard (score ~56, priority alert, fact line) | `[ ]` |

**Commits:** `843585c` (Sprint A) · `4d51600` (Sprint B)

---

### Sprint — State estate tax unification (2026-05-29) **← shipped**

| Item | Status |
|------|--------|
| Phase 0 — `lib/constants/strategyTypes.ts` | `[x]` |
| Delete engine A (`narrativeEngine` flat rates) | `[x]` |
| PDF cover + callout + page 3 → engine B | `[x]` |
| `hasBypassTrust` on horizons (consumer accepted / advisor projected) | `[x]` |
| `docs/CALCULATION_ENGINES.md` + standing grep rules | `[x]` |

**Post-ship:** Voels MFJ WA PDF — cover + page 3 state tax ~$231K (engine B); bypass trust scenario table when `cstBenefit > 0`.

**Follow-up (not this sprint):** Unify projection death-year rows (engine C) with engine B.

---

### Sprint — PDF exemption + action-item dedupe (2026-05-30) **← shipped**

| Item | Status |
|------|--------|
| Page 3 federal exemption → `currentFederalExemption()` | `[x]` |
| `dedupeActionItems()` for duplicate household_alerts | `[x]` |
| Voels smoke — exemption + single trust alert | `[ ]` |

---

### Sprint — PDF export path wiring (2026-05-30) **← shipped**

| Item | Status |
|------|--------|
| `loadAdvisorExportWiringForClient()` shared loader | `[x]` |
| API `meeting-prep-pdf?type=report` → `generatePDFHTML` | `[x]` |
| API `?type=brief` preserves legacy meeting brief | `[x]` |
| Header: Export estate report + Meeting brief buttons | `[x]` |
| Meeting Prep tab: Export estate report link | `[x]` |
| Manual smoke — header + tab export | `[ ]` |

**Post-ship:** Click **Export estate report** (not modal Print/PDF) — narrative cover + multi-page report.

---

### Sprint — PDF narrative engine (2026-05-30) **← shipped**

| Item | Status |
|------|--------|
| `lib/export/narrativeEngine.ts` — summary, callout, enrichment, grouping | `[x]` |
| `lib/export/fetchNarrativePdfFields.ts` — parallel `Promise.all` fetches | `[x]` |
| Extend `PDFReportData` + `ActionItem` | `[x]` |
| Wire in `page.tsx` / `exportMappers.ts` | `[x]` |
| `generatePDFHTML` cover + grouped action items page | `[x]` |
| `ExportPanel` → `generatePDFHTML(exportPdfData)` | `[x]` |
| Meeting Prep — top 3 open alerts above Export | `[x]` |
| Manual smoke — Voels PDF cover + action items | `[ ]` |

**Post-ship:** Advisor → Voels → Meeting Prep → Export PDF — executive summary, tax callout style, gifting bar, themed action items with impact lines.

---

### Sprint — Dashboard cleanup (2026-05-30) **← shipped**

| Item | Status |
|------|--------|
| Remove Common Planning Topics from estate summary | `[x]` |
| Titling conflicts — badges + link only | `[x]` |
| Bypass trust alert via `afterMetrics` | `[x]` |
| `parseBypassTrustSavings` from RPC reason | `[x]` |

**Post-ship:** Alan dashboard — bypass ~$645K alert · no topic list · titling link to `/titling`.

---

### Sprint — RMD Calculator page polish (2026-05-30) **← shipped**

| Item | Status |
|------|--------|
| Hero lifetime + peak stats | `[x]` |
| Status cards with years-away badges | `[x]` |
| Accounts 3-col grid + per-person totals | `[x]` |
| Tax impact callout (28% blended) | `[x]` |
| Decade navigator + inflection row highlights + legend | `[x]` |
| Single-user layout (`has_spouse` gates) | `[x]` |

**Post-ship:** Visual smoke on `/rmd` — decade nav changes page · peak/first-RMD highlights · years-away badges.

---

### Sprint — State exemption dashboard wire (2026-05-30) **← shipped**

| Item | Status |
|------|--------|
| Migration `no_portability` + WA 2025+ $3M | `[x]` |
| Fetch in `_dashboard-body` Promise.all | `[x]` |
| Tax snapshot: exemption, note, taxable, state tax | `[x]` |

**Post-ship:** `supabase db push` on prod before deploy

---

### Sprint — Estate summary dashboard consolidate (2026-05-30) **← shipped**

| Item | Status |
|------|--------|
| Tax hero + four metric tiles | `[x]` |
| Checklist + tax snapshot two-column grid | `[x]` |
| Greeting state context + compact alert pills | `[x]` |
| EstateSummarySection below unchanged | `[x]` |

---

### Sprint — Social Security page polish (2026-05-30) **← shipped**

| Item | Status |
|------|--------|
| Hero elected cards + muted FRA reference | `[x]` |
| Insight card (gain, combined monthly, survivor, breakeven) | `[x]` |
| Cumulative SVG chart (elected / FRA / age 62) | `[x]` |
| Claiming tables — bar column, FRA badge, elected highlight | `[x]` |
| Spousal section unchanged below tables | `[x]` |

**Post-ship:** Visual smoke on `/social-security` (Alan) — survivor $4,888/mo in insight card · elected–FRA crossover visible on chart (~age 84).

---

### Sprint — Roth Conversion polish (2026-05-30) **← shipped**

| Item | Status |
|------|--------|
| Stat cards + insight + WhatIfPanel | `[x]` |
| Balance projection above grouped table; tabs removed | `[x]` |
| Grouped table by `conversionRationale` | `[x]` |
| CTA above methodology → Transfer Strategies | `[x]` |

**Post-ship:** Prod smoke on `/roth` — WhatIfPanel all four cells react to slider (Alan: extra cost + **Delay is better**). Manual: emerald rows on IRA + rate-spread household.

### Sprint — Roth bracket headroom fix (2026-05-30) **← shipped**

| Item | Status |
|------|--------|
| `getBracketHeadroom` federal rate + 22% ceiling at 24% RMD | `[x]` |
| `pickRothConversionDisplayContext` for insight/WhatIf | `[x]` |
| Unit tests `tests/unit/roth-analysis.spec.ts` | `[x]` |

**Post-ship:** Alan pre-RMD gap — conversions to top of 22% bracket; insight shows gap rate not working-year rate.

---

### Sprint — Lifetime Snapshot polish (2026-05-30) **← shipped**

| Item | Status |
|------|--------|
| Hero Funds outlast card + stat row | `[x]` |
| Decade timeline navigator (`activePage` → derived `pageStart`) | `[x]` |
| Inflection highlights + badges (SS / RMD / peak) | `[x]` |
| Sparkline Trend · legend · sticky Year · Net CF `+` prefix | `[x]` |
| SS/RMD columns auto-hide per page (`personColumnCount` colSpan) | `[x]` |

**Post-ship:** Visual smoke on `/complete` — hero · decade jump · inflection rows · SS/RMD column show/hide by page

---

### Sprint — 6-step onboarding wizard (2026-05-29) **← shipped**

| Item | Status |
|------|--------|
| Steps 3–5: liabilities → expenses → insurance | `[x]` |
| Advisor invite → step 6; skip on 3–5 only | `[x]` |
| `saveLiability` / `saveExpense` / `saveInsurance`; `POST /api/insurance` | `[x]` |
| `guidedOnboardingHref` — core complete = all 5 sections | `[x]` |
| Unit tests — `guided-onboarding-href.spec.ts` (11 cases) | `[x]` |

**Post-ship:** Visual check — 6 step dots; skip absent on steps 1, 2, 6

---

### Sprint — Onramp guided path bounce fix (2026-05-29) **← shipped**

| Item | Status |
|------|--------|
| `resolveGuidedOnboardingHref()` — setup-progress-aware Guide target | `[x]` |
| Wizard page — redirect only when assets **and** income present | `[x]` |
| Profile gates — `from=/onboarding/persona` and `from=/onboarding/wizard` | `[x]` |
| Unit tests — `guided-onboarding-href.spec.ts` (6 cases) | `[x]` |

**Post-ship:** Import data → onramp → Guide resumes wizard (not dashboard bounce)

---

### Sprint — Import format surfacing (2026-05-29) **← shipped**

| Item | Status |
|------|--------|
| `SupportedFormats` component — broker CSV, multi-sheet Excel, single CSV | `[x]` |
| Upload step order: formats → persona templates → CSV templates → drop zone | `[x]` |
| `DashboardOnramp` import card copy + format hint line | `[x]` |
| Helper text aligned to new layout | `[x]` |

**Post-ship:** Manual smoke on `/import` — formats + templates visible before drop zone; onramp import card copy

---

### Sprint — Dashboard onramp (2026-05-30) **← shipped**

| Item | Status |
|------|--------|
| `shouldShowOnramp()` gate (wizard + score ≥ 60 + hasData) | `[x]` |
| `DashboardOnramp` component (import / wizard / self-serve) | `[x]` |
| Wire gate in `app/(dashboard)/dashboard/page.tsx` | `[x]` |
| Golden-path E2E score floor (`ensureMinEstateHealthScore`) | `[x]` |
| Onramp `guidedHref` — persona before wizard | `[x]` |
| `/dashboard` wizard gate exempt (onramp path choice) | `[x]` |
| `check-golden-path-onramp-gate.ts` verify script | `[x]` |

**Post-ship:** `npm run test:e2e:golden-path` · manual onramp paths (Import / Guide / Self) on fresh user

---

### Sprint — Cross-role E2E + persona gate + attorney FK (2026-05-30) **← shipped**

| Item | Status |
|------|--------|
| Cross-household IDOR matrix (`test:e2e:security-isolation`) | `[x]` 10/10 |
| Advisor–consumer sync (Johnson asset → advisor estate-composition) | `[x]` |
| Attorney documents + gap-dismissals API smoke | `[x]` |
| Persona onboarding E2E (`e2e-golden-path@`) | `[x]` Card `aria-pressed` + card-wrapper click |
| App route slug CI validator | `[x]` |
| Persona page gate → `isWizardReadyProfile` | `[x]` |
| `Card` forwards div props (`aria-pressed`, etc.) | `[x]` |
| Attorney FK migration `20260630100000` | `[x]` applied prod |

**Commits:** `510ac8a` · `cfe5f88` · `12734a3` · `3e8525c` · `3c63648` · Card + persona E2E selector

**Post-deploy:** `npm run test:e2e:cross-role` · `npm run test:e2e:security-isolation`

---

### Sprint — Prod API fix + security smoke verification (2026-05-30) **← shipped**

| Item | Status |
|------|--------|
| Fix documents API slug conflict (all `/api/*` hung on Vercel) | `[x]` |
| `getRouteAuth()` + `/api/health` liveness probe | `[x]` |
| Security smoke on prod (`npm run test:e2e:security-smoke`) | `[x]` 7/7 |
| [LAUNCH_GATE.md](./LAUNCH_GATE.md) — legal/ops go-live blockers | `[x]` doc added |

**Commit:** `af12ff0` — `fix(api): resolve documents slug conflict that hung all Vercel routes`

**Next:** Work [LAUNCH_GATE.md](./LAUNCH_GATE.md) 🔴 items before `PUBLIC_SIGNUP_OPEN=true`.

---

### Sprint — RPC guards + attorney RLS + edge auth (2026-05-29) **← shipped**

| Item | Status |
|------|--------|
| `assert_household_caller_access()` on household RPCs | `[x]` |
| Attorney RLS policy fix (`attorney_listings` join) | `[x]` |
| Monte Carlo edge function JWT + ownership check | `[x]` |
| Rate limits on referral track + telemetry | `[x]` |

**Commits:** `security: RPC household access guards + attorney RLS policy fix` · `security: Monte Carlo edge function JWT auth + ownership check` · `security: rate limits on referral track + telemetry endpoints`

**Deploy:** `supabase db push` (migrations `20260629120000`, `20260629130000`) · `supabase functions deploy estate-monte-carlo`

---

### Sprint — Security + CI + audit automation (2026-05-29) **← shipped**

| Item | Status |
|------|--------|
| Internal API key on email notify routes | `[x]` |
| Household access checks on RPC read routes | `[x]` |
| Signed unsubscribe tokens | `[x]` |
| Dead code cleanup (~3.5k lines) | `[x]` |
| GitHub Actions CI workflow | `[x]` |
| Unit tests: health score, prospect, playbook | `[x]` |
| E2E: prospect redirect, health score, mobile | `[x]` |

**Commits:** `fix(security)` · `chore` · `test(ci)` · `test(e2e)`

---

### Sprint — Health Score Narrative + Advisor First-Client Playbook (2026-05-29) **← shipped**

| Item | Status |
|------|--------|
| `HealthScoreBadge` — hero/card/badge, null-safe | `[x]` |
| `scoreContextSentence()` + `isScoreStale()` | `[x]` |
| Surfaces: dashboard, my-estate-strategy, health-check, advisor list, meeting prep | `[x]` |
| PlanReadinessCard + PlanStatusCard canonical labels | `[x]` |
| Advisor empty state — intake / invite / prospect | `[x]` |
| `AdvisorFirstClientPlaybook` + localStorage auto-complete | `[x]` |
| `first_client_connected` notification | `[x]` |
| "Clients needing attention" panel | `[x]` |
| Manual smoke (18 steps) | `[ ]` |

**Commits:** `feat(health-score)` · `feat(advisor)` · Manual smoke: playbook script + [LAUNCH_CHECKLIST](./LAUNCH_CHECKLIST.md#health-score--advisor-playbook-manual-smoke-2026-05-29)

---

### Sprint — Prospect Mode + Mobile Review (2026-05-29) **← shipped**

| Item | Status |
|------|--------|
| `getProspectTaxConfig` + DB-backed prospect calculations | `[x]` |
| `GET /api/advisor/prospect-pdf` print route | `[x]` |
| Intake invitation CTA (advisor on send-intake-request) | `[x]` |
| Mobile alert banner + stacked rec buttons | `[x]` |
| Table scroll wrappers (projections, RMD, scenarios) | `[x]` |
| Manual smoke checklist in LAUNCH_CHECKLIST | `[x]` |

**Commits:** `feat(prospect)` · `feat(mobile)` · Manual smoke: [LAUNCH_CHECKLIST](./LAUNCH_CHECKLIST.md#prospect--mobile-review-mode-manual-smoke-2026-05-29)

---

### Sprint — Inline profile prompts (2026-05-27) **← shipped**

| Item | Status |
|------|--------|
| `ProfileFieldPrompt` shared component | `[x]` |
| `/social-security` SS field prompts | `[x]` |
| `/scenarios` planning field prompts (deduction: null only) | `[x]` |
| Partial PATCH merge on profile API | `[x]` |
| E2E partial-payload + UI prompt smoke | `[x]` |
| Go-live pre-flight script + doc | `[x]` |

See [SPRINT_INLINE_PROFILE_PROMPTS.md](./archive/sprints/SPRINT_INLINE_PROFILE_PROMPTS.md). **Follow-up (2026-05-29):** `/projections` readiness fix shipped — `checkProjectionReadiness()` + inline prompts; see DECISION_LOG.

---

### Sprint — Projections empty state fix (2026-05-29) **← shipped**

| Item | Status |
|------|--------|
| `lib/planning/projectionReadiness.ts` | `[x]` |
| Targeted empty state (missing field labels) | `[x]` |
| Partial view + `ProfileFieldPrompt` when assets/income exist | `[x]` |
| `buildProjectionPlanningFields()` | `[x]` |
| Unit tests — `projectionReadiness.spec.ts` (5 cases) | `[x]` |

---

### Sprint — Attorney monetization (2026-05-29) **← shipped (Stripe products manual)**

| Item | Status |
|------|--------|
| `POST /api/stripe/attorney-checkout` + webhook `attorney_tier` | `[x]` |
| `/attorney/billing` Subscribe buttons + success banner | `[x]` |
| `AttorneyUpgradePrompt` — client cap, PDF, doc dashboard | `[x]` |
| Server-side client cap (403 on grant/accept) | `[x]` |
| Attorney drip steps 1–3 + migration | `[x]` |
| Create Stripe attorney products + set env vars | `[ ]` **manual** |

**Before deploy:** apply `20260529130000_attorney_drip_columns.sql`; set `STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY` + `STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY`.

---

### Sprint — Friction reduction (2026-05-27) **← shipped**

**Goal:** Reduce time-to-first-value without Plaid, schema changes, or wizard gate changes.

| Item | Status |
|------|--------|
| Import tier gate → Tier 1 (history Tier 2+) | `[x]` |
| Slim profile (essentials only; deferred fields → inline prompts) | `[x]` |
| Quick-add asset modal on dashboard | `[x]` |
| Wizard drop-off instrumentation (`wizard_completed` / `wizard_abandoned`) | `[x]` |
| Assessment restore smoke test doc | `[x]` — run at go-live (`PUBLIC_SIGNUP_OPEN`); blocked by waitlist on prod 2026-05-27 |

See [SPRINT_FRICTION_REDUCTION.md](./archive/sprints/SPRINT_FRICTION_REDUCTION.md).

---

### Sprint 19 — Go-live hardening **← CURRENT**

**Goal:** Sprint 17/18 ops blockers; manual RLS isolation smoke.

| Item | Status |
|------|--------|
| Manual RLS isolation smoke | `[ ]` |
| LAUNCH_GATE counsel handoff | `[ ]` |
| Stripe Phase 1 — test mode: 6 prices + preview env + webhook | `[ ]` |
| Stripe Phase 2 — live mode: live catalog + prod env (go-live day) | `[ ]` |
| C-4 billing disclosures walkthrough on preview | `[ ]` |
| Go-live smoke (fresh email) | `[ ]` |

**Engineering (closed):** Sprint 18 shells (J) + flow/perf program K–O + 19a on `main`.

**Sprint 4 consumer pricing (2026-05-28, 3 commits):** $29/$79/$149 monthly; $290/$790/$1,490 annual (2 months free); 14-day Estate trial only. `lib/billing/stripePrices.ts`, `consumerPlanCatalog`, billing + `/pricing` period toggle, checkout/webhook, `UpgradeBanner` copy. **Code complete** — Stripe Dashboard + env vars remain manual. See [LAUNCH_CHECKLIST § Stripe Setup](./LAUNCH_CHECKLIST.md#stripe-setup-required-before-public_signup_opentrue).

**TERMS-1/F (2026-05-27):** Signup T&C checkbox; backfill banner; ToS unify. **Trial fix (2026-05-27):** free Tier 1 at signup; 14-day Estate trial via Stripe only; assessment → `/billing?plan=`. **TERMS-2/3/5 (2026-05-29):** Estate trial checkout; `trialing` access; direct post-Stripe redirect.

**Consumer estate UX (2026-05-28):** Estate preview + execution checklist (`estate_checklist_items`). **Apply migration:** `20260528120000_estate_checklist_items.sql`.

**Golden Path / guided mode (2026-05-29, 4 commits):** `determinePlanStage`, `PlanProgressBar`, stage-gated dashboard sections, localStorage `mwm_show_all_tools`. E2E: `npm run test:e2e:golden-path`. Wizard / unlock-estate / tier gates unchanged.

**Advisor dashboard tier fix (2026-05-28):** `_dashboard-body.tsx` uses `getUserAccess().tier` — advisor-connected consumers get Stage 3 dashboard (was reading raw `consumer_tier`). Manual advisor billing documented in [LAUNCH_CHECKLIST § Advisor Integration](./LAUNCH_CHECKLIST.md#advisor-integration-launch--manual-billing).

---

### Post-launch — Advisor adoption package (Month 2) `[ ]`

**Goal:** Automate advisor **firm** billing; deepen advisor onboarding UX.

**Billing automation (deferred from launch)**
- `[ ]` Stripe products: Advisor Starter ($149/mo, 10 clients), Advisor Growth ($349/mo, 50 clients) — see [LAUNCH_CHECKLIST § Stripe Advisor & B2B2C](./LAUNCH_CHECKLIST.md#stripe--advisor--b2b2c-billing-prior-to-go-live)
- `[x]` Auto-pause consumer subscription on advisor connection (`applyAdvisorConnectionBilling`)
- `[x]` Auto-resume / resubscribe prompt on advisor disconnect (`restoreConsumerBillingOnDisconnect`)
- `[x]` Seat count enforcement on invite + accept (`advisorClientLimits.ts`) — app-side; not yet gated on firm Stripe sub
- `[ ]` Advisor billing portal (Stripe Customer Portal for firm subscription)

**Adoption UX**
- `[x]` "Invite your first client" primary CTA on empty advisor portal (`AdvisorEmptyStateCta`)
- `[x]` First-connection playbook (Overview → Strategy → Meeting prep)
- `[x]` Advisor activation drip — day 0 welcome, day 3 no-clients nudge, day 7 case study (`lib/emails/advisor-drip-templates.ts`, cron + `/api/email/advisor-drip`)
- `[x]` Competitive positioning copy in advisor portal — `AdvisorValuePropBanner` on `/advisor` (dismissible)
- `[ ]` Advisor-specific email sequence (activation + client milestone alerts)

---

### Sprint 18 — Planning shell completion ✅ (2026-05-27)

| Item | Status | Notes |
|------|--------|-------|
| Complete + estate-tax loading/error | `[x]` | Sprint J — `e93f9a0` |
| RouteErrorFallback adoption | `[x]` | Dashboard + trust-strategy |
| Manual RLS isolation smoke | `[ ]` | → Sprint 19 |
| LAUNCH_GATE / Stripe / go-live smoke | `[ ]` | → Sprint 19 |

---

### Post-launch perf program (2026-05-27) ✅ CLOSED

Engineering perf/correctness sprints shipped on `main` (`88cc63d`–`a4d2e38`, Sprint J in this session):

| Sprint | Theme | Commit anchor |
|--------|--------|---------------|
| **A** | Advisor tab loader alignment, Meeting Prep, composition dedupe | `ead0fac` |
| **B** | Monte Carlo + Allocation server prefetch | `f0a279f` |
| **C** | Scenarios lazy B/C projection fetch | `88cc63d` |
| **D** | Advisor tab `dynamic()` + domicile mount dedupe | `7ac9475` |
| **E** | Insurance/businesses `router.refresh()` | `35f02b1` |
| **F** | Profile gate consistency (`requireHouseholdRecord`) | `35f02b1` |
| **G** | Sidebar tier-locked → billing links | `f0f004d` |
| **H** | `loading.tsx` on hot prefetch routes | `b1f995f` |
| **I** | `error.tsx` + `RouteErrorFallback` | `a4d2e38` |
| **J** | Complete + estate-tax loading/error | `e93f9a0` |

### Flow & perf program (Sprints K–19a) — 2026-05-28 ✅ CLOSED

| Sprint | Theme | Commit |
|--------|--------|--------|
| **K** | Consumer flow consistency | `90d167a` |
| **L** | Bundle + duplicate fetch | `5da71b0` |
| **M** | Dashboard Suspense streaming | `c5186ca` |
| **N** | Advisor tab perf (roster alerts, Strategy hydrate) | `615d496` |
| **O** | Shells + composition cache tags | `3524581` |
| **19a** | Deferred review fixes (allocation, assessments, Meeting Prep) | `b7a15dd` |

Detail: [NEXT_SESSION.md](./NEXT_SESSION.md)

---

## ⚠️ Go-live gate

**No public go-live until all LAUNCH_CHECKLIST Section 1 gates are checked AND
CONSUMER_RELEASE_SMOKE_TEST manual pass completes.** Section 2 (domain, DNS, Resend,
Search Console) is ops-only and runs after Section 1 is fully verified.

---

### Sprint 12 — Conversion decisions & responsive UX (Weeks 43–46) ✅

**Goal:** Close A/B tests with data-driven decisions. Mobile audit. Copy pass.

**Persona alerts (first — deferred since Sprint 3; do not bury under A/B/mobile)**
- `[x]` Business $5M / $10M threshold alert on dashboard (`lib/dashboard/personaAlerts.ts`)
- `[x]` Multi-state real estate probate-risk alert on dashboard (`situs_state` in `loadDashboardCoreInputs`)
- `[x]` Planning empty-state CTAs — profile-only on `/projections` + `/complete` (`PLANNING_MISSING_PROJECTION_ACTIONS_TIER2`)

**A/B test decisions**

> ✅ Pre-launch: no traffic — shipped **personalized** + **score_visible**; removed A/B code and `app_config` rows (DECISION_LOG).

- `[x]` `ab_upgrade_copy` — personalized only; `EVENT_UPGRADE_COPY` verified (24/24 slugs)
- `[x]` `ab_assessment_gate` — score_visible only; logged-out assess shows scores

**UX**
- `[x]` Mobile nav — dashboard off-canvas drawer on `<lg` (`DashboardShell`); full route audit deferred post-launch
- `[x]` In-app copy audit — dashboard, public event/assess, planning surfaces, landing + share links; `DisclaimerBanner`; upgrade gates

**Success criteria**
- `[x]` A/B flags resolved; no split-test code at launch
- `[x]` Copy audit complete (hedging disclaimers removed or reframed; scenarios footer uses `Scope:`)

---

### Sprint 14 — Full test execution — feature freeze (Weeks 51–54) ✅ CLOSED 2026-05-23

- Manual smoke §1–11 passed
- §2.4 recompute automated (`93aa6f5`)
- Admin Portal hidden from consumers (`f4e9160`)
- Asset modal scrollable (`f4e9160`)
- E2E complete suite (**259 tests** in 42 files); staging 2026-05-25: consumer/advisor/public green with `--workers=1` ([PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md)); 2026-05-27 profile spouse-layout + growth-assumptions API specs
- All Sprint 14 launch bugs resolved

**Commits:** `93aa6f5`, `1e092d7`, `f4e9160`

---

### Sprint 17 — Go-live prep (Weeks 63–66) **← BLOCKERS REMAIN**

**Goal:** Legal review + Stripe/Supabase Dashboard config → flip `PUBLIC_SIGNUP_OPEN` → production smoke with fresh email.

**Engineering note:** Post-launch perf (Sprints B–J) closed; remaining Sprint 17 work is **legal/ops**, not code, except RLS isolation smoke.

**Compliance code (C-2b through C-5):** ✅ All closed on `main` — see commit log below.

| Item | Status | Notes |
|------|--------|-------|
| **Security post-deploy smoke** | `[x]` | 7/7 on prod 2026-05-30 — [LAUNCH_CHECKLIST § Security](./LAUNCH_CHECKLIST.md#security-hardening-post-deploy-browser-smoke-2026-05-29) |
| **Prod API routes** | `[x]` | Documents slug conflict fix `af12ff0`; `/api/health` live |
| **LAUNCH_GATE.md** | `[ ]` | **Blocker** — counsel handoff (§10/§11/§13, one redline); placeholders batched with redlines; email aliases — see [LAUNCH_GATE.md](./LAUNCH_GATE.md) |
| **Stripe Dashboard config** | `[ ]` | invoice.upcoming, portal cancel, receipts — [BILLING_DISCLOSURES_CHECKLIST.md](./BILLING_DISCLOSURES_CHECKLIST.md) |
| **Stripe production billing** | `[ ]` | Production keys; checkout + webhook verified |
| **Open signups** | `[ ]` | `PUBLIC_SIGNUP_OPEN=true` — go-live day ([LAUNCH_CHECKLIST.md § Opening signups](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip)) |
| **Go-live smoke** | `[ ]` | Core §1–3 + signup → confirm email → login → dashboard |
| **Drip step 2 check** | `[ ]` | `npm run verify:drip -- --email e2e-drip@mywealthmaps.test` (day 3+) |
| **Auth cleanup + deleteUser hardening** | `[x]` | FK scan, verify-deletion, rolobe retirement — `aea4bf6`, `3cdd9b5` |
| **Sprint UX-1 Life Events Hub** | `[x]` | Public `/events` hub + in-app picker — `6fb73e6` |
| **Design system Phase 1–3** | `[x]` | Tokens, sidebar/banner, indigo sweep — `d173b00`, `249bf85`, `7a1a121`, `a10299b`, `37f3f0a` |
| **Onboarding wizard OB-1** | `[x]` | Extended profile + `/onboarding/wizard` — `b1c7b49` (+ `fd00b69` wizard name dedup) |
| **Tier-aware narrative OB-2** | `[x]` | Profile intro, wizard previews, SetupPromptCard tier copy — `bccef99` |
| **Advisor flywheel AF-1** | `[x]` | Ask-advisor notification + advisor Strategy Questions card — `a255616` |
| **Setup progress OB-3** | `[x]` | `SetupProgressCard`, data-inferred wizard, onboarding import bypass — `3376134` |
| **Persona onboarding** | `[x]` | `/onboarding/persona`, persona-aware wizard, `PersonaInsightCard`, `personaConfig` — 2026-05-29 |
| **Acquisition & activation** | `[x]` | Attorney intake requests, referral impact panel, meeting prep PDF — 2026-05-29 |
| **Sidebar unlock OB-3b** | `[x]` | Remove old setup checklist; FP tier 1 + `isLockedUser` exempt; Security/My Advisor/Billing always on; My Advisor onboarding note — `6d2bff3`, `1660f27` |
| **Superuser sidebar SU-1** | `[x]` | `isSuperuser` prop, staff bypass, Advisor Portal admin check — `3c0d28b` |
| **Layout household query fix** | `[x]` | Drop invalid `date_of_birth_1` from `getDashboardLayoutContext` (fixes false `hasHousehold`) — `d50a982` |
| **Sidebar active indicator NAV-1** | `[x]` | Auto-expand group on active child; `isNavItemActive()` path matching — `be92947` |
| **Advisor portal performance** | `[x]` | Roster batched net worth; parallel client workspace load; scoped tax queries — `8c526de` |
| **Advisor portal UX-2** | `[x]` | Brand, tab-scoped load, PlanStatusCard, gap statuses, metrics cache, estate/strategy alerts — see SCHEMA_CHANGELOG UX-2 |
| **Advisor portal UX-3** | `[x]` | Strategy tab three-step workflow, severity system, opportunities + recommendations panels — SCHEMA_CHANGELOG UX-3 |
| **Advisor portal UX-4** | `[x]` | Inline Opportunities modeling — `InlineStrategyPanel`, `catalogToPanel.ts`, 11-strategy catalog — SCHEMA_CHANGELOG UX-4 |
| **Advisor portal UX-5** | `[x]` | Strategy tab restructure — impact panel, Strategy Horizon, remove redundant panels — SCHEMA_CHANGELOG UX-5 |
| **Advisor portal ENG-1** | `[x]` | Estate/Tax strategy inclusion parity via horizon actual set (no RPC change) — SCHEMA_CHANGELOG ENG-1 |
| **Advisor portal UX-5b** | `[x]` | CompositeOverlay: remove manual entry; default `recommendations` mode — SCHEMA_CHANGELOG UX-5b |
| **Advisor strategy tab polish** | `[x]` | Alert hierarchy, severity cards, opportunity savings, composite gate, MC empty state — 2026-05-30 |
| **Advisor Estate tab polish** | `[x]` | Liquidity hero, composition waterfall, conflict cards, doc alert, beneficiary-by-account, flow toggle, account groups — 2026-05-30 |
| **Advisor Retirement tab polish** | `[x]` | Wire YearRow + SS + Roth analysis; readiness hero, snapshot, withdrawal sequencing — 2026-05-30 |
| **Tax Horizons consumer polish** | `[x]` | Readiness pill, bypass bar, grouped assets, remove embedded dashboard sections — `56762ad` |
| **Brand consistency pass** | `[x]` | Consumer + advisor page headings/buttons — navy/gold tokens (`fbaa709`) |
| **Client Summary PDF upgrade** | `[x]` | ConsumerEstatePlanPDF matches Attorney Summary standard — SCHEMA_CHANGELOG 2026-05-27 |
| **Nav consistency (homepage, billing, utility)** | `[x]` | Homepage → `(public)/page.tsx` + PublicNav; MinimalAuthNav billing; WordmarkOnly utility layouts — SCHEMA_CHANGELOG 2026-05-27 |
| **ENG-2 — Growth assumptions (2A–2E)** | `[x]` | RE/business engine fix; `growth_assumptions` jsonb; insurance/income growth; MC alignment UI — commits `5589b89`–`8e90fa4`; SCHEMA_CHANGELOG ENG-2 |
| **Sprint P-1 perf quick wins** | `[x]` | Dashboard Promise.all, advisor conflict cache, recompute debounce, next/font, indexes — `5c24160` |
| **Sprint P-2 pre-launch refactors** | `[x]` | Recommendations cache, projections cache-first, auth dedup — `47a38f3` ([PERF_SPRINT_P1.md](./archive/sprints/PERF_SPRINT_P1.md)) |

**Compliance commit log (all on `main`):**

| Commit | Sprint | Key work |
|--------|--------|----------|
| `788aa08` | C-2b | UX language audit — 32 findings → 0 |
| `236890c` | C-3 | RLS fixes — businesses leak, monte_carlo_runs, accepted status parity |
| `56a4407` | C-3 | Auth callback, MFA middleware, security headers, PII logging |
| `cda2ccc` | C-3 | Monte Carlo UI strings, doc sync |
| `d854c05` | C-3 | Audit artifacts gitignored |
| `462bda9` | C-4 | Billing disclosures, RCW 19.316, cancellation, renewal reminders |
| `2e1dff3` | C-5 | Privacy Policy, Terms of Service, footer, sitemap |
| `695a860` | C-5 | Legal pages follow-up |
| `5c24160` | P-1 | Performance quick wins — dashboard Promise.all, indexes, debounce, next/font |
| `47a38f3` | P-2 | Pre-launch perf — recommendations cache, projections cache-first, auth dedup |
| `4d9571e` | C-6 | Deletion infra, Stripe plan-change guards, process-deletions cron |
| `01b997a` | C-6 | Admin Data & Compliance tab, admin APIs, gdpr-delete-user CLI |
| `ddbf079` | C-7 | Compliance reminders cron, privacy_requests, consumer + admin intake |
| `1ce9110` | C-7 | Migration fix — `due_at` DEFAULT not GENERATED |
| `84388ad` | Cleanup | Rolobe cleanup tooling, verify-drip-sequence, canonical E2E migration |
| `aea4bf6` | C-6+ | deleteUser WCPA hardening — FK scan, orphan Auth, verify-deletion script |
| `3cdd9b5` | C-6+ | FK scan — firms, firm_members, change_log before Auth delete |
| `8569c7c` | Docs | deleteUser WCPA hardening — master doc sync |
| `6fb73e6` | UX-1 | Life events hub `/events` + in-app event picker modal |
| `d173b00` | Design | My Wealth Maps tokens + Button/Card/form primitives |
| `249bf85` | Design | Sidebar navy/gold chrome (Phase 2b) |
| `7a1a121` | Design | Tailwind v4 `color:` prefix on sidebar + banner (Phase 2c) |
| `a10299b` | Design | Phase 3 indigo sweep — Financial Planning pages |
| `37f3f0a` | Design | Phase 3 indigo sweep — retirement, estate, portals, shared UI |
| `b1c7b49` | OB-1 | Onboarding wizard — extended profile + guided first-data entry |
| `fd00b69` | OB-1 | Remove duplicate wizard name fields from profile section |
| `bccef99` | OB-2 | Tier-aware onboarding narrative and contextual messaging |
| `a255616` | AF-1 | Ask-advisor notification + advisor Client Strategy Questions |
| `3376134` | OB-3 | SetupProgressCard, wizard hasAnyData gate, onboarding import for Tier 1 |
| `3c0d28b` | SU-1 | Superuser sidebar locks — `isSuperuser` prop, `isLockedUser` staff bypass |
| `6d2bff3` | OB-3b | Financial Planning tier 1; remove old dashboard setup checklist |
| `1660f27` | OB-3b | Unlock Security/My Advisor/Billing; My Advisor onboarding note |
| `d50a982` | OB-3b | Layout household query fix + master doc sync |
| `be92947` | NAV-1 | Active nav indicator follows current route; FP group auto-expand |
| `8c526de` | Perf | Advisor roster batched net worth; parallel client page load |

### Sprint summary — 2026-05-26

| Sprint | Status | Commits |
|--------|--------|---------|
| Design system Phase 1–3 | ✅ | `d173b00`, `249bf85`, `7a1a121`, `a10299b`, `37f3f0a` |
| Onboarding wizard OB-1 | ✅ | `b1c7b49`, `fd00b69` |
| Tier-aware narrative OB-2 | ✅ | `bccef99` |
| Advisor flywheel AF-1 | ✅ | `a255616` |
| Setup progress OB-3 | ✅ | `3376134` |
| Superuser sidebar SU-1 | ✅ | `3c0d28b` |
| Sidebar + onboarding OB-3b | ✅ | `6d2bff3`, `1660f27`, `d50a982` |
| Active nav indicator NAV-1 | ✅ | `be92947` |
| Advisor portal performance | ✅ | `8c526de` |
| Advisor portal UX-2 | ✅ | `1ba93eb` |
| Advisor portal UX-3 | ✅ | `06edb1a` |
| Advisor portal UX-4 | ✅ | `3c5c0ef` |
| Advisor portal UX-5 | ✅ | `d6e5c5e` |
| Advisor portal ENG-1 | ✅ | `b5cc8da` |
| Advisor portal UX-5b | ✅ | `4220c0a` |
| Brand consistency pass | ✅ | `fbaa709` |
| Client Summary PDF upgrade | ✅ | `0816f37` |
| Nav consistency (homepage, billing, utility) | ✅ | `b51eedd` |

**Success criteria**
- [LAUNCH_GATE.md](./LAUNCH_GATE.md) complete + counsel sign-off
- C-4 manual walkthrough signed off (signup → paid → receipt → self-serve cancel)
- Go-live sequence executed per LAUNCH_CHECKLIST
- `/signup` open after env flip; Core §1–3 smoke passes with fresh email

---

### Sprint UX-1 — Life events hub + in-app browser ✅ CLOSED 2026-05-25

**Goal:** Public catalog of all 24 life events + searchable in-app picker on dashboard.

- `[x]` `app/(public)/events/page.tsx` — hub grouped by category (Business & Wealth, Family, Health & Retirement)
- `[x]` Public nav **Life Events** link; homepage “See all life events →”
- `[x]` `LifeEventBanner` — modal picker with search, relevance ordering, logged-events list
- `[x]` Select event → log `life_events` → `/event/[slug]/assess`
- `[x]` `lib/events/catalog.ts` — shared grouping, filter, `sortEventsByRelevance`
- `[x]` Sitemap `/events` at priority 0.7; [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md) updated

**Commit:** `6fb73e6`

---

### Sprint P-1 — Performance quick wins ✅ CLOSED 2026-06-02

**Goal:** Pre-launch dashboard TTFB improvements without changing calculation logic.

- `[x]` Dashboard sequential block → `Promise.all` (`dashboard/page.tsx`)
- `[x]` Advisor client — read `beneficiary_conflicts` cache only (no `detectConflicts` on render)
- `[x]` Recompute 3s debounce per household (`triggerEstateHealthRecompute.ts`)
- `[x]` Notification unread count server-fetched in layout
- `[x]` `next/font` — Playfair Display + DM Sans
- `[x]` Indexes applied in production — `idx_assets_owner_id`, `idx_liabilities_owner_id`

**Commits:** `5c24160` · **Doc:** [PERF_SPRINT_P1.md](./archive/sprints/PERF_SPRINT_P1.md)

---

### Sprint P-2 — Pre-launch performance refactors ✅ CLOSED 2026-06-02

**Goal:** Remove hot-path RPCs and redundant auth queries before open signups.

- `[x]` `estate_health_scores.recommendations` jsonb — persisted during recompute (`20260602130000_sprint_p2_recommendations_cache.sql`)
- `[x]` Dashboard reads recommendations from cache — no `generate_estate_recommendations` on load
- `[x]` `loadProjectionData` cache-first — serve `outputs_s1_first` when projection is fresh
- `[x]` `getDashboardLayoutContext` — React `cache()` dedup for layout auth/profile/household/notifications

**Commits:** `47a38f3` · **Doc:** [PERF_SPRINT_P1.md § Sprint P-2](./archive/sprints/PERF_SPRINT_P1.md#sprint-p-2--pre-launch-refactors)

---

### Compliance sprints C-2b – C-5 ✅ CLOSED (code)

| Sprint | Status | Commits |
|--------|--------|---------|
| C-2b UX language audit | ✅ | `788aa08` |
| C-3 RLS + auth/security | ✅ | `236890c`, `56a4407`, `cda2ccc`, `d854c05` |
| C-4 Billing disclosures | ✅ code | `462bda9` |
| C-5 Privacy + Terms | ✅ code | `2e1dff3`, `695a860` |
| C-6 Data deletion (WCPA) | ✅ live | `4d9571e`, `01b997a` |
| C-7 Compliance reminders + privacy intake | ✅ live | `ddbf079`, `1ce9110` |

---

### Compliance infrastructure (C-6 + C-7) ✅ LIVE 2026-05-25

| What | How | Status |
|------|-----|--------|
| 30-day post-cancellation deletion | Stripe webhook → `deletion_schedule` → 2am cron | ✅ Live |
| Plan-change guard | Webhook + cron double-check | ✅ Live |
| Deletion audit trail | `deletion_audit_log` append-only | ✅ Live |
| Admin deletion UI | `/admin` → Data & Compliance | ✅ Live |
| Daily compliance check | 8am cron → `avoels@comcast.net` if issues | ✅ Live |
| WCPA privacy requests | In-app form + 45-day SLA tracking | ✅ Live |
| Email infrastructure | `hello@`, `noreply@`, `privacy@` verified via Resend | ✅ Live |
| Migrations | **75** files in `supabase/migrations/`; applied through `20260625170000` | ✅ Clean |

---

### Sprint C-7 — Compliance reminders + privacy intake ✅ CLOSED 2026-05-25 (prod)

- `[x]` `privacy_requests` table + migration applied in production
- `[x]` Daily compliance cron → `COMPLIANCE_EMAIL` (`avoels@comcast.net`); issues only; monthly summary on 1st
- `[x]` Consumer privacy form at `/settings/security`
- `[x]` Admin Privacy Requests sub-view + PATCH status
- `[x]` Production cron smoke — use `www.mywealthmaps.com` (apex strips auth header)

**Commits:** `ddbf079`, `1ce9110`

---

## Sprint C-6 — Data deletion & WCPA compliance ✅ CLOSED 2026-05-25 (prod)

**Goal:** Washington WCPA right-to-delete + Privacy Policy 30-day post-cancellation automation.

- `[x]` `lib/compliance/deleteUser.ts` — audited deletion; `deletion_audit_log` append-only; FK scan (`firms`, `firm_members`, `change_log`, …); orphan Auth handling; hard/soft delete fallback; post-deletion verification (`aea4bf6`, `3cdd9b5`)
- `[x]` `scripts/verify-deletion.ts` — standalone WCPA compliance check; `npm run verify:deletion`
- `[x]` `deletion_schedule` + migration `20260625120000_sprint_c6_deletion_compliance.sql`
- `[x]` Stripe webhook — schedule +30 days on cancel; skip on plan change / advisor role upgrade
- `[x]` Cron `process-deletions` — role + active-sub re-check before execute (`4d9571e`)
- `[x]` Admin `/admin` → Data & Compliance tab — schedule, audit, execute dry-run (`01b997a`)
- `[x]` `scripts/gdpr-delete-user.ts` — CLI uses same `deleteUser` path
- `[x]` [COMPLIANCE_CALENDAR.md](./COMPLIANCE_CALENDAR.md) — SOP + monthly checks
- `[x]` C-6 migration applied in production; crons verified

**Commits:** `4d9571e`, `01b997a`

---

### Sprint 16 — C-2b UX language audit ✅ CLOSED 2026-05-24

**Goal:** Compliance language policy; wire remaining disclaimer surfaces.

- `[x]` Sprint C-2b complete — all `DISCLAIMER_STRINGS` surfaces wired; `audit-ux-language.sh` 0 findings (`788aa08`)
- `[ ]` Billing setup — **carried to Sprint 17**
- `[ ]` Open signups — **Sprint 17 go-live day** (after legal + manual verify)
- `[ ]` Drip step 2 check — **carried to Sprint 17**

**Commits:** `788aa08`

---

### Sprint C-3 — RLS + auth/security ✅ CLOSED 2026-06-02

**Goal:** Close critical RLS gaps and ship auth/security hardening before open signups.

- `[x]` Phase 1 — `20260602000000_sprint_c3_rls_fixes.sql` (`236890c`)
- `[x]` Phase 1b + Phase 3 — `/auth/callback`, confirm-email, MFA middleware, security headers, PII logging (`56a4407`)
- `[x]` Docs + Monte Carlo UX strings (`cda2ccc`); audit artifacts gitignored (`d854c05`)

**Commits:** `236890c`, `56a4407`, `cda2ccc`, `d854c05`

---

### Sprint C-4 — Billing disclosures ✅ CLOSED 2026-06-02 (code)

**Goal:** RCW 19.316 auto-renewal + FTC negative option compliance.

- `[x]` `lib/compliance/billing-disclosures.ts`; pre-checkout, cancel flow, renewal reminders (`462bda9`)
- `[ ]` Manual Stripe Dashboard verify + production walkthrough — [BILLING_DISCLOSURES_CHECKLIST.md](./BILLING_DISCLOSURES_CHECKLIST.md)

**Commits:** `462bda9`

---

### Sprint C-5 — Privacy Policy + Terms ✅ CLOSED 2026-06-02 (code)

**Goal:** Public legal pages, footer links, sitemap.

- `[x]` `/privacy`, `/terms`, `LegalFooterLinks`, sitemap/robots (`2e1dff3`, `695a860`)
- `[ ]` [LAUNCH_GATE.md](./LAUNCH_GATE.md) — placeholders, counsel, email aliases

**Commits:** `2e1dff3`, `695a860`

---

### Sprint 15 — Go-live (Section 2 ops) ✅ CLOSED 2026-05-24

**Goal:** Execute LAUNCH_CHECKLIST Section 2 — domain, DNS, Search Console, waitlist mode.

- `[x]` Domain live — `mywealthmaps.com` + SSL (2026-05-24)
- `[x]` DNS cutover + `NEXT_PUBLIC_APP_URL` → production URL (2026-05-24)
- `[x]` Vercel Production env vars verified (2026-05-24)
- `[x]` Resend domain verified — SPF/DKIM (2026-05-24)
- `[x]` Search Console — verified via **Cloudflare** (not meta tag); sitemap submitted (2026-05-24)
- `[x]` Waitlist mode active — `middleware.ts` redirect (`3ceb125`); Preview enabled (2026-05-24)
- `[x]` Post-cutover smoke §1–3 passed on production (2026-05-24)
- `[x]` Sitemap XML + middleware infra bypass — `/sitemap.xml`, `/robots.txt` never gated (`73648e5`)
- `[x]` Test account cleanup script — `scripts/cleanup-test-accounts.ts` (`3f732e3`)
- `[x]` Dev workflow — local → preview → production
- `[ ]` Open signups — **Sprint 17 go-live day** (see [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md))

**Commits:** `7afaedb`, `bb9a191`, `3ceb125`, `729d411`, `b97f945`, `3f732e3`, `73648e5`

---

### Sprint 15 — Go-live (Section 2 ops only) (Weeks 55–58) — archived detail

**Waitlist mode (shipped)**

- `[x]` Waitlist page + email capture (`/waitlist`, `POST /api/email-capture`)
- `[x]` Runtime `/signup` → `/waitlist` redirect in `middleware.ts` (`3ceb125`; renamed from `proxy.ts`)
- `[x]` `getSignupHref()` wired on public CTAs; invite flows bypass gate
- `[x]` Default on for `VERCEL_ENV=production`; flip via `PUBLIC_SIGNUP_OPEN=true` at go-live

**Vercel Production environment variables — verified 2026-05-24**

See LAUNCH_CHECKLIST § “Vercel Production env vars”. `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` **not needed** — Search Console verified via Cloudflare.

---

## Completed sprints

### Sprint 13 — Pre-production hardening (Weeks 47–50) ✅

**Goal:** Stable staging, migrations verified, smoke test extended. Feature freeze begins.

**Shipped**
- `[x]` **75 migrations** in repo (`supabase/migrations/[0-9]*.sql`); local + remote in sync through `20260625170000`
- `[x]` E2E complete suite — **259 tests** in 42 files (143 consumer / 45 advisor / 59 public / 2 attorney / 7 import-unit); staging verified 2026-05-25; +6 tests 2026-05-27 (profile layout + growth API)
- `[x]` Seed scripts — `seed-test-attorney`, `seed-test-advisor`, `seed-test-consumer-estate`
- `[x]` Acquisition & attribution smoke **A–G passed** on staging
- `[x]` `INTERNAL_API_KEY` on Vercel Production
- `[x]` **`rmd-start-age` copy** — birth-year range 72–75 (was hardcoded 73 on event page)
- `[x]` **`advisor_directory_referral_code_trigger`** — was missing; added + migration

**Launch blockers found & fixed during Sprint 13 smoke:** RMD event copy inaccuracy; advisor `referral_code` not auto-generated on insert.

---

### Sprint 11 — Planning-app coherence (Weeks 39–42) ✅

**Goal:** Close cross-links and empty states that break the planning flow. No new feature pillars.

**Shipped**
- `[x]` Projections + Lifetime Snapshot — `PlanningSurfaceNav`; `loadProjectionData` on `/complete`
- `[x]` Scenarios discoverability — `ScenariosExploreCard` on `/projections`
- `[x]` Charitable Giving empty state — `buildPersonalizedCharitableTopics()` + profile note gate
- `[x]` `/complete` tier gate aligned to tier 2; pathname-based nav active pill
- `[x]` Planning empty states — tier-2 surfaces use profile-only CTA (Sprint 12 hardening shipped same release)

---

### Sprint 10 — Persona depth, advisor flywheel (Weeks 35–38) ✅
**Goal:** Close hard gates and log Sprint 10 decisions. Persona threshold alerts carry to Sprint 11.

**Shipped**
- `[x]` Business succession Path A — minimal intake (`households.succession_*`); `/business-succession` tier 3; dashboard alert
- `[x]` Invite-your-advisor Path A — `/onboarding/invite-advisor`; `profiles.onboarding_invite_advisor_completed_at` (skip = same timestamp)
- `[x]` A/B exit criteria in DECISION_LOG — `tier_upgraded`, 50 events/variant or 4 weeks, owner Alan
- `[x]` `CONNECTED_ADVISOR_CLIENT_STATUSES` — canonical `active` | `accepted` import; advisor APIs aligned
- `[x]` Life-event-on-connect verified — `pickConnectionLifeEvent()`; advisor Overview banner
- `[x]` Migration `20260530000000_sprint9_10_gates.sql`

**Carry-forward (shipped Sprint 12)**
- `[x]` Business $5M / $10M dashboard alert
- `[x]` Multi-state RE probate-risk dashboard alert

---

### Sprint 9 — Launch, signup attribution, growth polish (Weeks 31–34) ✅
**Goal:** Referral persistence, drip completeness, Sprint 9 hard gates.

**Shipped**
- `[x]` Signup attribution — `20260529000000_profiles_referral_attribution.sql`
- `[x]` Drip — all **24** event slugs in `lib/emails/drip-templates.ts`
- `[x]` RMD — `lib/calculations/rmdStartAge.ts` (72/73/75)
- `[x]` Life-event-on-connect — `connection_life_event_*` on `advisor_clients`; `accept-request` + advisor Overview
- `[x]` Digital Assets — `FEATURE_TIERS['digital-assets'] = 2`; page tier gate
- `[x]` URL audit — `lib/app-url.ts` `getAppUrl()` on email routes
- `[x]` `app/robots.ts` permissive rules in repo

**Launch ops (Sprint 15)** — Search Console, domain, prod drip smoke still open

---

### Sprint 8 — Attorney referral attribution (Weeks 27–30) ✅
**Goal:** Attorney event-page attribution parallel to advisor `?ref=` distribution.

**Shipped**
- `[x]` Migration `20260528000000_attorney_referrals.sql` — `attorney_listings.referral_code`; `referral_clicks` attorney columns + `listing_type`; attorney RLS
- `[x]` `POST /api/referral/track` — `type: 'attorney' | 'advisor'`; advisor path unchanged
- `[x]` `_referral-tracker.tsx` — `?aref=`; `mwm_attorney_referral_*` sessionStorage
- `[x]` `buildAttorneyReferralUrl` / `buildAllAttorneyEventReferralUrls` — 24 slugs
- `[x]` Attorney portal newsletter kit — three-tab UI (blue styling)

**Carried to Sprint 9**
- Launch checklist (partial — robots code done)
- Signup referral persistence (done)
- Drip for all 24 slugs (done)

---

### Sprint 7 — Funnel depth, distribution, personalization (Weeks 23–26) ✅
**Goal:** Improve funnel reporting, advisor distribution kit, expand drip and upgrade personalization.

**Shipped**
- `[x]` Admin funnel — 30-day `funnelStepCounts`; `tierConversion` by tier; By Tier tab
- `[x]` Advisor newsletter kit — 24 referral URLs, grouped UI, email + plain-text copy
- `[x]` `buildAllEventReferralUrls` — all 24 `EVENT_SLUGS`
- `[x]` Drip — custom `EVENT_SEQUENCES` for all **12** `DripEventSlug` union members
- `[x]` `EVENT_UPGRADE_COPY` — all 24 slugs, tier 2 and 3
- `[x]` Age triggers — per-age slugs (62/65/70/73)

**Carried to Sprint 8** (see Current sprint above)
- Launch / Search Console — [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)
- Drip for 12 slugs outside `DripEventSlug` union (listed under Sprint 8 Growth polish)
- Signup referral persistence

---

### Sprint 6 — Measurement, attorney PDF, growth distribution (Weeks 19–22) ✅
**Goal:** Act on funnel data, ship attorney-ready PDF content, begin outbound distribution.

**Shipped**
- `[x]` Admin funnel tab — `funnel-tab.tsx`; 30-day slug/referral data; SQL cheat sheet
- `[x]` Attorney PDF — `AttorneyEstatePlanPDF`; `variant=attorney` API branch (conflicts, assets, tax)
- `[x]` SEO — `app/sitemap.ts`, `app/robots.ts` (canonical `NEXT_PUBLIC_APP_URL`)
- `[x]` Resend drip — 3-step sequence; step 1 on capture; steps 2–3 in notifications cron; unsubscribe
- `[x]` Migration `20260524000000_email_captures_drip.sql`

**Deferred to Sprint 7+** (resolved or moved)
- `[ ]` Search Console verification → Sprint 8 launch checklist
- `[x]` Event → tier conversion report (Sprint 7)
- `[x]` Advisor newsletter kit (Sprint 7)
- `[x]` Attorney `?aref=` on event pages (Sprint 8 — `attorney_listings.referral_code`)

---

### Sprint 5 — Analytics, optimization, event pages (Weeks 15–18) ✅
**Goal:** Full funnel measured, A/B tests running, remaining event pages published.

**Shipped**
- `[x]` Vercel Analytics + `funnel_events` custom funnel + 6 instrumented steps
- `[x]` A/B via `app_config` — assess gate (`/assess` server + `_assess-client.tsx`) + upgrade copy toggle
- `[x]` 16 new event slugs in `lib/events/content-sprint5.ts` (24 total, SSG)
- `[x]` Idempotent migration policies for re-run safety

**Deferred to Sprint 6+**
- `[x]` Admin funnel dashboards (Sprint 6)
- `[x]` Content distribution — drip live; newsletter kit (Sprint 7); Search Console at launch
- `[ ]` Blended family as separate slug (optional; `remarriage-blended-family` covers today)

---

### Sprint 4 — Advisor/attorney network as distribution (Weeks 12–14) ✅
**Goal:** Advisors and attorneys become active referral sources.

**Shipped**
- `[x]` Invite your advisor — `mailto:` card on `/my-advisor` no-connection state
- `[x]` Advisor notification when client logs a life event — `POST /api/consumer/life-events` + cron job 6
- `[x]` Advisor referral links — `?ref=` on event pages, `referral_clicks`, portal copy UI (`lib/events/referral.ts`)
- `[x]` Attorney-ready export UI — `/print` dual mode; `ExportPDFButton` `variant=attorney` (PDF template follow-up)
- `[x]` Plan readiness on advisor client Overview — `PlanStatusCard` + `estate_health_scores` (UX-2; was `PlanReadinessCard`)
- `[x]` Canonical `advisor_directory` for listings/referrals (replaced `advisor_listings` references)

**Deferred**
- `[ ]` Life event context on new advisor connections (connection metadata)
- `[x]` Attorney `?aref=` on event pages (Sprint 8)
- `[ ]` Attorney portal readiness score (advisor-only today)
- `[ ]` Signup attribution from `mwm_referral_code` → Sprint 8 Growth polish

---

### Sprint 3 — In-app life event triggers (Weeks 9–11) ✅
**Goal:** Users can log life events in-app; plan recomputes with event-specific conflict generation.

**Shipped**
- `[x]` `life_events` table + RLS + consumer API + dashboard `LifeEventBanner`
- `[x]` Age-based trigger cron (`/api/cron/age-triggers`, 15:00 UTC)
- `[x]` Event-personalized upgrade gates (`lib/events/upgradeContext.ts`)

**Deferred**
- `[ ]` Event-specific dashboard alerts beyond banner
- `[x]` Per-milestone calendar slugs (62/65/70/73) — Sprint 7 age-triggers cron
- `[ ]` Segment-specific triggers (business $5M/$10M, multi-state RE, estate growth velocity)
- `[ ]` A/B on upgrade gates (moved to Sprint 5)

---

### Sprint 2 — Life event landing pages + public conversion (Weeks 6–8) ✅
**Goal:** 8 event pages live, SEO-ready, with event-specific assessments and email capture.

**Shipped**
- `[x]` 8 life event pages at `/event/[slug]` (SSG, action plans, professional CTAs)
- `[x]` schema.org Article JSON-LD on event pages
- `[x]` Event-specific assessments at `/event/[slug]/assess` (5 questions, scoring, gap detection)
- `[x]` `app/api/email-capture` + `email_captures` table (migration `20260520000000`)
- `[x]` Homepage social proof + trust bar (`app/page.tsx`)
- `[x]` General `/assess`: overall + pillar scores visible when logged out; gap report gated behind account
- `[x]` Pricing moved to `app/(public)/pricing/page.tsx` (shared public nav)
- `[x]` Sprint 2 Track A: public nav, segment homepage/pricing copy

**Deferred to Sprint 3+**
- `[ ]` Email drip sequence (3 emails per event type) — needs provider decision
- `[ ]` Event pages indexed in Google Search Console — post-deploy verification
- `[ ]` In-app copy audit; Transfer Strategy guided depth; Invite-your-advisor onboarding step
- `[ ]` Account creation: plan selector maps assessment tier gaps to subscription tiers

---

### Sprint 1 — App/public nav separation + upgrade gates (Weeks 3–5) ✅
**Goal:** Planning app sidebar contains planning tools only; public routes outside dashboard layout; tier gates personalized.

**Shipped (engineering)**
- `[x]` Remove public-site links from app sidebar Overview (Education, Assessment, Find Advisor, Find Attorney, Home)
- `[x]` Overview group: Profile + Estate Summary only
- `[x]` Move **My Attorney** to sidebar footer (tier 2+); remove **Attorney access settings** from sidebar
- `[x]` Sidebar footer: My Advisor · My Attorney (tier 2+) · Manage Subscription · Sign out
- `[x]` "Your plan" tier badge on active planning group header
- `[x]` `UpgradeBanner` `householdContext` on all tier-gated consumer pages (retirement + estate modules)
- `[x]` Social Security: tier 2 gate added (was missing)
- `[x]` Domicile Analysis: explicit tier 3 gate added
- `[x]` Public route group `app/(public)/` — education, assess, find-advisor, find-attorney (passthrough layout, no dashboard sidebar)
- `[x]` Projections income table: full first names via `displayPersonFirstName` in `_projections-client.tsx`

**Deferred to Sprint 2 (marketing / public chrome)** — completed in Sprint 2 except items listed under Sprint 2 deferred above

**Success criteria met (engineering slice)**
- Zero public-site links in app sidebar ✅
- Public routes render without dashboard chrome ✅
- Upgrade gates personalized with `state_primary` where household exists ✅

---

### Sprint 0 — In-app fixes (Weeks 1–2) ✅
**Goal:** Surface the most valuable content already built. No new infrastructure required.

**Dashboard fixes**
- `[x]` Conflict alerts above the fold — severity chips in `DashboardIntroSection` only (mid-page dismissible banner removed 2026-05-30)
- `[x]` Move advisor links to sidebar footer — **My Advisor** + **Manage Subscription** in footer
- `[x]` Horizons page: comparison table + hero tax-liability summary cards
- `[x]` Horizons page: tier gate on `/my-estate-strategy`
- `[x]` Projections table: `title` tooltips on income column headers
- `[x]` Monte Carlo: single-column layout; labeled step stepper
- `[x]` Upgrade gates: `householdContext` on `/estate-tax` and `/my-estate-strategy`
- `[x]` Estate Tax Snapshot — interactive composition waterfall + strategy panel (`3c9a97a`)
- `[x]` Dashboard Script A — readiness pill, allocation links, conflict dedup (`960a414`)
- `[x]` Dashboard Financial Summary — remove embedded asset allocation card (`/allocation` unchanged)
- `[x]` Three-state dashboard progression — `getDashboardState`, State 2 net worth hero, State 3 unchanged (`b71af63`)
- `[x]` Roth bracket headroom — gap-year conversion amounts + display context on `/roth`
- `[x]` Nav: **Tax Horizons & Strategy** (`/my-estate-strategy`)

**Retrospective:** UI-only sprint; no engine/API/DB changes. Sprint 1 completed nav separation and remaining upgrade-gate personalization.

---

## Sprint F-2 — Import UX & Intelligence ✅ shipped 2026-06-02

- `[x]` Header row auto-detection (preamble rows / broker exports) — `9b524aa`
- `[x]` Excel sheet picker + re-parse without re-upload
- `[x]` Inline row editor + per-row delete at review
- `[x]` Duplicate detection (409 → skip or import all); success when all rows skipped — `a344032`
- `[x]` `ingestion_job_id` traceability on committed rows + view link
- `[x]` Richer alias / substring header matching
- `[x]` Pending import remove + cancel during review (`DELETE /api/import/jobs/[id]`)
- `[x]` Automated test suite — `a344032` (`test:import:unit`; `test:import:api`)
- `[ ]` Apply `20260602150000_sprint_f2_import_traceability.sql` in production (if not applied); optional manual I.5–I.9 in [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md)

---

## Import expansion + attorney workflow ✅ shipped 2026-05-29

**Doc:** [SPRINT_IMPORT_ATTORNEY.md](./archive/sprints/SPRINT_IMPORT_ATTORNEY.md)

**Import (Phases 1–5):**
- `[x]` Type normalization — `lib/import/type-normalizer.ts`; review UI badges + override dropdowns
- `[x]` Multi-sheet workbook + CSV `record_type` split; Commit All + batch summary
- `[x]` Import-first onboarding fork (`?onboarding=true` → dashboard toast)
- `[x]` Persona templates (business owner, RE portfolio, executive)
- `[x]` Real estate import target + property type normalization
- `[x]` Unit tests — `import-type-normalizer.spec.ts` (19 import-unit tests total)

**Attorney (Phases 6–7):**
- `[x]` Migration `20260529120000_sprint_import_attorney.sql` — doc status lifecycle + gap dismissals + `attorney_tier`
- `[x]` Document vault — status dropdown, type filter, Document Gaps card
- `[x]` Intake summary PDF (tier ≥ 1); multi-client doc health dashboard (tier ≥ 1)
- `[x]` `/attorney/billing` — Stripe checkout wired (`/api/stripe/attorney-checkout`); 503 until price env vars set
- `[x]` Attorney upgrade prompts + client cap enforcement + onboarding drip
- `[x]` Fix attorney connection lookup (`attorney_listings.id`)

**Before deploy:** apply `20260529120000_sprint_import_attorney.sql` + `20260529130000_attorney_drip_columns.sql`; set `STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY` + `STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY` (create products in Stripe first).

---

## Sprint F-1 — Financial data import ✅ closed & verified 2026-06-02

- `[x]` `POST /api/ingest` — CSV/XLSX parse, table detection, field mapping (`d3400b1`)
- `[x]` `ingestion_jobs` migration + RLS; schema cleanup to 14 columns (`file_name`, `file_type`)
- `[x]` `/import` tier 2 gate aligned; client commit URL + PGRST204 fixes (`b5bb0b1`)
- `[x]` Sample CSV templates + doc sync
- `[x]` Production smoke I.1–I.4 — 4 asset rows, `status = committed`

**Post-launch:** PDF/DOCX import parsing.

---

## Backlog (not yet scheduled — confirmed post-launch)

**Competitive gap backlog (prioritized):** [COMPETITIVE_SCAN.md](./COMPETITIVE_SCAN.md) — H1–H4 + L1–L4 complete. **Next:** M5 attorney Stripe at go-live, L5 attorney multi-seat. **Pricing:** [BILLING_B2B2C_POLICY.md](./BILLING_B2B2C_POLICY.md). Enable [RELEASE_ROUTINE.md](./RELEASE_ROUTINE.md) before open signups.

The following items are explicitly deferred to post-launch. Each has a DECISION_LOG entry
(see DECISION_LOG.md) documenting the reasoning.

- ~~**ATG / horizon wiring (IRC §2001(b))**~~ — shipped: gifting tab ATG section, `/api/consumer/adjusted-taxable-gifts`, RPC add-back `20260701120000`.
- ~~**Consumer Monte Carlo full parity**~~ — shipped: all 7 advisor assumption fields on `/monte-carlo`.
- **`/api/businesses` + `/api/insurance` → `/api/consumer/*` rename** — canonical paths today;
  namespace cleanup deferred (MASTER_ARCHITECTURE.md Open Backlog #1, #4)
- **"Ask your advisor →" in-app action for connected advisors** — currently links to
  `/find-advisor` for all users including those with a connected advisor; see DECISION_LOG
- ~~**Add `/education` to `middleware.ts` `PUBLIC_PATHS`**~~ — ✅ done (`a138608`); education fully public; nav fix skips double sticky header on `/education/*`
- **PDF/DOCX financial import** — deferred post-launch; CSV/XLSX shipped Sprint F-1 (`d3400b1`)

**Resolved in Sprint 10 (see DECISION_LOG):** business succession Path A minimal intake;
invite-your-advisor Path A onboarding; A/B exit criteria.

**Still backlog:** Blended family as separate slug (optional; `remarriage-blended-family` covers today)

**Queued next (2026-05-29 — post attorney monetization + projections readiness):**

- **Dashboard projection-setup nudge (low priority)** — When `checkProjectionReadiness().canShowPartial` is true (assets/income present but birth year or retirement age missing), show a subtle card on `/dashboard` (“Add your retirement age to see your full timeline” → `/projections` or inline prompt). **Deferred:** add noise before funnel data; revisit after ~2 weeks of real traffic on the scenarios → projections path. Projections page already shows inline `ProfileFieldPrompt` for partial users.

- **Attorney drip cron verification (ops)** — After the first real attorney registers, confirm steps 2–3 fire via daily `GET /api/cron/notifications` → `POST /api/email/attorney-drip`. Manual check ~3 days after first signup: SQL + Resend inbox. See [NEXT_SESSION.md § Queued next](./NEXT_SESSION.md#queued-next-post-ship-ops), [LAUNCH_CHECKLIST § Attorney drip cron (ops)](./LAUNCH_CHECKLIST.md#attorney-drip-cron-ops).

---

## How this document relates to engineering docs

When a sprint item results in:
- Route/tier/gate change → update `CONSUMER_NAV_MAP.md`
- Journey/API/refresh behavior change → update `CONSUMER_FLOWS.md`
- Schema/RPC change → update `DATABASE_SCHEMA_REFERENCE.md` + `SCHEMA_CHANGELOG.md`
- Cross-cutting architecture change → update `MASTER_ARCHITECTURE.md`
- New decision made → add entry to `DECISION_LOG.md`

See `UPDATE_CHECKLIST.md` for the full pre-merge checklist.
