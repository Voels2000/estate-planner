# NEXT_SESSION.md
# Sprint 19 — Session Start Document
# Updated: 2026-06-01 (Domain 3 — StateTaxPanel tooltips)

---

## Domain 3 — StateTaxPanel tooltips ✅ (2026-06-01)

**Shipped:** Advisor **`StateTaxPanel`** — `No portability` badge + **Exemption** `<th>` (`taxTermCtx` from `currentYearRow` + `unifiedStateCode` + `isMFJ`). Other badges skipped (no keys).

**Tax exposure surfaces complete:** dashboard hero · `/estate-tax` · **`StateTaxPanel`**.

**Remaining Domain 3:** projections chart disclaimer + gifting `annual_exclusion` / `superfunding` tooltips.

---

## Domain 3 — /estate-tax tooltips ✅ (2026-06-01)

**Shipped:** Consumer **`/estate-tax`** — four federal summary card labels + waterfall state exemption / no-portability / est. state tax rows. Full **`taxTermCtx`** from client-side `stateExemption` derivation. **`SummaryCard`** gained optional **`labelTooltip?: ReactNode`**.

**Unchanged:** MFJ blue callout, green no-federal block, dollar cells.

**Next surface:** Advisor **`StateTaxPanel.tsx`** — badge pills (`No portability`, etc.) + Exemption table header only; inline callouts (portability gap, NY cliff, violet horizon) stay as-is.

---

## Domain 3 — dashboard tax hero tooltips ✅ (2026-06-01)

**Shipped:** `EstateSummaryHeroAndMetrics` tile labels — Federal headroom, Est. federal tax, Est. state tax (`taxTermExplainer` + `InfoTooltip`). Sidebar **`EstateTaxSnapshotPanel`** unchanged.

**Deferred at hero:** `stateExemption` / `isMFJ` — not on hero props; state tax tooltip uses `statePrimary` only.

---

## Estate readiness explainers — InfoTooltip ✅ (2026-06-01)

**Shipped:** Six score subcategory labels on **`EstateReadinessCard`** have inline **`InfoTooltip`** explainers. Copy in **`SCORE_CATEGORY_EXPLAINERS`** (`lib/estate-health-score.ts`); lookup via **`scoreCategoryExplainer(c.key)`**.

| File | Role |
|------|------|
| `components/ui/InfoTooltip.tsx` | Custom accessible popover (`?` trigger; MWM tokens; above/below flip) |
| `lib/estate-health-score.ts` | `ScoreCategoryKey`, `SCORE_CATEGORY_EXPLAINERS`, `scoreCategoryExplainer()` |
| `components/dashboard/EstateReadinessCard.tsx` | One tooltip per subcategory when explainer non-empty |

**Onramp note:** Voels consumer (score 56) stays on **`DashboardOnramp`** until score ≥ 60 — tooltips visible only on full dashboard (State 3 with **`estateHealthScore`**).

**Smoke:** e2e consumer localhost — 6 icons; documents/titling/estate_tax copy checks pass.

**Next explainer surfaces (not started):** MC panel metrics · advisory metrics accordion · score band header · compliance disclaimers.

---

## PDF page 3 metric cards — engine B ✅ (2026-06-01)

**Shipped:** Page 3 Federal / State / Net cards use `page3FederalTax`, `page3StateTax` (`resolveActiveStateTax` + `hasBypassTrust`), `page3NetToHeirs` in `generatePDFReport.ts` — not `latestOutput` / `withoutBypassTrust` only.

**Deferred:** `exportMappers.ts` Excel + export panel alignment.

**Smoke (Voels `?type=report`):** Federal $0 · state ~$943K (no bypass) · net = gross − state.

---

## Domain 1 — estate MC engine B ✅ (2026-06-01)

**Closed:** All **display** surfaces that show state estate tax dollars use engine B (`lib/calculations/stateEstateTax.ts`). Estate Monte Carlo was the last gap (flat `stateEstateTaxRate`).

| Surface | Engine | Status |
|---------|--------|--------|
| Horizons, Tax tab, consumer strategy, PDF cover/narrative, prospect | B | ✅ (2026-05-29) |
| PDF page 3 metric cards | B at render | ✅ (2026-06-01) |
| Estate Monte Carlo (advisor Strategy) | B per simulated estate | ✅ `fc85ff8` |
| MC model footnote + **Zero-Tax Paths** label | Honest copy | ✅ `4bdda56` |
| exportMappers / Excel / export panel | C (`latestOutput`) | **deferred** |
| Projection death-year rows | C (deprecated) | Open |

**Commits:** `fc85ff8` (engine B + edge + hoist) · `4bdda56` (Zero-Tax Paths label)

**Regression:** [CALCULATION_ENGINES.md § Regression grep checks](./CALCULATION_ENGINES.md#regression-grep-checks-ongoing-smoke-test)

---

## Estate Monte Carlo — engine B state tax ✅ (2026-06-01)

**Shipped:** Advisor Strategy tab estate MC uses engine B (`calculateStateEstateTax` + `resolveActiveStateTax`) per simulated estate — flat `stateEstateTaxRate` removed.

| Area | Detail |
|------|--------|
| Lib | `lib/calculations/estate-monte-carlo.ts` — POST inputs: `stateCode`, `stateBrackets`, `filingStatus`, `hasBypassTrust` |
| Edge | `supabase/functions/estate-monte-carlo/index.ts` — inlined engine B; **redeploy required** after changes |
| UI | `MonteCarloPanel.tsx` + `StrategyTab.tsx`; `stateBrackets` hoisted via `_client-view-shell.tsx` / `page.tsx` (same array as horizons) |
| Docs | [CALCULATION_ENGINES.md](./CALCULATION_ENGINES.md) estate MC row; [DECISION_LOG.md](./DECISION_LOG.md) |
| Footnote | Model assumptions copy updated (no flat-rate language) |
| Label | **Zero-Tax Paths** — federal + state both $0 (not “Tax-Free Rate”) |

**Deploy:** `supabase functions deploy estate-monte-carlo` on `fnzvlmrqwcqwiqueevux` (deployed 2026-06-01).

**Verify:** `npx tsx scripts/verify-estate-mc-voels-smoke.ts` (POST shape + horizons alignment; edge HTTP needs `SMOKE_ADVISOR_EMAIL` + password in `.env.local`).

**Smoke (Voels Strategy tab):** Network POST has `stateBrackets` (WA, 8 rows), no `stateEstateTaxRate`; P10/P50/P90 + fan chart render. Today `stateTax` ~$943K at ~$9.5M gross — P50 **total** tax is on simulated P50 estate (~$30M+), not comparable to today column.

**Not in scope:** Consumer `/monte-carlo` (retirement portfolio MC) unchanged. Estate MC remains advisor Strategy tab only.

---

## PDF beneficiary summary page ✅ (2026-06-01)

**Shipped:** Conditional page **`beneficiary_summary`** between estate snapshot and tax analysis. Voels export → **6 pages** (was 5) when `asset_beneficiaries` rows link to accounts.

**Data:** Raw rows from **`beneficiariesResult.data`** (not mapped UI shape) → **`buildBeneficiaryAccountGroups()`** in **`lib/advisor/beneficiaryHelpers.ts`** → **`PDFReportData.beneficiaryData`**. Params: `beneficiaries`, `assets`, `realEstate`, `insurancePolicies`, `businesses` in **`buildAdvisorExportPayloads`**. Wired in **`loadAdvisorExportWiring.ts`** + **`page.tsx`** when `exportWiring` runs. No new DB fetch (`inc.beneficiaries = true` on meeting-prep).

**Estate tab:** Local **`buildBeneficiaryAccountGroups`** in **`EstateTab.tsx`** unchanged (different signature/shape — UI grouping only).

**Smoke (Voels `?type=report`):** Page 3 = beneficiary summary · stat cards · retirement/insurance sections · gap box (Teva, 529) · page count **6**.

**If page count stays 5:** `beneficiaryData` undefined or empty groups — check `beneficiariesResult` length and row FKs (`asset_id`, etc.).

---

## PDF strategy page dedupe ✅ (2026-06-01)

**Fix:** Page 4 gap list uses `enrichedActions` — no duplicate “Large estate without a trust”.

---

## PDF page 2 SVG chart fix ✅ (2026-06-01)

**Fix:** `buildEstateSVGChart()` — inline SVG replaces Chart.js canvas (print/PDF-safe). Uses full `data.projectionChartRows`.

**Smoke (Voels `?type=report`):** Chart visible in **Cmd+P print preview** · cliff marker + callout · asset/health two-column below.

---

## PDF page 2 estate snapshot chart ✅ (2026-06-01)

**Shipped:** Estate growth SVG + tax cliff callout + two-column asset/health on export PDF page 2. Data: `projectionChartRows` from `params.scenarioOutputs`.

---

## Print brief at-death tax ✅ (2026-06-01)

**Fix:** `meetingPrepAtDeath` on `loadAdvisorExportWiringForClient` → `totalTaxLiability` for brief tax card (not projection row `estate_tax_*`).

**Smoke:** Voels MFJ — Est. tax exposure ≠ $0; matches modal at-death tax.

---

## pdfFilingStatus build fix ✅ (2026-06-01)

**Fix:** `lib/export/pdfFilingStatus.ts` — client-safe `normalizePdfFilingStatus`; `MeetingPrepTab` must not import `fetchNarrativePdfFields.ts` (pulls `supabase/server`).

---

## Print brief stat cards ✅ (2026-06-01)

**Fix:** `?type=brief` uses `findAtDeathRow` + correct tax fields; no **"At retirement"** label. Template **`sprint-four-surface-polish-v2`**.

**Smoke (Voels):** `X-Brief-Template: sprint-four-surface-polish-v2` · projected estate ~at-death horizon · tax card shows federal+state · subtitle `At death (age X)`

---

## Four-surface advisor polish ✅ (2026-06-01)

**Shared:** `lib/advisor/advisorBriefHelpers.ts` · **PDF page 2:** inline SVG estate growth + asset/health two-column · **Brief print:** `?type=brief` template `sprint-four-surface-polish-v2` · **Notes:** `note_type` migration

**Pre-deploy:** Apply `supabase/migrations/20260529120000_advisor_notes_note_type.sql`

**Smoke (Voels):** PDF page 2 rows · brief response header `X-Brief-Template` · **Open print brief** (not modal layout) · Notes type selector

**Verify:** `npx tsx scripts/verify-four-surface-polish.ts`

---

## Standing rules for Cursor sprints

1. **Calculation / tax work:** Start every session with **"read docs/CALCULATION_ENGINES.md"** before writing or changing any tax, projection, strategy, or horizon math.
2. **Regression grep (after any calc-file touch):** [CALCULATION_ENGINES.md § Regression grep checks](./CALCULATION_ENGINES.md#regression-grep-checks-ongoing-smoke-test) — zero hits on engine A / stray `calcStateTax`.
3. **CST strings:** Import from **`lib/constants/strategyTypes.ts`** — never hardcode `'cst'` / `'credit_shelter_trust'` at DB query sites.

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — **PDF beneficiary summary page shipped (2026-06-01).** Export report order: cover → snapshot → **beneficiaries** → tax → strategies → action items. **`lib/advisor/beneficiaryHelpers.ts`** + raw **`asset_beneficiaries`** through **`exportMappers`**. Prior: print brief stat fix, PDF page 2 SVG chart, strategy page dedupe. **Prepare for Meeting** = React modal; **Export estate report** / **`?type=report`** = full **`generatePDFHTML`**.
>
> **Post-deploy smoke:** Voels — PDF **6 pages** · beneficiary page (Pfizer complete, Teva missing primary, 529 missing contingent) · brief v2 header · PDF page 2 chart in print preview.
>
> **Go-live blockers (non-code):** [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) — legal placeholders, counsel sign-off, WA entity/EIN/B&O, email aliases, Supabase auth tighten, Stripe live config. [LEGAL_TODO.md](./LEGAL_TODO.md). Do **not** set `PUBLIC_SIGNUP_OPEN=true` until all 🔴 items checked.
>
> **Before flip:** Counsel on ToS §10/§11/§13. **Stripe Phase 1** on preview — [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md). **Go-live day:** Phase 2 live catalog + `PUBLIC_SIGNUP_OPEN=true` → [LAUNCH_CHECKLIST § Opening signups](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip).
>
> **Post-deploy:** `npm run test:e2e:go-live-profile` · `npm run test:e2e:cross-role` · `npm run test:e2e:security-isolation` — [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) · [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md). **Manual smoke:** [LAUNCH_CHECKLIST](./LAUNCH_CHECKLIST.md) · [PRE_LAUNCH_CHECKLIST](./PRE_LAUNCH_CHECKLIST.md).

---

## Sprint A — Score rationalization ✅ (2026-05-29)

**Goal:** One consumer label (`ESTATE_READINESS_LABEL` = "Estate readiness"), retire completeness grade from consumer surfaces.

| Change | Detail |
|--------|--------|
| Label | "Foundation" / "plan health score" → **Estate readiness** (`{n}/100`) on dashboard, onramp, PDF narrative |
| Constant | `ESTATE_READINESS_LABEL` in `lib/estate-health-score.ts` |
| Consumer PDF | Uses `estate_health_scores.score` — not `calculate_estate_completeness` grade/% |
| Gates | Unlock + execution checklist → "X of Y steps/items complete" (no threshold % or score label) |
| Advisor | `EstatePlanningDashboard` grade retained — attorney portal only (no `showGrade` prop needed) |
| Governance | [SCORE_TAXONOMY.md](./SCORE_TAXONOMY.md) |

**Sprint B ✅ (2026-05-29)** — score-driven consumer dashboard (presentation only; no score engine changes).

| Item | Detail |
|------|--------|
| **`EstateReadinessCard`** | Score hero, benchmark bar (avg American / avg MWM user markers), six component pills, trend delta, disclaimer |
| **`PriorityAlertCard`** | Single top `household_alerts` row; factual consequence line; escalating CTA |
| **Adaptive greeting** | Four score-band headline + subtitle variants in State 3 |
| **Data** | `priorScore` + `openAlerts` fetched in `_dashboard-body.tsx` (not `page.tsx`) |
| **Helpers** | `lib/dashboard/scoreDisplayHelpers.ts` · benchmarks in `readinessBenchmarks.ts` |
| **State 2** | Estate readiness `{n}/100` tile + nudge → `/health-check` |
| **Removed** | `ConsolidatedAlertPanel` (conflict-derived alert list) |
| **Follow-up ✅** | Removed duplicate `EstateHealthScoreBlock` from **`EstateSummarySection`**; score cards ungated (`estateHealthScore` present → show, not `sectionVisible(3)`) |

**Post-ship smoke:** Voels (~56, WA) — greeting → **`EstateReadinessCard`** → **`PriorityAlertCard`** in main flow; Estate Summary collapsible = composition only (titling conflicts removed — covered by priority alerts).

**Follow-up (future sprint):** Real platform averages from `estate_health_scores` → config table; score history table for reliable trend delta (current table upserts one row per household).

---

## Estate flow horizon tabs ✅ (2026-05-31)

**Engine pass (`720861a`):** `lib/estate-flow/generateEstateFlow.ts` · `ConsumerEstateFlowView.tsx`

| Fix | Detail |
|-----|--------|
| Year lookup | `findClosestOutputRow()` — 10y/20y no longer collapse to `lastOutput` when exact year missing |
| At Longevity | `findAtDeathRow()` (same as Tax Horizons table), not blind final row |
| Owner pill | `computedGrossEstate`: `liveNetWorth` for Today; projection row for other tabs |
| Asset tiles | Today's holdings only — context note on projected horizons (no per-account projection) |
| UI | `horizonLabel` caption below timeframe tabs |

**Display pipeline pass (2026-05-31):** `ConsumerEstateFlowView.tsx` · `_my-estate-strategy-client.tsx`

| Fix | Detail |
|-----|--------|
| **Primary** | `horizonOverride` from `selectedHorizons` (`buildStrategyHorizons`) — same numbers as tax table; passed to `generateEstateFlow` 8th arg (matches `EstateFlowDiagram`) |
| Race | `cancelled` flag in `useEffect` — fast tab clicks cannot paint stale response |
| Loading | Tabs stay mounted; inline “Updating…” spinner (no full-view unmount) |
| UX | Prominent `gross_estate` + est. tax above asset tiles |
| Caption | `getHorizonDisplayLabel(horizon)` — syncs with tab immediately |

**Smoke:** Voels — Today ~$9.6M · In 10 Years ~$20.98M · At Longevity ~$97.7M. **Rapid click:** Today → At Longevity → In 10 Years in &lt;1s — final tab must show ~$20.98M (not late ~$97M).

---

## State tax unification ✅ (2026-05-29)

**Sprint:** [SPRINT_UNIFY_STATE_TAX.md](./SPRINT_UNIFY_STATE_TAX.md) — Phases 0–8 complete

| Change | Detail |
|--------|--------|
| Engine A deleted | `narrativeEngine.ts` flat-rate `STATE_TAX` / `calcStateTax` removed |
| Engine B canonical | PDF cover, callout, page 3 scenario table, horizons via `calculateStateEstateTax` |
| Phase 0 | `lib/constants/strategyTypes.ts` — single CST string source |
| `hasBypassTrust` | Threaded through `computeColumnTaxes` / `buildStrategyHorizons`; consumer = accepted line items only |
| Governance | [CALCULATION_ENGINES.md](./CALCULATION_ENGINES.md) + regression greps in standing rules |

**Post-deploy smoke:** Voels MFJ WA ~$9.3M — PDF cover + page 3 state tax (engine B); bypass trust scenario table when `cstBenefit > 0`.

**Open post-deploy checks (Voels smoke 2026-05-29):**

| Check | Expected | Commit |
|-------|----------|--------|
| Action items — trust alert | **Documents & trust structure**; enriched impact + next step | filler-normalized dedupe key (2026-05-31) |
| Cover — state tax phrasing | **"…exposure without a bypass trust"** when MFJ + no CST + portability gap | `0f9305e` |

---

## household_alerts trust title — sentence case ✅ (2026-05-31)

| Fix | Detail |
|-----|--------|
| Source | `conflict-detector.ts` — `large_estate_no_trust` title → **Large estate without a trust** (matches `evaluateAlerts`) |
| PDF | `enrichActionItems` sets canonical title on trust enrichment (legacy Title Case rows) |
| Cleanup | Removed `[dedup input]` debug `console.log` from `generatePDFReport.ts` |

---

## PDF action-item dedupe — filler-normalized keys ✅ (2026-05-31)

**Files:** `lib/export/narrativeEngine.ts`

| Fix | Detail |
|-----|--------|
| Sort | Enriched rows first (`dollarImpact` + `nextStep` score) before dedupe |
| Key | `actionItemDedupeKey()` strips filler words (`without`, `a`, `the`, …) then 20-char stem |
| Trust titles | `"Large estate without a trust"` + `"Large Estate Without Trust"` → **`largeestatetrust`** |

**Smoke:** Voels MFJ PDF — trust alert once under **Documents & trust structure** with probate impact + attorney next step.

---

## PDF narrative polish — dedupe + worst-case copy ✅ (2026-05-29)

| Fix | Detail |
|-----|--------|
| Dedupe priority | `dedupeActionItems()` keeps **enriched** duplicate (theme + impact/next step), drops raw `general` row |
| Trust enrich | Matches **"without trust"** (no `a`) — e.g. "Large estate without trust" |
| Cover copy | Worst-case state tax labeled **without a bypass trust** in no-portability MFJ states |

**Commit:** `0f9305e`

---

## PDF exemption + action-item dedupe ✅ (2026-05-30)

| Fix | Detail |
|-----|--------|
| Page 3 exemption | `currentFederalExemption()` — MFJ **$27.98M** (was per-person $15M from `assumption_snapshot`) |
| Dedupe | `dedupeActionItems()` — title prefix; **enriched row wins** (`0f9305e`) |

**Smoke:** Voels MFJ PDF — cover and page 3 exemption match; trust alert appears once under Documents only.

---

## PDF export path wiring ✅ (2026-05-30)

**Follow-up to narrative engine (`efbafba`):** Unified all estate-report print paths.

| Entry point | Path |
|-------------|------|
| Header **Export estate report** | `/api/advisor/meeting-prep-pdf/[clientId]?type=report` |
| Header **Meeting brief** | same route `?type=brief` (legacy one-pager) |
| Meeting Prep **Export estate report (PDF)** | `?type=report` |
| Meeting Prep **Export PDF Report** | `ExportPanel` + `generatePDFHTML(exportPdfData)` |
| Shared loader | `lib/advisor/loadAdvisorExportWiring.ts` |

**Do not use** in-tab **Prepare for Meeting** modal → Print/PDF for full narrative (modal brief only).

---

## PDF narrative engine ✅ (2026-05-30)

**Sprint: Rule-based PDF report enrichment — COMPLETE**

| Area | Detail |
|------|--------|
| Engine | `lib/export/narrativeEngine.ts` — executive summary, tax callout, health trend, action enrichment, gifting bar, theme groups |
| Fetch | `lib/export/fetchNarrativePdfFields.ts` — **`Promise.all`** for trust, strategies, insurance, prior score, gifting RPC |
| Filing status (client-safe) | `lib/export/pdfFilingStatus.ts` — `normalizePdfFilingStatus` only; **not** from `fetchNarrativePdfFields` in `'use client'` tabs |
| PDF | `generatePDFHTML` — new cover layout + grouped action items with impact / next step |
| Export | `ExportPanel` + API `?type=report` via `loadAdvisorExportWiringForClient()` |
| Meeting Prep | Top 3 open alerts above Export & Reports |
| Action items | `household_alerts.title` + `description` → `title` + `message` at fetch layer |

**Post-deploy smoke:** Header **Export estate report** OR Meeting Prep → **Export PDF Report** — executive summary · tax callout · gifting bar · grouped action items.

**Files:** `narrativeEngine.ts` · `fetchNarrativePdfFields.ts` · `generatePDFReport.ts` · `export-wiring.ts` · `exportMappers.ts` · `page.tsx` · `ExportPanel.tsx` · `MeetingPrepTab.tsx`

---

## Sprint 19 polish pass — session summary (2026-05-30)

| Page | Commit | Client / area |
|------|--------|----------------|
| Estate summary dashboard | `deb0080` | Tax hero + 4 tiles + checklist/tax snapshot two-col |
| State exemption wire | `0686f52` | `no_portability` on tax snapshot |
| Roth Conversion | `839bfbb` + WhatIfPanel fix | `_roth-client.tsx` |
| Lifetime Snapshot | `9d103a7` | `_complete-client.tsx` |
| Social Security | `405d3d0` | `_ss-client.tsx` |
| RMD Calculator | `b47fed5` | `_rmd-client.tsx` |
| Dashboard cleanup | `0aa0cab` + `f200af7` | Planning topics removed · bypass alert · titling badges-only |
| Dashboard Script A | `960a414` | Readiness pill on intro row · allocation downstream links · conflict banner dedup |
| Dashboard — no allocation card | `7e8bf00` | **`AssetAllocationSummary`** removed from Financial Summary; **`/allocation`** unchanged |
| Three-state dashboard | `b71af63` | State 1 onramp · State 2 net worth hero · State 3 tax hero (Alan unchanged) |
| Roth bracket headroom | `cae89fc` | `runRothAnalysis` federal headroom · `pickRothConversionDisplayContext` on `/roth` |
| Roth methodology note | `6cb942a` | Expanded “How this calculation works” on `/roth` |
| Tax Horizons polish | `56762ad` | Readiness pill · bypass bar · grouped assets · no embedded completeness/topics |
| Advisor strategy polish | `7a8d10c` | Alert hierarchy · severity cards · opportunity savings · MC empty · composite gate |
| Advisor Estate tab polish | `7a8d10c` | Liquidity hero · waterfall + conflicts two-col · doc alert · beneficiary-by-account · flow toggle |
| Advisor Retirement tab polish | *(this commit)* | YearRow + SS + Roth wiring · readiness hero · snapshot · withdrawal sequencing |
| PDF narrative engine | *(this commit)* | Executive summary · tax callout · enriched grouped action items · Meeting Prep top alerts |
| Estate Tax strategy panel | `3c9a97a` | Composition waterfall + toggleable strategies on `/estate-tax` |

**Prod pending (Alan visual smokes, once each):**

| Route | Confirm |
|-------|---------|
| `/dashboard` (Alan, State 3) | Tax hero · consolidated alerts · readiness strip · checklist/tax snapshot · **no** allocation card in Financial Summary |
| `/dashboard` (State 2 smoke) | Net worth hero · amber estate-unlock prompt · **no** tax hero / readiness strip |
| `/estate-tax` | Composition waterfall + strategy toggles (Alan WA tax) · $0-tax user sees waterfall only |
| `/allocation` | Downstream note to Projections + Monte Carlo after save |
| `/rmd` | **9 years away** (Alan) · **16 years away** (Cathi); decade nav changes rows |
| `/social-security` | Survivor **$4,888/mo**; cumulative chart crossover ~age 84; spousal block unchanged |

**Not in this pass:** Monte Carlo, Scenarios, Allocation, Projections UI polish · Roth emerald rows on IRA fixture household · wizard prod smoke · `supabase db push` for state exemption migration on prod if not yet run.

---

## Roth conversion — bracket headroom fix ✅ (2026-05-30)

**Files:** `lib/calculations/roth-analysis.ts` · `_roth-client.tsx` · `tests/unit/roth-analysis.spec.ts`

| Issue | Fix |
|-------|-----|
| Gap-year conversions too small | **`getBracketHeadroom`** uses **`peakRmdFederalRate`** + legacy **`>`** walk; at RMD ≥ 24% federal, fill to top of **22%** bracket |
| Insight / WhatIf wrong “current rate” | **`pickRothConversionDisplayContext()`** — first conversion-window row, not **`rows[0]`** |

**Post-deploy smoke:** Alan/Cathi pre-RMD gap — emerald rows ~$150K+/yr (headroom-limited); insight **~12% current** vs **~24% projected RMD**.

**Commit:** `cae89fc`

---

## Roth conversion — methodology note ✅ (2026-05-30)

**Commit:** `6cb942a` · **File:** `_roth-client.tsx` — expanded “How this calculation works” (eligibility, combined pool, SS simplification, WhatIf vs table).

---

## Tax Horizons & Strategy — consumer polish ✅ (2026-05-30)

**Commit:** `56762ad` · **Files:** `_my-estate-strategy-client.tsx` · `page.tsx` · `ConsumerEstateFlowView.tsx` · `lib/estate/parseBypassTrustSavings.ts`

| Change | Detail |
|--------|--------|
| Readiness | Header pill; large score block removed |
| Bypass bar | Between horizon cards and table when savings &gt; 0 |
| What-if tab | Hidden when `projectedCount === 0` |
| Removed | Embedded `EstatePlanningDashboard` |
| Estate flow | Grouped asset tiles + expand |

---

## Advisor strategy tab — visual polish ✅ (2026-05-30)

**Files:** `StrategyAlertBanners` · `AdvisoryMetricCard` · `OpportunitiesPanel` · `CompositeOverlay` · `MonteCarloPanel` · `estimateStrategySavings.ts`

| Change | Detail |
|--------|--------|
| Alerts | Primary liquidity + secondary exemption/GRAT |
| Cards | Severity colors + status labels |
| Opportunities | Per-strategy savings estimates |
| Composite | Waterfall hidden when no recommendations |

---

## Advisor Estate tab — visual polish ✅ (2026-05-30)

**File:** `app/advisor/clients/[clientId]/_tabs/EstateTab.tsx`

| Change | Detail |
|--------|--------|
| Liquidity hero | Coverage **&lt; 1.0x** — `inside_liquid` or asset `liquidity === 'liquid'` |
| Composition | Two-col: card + IRS waterfall \| conflict cards |
| Documents | Hero alert for missing critical docs |
| Beneficiaries | Group by account (asset join) + contingent flags |
| Estate flow | Summary tiles + toggled full diagram |
| Accounts | Six consolidated type groups |

**Post-deploy smoke:** Alan household — liquidity hero · waterfall · conflicts · flow toggle · account groups.

---

## Advisor Retirement tab — wire data + polish ✅ (2026-05-30)

**Files:** `page.tsx` · `_client-view-shell.tsx` · `RetirementTab.tsx` · `lib/advisor/loaders.ts`

| Change | Detail |
|--------|--------|
| Data | `scenarioOutputs` (`YearRow[]`); `loadSocialSecurityData(clientId)`; `runRothAnalysis()` |
| Readiness | Funds outlast lifetime + net worth at retirement year |
| Snapshot | `income_total` / `expenses_total` / surplus at retirement year |
| SS | Survivor on `person2.survivorBenefit`; breakeven from scenarios |
| Roth | `optimalConversionWindow` + `totalLifetimeTaxSavings` when analysis runs |
| UX | RMD timeline · withdrawal sequencing · kept planning assumptions |

**Post-deploy smoke:** Alan — readiness hero · survivor benefit · Roth conversion window · RMD age 75.

---

## Three-state dashboard ✅ (2026-05-30)

**Commit:** `b71af63` · **Files:** `determinePlanStage.ts` (`getDashboardState`) · `_dashboard-body.tsx` · `_dashboard-client.tsx`

| State | Condition | UI |
|-------|-----------|-----|
| 1 | `foundationScore < 60` · wizard incomplete · no data | `DashboardOnramp` early return in `page.tsx` |
| 2 | Past onramp · taxes $0 · no estate-plan signals | Net worth hero · unlock prompt · `SetupProgressCard` · Financial/Retirement |
| 3 | Tax &gt; 0 or `hasEstatePlanData` | Full Alan layout — tax hero · alerts · readiness strip · checklist |

**Post-deploy smoke:** Alan → State 3 unchanged · find/create State 2 user ($0 tax, no conflicts) → net worth hero only.

---

## Dashboard cleanup ✅ (2026-05-30)

**Files:** `_dashboard-client.tsx` · `EstateSummarySection.tsx` · `EstateCalloutCard.tsx`

| Item | Notes |
|------|-------|
| Removed | Common Planning Topics section (`PlanningGapsSection` in estate summary collapsible) |
| Titling conflicts | **`criticalCount` / `warningCount`** from `conflictReport` — badges only + **Review in Titling & Beneficiaries →** (detail on `/titling`) |
| Bypass trust alert | **`parseBypassTrustSavings`** — parses **`by $645,463`** from `bypass_trust` RPC reason (Alan prod verified); fallback last `$` in reason, then `(gross − exemption) × 10%` |
| Placement | **`EstateSummaryHeroAndMetrics.afterMetrics`** — after four metric tiles, before **`sm:grid-cols-2`** checklist + tax snapshot grid |
| Removed | Middle dismissible conflict banner (duplicate of intro pills) |
| Unchanged | Intro conflict pills in **`DashboardIntroSection`** · estate readiness score · composition card · execution checklist · titling badges in estate summary |

**Post-deploy smoke (once):** Alan → `/dashboard` — blue callout **$645,463** between tiles and checklist · no planning topics · titling badges + link only at bottom of estate summary collapsible · **no mid-page conflict banner** · intro row shows conflict pills + **Estate readiness 56/100** pill on same line.

---

## Script A — Dashboard polish ✅ (2026-05-30)

**Files:** `DashboardIntroSection.tsx` · `_dashboard-client.tsx` · `allocation/_allocation-client.tsx`

| Item | Notes |
|------|-------|
| Readiness pill | **`estateHealthScore.score`** on same flex row as conflict pills — green ≥80 · amber ≥60 · red &lt;60 |
| Detailed score | **`EstateSummarySection`** unchanged — component bars + "Needs Attention" + health check link |
| Allocation | Downstream note after Save Target Mix → `/projections` + `/monte-carlo` |
| Risk caption | Projections growth · Monte Carlo distributions · benchmark comparisons |
| Scenarios nav | Already under Financial Planning in `sidebar-nav.tsx` — no change |

**Next:** Script B follow-ups as needed.

---

## Estate Tax Snapshot — strategy panel ✅ (2026-05-30)

**Route:** `/estate-tax` · **Files:** `_estate-tax-client.tsx` · `page.tsx` · `sidebar-nav.tsx`

| Item | Notes |
|------|-------|
| Waterfall | Inside/outside breakdown from composition — `inside_financial`, `inside_real_estate`, `inside_business_gross`, `inside_insurance` |
| Toggle | **Current** / **With strategies** on composition view |
| Strategy panel | Only when `estimatedTaxState > 0 \|\| estimatedTaxFederal > 0` — Alan always shows |
| Data | `getCachedComposition` + `strategy_line_items` fetch on entitled path; `noPortability` from state rules |
| Helpers | `getStrategyDescription` module-level; synthetic bypass / ILIT / gifting when missing |
| Nav | **Tax Horizons & Strategy** (`/my-estate-strategy`) |

**Post-deploy smoke:** Alan → `/estate-tax` — waterfall + strategy toggles · $0-tax household → waterfall only, no strategy panel.

---

## RMD Calculator page polish ✅ (2026-05-30)

**Route:** `/rmd` · **Client:** `app/(dashboard)/rmd/_rmd-client.tsx`

| Item | Notes |
|------|-------|
| Hero stats | Combined lifetime + peak annual RMD (from full **`rows`** array, not paginated slice) |
| Status cards | RMD start + current-year RMD per person; **X years away** / **Active** badges; 2-col single / 4-col married |
| Accounts | Per-person total tax-deferred; **`grid-cols-1 sm:grid-cols-3`**; joint/unassigned section |
| Tax callout | Peak RMD × **28%** blended rate (no marginal rate in household props) |
| Table | Decade navigator → **`goToPage(i)`** / `setPeriodOffset`; inflection rows (blue P1 start, emerald P2 start, amber peak) |
| Legend | Row color key below table |
| Single user | No P2 status cards, legend entry, or table columns (`has_spouse` gates) |

**Post-deploy smoke (once):** Alan → `/rmd` — hero totals · years-away badges · decade buttons change visible rows · peak/first-RMD row highlights.

**Years-away verify (Alan household, programmatic 2026-05-30):** `rows.find(r => r.p1_rmd > 0)?.year` → **2035** → **9 years away** (Alan); P2 → **2042** → **16 years away** (Cathi). Matches `birthYear + getRmdStartAge()`.

---

## Social Security page polish ✅ (2026-05-30)

**Route:** `/social-security` · **Client:** `app/(dashboard)/social-security/_ss-client.tsx`

| Item | Notes |
|------|-------|
| Hero cards | 2× elected (blue/emerald, 2px border) + 2× FRA reference (muted); inline `gridTemplateColumns: 2fr 2fr 1fr 1fr` |
| Insight card | Lifetime gain (`deltaVsFRA`) · combined monthly · survivor (`person2.survivorBenefit`) · breakeven age |
| Chart | SVG cumulative line — elected / FRA / age 62; uses `cumulativeByAge` (calendar age, no offset padding) |
| Tables | Relative lifetime bar · FRA badge · elected row highlight · breakeven note (blue P1, emerald P2) |
| Removed | Projected summary paragraph · duplicate per-person breakeven sections |
| Unchanged | Spousal & Survivor Strategy section below tables (coordinator copy + restricted application) |

**Prod data verify (Alan household, programmatic):** elected age 70 · survivor **$4,888/mo** · at age 70 cumulative order age-62 > FRA > elected · elected crosses FRA at **age 84** (2.5% COLA, longevity 90) · FRA crosses age-62 at 81.

**Post-deploy visual smoke (once):** Log in as Alan → `/social-security` — insight survivor card **$4,888/mo** · cumulative chart shows blue elected line crossing gray FRA line (~age 84 on x-axis) · spousal section unchanged below tables.

---

## State exemption dashboard wire ✅ (2026-05-30)

**Commit:** `0686f52` · **Migration:** `20260630110000_state_estate_tax_rules_no_portability.sql`

| Item | Notes |
|------|-------|
| Schema | **`no_portability`** on `state_estate_tax_rules`; WA/MA/OR `true`; WA 2025+ exemption **$3M** |
| Fetch | `dashboard/_dashboard-body.tsx` — inside existing **`Promise.all`** (not sequential) |
| Props | `stateExemption`, `noPortability` → `EstateTaxSnapshotPanel` |
| Panel rows | `{state} exemption` · portability note · `{state} taxable estate` (gross − exemption) · `{state} estate tax` |
| Alan (WA) | Exemption $3M · taxable ~$6.45M · state tax ~$937K visible in snapshot |

**Prod:** Run `supabase db push` before deploy (column required for select).

---

## Estate summary dashboard consolidate ✅ (2026-05-30)

**Commit:** `deb0080` · **Files:** `_dashboard-client.tsx` · `EstateCalloutCard.tsx` · `DashboardIntroSection.tsx`

| Item | Notes |
|------|-------|
| Hero | **`EstateSummaryHeroAndMetrics`** — red when `estimatedTaxState > 0` (e.g. WA $937K); amber when federal-only |
| Metrics | Four tiles — gross, federal headroom (`exemptionRemaining`), est. federal/state tax; compact **`fmt`** |
| Two-col | **`sm:grid-cols-2`** — `EstateExecutionChecklist` + **`EstateTaxSnapshotPanel`** (stacks on mobile) |
| Greeting | Subtitle includes `state_primary` · alert pills compact row + **See details →** |
| Unchanged | `EstateSummarySection` below — readiness score, planning gaps, titling conflicts |

**Variable map:** `estateTax` → `estimatedTaxState` · `federalTax` → `estimatedTaxFederal` · `federalHeadroom` → `exemptionRemaining` · `fmtCurrencyCompact` → existing **`fmt`** in `formatters.ts`

---

## Roth Conversion polish ✅ (2026-05-30)

**Commit:** `839bfbb` · **Client:** `app/(dashboard)/roth/_roth-client.tsx`

| Item | Notes |
|------|-------|
| Stat cards | Total conversions + lifetime tax savings (compact `fmt`) |
| Insight card | Rate comparison (`=` / `<`); triggers when no conversion; **`WhatIfPanel`** slider |
| Balance projection | Always visible **above** grouped table; legend; tabs removed |
| Grouped table | **`conversionRationale`** section headers + year ranges; emerald rows on conversion years |
| CTA | **Use in Transfer Strategies →** when `totalConversions > 0`; **above** methodology; → `?tab=strategies&openPanel=roth` |
| Imports | `useMemo` / `useState` from `react` (not `React.useMemo`) |

**Post-deploy prod smoke (2026-05-30, `e2e-consumer`):** stat cards · insight · balance above grouped table · 7 group headers · tabs removed · CTA hidden at $0 conversions. **WhatIfPanel fix:** all four cells react to slider on Alan (extra cost + **Delay is better**).

**Manual follow-up:** Log in as household with **traditional IRA + rate differential** (e.g. Johnson advisor demo) — confirm emerald conversion rows and CTA → Transfer Strategies sandbox.

---

## Score-driven consumer dashboard ✅ (2026-05-29, Sprint B)

**Files:** `_dashboard-body.tsx` · `_dashboard-client.tsx` · `EstateReadinessCard.tsx` · `PriorityAlertCard.tsx` · `scoreDisplayHelpers.ts`

| Item | Notes |
|------|-------|
| **`EstateReadinessCard`** | Benchmark bar · component pills · trend delta · disclaimer |
| **`PriorityAlertCard`** | Top open `household_alerts` row · `getAlertFact` · severity/score CTA |
| **Greeting** | `getGreeting()` — four bands; placed above score card in State 3 |
| **Other items** | Collapsible "+ N other items" for remaining alerts |
| **Supersedes** | **`ConsolidatedAlertPanel`** (2026-05-30 interim — conflict-derived ranked list) |

**Alan post-deploy:** Adaptive greeting · score card with benchmarks · single priority alert from `household_alerts` · collapsed other items.

---

## Roth WhatIfPanel fix ✅ (2026-05-30)

**File:** `app/(dashboard)/roth/_roth-client.tsx` — **`WhatIfPanel` only**

| Item | Notes |
|------|-------|
| Root cause | Slider worked; **`rateDiff = max(0, …)`** forced **$0** savings when current rate ≥ projected RMD rate |
| **`lifetimeNetBenefit`** | Signed; label **Lifetime extra cost** when delay is optimal |
| Break-even | **"Delay is better"** when converting now costs more (Alan: 24% vs 22%) |
| **`iraBalanceAtRmd`** | Reacts to slider via `yearsUntilRmd × 1.05` conversion impact + delta annotation |
| Title | **"(delay is optimal)"** when `projectedRmdPct <= currentRatePct` |
| **`fmtPanel`** | Local helper inside panel; top-level **`fmt()`** unchanged |

**Alan at $50K/yr:** Tax **$12K** · Lifetime extra cost **−$15K** · Break-even **Delay is better** · IRA at RMD decreases with slider.

**Post-deploy smoke:** `/roth` — move slider; all four WhatIf cells update (especially on Alan / equal-or-inverted rate spread).

---

## Lifetime Snapshot polish ✅ (2026-05-30)

**Route:** `/complete` · **Client:** `app/(dashboard)/complete/_complete-client.tsx`

| Item | Notes |
|------|-------|
| Hero | **Funds outlast lifetime** — full-height green/red hero card (`lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]`) |
| Stats | Start · End · Peak net worth · Peak estate value — four `SummaryCard`s beside hero |
| Navigation | **Decade timeline** — spatial segment buttons replace Prev/Next; `activePage` state only (`pageStart = activePage * PAGE_SIZE`, derived) |
| Inflection rows | Amber highlight + inline badges: **SS begins**, **RMD begins**, **Peak net worth** (first year each event + peak row) |
| Net CF | Emerald/red with **`+` prefix** on positive values |
| Trend | **Sparkline** column after age columns (net worth vs min/max across full projection) |
| Legend | Inflection · decade boundary · positive/negative CF — above expand toggles |
| Table UX | **Sticky Year** column on horizontal scroll; SS/RMD sub-columns **auto-hide** when all zero on current page |
| colSpan | `personColumnCount()` — group header colSpan must match visible SS/RMD/expand columns per page (layout bug watch) |

**Post-deploy visual smoke (production, once):** Log in as household with SS in projection (e.g. golden-path / e2e-consumer) → `/complete`. **Passed prod 2026-05-30** (`e2e-consumer`) — hero · decade jump · SS badges · page 1/2 column hide/show · colSpan 14=14.

---

## 6-step onboarding wizard ✅ (2026-05-29)

**Commit:** `385dd4b` · **Steps:** 1 assets · 2 income · 3 liabilities · 4 expenses · 5 insurance · 6 advisor (invite unchanged)

| Item | Notes |
|------|-------|
| Client | `app/(dashboard)/onboarding/wizard/_wizard-client.tsx` — expanded from 3 → **6 steps**; **6-dot** step indicator |
| Skip UX | **Skip for now** on steps **3–5 only** (liabilities, expenses, insurance); removed from steps 1–2 |
| Save handlers | `saveAsset()`, `saveIncome()`, **`saveLiability()`**, **`saveExpense()`**, **`saveInsurance()`** — one handler per data step |
| Resume logic | **`firstIncompleteStep()`** + **`stepComplete()`** cover all **6** steps (not just assets/income) |
| Step previews | **`PREVIEW_BY_STEP`** — value-focused copy for all 6 steps |
| Write APIs | Steps 1–4 → `/api/consumer/assets`, `/income`, `/liabilities`, `/expenses`; step 5 → **`POST /api/insurance`** (correct path); step 6 → onboarding-wizard-complete + optional invite |
| Guided href | `lib/dashboard/guidedOnboardingHref.ts` — **core complete** = all **5** data sections have data |
| Tests | `tests/unit/guided-onboarding-href.spec.ts` — **11** unit cases for new step logic |

**Post-deploy manual smoke (production, once):** Sign up a **fresh test user** → profile → (persona if prompted) → wizard. Confirm **6 step dots** render. Save on each step (1–5) and verify rows persist; step 5 hits **`/api/insurance`**. Step 6 skip or invite. Re-open dashboard → **Guide me through it** resumes at first incomplete step, not a bounce to dashboard.

---

## Onramp guided path bounce fix ✅ (2026-05-29)

**Symptom:** "Guide me through it" on onramp → instant return to `/dashboard` after import or wizard backfill.

| Item | Notes |
|------|-------|
| Root cause | Onramp (score &lt; 60) vs wizard page (`onboarding_wizard_completed_at` set by `ensureWizardBackfill`) used different "done" criteria |
| Fix | `lib/dashboard/guidedOnboardingHref.ts` — `resolveGuidedOnboardingHref()` + `shouldRedirectCompletedWizardToDashboard()` |
| Dashboard | `dashboard/page.tsx` — Guide target from setup progress |
| Wizard | `onboarding/wizard/page.tsx` — redirect only when wizard complete **and** all **5** sections have data |
| Profile | `persona/page.tsx`, `wizard/page.tsx` — `from=` on required profile redirect |
| Tests | `tests/unit/guided-onboarding-href.spec.ts` — 11 cases in `import-unit` |

**Manual smoke:** Import CSV → onramp → Guide → wizard step 2 (income), not dashboard bounce.

---

## Import format surfacing ✅ (2026-05-29)

**Upload step order:** `SupportedFormats` → persona XLSX templates → single-table CSV templates → drop zone.

| Item | Notes |
|------|-------|
| Component | `app/(dashboard)/import/_SupportedFormats.tsx` — broker CSV, multi-sheet Excel, single CSV |
| Client | `app/(dashboard)/import/_import-client.tsx` — reordered upload step; helper text points to templates below / drop zone below |
| Onramp | `components/dashboard/DashboardOnramp.tsx` — import desc + `Broker CSV · Multi-sheet Excel · Single-table CSV` hint |

**Manual smoke:** `/import` — no scroll needed to see supported formats and template downloads; broker users can drop export immediately after reading formats block.

---

## Dashboard onramp ✅ (2026-05-30)

**Route:** `app/(dashboard)/dashboard/page.tsx` — early return before `DashboardBody`.

| Item | Notes |
|------|-------|
| Gate | `lib/dashboard/onrampGate.ts` — `shouldShowOnramp()`; `ONRAMP_SCORE_THRESHOLD = 60` |
| UI | `components/dashboard/DashboardOnramp.tsx` — import / guided / self paths; **`guidedHref`** from `resolveGuidedOnboardingHref()` |
| Layout | `getDashboardLayoutContext()` + `full_name`, `onboarding_persona` on profile select |
| Wizard gate | `/dashboard` in `wizardGateExemptPrefixes.ts` — onramp stays visible; gate does not auto-push to wizard |
| E2E guard | `e2e-golden-path@` — score ≥ 60 via `ensureMinEstateHealthScore` |
| Verify | `npx tsx scripts/check-golden-path-onramp-gate.ts` |

**Manual smoke (fresh user, post-deploy):** Import → `/import` · Guide (no persona) → `/onboarding/persona` → wizard · Self → `/assets`

**Docs:** [dashboard-page-patch.md](./dashboard-page-patch.md)

---

## Cross-role E2E + CI route validator ✅ (2026-05-30)

**Commits:** `510ac8a` · `cfe5f88` · `12734a3` · `3e8525c` · `3c63648` · (Card + persona E2E) `aria-pressed` on `Card` root div

| Item | Notes |
|------|-------|
| `test:e2e:security-isolation` | Consumer + advisor IDOR matrix — gifting, estate-composition, export, documents; **403 or 404** both deny access |
| `test:e2e:cross-role` | Johnson advisor sync, persona onboarding, attorney documents/gap-dismissals, cross-household specs |
| New specs | `tests/e2e/security/cross-household-isolation.spec.ts`, `advisor/advisor-consumer-sync.spec.ts`, `attorney/attorney-documents-gaps.spec.ts`, `consumer/onboarding-persona.spec.ts` |
| Helpers | `tests/e2e/helpers/e2e-households.ts`, `johnson-client.setup.ts` |
| CI | `npx tsx scripts/verify-app-route-slugs.ts` — fails build on conflicting App Router dynamic segments |
| `/api/health` | Added to `security-sprint-post-deploy.spec.ts` |

**Persona gate fix:** `/onboarding/persona` gate is `isWizardReadyProfile` (state, filing, birth year) — not full MVI with `person1_name`. Partial household SELECT caused false `/profile?required=true` redirects on prod.

**Persona E2E + Card fix:** `_persona-client.tsx` sets `aria-pressed` on `<Card>`; `components/ui/Card.tsx` now spreads div props (`ComponentPropsWithoutRef<'div'>`) so `aria-pressed` renders on the clickable root. E2E clicks `page.locator('[aria-pressed]').filter({ hasText: '…' })` — not the inner `h2`. Continue flow waits for `PATCH /api/consumer/profile` before navigation assert.

**Attorney DB:** `supabase db push` migration `20260630100000_attorney_clients_fk_listing_household.sql` — aligns FKs with app code; attorney grant-access + vault RLS.

**Env:** Add `RECOMPUTE_SECRET` from `.env.local` to `.env.test` for golden-path seed recompute (optional — onboarding spec does not require it).

---

## Prod API route fix + security smoke ✅ (2026-05-30)

**Commit:** `af12ff0` — `fix(api): resolve documents slug conflict that hung all Vercel routes`

| Item | Notes |
|------|-------|
| Root cause | Next.js 16: `[household_id]` and `[id]` at same depth under `/api/documents/` — serverless init silently failed; all route handlers hung |
| Fix | `GET /api/documents/household/[household_id]`; attorney vault fetch updated |
| Route auth | `lib/supabase/routeAuth.ts` — `getSession()` in route handlers; `requireAdvisorUser` uses it |
| Liveness | `GET /api/health` — no auth, returns `{ ok: true }` |
| Security smoke | **7/7 passed** on `https://www.mywealthmaps.com` — referral `{200:60,429:5}`, telemetry 401, consumer RPC pages, Monte Carlo P10/P50/P90 |

**Pre-launch ops doc:** [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) — legal, business formation, email aliases, Supabase auth, Stripe live, go-live day sequence.

---

## RPC guards + attorney RLS + edge auth ✅ (2026-05-29)

**Sprint: Audit follow-up security — COMPLETE**

**Commits:** `security: RPC household access guards + attorney RLS policy fix` · `security: Monte Carlo edge function JWT auth + ownership check` · `security: rate limits on referral track + telemetry endpoints`

| Item | Notes |
|------|-------|
| `assert_household_caller_access()` | Owner, advisor, or attorney; `service_role` bypass for recompute |
| RPCs guarded | `calculate_estate_composition`, `calculate_gifting_summary`, `generate_estate_recommendations` |
| Attorney RLS | `attorney_listings.profile_id = auth.uid()`; `client_id = households.id` |
| Monte Carlo edge | JWT validation + household access before service-role insert |
| Rate limits | `simpleRateLimit.ts`; referral 60/min; telemetry 120/min + auth |

**Prod deploy (2026-05-29):** Migrations applied + edge function deployed on `fnzvlmrqwcqwiqueevux`. SQL verify script: `scripts/verify-security-sprint-20260629.sql`. **Cron note:** `app/api/cron/README.md`.

**Browser smoke:** [LAUNCH_CHECKLIST § Security hardening post-deploy](./LAUNCH_CHECKLIST.md#security-hardening-post-deploy-browser-smoke-2026-05-29) — **passed 7/7 on prod 2026-05-30** (`npm run test:e2e:security-smoke`)

**Go-live:** Remaining blockers are legal/ops — [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md).

---

**Sprint: Codebase audit remediation — COMPLETE**

**Commits:** `fix(security): gate internal email routes and household access checks` · `chore: remove orphaned components and backup artifacts` · `test(ci): add CI workflow and unit tests for sprint surfaces` · `test(e2e): health score, prospect, playbook, and mobile smoke specs`

### PR1 — Security hardening
| Item | Notes |
|------|-------|
| `lib/api/internalApiAuth.ts` | `INTERNAL_API_KEY` / `CRON_SECRET` gate for server-only routes |
| Email routes | `advisor-notify`, `attorney-notify`, `attorney-invite` — gated + HTML escaped |
| Household access | `gifting-summary`, `estate-composition`, `strategy-configs`, `export-estate-plan` |
| Unsubscribe | HMAC-signed tokens via `lib/email/unsubscribeToken.ts` |
| Misc | Resend inbound auth; debug-tier 404 in prod; invite email match; projection run service-role only |

### PR2 — Dead code cleanup
| Item | Notes |
|------|-------|
| Removed | ~3.5k lines orphaned components + 5 `.bak_*` files |
| Redirect | `/advisor/prospect` → `/prospect` in `next.config.ts` |

### PR3 — CI + unit tests
| Item | Notes |
|------|-------|
| `.github/workflows/ci.yml` | lint, build, security-audit, UX language, unit tests |
| Unit specs | health score, prospect summary, advisor playbook storage, rate limit — **39/39 pass** |

### PR4 — E2E specs
| Spec | Coverage |
|------|----------|
| `advisor-prospect-mode.spec.ts` | Prospect tool smoke |
| `advisor-first-client-playbook.spec.ts` | Playbook panel + empty state |
| `consumer-health-score-narrative.spec.ts` | Score badge + context sentence |
| `consumer-mobile-review.spec.ts` | Mobile banner + table scroll |

**Follow-ups (not in scope):** Manual 18-step health/playbook and 19-step prospect/mobile checklists.

---

## Health Score Narrative + Advisor First-Client Playbook ✅ (2026-05-29)

**Sprint: Health Score Narrative + Advisor First-Client Playbook — COMPLETE**

**Commits:** `feat(health-score): unified narrative badge across surfaces` · `feat(advisor): first-client activation playbook + attention panel`

### Track 1 — Health score narrative
| Item | Notes |
|------|-------|
| `components/shared/HealthScoreBadge.tsx` | hero/card/badge sizes, null-safe |
| `lib/estate-health-score.ts` | `scoreContextSentence()`, `scoreContextSentenceForAdvisor()`, `isScoreStale()` |
| Surfaces | Dashboard `EstateSummarySection`, `/my-estate-strategy`, health-check completion, advisor client list, Meeting Prep |
| Labels | **Strong** (75+) · **Needs Attention** (50–74) · **At Risk** (0–49) |
| Stale | Recalculate prompt when `computed_at` > 30 days |

### Track 2 — Advisor first-client activation
| Item | Notes |
|------|-------|
| Empty state | 3 options: intake request, invite, prospect mode |
| `AdvisorFirstClientPlaybook` | 3-step panel, localStorage `mwm_advisor_playbook_${advisorId}` |
| Auto-complete | Step 1 client view · Step 2 strategy tab · Step 3 recommendation send |
| Notification | `first_client_connected` via `create_notification` RPC on first active client |
| Needs attention | Clients with score < 50 or high-severity alerts |

**Locked decisions:** Score calculation unchanged; playbook state localStorage only; needs-attention uses existing `healthScoreMap` / `alertCountsMap`.

**Manual smoke:** 18-step checklist in playbook script — **not run in CI**.

---

## Prospect Mode Polish + Mobile Review Mode ✅ (2026-05-29)

**Sprint: Prospect Mode Polish + Mobile Review Mode — COMPLETE**

**Commits:** `feat(prospect): DB tax config, PDF export, intake invitation CTA` · `feat(mobile): review mode banner, tappable recs, table scroll wrappers`

### Track 1 — Prospect mode
| Item | Notes |
|------|-------|
| `lib/prospect/getProspectTaxConfig.ts` | Reads `federal_tax_config` (`current_law`, `sunset_2026`); falls back to OBBBA / TCJA sunset baselines |
| `lib/prospect/calculateProspectSummary.ts` | Federal + state via `calculateStateEstateTax` + `state_estate_tax_rules` — **not** `calculate_state_estate_tax` RPC (no `household_id` in prospect mode) |
| `GET /api/advisor/prospect-pdf` | Print-to-PDF HTML (500ms delay), same pattern as meeting prep |
| Intake CTA | Reuses `POST /api/attorney/send-intake-request`; **advisor role permitted**; free-tier cap attorney-only |
| Canonical route | `/prospect`; `/advisor/prospect` → redirect |

### Track 2 — Mobile review mode
| Item | Notes |
|------|-------|
| Mobile alert banner | `< lg` when conflicts or pending advisor recs |
| `StrategyRecommendationPanel` | Stacked Accept/Decline, `min-h-[44px]` |
| Table scroll | `overflow-x-auto -mx-4 px-4` on projections, RMD, scenarios |
| Net worth grid | Already `grid-cols-2 lg:grid-cols-4` — no change |
| Estate tax page | Card-based — no change |

**Locked decisions:** Prospect state tax uses `calculateStateEstateTax` directly (not RPC); `getProspectTaxConfig()` DB fallback; mobile is review-only (desktop-first planning).

**Automated verify (2026-05-29):** `npm run test:import:unit` 24/24 pass; ESLint on sprint files — 0 errors; TypeScript clean except pre-existing `consumer-import.spec.ts`.

**Manual smoke:** 19-step checklist in [LAUNCH_CHECKLIST § Prospect + Mobile manual smoke](./LAUNCH_CHECKLIST.md#prospect--mobile-review-mode-manual-smoke-2026-05-29) — **not run in CI** (requires Resend inbox, advisor2 login, DevTools 390px).

**CA note for step 4:** CA has no state estate tax — sunset delta should appear; state tax card should not. Use **WA** or **OR** to verify state tax figure.

---

## Professional Acquisition & Activation ✅ (2026-05-29)

**Sprint: Professional Acquisition & Activation — COMPLETE**

### Track 1 — Attorney intake request flow
| Item | Notes |
|------|-------|
| Migration | `20260530110000_attorney_intake_requests.sql` (renamed from invalid `20260530_*`) |
| Free tier | 5 requests/month cap enforced server-side |
| Token flow | sessionStorage → auto-grant on profile save or login |
| Email | Resend, BCC `avoels@comcast.net` |

### Track 2 — Advisor referral impact panel
| Item | Notes |
|------|-------|
| Clicks | `referral_clicks` — 30-day window, `created_at` column |
| Signups | `funnel_events` — `account_created` with `referral_code` |
| Connected | `advisor_clients` — active/accepted |
| Notify | In-app + email on attributed consumer signup |

### Track 3 — Meeting prep one-pager
| Item | Notes |
|------|-------|
| Route | `GET /api/advisor/meeting-prep-pdf/[clientId]` — HTML → browser print |
| Data | `estate_health_scores`, `household_alerts`, `estate_composition_cache`, projection scenario |
| Print delay | `setTimeout(..., 500)` before `window.print()` |

**Locked decisions:** Signup attribution via `profiles.referral_code` (not `referral_clicks.user_id); meeting prep is print-to-PDF (no new library); intake expiry 14 days; `attorney_listings.referral_code` confirmed (`20260528000000_attorney_referrals.sql`).

**Before deploy:** apply `20260530110000_attorney_intake_requests.sql`. **Manual smoke:** 20-step checklist in LAUNCH_CHECKLIST (Tracks 1–3).

**Watch post-deploy:** intake completion rate (`completed` / `sent`); advisor referral notification open rate; Firefox print layout (may need 800ms delay).

---

## Persona-based onboarding ✅ (2026-05-29)

| Category | Item | Status | Notes |
|----------|------|--------|-------|
| DB | `onboarding_persona` + `persona_set_at` on `profiles` | ✅ | Migration `20260530100000_onboarding_persona.sql` |
| FEATURE | Persona selection `/onboarding/persona` | ✅ | 4 cards, post-profile redirect, funnel events |
| FEATURE | Persona-aware wizard step 1 | ✅ | Headline, body, asset type, template per persona |
| FEATURE | `PersonaInsightCard` on dashboard | ✅ | 4 variants, 7-day window, sessionStorage dismiss |
| FEATURE | Persona funnel events | ✅ | `persona_selected`, `persona_skipped`, insight shown/clicked/dismissed |
| CONFIG | `lib/onboarding/personaConfig.ts` | ✅ | Single source of truth for persona content |

**Locked decisions:** Persona set once (`persona_set_at` immutable for analytics); fallback `accumulator` on sidebar skip; persona does not gate features — copy/routing only; insight card is 7-day first-run only.

**Before deploy:** apply `supabase/migrations/20260530100000_onboarding_persona.sql`. Smoke: fresh signup → profile → persona screen → wizard (persona headline) → dashboard (`PersonaInsightCard`).

---

## Import expansion + attorney workflow ✅ (2026-05-29)

| Task | Status |
|------|--------|
| Type normalization (`lib/import/type-normalizer.ts`) + review UI badges | ✅ |
| Multi-sheet workbook + CSV `record_type` split + Commit All | ✅ |
| Import-first onboarding fork (`?onboarding=true`) | ✅ |
| Persona templates (business owner, RE, executive) | ✅ |
| Real estate import target + property type normalization | ✅ |
| Attorney doc status lifecycle + gap dismissals migration | ✅ |
| Document vault status/filter/gaps + intake PDF (tier ≥ 1) | ✅ |
| Multi-client doc health dashboard (tier ≥ 1) | ✅ |
| Attorney tier model + `/attorney/billing` (checkout wired; 503 until Stripe prices) | ✅ |
| Fix attorney connection lookup (`attorney_listings.id`) | ✅ |

See [SPRINT_IMPORT_ATTORNEY.md](./SPRINT_IMPORT_ATTORNEY.md).

**Before deploy:** apply `supabase/migrations/20260529120000_sprint_import_attorney.sql` + `20260529130000_attorney_drip_columns.sql`; create Stripe attorney products; set `STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY` + `STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY`.

---

## Attorney monetization ✅ (2026-05-29)

| Task | Status |
|------|--------|
| `POST /api/stripe/attorney-checkout` + webhook `attorney_tier` | ✅ |
| `/attorney/billing` Subscribe + `?checkout=success` banner | ✅ |
| `AttorneyUpgradePrompt` — client cap, PDF export, doc dashboard blur | ✅ |
| Client cap 403 — `grant-access`, `accept-request` | ✅ |
| Attorney drip steps 1–3 + `attorney_drip_step_*` columns | ✅ |
| Stripe products + env vars | ⏳ manual |

---

## Projections empty state fix ✅ (2026-05-29)

| Task | Status |
|------|--------|
| `checkProjectionReadiness()` — birth year, retirement age, assets/income | ✅ |
| Targeted empty state + partial view with inline prompts | ✅ |
| `buildProjectionPlanningFields()` | ✅ |
| Unit tests — `projectionReadiness.spec.ts` (5 cases) | ✅ |

---

## Queued next (post-ship ops)

### 1. Dashboard `canShowPartial` nudge — low priority

Deferred from projections empty-state sprint (Phase 3). Show a subtle setup card on `/dashboard` when the user has financial data but is missing birth year or retirement age for projections. Revisit after ~2 weeks of traffic — only worth screen real estate if a meaningful share of users hit `canShowPartial` without visiting `/projections` (which already has inline prompts).

### 2. Attorney drip steps 2 & 3 — cron verification

Worth a manual DB check once a **real** attorney has registered (not seed-only).

**Expectations**

| Step | When | Column |
|------|------|--------|
| 1 | Immediately on activation (signup callback, claim-listing, or first `/attorney` visit) | `attorney_drip_step_1_sent_at` non-null |
| 2 | ~3+ days after step 1 sent (`step1At <= threeDaysAgo` in cron) | `attorney_drip_step_2_sent_at` |
| 3 | ~7+ days after step 1 sent (`step1At <= sevenDaysAgo`) | `attorney_drip_step_3_sent_at` |

Cron: `app/api/cron/notifications/route.ts` § attorney activation drip. Candidates: `profiles` with non-null step 1 and `role = 'attorney'` **or** `is_attorney = true`.

**~3 days after first real attorney signup**, run in Supabase SQL Editor:

```sql
SELECT email,
       created_at,
       attorney_drip_step_1_sent_at,
       attorney_drip_step_2_sent_at,
       attorney_drip_step_3_sent_at
FROM profiles
WHERE role = 'attorney' OR is_attorney = true
ORDER BY created_at DESC
LIMIT 10;
```

**If step 1 is set but step 2 is still null after day 3:** cron may not be matching attorney rows, `CRON_SECRET` / Vercel cron not firing, or day threshold off — debug with the first real `email` from the query above and cron logs (`[cron:notifications]`). Easy fix once you have a real case.

---

## Inline profile prompts ✅ (2026-05-27)

| Task | Status |
|------|--------|
| `ProfileFieldPrompt` shared component (session dismiss, save-hidden anti-flash) | ✅ |
| `/social-security` per-person SS prompts | ✅ |
| `/scenarios` combined planning prompt (deduction: null/unset only) | ✅ |
| Partial PATCH merge on `PATCH /api/consumer/profile` | ✅ |
| E2E partial-payload smoke (SS + retirement/longevity, run separately post-deploy) | ✅ |
| Master docs sync | ✅ |

See [SPRINT_INLINE_PROFILE_PROMPTS.md](./SPRINT_INLINE_PROFILE_PROMPTS.md). Replaces interim `ProfileIncompleteInlinePrompt`.

---

## Sprint summary — 2026-05-26

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
| Advisor portal perf | ✅ | `8c526de` |
| Advisor portal UX-2 | ✅ | `1ba93eb` |
| Advisor tax parity (Tax/Domicile/Strategy) | ✅ | `cb04d64` |
| Advisor portal UX-3 | ✅ | `06edb1a` |
| Advisor portal UX-4 | ✅ | `3c5c0ef` |
| Advisor portal UX-5 | ✅ | `d6e5c5e` |
| Advisor portal ENG-1 | ✅ | `b5cc8da` |
| Advisor portal UX-5b | ✅ | `4220c0a` |
| Brand consistency pass | ✅ | `fbaa709` |
| Client Summary PDF upgrade | ✅ | `0816f37` |
| Nav consistency (homepage, billing, utility) | ✅ | `b51eedd` |
| ENG-2A — RE/business + estate MC | ✅ | `5589b89` |
| ENG-2B — growth_assumptions UI | ✅ | `51fff01` |
| ENG-2C — insurance cash value growth | ✅ | `604b1b9` |
| ENG-2D — income growth rate | ✅ | `9101ac5` |
| ENG-2E — MC alignment surfacing | ✅ | `8e90fa4` |
| Strategy reversal lifecycle | ✅ | 4 commits: DB audit columns · reversal API/UI · gifting delete warning · advisor withdrawn |

---

## Sprint K — consumer flow consistency ✅ (2026-05-28, `90d167a`)

| Task | Status |
|------|--------|
| Remove `window.location.reload` (P&C, my-estate-strategy, advisor/attorney invite, Strategy base-case) | ✅ |
| Trust-strategy `ConsumerStrategyPanel` server hydrate | ✅ |
| Charitable donations → `/api/consumer/charitable-donations` | ✅ |

---

## Sprint L — bundle + duplicate fetch ✅ (2026-05-28, `5da71b0`)

| Task | Status |
|------|--------|
| Recharts via `dynamic()` in `MonteCarloCharts.tsx` | ✅ |
| Lazy `@react-pdf/renderer` in `ExportPDFButton` | ✅ |
| Delete dead `projections/_projections-view.tsx` | ✅ |
| `loadEstatePlanningDashboard` + prefetch (my-estate-strategy, attorney client) | ✅ |

---

## Sprint M — dashboard Suspense streaming ✅ (2026-05-28, `c5186ca`)

| Task | Status |
|------|--------|
| Thin `dashboard/page.tsx` + `DashboardBody` in `<Suspense>` | ✅ |

---

## Sprint N — advisor tab perf ✅ (2026-05-28, `615d496`)

| Task | Status |
|------|--------|
| Roster `alertCountsMap` batch load | ✅ |
| `AdvisorAlertBadge` prefetch | ✅ |
| Strategy tab server hydrate gate | ✅ |

**Deferred:** advisor `?tab=` still full server navigation — Parallel Routes sprint post–go-live.

---

## Sprint O — shells + composition cache ✅ (2026-05-28, `3524581`)

| Task | Status |
|------|--------|
| `loading.tsx` / `error.tsx` on assets, titling, advisor, my-estate-strategy | ✅ |
| `revalidateTag(household-composition-{id})` after household writes | ✅ |

---

## TERMS-2/3/5 — billing checkout fixes ✅ (2026-05-29, `48e7326`)

| Fix | Status |
|-----|--------|
| TERMS-2: `/terms/accept` accepts `no_payment_required`; `subscription_status` from Stripe | ✅ |
| TERMS-3: `layout.tsx` `hasAccess` includes `trialing` | ✅ |
| TERMS-5: Checkout success → `/dashboard` or `/profile` (not `/terms/accept`) | ✅ |
| TERMS-1: Signup T&C checkbox → `terms_accepted_at` at signup | ✅ |
| Section F: Soft backfill banner on dashboard for legacy users | ✅ |

**Ops:** `npm run repair:orphaned-user -- <email>` — missing `profiles` row + optional Stripe sync.

---

## Stripe go-live + annual toggle guard ✅ (2026-05-28)

| Task | Status |
|------|--------|
| `isAnnualBillingConfigured()` — hide toggle if annual price IDs missing | ✅ |
| LAUNCH_CHECKLIST Phase 1 (test) + Phase 2 (live) + cutover table | ✅ |

**Ops:** Do not toggle to annual in app until all three `STRIPE_PRICE_*_ANNUAL` env vars are set. See [LAUNCH_CHECKLIST § Stripe Setup](./LAUNCH_CHECKLIST.md#stripe-setup-required-before-public_signup_opentrue).

---

## Advisor dashboard tier fix ✅ (2026-05-28)

| Task | Status |
|------|--------|
| `_dashboard-body` uses `getUserAccess().tier` (not raw `consumer_tier`) | ✅ |
| `isConsumerTier2` uses `access.tier === 2` | ✅ |
| LAUNCH_CHECKLIST advisor manual billing section | ✅ |
| DECISION_LOG + ROADMAP post-launch advisor adoption scope | ✅ |

**Commits (2):** `fix(dashboard): getUserAccess tier in _dashboard-body` · `docs: advisor billing manual process`

**Smoke:** advisor-connected consumer with `consumer_tier = 1` in DB → `/dashboard` shows Stage 3, direct estate links, no unlock banner.

---

## Sprint 4 — consumer pricing & Stripe integration ✅ (2026-05-28)

| Task | Status |
|------|--------|
| `lib/billing/stripePrices.ts` — env price IDs, `getPriceConfig`, `getTierFromPriceId` | ✅ |
| Billing + `/pricing` monthly/annual toggle; Estate 14-day trial | ✅ |
| Checkout/webhook tier wiring; `UpgradeBanner` copy | ✅ |

**Commits (3):** `feat(billing): stripePrices` · `feat(billing): annual toggle` · `docs: Stripe setup + master docs`

---

## Golden Path — guided dashboard ✅ (2026-05-29)

| Task | Status |
|------|--------|
| Delete unused `lib/dashboard/setupProgress.ts` | ✅ |
| `determinePlanStage` (stages 1–4, single progress %) | ✅ |
| `PlanProgressBar` hero + Show all tools / Guided view | ✅ |
| Stage-based section visibility on `/dashboard` | ✅ |
| `SetupProgressCard` demoted (stage 1 detail only) | ✅ |
| Playwright smoke `npm run test:e2e:golden-path` | ✅ |

**Commits (4):** `chore: delete setupProgress` · `feat(golden-path): determinePlanStage` · `feat(golden-path): PlanProgressBar` · `feat(golden-path): stage-based dashboard`

**Smoke:** `npm run seed:golden-path` then `PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e:golden-path`

---

## Estate execution checklist + preview UX ✅ (2026-05-28)

| Task | Status |
|------|--------|
| `estate_checklist_items` migration + RLS | ✅ |
| `buildEstateExecutionChecklist` (existing tables, no new RPCs) | ✅ |
| `EstateExecutionChecklist` on dashboard (below callout) | ✅ |
| Trust `TrustDocumentsPanel` checkboxes → PATCH persist | ✅ |
| Estate preview: callout position, tier CTAs, upgrade wall, tier-aware links | ✅ |

**Commits (4):** `feat(db): estate_checklist_items` · `feat(checklist): buildEstateExecutionChecklist` · `feat(checklist): EstateExecutionChecklist` · `feat(checklist): TrustDocumentsPanel persist`

**Smoke:** tier 1 with assets → checklist below callout; toggle will → reload persists; trust tab “Gather assets list” → `titling_reviewed` on dashboard.

---

## Sprint 19a — deferred review fixes ✅ (2026-05-28, `b7a15dd`)

| Task | Status |
|------|--------|
| Allocation save → `router.refresh()` only (no extra `/api/asset-allocation`) | ✅ |
| `loadAssessmentHistory` + `AssessmentHistoryWidget` server prefetch on dashboard | ✅ |
| Meeting Prep instant brief + “Refresh from latest data” | ✅ |

**Deferred:** Meeting Prep full server dedupe of all `generateMeetingBrief` queries; advisor tab full-reload architecture.

---

## Sprint 18 — planning shell completion (2026-05-27)

| Task | Status |
|------|--------|
| `/complete` + `/estate-tax` loading + error | ✅ Sprint J |
| Manual RLS isolation smoke | `[ ]` |
| Dashboard/trust-strategy → `RouteErrorFallback` | ✅ |

**Sprint 17 ops blockers unchanged:** legal counsel, Stripe Dashboard, signup flip, production smoke.

---

## Post-launch perf program — CLOSED (Sprints B–J)

### Sprint J — complete + estate-tax shells ✅ (2026-05-27)

| Route | Files |
|-------|-------|
| `/complete` | `loading.tsx`, `error.tsx` |
| `/estate-tax` | `loading.tsx`, `error.tsx` |

---

## Post-launch perf Sprint I — error boundaries ✅ (2026-05-27)

| Route | File |
|-------|------|
| Hot prefetch routes | `error.tsx` + shared `RouteErrorFallback` |

---

## Post-launch perf Sprint H — loading skeletons ✅ (2026-05-27)

| Route | Skeleton |
|-------|----------|
| `/monte-carlo` | Step bar + form cards + gauge/chart placeholder |
| `/allocation` | Donut + slider + benchmark cards |
| `/scenarios` | Assumptions panel + 3 scenario columns + chart |
| `/social-security` | Person cards + comparison table |
| `/projections` | Summary cards + chart tabs |

---

## Post-launch perf Sprint G — sidebar tier-locked billing links ✅ (2026-05-27)

| Fix | Outcome |
|-----|---------|
| **Tier-locked leaves** | Feature-gated nav items link to `/billing?returnTo=…` instead of dead clicks |
| **Locked groups** | Retirement/Estate group items and upgrade banner link to billing |

---

## Post-launch perf Sprint F — profile gate consistency ✅ (2026-05-27)

| Fix | Outcome |
|-----|---------|
| **requireHouseholdRecord** | Shared redirect to `/profile?required=true&missing=…&from=…` when no household row |
| **Pages aligned** | health-check, social-security, digital-assets, attorney-access use shared helper |
| **Trust-strategy** | Replaced inline empty state with `requireMinimumViableProfile` redirect |
| **Type narrowing** | `requireMinimumViableProfile` assertion; `ProfileGateHousehold.id` optional field |

---

## Post-launch perf Sprint E — insurance/businesses form refresh ✅ (2026-05-27)

| Fix | Outcome |
|-----|---------|
| **Insurance form** | Local state patch + `router.refresh()` after save/delete (no full reload) |
| **Businesses form** | Same pattern as `/assets` write path |

---

## Post-launch perf Sprint D — advisor tab code-split + domicile dedupe ✅ (2026-05-27)

| Fix | Outcome |
|-----|---------|
| **Tab code-split** | Overview, Estate, Retirement, Tax, Notes via `next/dynamic` in `ClientViewShell` |
| **Nav skeletons** | Pending-tab skeletons for overview, notes, documents |
| **Domicile dedupe** | `DomicileTab` uses server `domicileAnalysis` prop; removed mount `/api/domicile-analysis` refetch |

**Detail:** [SCHEMA_CHANGELOG.md § Post-launch perf Sprint D](./SCHEMA_CHANGELOG.md) · [DECISION_LOG.md](./DECISION_LOG.md)

---

## Post-launch perf Sprint C — Scenarios lazy B/C fetch ✅ (2026-05-27)

| Fix | Outcome |
|-----|---------|
| **Lazy B/C** | Scenario B/C skip `/api/projection` on mount until user edits inputs |
| **Returning users** | localStorage saved overrides auto-activate fetch on load |
| **UX hint** | “Adjust an input to calculate this scenario” when B/C not yet run |

**Detail:** [SCHEMA_CHANGELOG.md § Post-launch perf Sprint C](./SCHEMA_CHANGELOG.md) · [DECISION_LOG.md](./DECISION_LOG.md)

---

## Post-launch perf Sprint B — Monte Carlo + Allocation prefetch ✅ (2026-05-27)

| Fix | Outcome |
|-----|---------|
| **Monte Carlo loaders** | `loadMonteCarloPrefill`, `loadMonteCarloHistory`, `loadMonteCarloAdvisorAssumptions` in `lib/monte-carlo/`; API routes thin wrappers |
| **Monte Carlo page** | Server `Promise.all` prefetch → `MonteCarloClient` props; client skips mount fetches when hydrated |
| **Allocation loader** | `loadAssetAllocationData` in `lib/allocation/`; `/api/asset-allocation` reuses loader |
| **Allocation page** | Passes `initialAllocationData`; client fallback fetch only when null |

**Detail:** [SCHEMA_CHANGELOG.md § Post-launch perf Sprint B](./SCHEMA_CHANGELOG.md) · [DECISION_LOG.md](./DECISION_LOG.md)

---

## Post-launch perf Sprint A — advisor correctness ✅ (2026-05-27)

| Fix | Outcome |
|-----|---------|
| **Advisor tab includes** | `advisorDatasetIncludeForTab` aligned with `needsStrategyVm` for estate/tax/domicile/meeting-prep |
| **Strategy tab dedupe** | Single line-item fetch; `strategyLineItemsForHorizons()` feeds VM + StrategyTab |
| **Trust composition dedupe** | `loadTrustWillGuidance(..., preloadedComposition)` on trust-strategy |
| **Meeting Prep** | Server composition prop; `?tab=strategy` links; recalculate → `router.refresh()` |
| **Quick wins** | Upgrade banner cache read; dashboard loading skeleton; notification sessionStorage gate |

**Detail:** [SCHEMA_CHANGELOG.md § Post-launch perf Sprint A](./SCHEMA_CHANGELOG.md) · [DECISION_LOG.md](./DECISION_LOG.md)

---

## Post-launch perf sprint ✅ (2026-05-27)

| Fix | Outcome |
|-----|---------|
| **StrategyTab hydration** | Advisor `page.tsx` prefetches advisor/consumer line items, strategy configs, gifting actuals when `tab=strategy`; `StrategyTab` hydrates from props; `loadConsumerData(false)` skips mount fetches; `loadConsumerData(true)` after writes |
| **Server prefetch** | Social Security (`loadSocialSecurityData`), dashboard setup progress, charitable summary on trust-strategy |
| **Dynamic import** | `ConsumerStrategyPanel` — `dynamic(..., { ssr: false })` on trust-strategy tabs |
| **Render path** | Advisor strategy notifications via `POST /api/consumer/advisor-strategy-notifications` (client mount); `loading.tsx` / `error.tsx` on trust-strategy + dashboard |
| **Composition cache** | `estate_composition_cache` table; `getCachedComposition` read path; recompute upserts consumer + advisor roles |

**Migration:** `20260527180000_estate_composition_cache.sql` — apply before cache is warm in prod.

**Detail:** [SCHEMA_CHANGELOG.md § Post-launch perf](./SCHEMA_CHANGELOG.md) · [MASTER_ARCHITECTURE.md § Estate health recompute](./MASTER_ARCHITECTURE.md#estate-health-recompute--operations) · [DECISION_LOG.md](./DECISION_LOG.md)

---

## Strategy sandbox → actuals ✅ (2026-05-27)

| Area | Outcome |
|------|---------|
| **Consumer** | Transfer Strategies: **Strategy Sandbox** (`illustrative`) → **Add to plan** → **In My Plan** (`probable`/`certain`); chip dots amber/green/blue ring |
| **API** | `PATCH /api/strategy-line-items` `{ id, promoteConfidence: true }`; `DELETE` by `id` |
| **Roth** | `/roth` **Use in Transfer Strategies →** → `?tab=strategies&openPanel=roth` |
| **Advisor** | Send/accept path unchanged; accepted rows surface in In My Plan; illustrative advisor rows stay in sandbox until accept |
| **Docs** | [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md), [MASTER_ARCHITECTURE.md § sandbox](./MASTER_ARCHITECTURE.md#consumer-and-advisor-interaction) |

**Detail:** [SCHEMA_CHANGELOG.md § Strategy sandbox](./SCHEMA_CHANGELOG.md) · [DECISION_LOG.md](./DECISION_LOG.md)

---

## Strategy reversal lifecycle ✅ (2026-05-31)

| Area | Outcome |
|------|---------|
| **DB** | `consumer_withdrawn`, `withdrawn_at`, `reversal_reason`, `reversed_from`, `previously_active_at` |
| **API** | `PATCH` `{ id, action: promote \| return_to_sandbox \| withdraw \| demote }` — consumer owner only |
| **Consumer** | In My Plan: Return to sandbox / Withdraw / Unwind; Strategy history; gifting plan card + delete warning |
| **Advisor** | Step 3 **Withdrawn by Client** with optional consumer reason |
| **Deploy** | `supabase db push` for `20260531120000` before app |

**Detail:** [SCHEMA_CHANGELOG.md § Strategy reversal](./SCHEMA_CHANGELOG.md) · [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md)

---

## ENG-2 growth assumptions ✅ (2026-05-27)

| Area | Outcome |
|------|---------|
| **Engine** | RE at `reGrowthRate` (4.5% default); business at `bizGrowthRate` (7%); estate MC uses request `returnMeanPct`/`volatilityPct` |
| **Storage** | `households.growth_assumptions`; `income.annual_growth_rate`; `insurance_policies.cash_value_growth_rate` |
| **Consumer UI** | `/scenarios` edit + save; `/projections` read-only |
| **Advisor UI** | RE/business overrides + MC alignment note on Strategy tab |
| **Staleness** | Not save-only — dashboard/strategy/advisor auto-regen when stale; migration `20260527130400` bumps `updated_at` post-deploy |

**Deploy order:** migrations → `supabase functions deploy estate-monte-carlo` → app → verify test household on Scenarios save or dashboard visit.

**Detail:** [SCHEMA_CHANGELOG.md § ENG-2](./SCHEMA_CHANGELOG.md) · [MASTER_ARCHITECTURE.md § Growth assumptions](./MASTER_ARCHITECTURE.md)

---

## Nav consistency ✅ (2026-05-27)

| Area | Outcome |
|------|---------|
| **Homepage** | `app/(public)/page.tsx` — `PublicNav` + footer (removed inline nav) |
| **Billing** | `app/billing/layout.tsx` + `MinimalAuthNav` |
| **Utility** | `WordmarkOnly` on invite, beneficiary, share, confirm-email, attorney-invite, claim-listing |
| **Unchanged** | Dashboard sidebar, advisor, education, auth login/signup, admin |

**Detail:** [SCHEMA_CHANGELOG.md § Nav consistency](./SCHEMA_CHANGELOG.md) · [MASTER_ARCHITECTURE.md § Layout and Navigation](./MASTER_ARCHITECTURE.md)

---

## Client Summary PDF upgrade ✅ (2026-05-27)

| Area | Outcome |
|------|---------|
| **Consumer PDF** | Navy/gold header, purpose callout, household profile grid, readiness without letter grade |
| **Checklist** | Document Status — Not on file / On file |
| **Export API** | Consumer role receives tax + assets for profile figures |
| **Print page** | Updated card copy + data ownership note |
| **Attorney PDF** | Unchanged |

**Detail:** [SCHEMA_CHANGELOG.md § Client Summary PDF brand upgrade](./SCHEMA_CHANGELOG.md)

---

## Advisor portal — end-to-end workflow ✅ (2026-05-26)

| Step | What the advisor experiences |
|------|------------------------------|
| **Overview** | `PlanStatusCard` plan readiness; critical gaps above the fold with Discussed / Deferred / Resolved |
| **Strategy** | Severity banners → Step 1 Situation → Step 2 Opportunities (**Model this ↓** inline panels) → Step 3 Recommendations & Impact (tax delta) → Strategy Horizon (table + `CompositeOverlay`) → Monte Carlo |
| **Send** | Inline panel → `strategy_line_items` (`source_role='advisor'`) → `router.refresh()` → Step 3 + CompositeOverlay → consumer dashboard panel + Transfer Strategies **Strategy Sandbox** when `illustrative` |
| **Accept** | Consumer `PATCH /api/consumer/strategy-recommendation` or promote own row → **In My Plan** when `probable`/`certain` or accepted; actual horizon set → Estate/Tax via `advisorHorizons.today` (ENG-1) |
| **Other tabs** | Tax, Domicile, Estate, Retirement — proactive alert banners for time-sensitive issues |

No duplicate entry points, no dead-end panels, no tab-hopping required to act.

**Architecture detail:** [MASTER_ARCHITECTURE.md § Advisor portal end-to-end workflow](./MASTER_ARCHITECTURE.md)

---

## Advisor portal UX-5 ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Removed** | Full-width SLAT/ILIT + Advanced panels below three-step workflow |
| **Step 3** | Recommendations & Impact + `StrategyImpactPanel` (Current / Projected / With Accepted) |
| **Horizon** | Renamed Strategy Horizon; section below Step 3; scroll → `#strategy-opportunities` |
| **Impact data** | `outsideCertainProbableTotal + outsideIllustrativeTotal`, `stateTax` from horizons |

**Detail:** [SCHEMA_CHANGELOG.md § UX-5](./SCHEMA_CHANGELOG.md)

---

## Advisor portal UX-5b ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Removed** | `custom` mode, `customStrategies`, "Enter Strategy Reductions" form |
| **Default** | `recommendations` via `/api/advisor/strategy-recommendations-read` |
| **Modes** | `recommendations` \| `30m` \| `100m` |
| **Unchanged** | `StrategyHorizonTable`, archetypes, boundary snapshot, consumer paths |

**Detail:** [SCHEMA_CHANGELOG.md § UX-5b](./SCHEMA_CHANGELOG.md)

---

## Advisor portal ENG-1 ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Audit** | Composition RPC `source_role` limitation documented; strategyMappers actual set confirmed |
| **Estate tab** | Advisor display uses horizon-derived composition override (`horizonComposition`) |
| **Tax tab** | Current-law already horizon-driven; accepted-strategy indicator added |
| **Outside strategy total** | Uses horizon `outsideCertainProbableTotal + outsideIllustrativeTotal` |
| **Consumer path** | `classifyEstateAssets(..., 'consumer')` unchanged |

**Detail:** [SCHEMA_CHANGELOG.md § ENG-1](./SCHEMA_CHANGELOG.md)

---

## Advisor portal UX-4 ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Opportunities** | Per-row expand → `InlineStrategyPanel`; 11-strategy catalog; `isSent` from advisor line items |
| **Mapping** | `catalogToPanel.ts` — `cst` → chip `credit_shelter_trust`; `annual_gifting` catalog id fixed |
| **Recommend** | `onRecommend` → `loadConsumerData()` + `router.refresh()` + collapse row |
| **Below** | Combined Strategy, SLAT/ILIT, Advanced, Monte Carlo unchanged (full-width fallback) |

**Detail:** [SCHEMA_CHANGELOG.md § UX-4](./SCHEMA_CHANGELOG.md)

---

## Advisor portal UX-3 ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Situation** | Six metric cards (+2 when modules run); `●`/`!`/`✓`/`—`; max 2 indicators |
| **Opportunities** | Strategy catalog with relevance highlighting; Run modules CTA |
| **Recommendations** | Pending / accepted / declined; client strategy questions in Step 3 |
| **Below** | Combined Strategy, SLAT/ILIT, Advanced, Monte Carlo unchanged |
| **Flags** | `NEXT_PUBLIC_ADVISOR_BENCHMARKS` off by default |

**Detail:** [SCHEMA_CHANGELOG.md § UX-3](./SCHEMA_CHANGELOG.md)

---

## Advisor tax parity ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Tax tab** | Waterfall uses horizon state tax; survivor-timeline labels on State Tax Detail |
| **MFJ** | `isMFJFilingStatus()` on Strategy, Tax, Domicile, `GET /api/advisor/strategy-tab` |
| **Meeting Prep** | `meetingPrepBriefFromHorizons` (shipped with UX-3) |
| **Follow-up** | Deprecated brackets in `estate-tax-projection` death rows |

**Detail:** [SCHEMA_CHANGELOG.md § Advisor tax parity](./SCHEMA_CHANGELOG.md) · [MASTER_ARCHITECTURE.md § Calculation consistency audit](./MASTER_ARCHITECTURE.md#calculation-consistency-audit-2026-05-26)

---

## Advisor portal UX-2 ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Brand** | Navy header, gold tab underlines, status/complexity badges |
| **Load** | `advisorDatasetIncludeForTab()` — tab-scoped datasets on client workspace |
| **Overview** | `PlanStatusCard`, gap banner, `GapStatusSelector` + `advisor_gap_statuses` |
| **Estate** | Collapsed outside estate when empty; red tax callout; no-transfer amber banner |
| **Strategy** | `getCachedAdvisoryMetrics` (120s); 6-card grid + module CTA; ≤2 warning badges; exemption banner |
| **Migration** | `20260626120000_advisor_gap_statuses.sql` |

**Detail:** [SCHEMA_CHANGELOG.md § UX-2](./SCHEMA_CHANGELOG.md) · [PERF_SPRINT_P1.md § UX-2](./PERF_SPRINT_P1.md#advisor-portal-ux-2--tab-scoped-load--metrics-cache-2026-05-26)

---

## Advisor portal performance ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Roster `/advisor`** | `loadRosterNetWorthByOwner` — 5 batched queries instead of N× `calculate_estate_composition` RPC |
| **Client workspace** | Parallel staleness + composition + datasets; scoped tax rules; non-blocking access log |

**Commit:** `8c526de` · See [PERF_SPRINT_P1.md § Advisor portal](./PERF_SPRINT_P1.md#advisor-portal-quick-wins-2026-05-26).

---

## Active sidebar NAV-1 ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Active match** | `isNavItemActive()` — `usePathname()`; sub-routes via `startsWith`; `/dashboard` exact only |
| **Group expand** | Financial / Retirement / Estate groups auto-open when any child route is active (was collapsed while active → no visible indicator) |
| **Chrome** | `NAV_ACTIVE` — navy fill + `border-l-[color:var(--mwm-gold)]` (Tailwind v4 `color:` prefix) |

**Commit:** `be92947`

---

## Sidebar + onboarding OB-3b ✅ (2026-05-26)

| Area | Outcome |
|------|---------|
| **Dashboard** | Removed `DashboardIntroSection` green checklist; `SetupProgressCard` only |
| **Financial Planning** | All sidebar features tier 1; group exempt from `isLockedUser` |
| **Footer / Security** | Security, My Advisor, Manage Subscription always navigable (not `isLockedUser`) |
| **My Advisor** | Onboarding note when unconnected + wizard incomplete + no pending request |
| **Bugfix** | `getDashboardLayoutContext` — do not select `households.date_of_birth_1` (column does not exist; broke `hasHousehold` for all users) |

**Commits:** `6d2bff3`, `1660f27`, `d50a982` · **Nav map:** [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md)

---

## Superuser sidebar SU-1 ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Layout** | Pass `isSuperuser` to consumer `SidebarNav` |
| **Locks** | `isLockedUser` bypass for superuser, advisor, admin |
| **Advisor Portal** | Visible when `role === 'advisor' \|\| isAdmin \|\| isSuperuser` |

**Commit:** `3c0d28b`

---

## Setup progress OB-3 ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Dashboard** | `SetupProgressCard` — 5-section data-inferred progress; collapses to one line when complete (does not disappear) |
| **API** | `GET /api/consumer/setup-progress` |
| **Wizard gate** | Redirect only when zero assets/income (`shouldRequireWizardOnboarding`); Financial Planning + `/import` exempt |
| **Wizard** | Data-inferred steps, free navigation, **← Back to dashboard** |
| **Import** | Tier 1 upload during onboarding; history/management stays Tier 2+ (UI gate only — no data deletion) |

**Commit:** `3376134` · **Tests:** `tests/unit/wizard-onboarding-gate.spec.ts` (`npx playwright test tests/unit/wizard-onboarding-gate.spec.ts --project=import-unit`)

---

## Design system — Phases 1–3 ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Tokens** | `app/globals.css` — `--mwm-*` + aliases; body off-white |
| **Primitives** | `Button`, `Card`, `SectionHeader`, `form.ts`; `ExportPDFButton` on shared Button |
| **Sidebar** | Navy active fill, gold left accent, gold “M” + Playfair wordmark, YOUR PLAN badge gold/navy |
| **Banner** | `LifeEventBanner` — “Log a life event” gold link (`!text-[color:var(--mwm-gold)]`) |
| **Phase 3** | Indigo sweep across planning pages, retirement/estate, portals — `color:` prefix per `CURSOR_PROMPT_TEMPLATE.md` |

**Commits:** `d173b00`, `249bf85`, `7a1a121`, `a10299b`, `37f3f0a` (+ Phase 2d/2e shell fixes `76dc8b9`, `f58affe`)

---

## Onboarding wizard OB-1 ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Wizard** | `/onboarding/wizard` — extended profile + guided first-data entry |
| **Migration** | `20260526000000_onboarding_wizard_fields.sql` — `onboarding_wizard_completed_at` |
| **Gates** | Layout wizard redirect (superseded by OB-3 `hasAnyData` check) + dashboard setup nudge |

**Commits:** `b1c7b49`, `fd00b69` (remove duplicate wizard name fields)

---

## Tier-aware narrative OB-2 ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Copy** | Profile intro, wizard step previews, setup prompt (→ `SetupProgressCard` in OB-3), `EmptyStateCard`, `UpgradeBanner` tier-aware messaging |

**Commit:** `bccef99`

---

## Advisor flywheel AF-1 ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Consumer** | Transfer Strategies **Ask your advisor about this →** — `POST /api/consumer/ask-advisor` when `advisor_clients` connected; else `/find-advisor` |
| **Advisor** | Client Overview **Client Strategy Questions** card — unread `consumer_strategy_question` notifications; mark read on client workspace load |

**Commit:** `a255616` · **Flow:** [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) Transfer Strategies table

---

## Sprint UX-1 closed ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Public hub** | `/events` — all 24 life events by category; links to `/event/[slug]` |
| **Public nav** | Life Events link; homepage “See all life events →” |
| **Dashboard picker** | `LifeEventBanner` modal — search, relevance ordering, logs `life_events`, → `/event/[slug]/assess` |
| **Logged events list** | “Events you've logged” with Review links below banner |
| **Shared catalog** | `lib/events/catalog.ts` — grouping, filter, relevance sort |

**Commit:** `6fb73e6`

---

## Auth cleanup + deleteUser hardening ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Auth table** | 9 accounts remain — 4 founder + 5 `@mywealthmaps.test` (see test account table below) |
| **Rolobe retirement** | All `@rolobe.resend.app` deleted via `npm run cleanup:rolobe` |
| **FK scan** | `firms`, `firm_members`, `change_log` added to `FK_TABLES_TO_USER` — blocked Auth hard-delete during cleanup |
| **Orphan Auth** | No profile → Auth delete + audit log (no early "Profile not found" return) |
| **Auth delete fallback** | Hard delete → soft delete with warning; monthly check for `deleted_at IS NOT NULL` |
| **Verification** | `npm run verify:deletion -- --email …` — PASS required before WCPA response |
| **Drip verify** | `npm run verify:drip` replaces manual `consumer21@rolobe` inbox check |

**Commits:** `84388ad` (rolobe tooling), `aea4bf6` (deleteUser hardening + verify-deletion), `3cdd9b5` (firms/firm_members/change_log FK scan)

### Auth accounts (production — 2026-05-25)

| Email | Purpose |
|-------|---------|
| avoels@comcast.net | Primary founder |
| avoels@outlook.com | Secondary founder |
| stephen.a.voels@sbcglobal.net | Personal |
| david@gmail.com | Personal |
| e2e-consumer@mywealthmaps.test | E2E consumer tier 3 |
| e2e-consumer-tier1@mywealthmaps.test | E2E consumer tier 1 |
| e2e-advisor@mywealthmaps.test | E2E advisor |
| e2e-attorney@mywealthmaps.test | E2E attorney |
| e2e-client.johnson@mywealthmaps.test | E2E advisor client |

---

## Compliance sprints — all closed ✅ (code complete)

| Sprint | Scope | Commit(s) | Status |
|--------|-------|-----------|--------|
| **C-2b** | UX language audit — 32 findings → 0 | `788aa08` | ✅ |
| **C-3** | RLS fixes (`236890c`); auth callback, MFA, security headers, PII logging (`56a4407`); Monte Carlo UX + docs (`cda2ccc`); audit artifacts gitignored (`d854c05`) | `236890c`, `56a4407`, `cda2ccc`, `d854c05` | ✅ |
| **C-4** | Billing disclosures — RCW 19.316, FTC Negative Option, renewal reminders | `462bda9` | ✅ code — manual Stripe walkthrough remains |
| **C-5** | Privacy Policy (`/privacy`), Terms of Service (`/terms`), footer links, sitemap | `2e1dff3`, `695a860` | ✅ — legal review + TODO placeholders remain |
| **C-6** | WCPA deletion — `deleteUser`, webhook schedule + plan-change guards, cron, admin UI, CLI | `4d9571e`, `01b997a` | ✅ live in prod |
| **C-7** | Compliance cron + `privacy_requests` intake | `ddbf079`, `1ce9110` | ✅ live in prod |

**Audit scripts (must stay 0):** `bash scripts/audit-ux-language.sh` · `bash scripts/security-audit.sh`

---

## Sprint C-6 closed ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Deletion core** | `lib/compliance/deleteUser.ts` — single path for CLI, admin, cron; FK scan; orphan Auth; hard/soft delete fallback; post-deletion verification |
| **Verification CLI** | `npm run verify:deletion -- --email …` — PASS required before WCPA response |
| **Guards** | `deletionGuards.ts` — no schedule on plan change (active Stripe sub) or upgraded role; cron re-check |
| **Webhook** | `customer.subscription.deleted` → 30-day schedule; `subscription.updated` active → cancel pending |
| **Cron** | `GET /api/cron/process-deletions` — 2am UTC (`vercel.json`) |
| **Admin UI** | `/admin` → **Data & Compliance** — schedule, audit log, execute (dry-run default) |
| **CLI** | `npx tsx scripts/gdpr-delete-user.ts --email … [--dry-run]` |
| **Docs** | [COMPLIANCE_CALENDAR.md](./COMPLIANCE_CALENDAR.md) — right-to-delete SOP + monthly checks |

**Commits:** `4d9571e` (infra + guards), `01b997a` (admin UI + CLI)

**Production:** Migrations `20260625120000`, `20260625170000` applied. Crons verified via `https://www.mywealthmaps.com` (apex redirect strips `Authorization`).

---

## Compliance infrastructure — C-6 + C-7 ✅ LIVE (2026-05-25)

| What | How | Status |
|------|-----|--------|
| 30-day post-cancellation deletion | Stripe webhook → `deletion_schedule` → 2am cron | ✅ Live |
| Plan-change guard | Webhook + cron double-check (`deletionGuards.ts`) | ✅ Live |
| Deletion audit trail | `deletion_audit_log` append-only | ✅ Live |
| Admin deletion UI | `/admin` → Data & Compliance | ✅ Live |
| Daily compliance check | 8am cron → `avoels@comcast.net` if issues (`COMPLIANCE_EMAIL`) | ✅ Live |
| WCPA privacy requests | In-app form + 45-day SLA (`privacy_requests`) | ✅ Live |
| Email infrastructure | `hello@`, `noreply@`, `privacy@` → Comcast inbox (Resend verified) | ✅ Live |
| Migration history | **75** timestamped files in `supabase/migrations/`; through `20260625170000` | ✅ Clean |

**Cron manual test:** `curl -sS https://www.mywealthmaps.com/api/cron/compliance-reminders -H "Authorization: Bearer $CRON_SECRET"` → `{"sent":false,"message":"All clear — no email sent"}` when healthy.

---

## Sprint C-7 closed ✅ (2026-05-25)

| Area | Outcome |
|------|---------|
| **Table** | `privacy_requests` — five WCPA rights; `due_at` DEFAULT (+45 days) |
| **Cron** | `GET /api/cron/compliance-reminders` — 8am UTC; emails only on issues or monthly summary (1st) |
| **Consumer** | `/settings/security` → Privacy Rights; confirmation email with reference ID |
| **Admin** | Privacy Requests sub-view; PATCH status via `/api/admin/deletions` |
| **Ops email** | `COMPLIANCE_EMAIL=avoels@comcast.net` in Vercel Production |

**Commits:** `ddbf079`, `1ce9110` (migration `due_at` fix)

---

## Sprint P-1 closed ✅ (2026-06-02)

| Area | Outcome |
|------|---------|
| **Dashboard Promise.all** | Parallelized sequential block — ~200–400ms TTFB improvement |
| **Advisor conflict cache read** | Removed `detectConflicts()` write-on-read on advisor client page |
| **Recompute debounce** | 3s per `householdId` in `triggerEstateHealthRecompute.ts` |
| **Notification count** | Server-fetched in layout; client refresh on panel actions only |
| **next/font** | Self-hosted Playfair Display + DM Sans (no CDN) |
| **Indexes (prod applied)** | `idx_assets_owner_id`, `idx_liabilities_owner_id` |

**Commit:** `5c24160` · **Doc:** [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) · **Diagnostics:** [scripts/perf-diagnostic.sql](../scripts/perf-diagnostic.sql)

---

## Sprint P-2 closed ✅ (2026-06-02)

| Area | Outcome |
|------|---------|
| **Recommendations cache** | `estate_health_scores.recommendations` jsonb; persisted during recompute; dashboard reads cache (no RPC on load) |
| **Projections cache-first** | `loadProjectionData` serves fresh `outputs_s1_first`; skips 11-query load + `computeCompleteProjection` when not stale |
| **Auth dedup** | `getDashboardLayoutContext` via React `cache()` — one profile+household+notifications load per request in layout |

**Commit:** `47a38f3` · **Migration:** `20260602130000_sprint_p2_recommendations_cache.sql` — apply in prod before deploy if not already applied · **Doc:** [PERF_SPRINT_P1.md § Sprint P-2](./PERF_SPRINT_P1.md#sprint-p-2--pre-launch-refactors)

**Remaining post-launch perf:** ~~Materialize `calculate_estate_composition` at recompute~~ — **shipped 2026-05-27** (`estate_composition_cache` + `getCachedComposition`). Apply migration `20260527180000` in prod.

---

## Education nav fix ✅ (2026-06-02)

| Area | Outcome |
|------|---------|
| **Double sticky nav** | Skip marketing `PublicNav`/footer on `/education/*`; education header only |
| **Unpublished modules** | `getEducationModule()` returns null → 404 (was reachable by direct URL) |
| **Decision tree** | Suggested learning paths link to real module URLs |
| **Link validation** | `scripts/validate-education-links.mjs` — run after content changes |

**Commits:** `a138608` (public access), `b41719f` (sidebar link), education nav fix (this session)

**Post-deploy:** `EDUCATION_LINK_BASE_URL=https://mywealthmaps.com node scripts/validate-education-links.mjs`

---

## Sprint F-2 shipped (2026-06-02) — apply migration before deploy

**Migration:** `20260602150000_sprint_f2_import_traceability.sql` — `ingestion_job_id` on assets/liabilities/income/expenses; `header_row_index`, `sheet_name` on `ingestion_jobs`.

**Features:** header row detection, Excel sheet picker, inline row editor, duplicate warnings, post-import deep link, richer aliases, pending job delete.

**Commits:** `9b524aa` (UX), `a344032` (tests + skip-all-duplicates success)

---

## Sprint F-2 tests ✅ (2026-05-25)

| Command | Coverage |
|---------|----------|
| `npm run test:import:unit` | Header detection, sheet list, alias matching (7 passed) |
| `npm run test:import:api` | Preamble parse, broker aliases, inline edit, duplicates, traceability (8 passed; `.env.test`, tier 2+) |

**Fix:** `POST /api/import/commit` returns success when `skip_duplicates` filters every row.

**Fixtures:** `tests/fixtures/import/` (`preamble.csv`, `broker-aliases.csv`, `import-sample.csv`, `two-sheets.xlsx`). Regenerate XLSX: `npx tsx scripts/generate-import-fixtures.ts`.

**Manual (optional):** [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) I.5–I.9 if not running API tests against prod.

---

## Sprint F-1 closed ✅ (2026-06-02) — verified in production

| Area | Outcome |
|------|---------|
| **Parse API** | `POST /api/ingest` — CSV/XLSX only; auto-detect table + field mapping |
| **Commit** | `POST /api/import/commit` — INSERT_COLUMNS allowlist; 4 assets rows smoke-tested |
| **Schema** | `ingestion_jobs` — final 14 columns: `file_name`, `file_type` (NOT NULL); legacy names removed |
| **Tier gating** | All gated pages + sidebar use `hasFeatureAccess` / `FEATURE_TIERS` (`lib/tiers.ts`); pages are authority for minimum tier |
| **Templates** | `public/templates/import-sample*.csv` |

**Commits:** `d3400b1`, `0f8cf2d`, `b5bb0b1`, schema cleanup (this session)

**Smoke passed:** upload `import-sample.csv` → review → commit → `ingestion_jobs.status = committed`; import history correct.

---

## Sprint 17 — remaining (non-code)

| Item | Owner | Blocks open signups? |
|------|-------|----------------------|
| **LEGAL_TODO.md** — replace TODO placeholders (entity name, address, registered agent) | You | **Yes** |
| **Email aliases** — privacy@, security@, legal@ | You | **Yes** |
| **Counsel sign-off** — ToS §10 (disclaimers), §11 (liability cap), §13 (arbitration) | Counsel | **Yes** |
| **Stripe Dashboard** — invoice.upcoming webhook, Customer Portal cancel, receipt emails | You | **Yes** (manual verify) |
| **Stripe production billing** | You | **Yes** |
| **Supabase Auth** — email confirm ON, secure email change ON, min password 12 | You | Go-live day |
| **`PUBLIC_SIGNUP_OPEN=true`** + redeploy | You | Go-live day |
| **Core §1–3 smoke** — fresh email; signup → confirm → login → dashboard | You | Go-live day |
| **Drip step 2 check** | Ops | `npm run verify:drip -- --email e2e-drip@mywealthmaps.test` (day 3+) |

**Counsel handoff:** Send ToS with §10/§11/§13 flagged; ask for **one consolidated redline**. Apply redlines + TODO placeholder find-and-replace in **one final commit** before go-live — see [LEGAL_TODO.md § Counsel handoff](./LEGAL_TODO.md#counsel-handoff--how-to-send-the-tos).

### Go-live gate (exact order)

**Pre-flip (legal + config):** See [LEGAL_TODO.md](./LEGAL_TODO.md) and [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) manual checklist.

**Go-live day:** [LAUNCH_CHECKLIST.md § Opening signups — go-live flip](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip):

1. Supabase Dashboard → email confirmations ON, secure email change ON, min password **12**
2. Verify `/auth/callback` + signup → confirm-email flow on **staging** (code on `main` since `56a4407`)
3. Vercel Production → `PUBLIC_SIGNUP_OPEN=true` → redeploy
4. Core §1–3 smoke on production ([CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md)) with **fresh email**

**Note:** Supabase Auth dashboard switches stay **OFF** until go-live day — test accounts and seed scripts depend on current settings.

---

## Sprint 16 closed ✅

| Area | Outcome |
|------|---------|
| **Sprint C-2b UX Language Audit** | ✅ Complete — all `DISCLAIMER_STRINGS` surfaces wired; `audit-ux-language.sh` 0 findings (`788aa08`) |

**Commits:** `788aa08`

---

## Sprint C-3 closed ✅ (2026-06-02)

| Phase | Outcome | Commits |
|-------|---------|---------|
| **Phase 1 — RLS** | `20260602000000_sprint_c3_rls_fixes.sql` | `236890c` |
| **Phase 1b + Phase 3 — Auth/security** | `/auth/callback`, confirm-email, MFA middleware, security headers, PII logging, welcome route auth | `56a4407` |
| **Docs + Monte Carlo UX** | Master doc sync, Monte Carlo insight strings | `cda2ccc` |
| **Hygiene** | Audit artifacts gitignored | `d854c05` |

---

## Sprint C-4 closed ✅ (code)

| Area | Outcome |
|------|---------|
| **Billing disclosures** | `lib/compliance/billing-disclosures.ts`; pre-checkout on billing/pricing; cancel flow; `invoice.upcoming` renewal reminder | `462bda9` |

**Manual remaining:** Stripe Dashboard config + production walkthrough — [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md)

---

## Sprint C-5 closed ✅ (2026-06-02)

| Area | Outcome |
|------|---------|
| **Privacy Policy** | `/privacy` — WCPA structure; TODO placeholders for entity/address/agent | `2e1dff3`, `695a860` |
| **Terms of Service** | `/terms` — RCW 19.316 billing terms; post-checkout accept at `/terms/accept` | `2e1dff3`, `695a860` |
| **Footer / SEO** | `LegalFooterLinks` on public + dashboard; sitemap + robots | `2e1dff3`, `695a860` |

**Manual remaining:** [LEGAL_TODO.md](./LEGAL_TODO.md)

---

## Sprint 15 closed ✅

| Area | Outcome |
|------|---------|
| **Domain / DNS / SSL** | `mywealthmaps.com` live (2026-05-24) |
| **Vercel Production env vars** | Verified (2026-05-24) |
| **Search Console** | Verified via Cloudflare domain provider; sitemap submitted (2026-05-24) |
| **Resend domain** | `mywealthmaps.com` verified (2026-05-24) |
| **Waitlist mode** | Active on Production (`middleware.ts`, `3ceb125`); Preview enabled (2026-05-24) |
| **Post-cutover smoke §1–3** | Passed on production (2026-05-24) |
| **Sitemap / crawl infra** | Middleware bypass for `/sitemap.xml`, `/robots.txt`, `/_next/`, `/api/` (`73648e5`) |
| **Test account cleanup** | `scripts/cleanup-test-accounts.ts` (`3f732e3`) |
| **Dev workflow** | local → preview → production |

**Commits:** `7afaedb`, `bb9a191`, `3ceb125`, `729d411`, `b97f945`, `3f732e3`, `73648e5`

### Dev deploy workflow (2026-05-24)

1. **Local** — `npm run dev` with `.env.local`
2. **Preview** — push branch → Vercel preview (`estate-planner-gules.vercel.app`); set `WAITLIST_MODE=true` on Preview to match production gating
3. **Production** — merge to `main` → `mywealthmaps.com`; flip `PUBLIC_SIGNUP_OPEN=true` on go-live day per checklist

---

## Sprint 14 closed ✅

| Area | Outcome |
|------|---------|
| **Manual smoke §1–3** | Passed 2026-05-23 |
| **Manual smoke §4–7** | Passed 2026-05-23 |
| **Manual smoke §8, §11** | Passed 2026-05-23 |
| **§9 advisor recommendation** | Skipped — needs linked advisor |
| **§10 Gifting/Strategies/Trusts** | E2E 19/19 confirmed |
| **§2.4 recompute automated** | consumer-core-recompute.spec.ts (`93aa6f5`) |
| **Admin Portal bug** | Fixed `f4e9160` |
| **Asset modal bug** | Fixed `f4e9160` |
| **E2E complete suite** | **280 tests** in 48 files — see [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) · pre-flip [GO_LIVE_E2E.md](./GO_LIVE_E2E.md); staging 2026-05-25: consumer 127 pass / 5 skip; **2026-05-27:** go-live-profile **17 passed** |
| **Commits** | `93aa6f5`, `1e092d7`, `f4e9160` |

### Known staging E2E behaviour (do not lose)

`consumer-strategy-writes` and `dashboard` specs fail under parallel workers on staging — Supabase statement timeouts (`57014`) and `net::ERR_ABORTED`. Always re-run failures with `--workers=1` before treating as regressions. Production DB will not have this contention.

---

## Test account references

| Role | Email | Notes |
|------|-------|-------|
| **Consumer** | `e2e-consumer@mywealthmaps.test` | Estate tier 3 · `npm run seed:e2e` |
| **Consumer tier 1** | `e2e-consumer-tier1@mywealthmaps.test` | Upgrade-banner project |
| **Advisor (Playwright)** | `e2e-advisor@mywealthmaps.test` | Johnson client: `e2e-client.johnson@mywealthmaps.test` |
| **Attorney (portal)** | `e2e-attorney@mywealthmaps.test` | `?aref=e2eatt01` |
| **Referral codes** | `e2eadv01` / `e2eatt01` | Directory listings (no login) |
| *Legacy* | *(retired)* | All `@rolobe.resend.app` removed via `npm run cleanup:rolobe` — [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) |

### Drip smoke (DB verification)

| Email | Notes |
|-------|-------|
| `e2e-drip@mywealthmaps.test` | Capture on `/assess` or homepage; verify with `npm run verify:drip` |

*Historical:* drip was verified via `consumer21@rolobe.resend.app` inbox — replaced by `scripts/verify-drip-sequence.ts`.

### E2E fixture reset (go-live v2 — preferred)

```bash
npm run seed:e2e
# Copy printed block into .env.test (see docs/E2E_TEST_RESET.md)
npm run prune:e2e   # optional before full run
```

Canonical accounts: `e2e-consumer@mywealthmaps.test`, `e2e-advisor@mywealthmaps.test`, `e2e-attorney@mywealthmaps.test` — password `E2eTest!2026Mwm` ([scripts/e2e-test-identities.ts](../scripts/e2e-test-identities.ts)).

Legacy seeds (retire after cutover): `seed-test-attorney.ts`, `seed-test-consumer-estate.ts` — prefer `npm run seed:e2e`.

### Run E2E (always source env first)

```bash
set -a && source .env.local && source .env.test && set +a
npm run test:e2e:complete -- --workers=1
# Or per project:
npm run test:e2e:consumer -- --workers=1
npm run test:e2e:advisor -- --workers=1
npm run test:e2e:public
npm run test:e2e:attorney   # after: npx tsx scripts/seed-test-attorney.ts
npm run test:import:unit
npm run test:import:api
# If failures on staging: re-run with --workers=1 before investigating
npx playwright test [failing spec] --project=consumer --workers=1
```

Full spec index: [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) · [CONSUMER_FLOWS.md §7](./CONSUMER_FLOWS.md#7-e2e-map-living-contracts)

---

## Known limitations (do not lose between sessions)

### Anonymous cross-device attribution

`referral_clicks` has **no `user_id`** — clicks are logged anonymously at event-page visit (`POST /api/referral/track`). Per-user attribution at signup uses `funnel_events` and `profiles.referral_code` / `attorney_referral_code` from sessionStorage.

**Edge case:** Visit with `?ref=` on device A, signup on device B without sessionStorage — weak funnel match. Not a launch blocker.

### Advisor connection status — canonical import

```ts
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
```

Statuses: `active`, `accepted`. Do not hardcode status strings.

### Planning empty-state CTAs (do not regress)

- **`/projections`:** `checkProjectionReadiness()` — targeted empty state or partial chart + `ProfileFieldPrompt`; TIER2 CTAs include `/profile` + `/scenarios`. **`/complete`:** legacy TIER2 profile-only CTAs unchanged.
- **`/my-estate-strategy` (tier 3):** `POST /api/consumer/generate-base-case`
- Do **not** merge TIER2 and TIER3 lists — `lib/planning/planningEmptyState.ts`

### Legal pages vs in-app terms accept

- **Public ToS:** `/terms` — full Terms of Service (Sprint C-5)
- **Post-checkout accept:** `/terms/accept` — same My Wealth Maps ToS as `/terms` via `getCanonicalTerms()` (version `2026-06-02`). Apply migration `20260527120000_sync_terms_app_config_mwm.sql` on remote Supabase to sync `app_config` mirror.
