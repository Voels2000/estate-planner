# DECISION_LOG.md
# My Wealth Maps — Key Decisions and Reasoning
# Last updated: 2026-05-30 (PDF exemption + action-item dedupe)

## PDF tax page exemption aligned with narrative engine (2026-05-30)

**Problem:** PDF page 3 (Tax Analysis) showed **$15M** federal exemption for MFJ households while the cover narrative correctly referenced **~$28M**. Root cause: `exportMappers.ts` read `assumption_snapshot.estate_exemption_individual` (per-person OBBBA $15M) without applying filing status.

**Decision:** `PDFReportData.federalExemption` now uses **`currentFederalExemption(normalizePdfFilingStatus(...))`** — same source as cover copy in `narrativeEngine.ts` ($27.98M MFJ / $13.99M single). Projection tax **amounts** on page 3 still come from scenario `latestOutput`; only the exemption **display** label is unified.

**Duplicate action items:** `dedupeActionItems()` drops second alerts whose normalized title matches the first 20 characters of an earlier item (e.g. duplicate "Large estate without trust" rows in Documents vs Additional recommendations).

---

## PDF export paths unified — narrative engine on all estate reports (2026-05-30)

**Problem:** Narrative engine shipped on `ExportPanel` only. Header **"Prepare for meeting"** and in-tab **"Prepare for Meeting"** modal used legacy one-page brief HTML — advisors saw old output.

**Decision:** One shared server loader (`lib/advisor/loadAdvisorExportWiring.ts`) builds `exportPdfData` for both the client page and print API. **`GET /api/advisor/meeting-prep-pdf/[clientId]?type=report`** returns full narrative PDF via `generatePDFHTML`. **`?type=brief`** keeps the original one-page meeting brief.

**UI:** Client header → **Export estate report** (narrative) + **Meeting brief** (legacy). Meeting Prep tab → **Export estate report (PDF)** link + **Export PDF Report** in `ExportPanel` (same engine).

---

## PDF narrative engine — rule-based report enrichment (2026-05-30)

**Decision:** Add a deterministic, rule-based narrative layer to advisor PDF export — no new tables, no external APIs.

**Engine (`lib/export/narrativeEngine.ts`):** Executive summary (tiered by estate size), tax callout (`clear` / `sunset_risk` / `exposed`), health score trend, enriched action items (dollar impact + next step + owner), gifting capacity bar, theme grouping.

**Data wiring (`lib/export/fetchNarrativePdfFields.ts`):** Six async reads in one **`Promise.all`** — `estate_documents` (trust), `strategy_configs` (irrevocable + gifting), `insurance_policies` (non-ILIT death benefit sum), prior `estate_health_scores` row, `calculate_gifting_summary` RPC. **`sunsetTaxEstimate`** = `max(0, gross − sunsetExempt) × 0.40` with MFJ sunset exempt $14M. **`filingStatus`** normalized from `married_filing_jointly` → `mfj` before all narrative branches.

**Action items:** `household_alerts` selects **`title` + `description`**; fetch maps to **`title`** + **`message`** (not `body` at source). PDF uses enriched **`ActionItem`** from `@/lib/export-wiring`.

**Export path:** `loadAdvisorExportWiringForClient()` → `buildAdvisorExportPayloads` → `generatePDFHTML`. Used by Meeting Prep tab `ExportPanel`, header/API **`?type=report`**, and `page.tsx` when `exportWiring` is on.

**Meeting Prep:** Top 3 open alerts surfaced above Export & Reports (same `actionItems` query as PDF).

**Smoke note:** `sunset_risk` callout requires **`sunsetTaxEstimate > $100K`** — MFJ gross estate **> ~$14.25M**. At exactly $9.3M MFJ, formula yields $0 federal sunset exposure → **`clear`** (state tax may still appear in detail). Verify wiring by confirming `sunsetTaxEstimate` is populated on cover metrics, not by assuming $9.3M always triggers sunset branch.

---

## Advisor Retirement tab — wire projection data + polish (2026-05-30)

**Decision:** Polish advisor **Retirement** tab by wiring three existing data sources server-side in `page.tsx` — no new migrations.

**Data wiring (`page.tsx`, `tab === 'retirement'`):**
- **`scenarioOutputs`** — `YearRow[]` from `projection_scenarios.outputs_s1_first` / `outputs` (loaders now enable `scenario: true` on retirement tab).
- **`advisorSsData`** — `loadSocialSecurityData(supabase, clientId)` (owner id, same as consumer `/social-security`).
- **`advisorRothData`** — `runRothAnalysis()` from `@/lib/calculations/roth-analysis` with federal brackets fetch + `resolveDeduction`; uses **`optimalConversionWindow`**, **`totalLifetimeTaxSavings`**, **`totalConversions`**.

**UI (`RetirementTab.tsx`):** Readiness hero (funds outlast + net worth at retirement from **`net_worth`** / **`income_total`** / **`expenses_total`**); asset mix cards; SS coordination with **`person2.survivorBenefit`** + breakeven from **`person1.scenarios`**; RMD timeline; Roth block (analysis or heuristic); withdrawal sequencing. Kept RMD planning banner + Planning Assumptions.

**Verify:** Alan household — readiness hero · retirement-year snapshot · survivor benefit · Roth window when pre-RMD.

---

## Advisor Estate tab — visual polish (2026-05-30)

**Decision:** Polish advisor **Estate** tab (`EstateTab.tsx` only) using existing props — no new fetches.

**Liquidity hero:** Shown when coverage ratio **&lt; 1.0x**. Liquid total from **`composition.inside_liquid`**, fallback sum of assets with **`liquidity === 'liquid'`**. Tax liability = horizon/composition federal + state estimates.

**Layout:** Two-column grid — left: **`EstateCompositionCard`** (`showMetrics={false}`) + IRS waterfall (replaces redundant Gross/Net/Admin/Taxable pills); right: conflict cards (`description` + `recommended_action`).

**Documents:** Hero alert when critical docs (`will`, `dpoa`, `medical_poa`) not confirmed via **`docMap[type].exists`**.

**Beneficiaries:** Group by linked asset (`asset_id` on raw records when present; single-asset type match fallback); show account name, value, owner, missing-contingent flag.

**Estate flow:** Summary tiles (Financial / RE / Business / Retirement) always visible; full **`EstateFlowDiagram`** behind toggle.

**Accounts:** Six consolidated groups (IRA, 401(k), brokerage, Roth, bank, other) from **`assetAccountType()`** values.

**Unchanged:** Death-sequence toggle, admin expense override, DLOC/DLOM, RE table, insurance, **`BeneficiaryGrantPanel`**.

---

## Advisor strategy tab — visual hierarchy polish (2026-05-30)

**Decision:** Polish advisor **Strategy** tab presentation without new data fetches: alert hierarchy, severity-colored situation cards, illustrative savings on opportunity rows, Monte Carlo empty state, hide composite waterfall when no recommendations.

**Alerts (`StrategyAlertBanners`):** One **primary** red banner for liquidity coverage **&lt; 1.0x**; compact **secondary** amber banners for unused exemption (&lt; 50%) and tight GRAT §7520 margin.

**Situation (`AdvisoryMetricCard` + `SituationMetricsGrid`):** Optional **`severity`** (default `neutral`) drives card/value/status colors; **`getMetricStatusLabel()`** adds short status lines (“Critical — at risk”, “Headroom available”, etc.).

**Opportunities:** **`estimateStrategySavings()`** in `lib/advisor/estimateStrategySavings.ts` — keys match catalog ids (`cst`, `ilit`, `annual_gifting`, `slat`, `grat`, `liquidity`; aliases `bypass_trust` / `credit_shelter_trust` → `cst`). Savings context built in **`StrategyTabContent`** from existing metrics props.

**Composite (`CompositeOverlay`):** Waterfall + summary hidden in **From Recommendations** mode when **`activeRecommendedItems.length === 0`** (avoids “All 0 strategies…” copy).

**Monte Carlo (`MonteCarloPanel`):** Dashed empty state when **`!result && !loading`**, using existing **`simulationCount`**.

**Verify:** Strategy tab — liquidity shortfall primary banner; CST/ILIT rows show emerald savings line; composite empty until a recommendation is sent.

---

## Tax Horizons & Strategy — consumer page polish (2026-05-30)

**Decision:** Polish **`/my-estate-strategy`** layout: readiness as header pill; bypass-trust impact bar; remove embedded completeness/topics; grouped asset summary in estate flow; hide empty what-if tab.

**Readiness:** Remove **`MyEstateStrategyHealthScore`** block; compact pill in page header uses existing **`healthScore`** prop.

**Bypass bar:** **`parseBypassTrustSavings()`** shared with dashboard (`lib/estate/parseBypassTrustSavings.ts`); shown between horizon cards and table when savings &gt; 0.

**Removed from page:** Embedded **`EstatePlanningDashboard`** (Estate Plan Completeness + Common Planning Topics — live on dashboard / estate-tax).

**What-if tab:** Hidden when **`projectedCount === 0`**.

**Estate flow assets:** **`ConsumerEstateFlowView`** — grouped summary tiles + “Show all accounts” expand (Financial / Real estate / Business / Retirement / Insurance / Other).

**Files:** `_my-estate-strategy-client.tsx`, `page.tsx`, `ConsumerEstateFlowView.tsx`

**Commit:** `56762ad`

---

## Roth conversion — methodology note (2026-05-30)

**Decision:** Expand **“How this calculation works”** on **`/roth`** to document projection source, RMD-era target rate, eligibility (both spouses ≥ 60), bracket headroom, combined IRA/401(k) pool, SS simplification, and WhatIf slider vs table engine.

**Commit:** `6cb942a`

---

## Roth conversion — bracket headroom + display context (2026-05-30)

**Decision:** Fix **`runRothAnalysis`** gap-year conversion amounts and **`/roth`** rate display after UI polish regressions.

**Engine (`roth-analysis.ts`):** Headroom must use **`peakRmdFederalRate`** (not combined federal+state) with legacy **`>`** bracket walk. When RMD-era federal marginal is **24%+**, fill through the **22% bracket ceiling** (just under 24% threshold). Previously `>=` against combined rate stopped one bracket early (~$43K–$63K/yr instead of ~$150K–$170K/yr for typical MFJ gap).

**UI (`_roth-client.tsx`):** **`pickRothConversionDisplayContext()`** — insight + **`WhatIfPanel`** use first **conversion-window row** marginal (retirement gap ~10–12%), not **`rows[0]`** (often still working-year rate).

**Tests:** `tests/unit/roth-analysis.spec.ts` (`import-unit` project).

**Verify:** Alan/Cathi pre-RMD gap — emerald rows with conversions to top of 22% bracket; insight shows low current % vs ~24% projected RMD.

**Commit:** `cae89fc`

---

## Three-state dashboard progression (2026-05-30)

**Decision:** Three display states on **`/dashboard`**, driven by data completeness:

| State | Condition | Hero |
|-------|-----------|------|
| 1 | `foundationScore < 60` OR wizard incomplete OR no household data | **`DashboardOnramp`** (early return in `page.tsx`) |
| 2 | Past onramp AND both taxes $0 AND no estate-plan signals | Net worth hero + financial metrics + amber estate-unlock prompt |
| 3 | Past onramp AND (`estimatedTaxState/Federal > 0` OR `hasEstatePlanData`) | Tax exposure hero + consolidated alerts + readiness strip (Alan layout unchanged) |

**`hasEstatePlanData`:** beneficiary conflicts, any health-score component score &gt; 0, or execution checklist rows.

**Files:** `determinePlanStage.ts` (`getDashboardState`), `dashboard/_dashboard-body.tsx`, `_dashboard-client.tsx`, `DashboardIntroSection.tsx`, `FinancialSummarySection.tsx`

**Verify:** State 2 user — net worth hero, no tax hero, no readiness strip. Alan — State 3 unchanged. **Commit:** `b71af63`

---

## Dashboard — remove asset allocation card from Financial Summary (2026-05-30)

**Decision:** Remove **`AssetAllocationSummary`** from the **`FinancialSummarySection`** collapsible on **`/dashboard`**. Full allocation editing, benchmarks, and portfolio breakdown remain on **`/allocation`** via **`loadAssetAllocationData`**. **`buildAllocationContext`** stays in **`lib/dashboard/mappers.ts`** for reuse; dashboard no longer builds or passes allocation context on load.

**Reasoning:** Duplicate surface — users with tier 2+ access use the dedicated Asset Allocation route; the dashboard card added scroll without unique actions.

**Files:** `FinancialSummarySection.tsx`, `_dashboard-client.tsx`, `dashboard/_dashboard-body.tsx`

**Verify:** `/dashboard` Financial Summary shows net worth, by-source bars, income/expense/savings/debt cards only — no allocation donut or target mix.

---

## Consolidated dashboard alert panel (2026-05-30)

**Decision:** Replace scattered dashboard alerts (intro pills, bypass blue card, succession banner, checklist red flags) with one **`ConsolidatedAlertPanel`**. Alert detection uses **`conflict_type`**, **`estateHealthScore.components`** keys (`documents`, `incapacity`, `beneficiaries`), and **`successionGap`** — not fragile description substring matching alone. Compliant copy defers to advisors/attorneys; disclaimer renders **after** all alert rows.

**Files:** `_dashboard-client.tsx`, `DashboardIntroSection.tsx`, `EstateExecutionChecklist.tsx` (`deemphasizeFlagged`)

---

**Decision:** When **`projectedRmdPct <= currentRatePct`**, **`WhatIfPanel`** must not show stuck **$0** / **"—"** cells. Use signed **`lifetimeNetBenefit`** (label **Lifetime extra cost** when negative), **"Delay is better"** instead of break-even dash, and slider-reactive **`iraBalanceAtRmd`** via simplified conversion impact. Title: **"(delay is optimal)"**. Local **`fmtPanel`** inside **`WhatIfPanel`** only — top-level **`fmt()`** unchanged.

**Reasoning:** Slider was never broken; **`rateDiff = max(0, …)`** hid the “converting now costs more” message. Alan (24% current vs 22% projected): **$12K** tax at $50K/yr, **−$15K** lifetime extra cost, IRA at RMD drops with slider.

**Files:** `app/(dashboard)/roth/_roth-client.tsx` — **`WhatIfPanel` only**

---

## Estate Tax Snapshot — interactive strategy panel (2026-05-30)

**Decision:** Replace static **`EstateCompositionCard`** on **`/estate-tax`** with interactive composition waterfall + toggleable strategy panel. Asset rows use composition fields (`inside_financial`, `inside_real_estate`, `inside_business_gross`, `inside_insurance`). Strategy panel hidden when both state and federal estimated tax are $0. **`getStrategyDescription`** is module-level (not in component). Entitled path: separate **`getCachedComposition`** + **`strategy_line_items`** fetch in `page.tsx`.

**Files:** `_estate-tax-client.tsx`, `estate-tax/page.tsx`, `sidebar-nav.tsx`

---

## Script A — readiness pill + allocation connections (2026-05-30)

**Decision:** Surface **`estateHealthScore.score`** as compact pill on the same flex row as conflict pills in **`DashboardIntroSection`**. Keep full **`EstateHealthScoreBlock`** in **`EstateSummarySection`**. On **`/allocation`**, downstream note to Projections + Monte Carlo after save.

**Files:** `DashboardIntroSection.tsx`, `_dashboard-client.tsx`, `allocation/_allocation-client.tsx`

---

## Dashboard — single conflict alert location (2026-05-30)

**Decision:** Remove the **middle dismissible conflict banner** from `_dashboard-client.tsx` (full-width red/amber block with description + “See details ↓” between checklist grid and persona alerts). Keep **one** above-the-fold surface: severity pill chips in **`DashboardIntroSection`** (🚨 critical / ⚠️ warnings + “See details →”). Titling badges in **`EstateSummarySection`** collapsible unchanged.

**Reasoning:** Duplicate critical/warning messaging in intro pills and mid-page banner added noise without new information.

**Files:** `_dashboard-client.tsx`

**Verify:** Household with conflicts — pills under greeting only; no second banner mid-page.

---

## Dashboard cleanup — bypass trust alert (2026-05-30)

**Decision:** Remove **Common Planning Topics** from dashboard estate summary. **Titling & Beneficiary Conflicts** shows badge pills + link to `/titling` only — **`criticalCount` / `warningCount`** from **`conflictReport`** preserved. Surface **bypass trust** savings as blue alert in **`EstateSummaryHeroAndMetrics.afterMetrics`** (after four metric tiles, before checklist/tax snapshot grid). Savings via **`parseBypassTrustSavings`**: primary match `by $…` in `bypass_trust` RPC reason; fallback last `$` in reason; then `(grossEstate − stateExemption) × 0.10`.

**Files:** `_dashboard-client.tsx`, `EstateSummarySection.tsx`, `EstateCalloutCard.tsx`

**Verify:** Alan — reason parses **$645,463**; alert sits between metric tiles and two-column grid.

---

## RMD Calculator page polish (2026-05-30)

**Decision:** Polish `/rmd` client UI only (`_rmd-client.tsx`): hero lifetime/peak stats above status cards; status cards with years-away/active badges; standardized accounts grid with per-person totals; tax impact callout; decade navigator wired to existing **`periodOffset`** pagination; inflection row highlights (P1 start blue, P2 start emerald, peak amber) + legend. Full projection array is **`rows`** (sliced to `visibleRows`); peak/first-RMD years computed from `rows`, not the visible page.

**Reasoning:** No marginal rate in RMD page props — tax callout uses **28% blended** estimate. Account grids use **`grid-cols-1 sm:grid-cols-3`** for long account names on mobile. Decade buttons call same **`goToPage(i)`** as Prev/Next.

**Files:** `app/(dashboard)/rmd/_rmd-client.tsx`

**Verify:** Decade navigator active state `i === periodOffset`; clicking segment updates visible rows.

---

## Social Security page polish — SVG cumulative chart (2026-05-30)

**Decision:** Polish `/social-security` client UI only (`_ss-client.tsx`): hero elected cards, insight card (replaces recommendation paragraph), cumulative **SVG** line chart (3 scenarios), claiming tables with relative bar column. Chart uses existing `cumulativeByAge: { age, cumulative }[]` from `loadSocialSecurityData` — calendar-age lookup, not `cumulative_by_year` index padding. Breakeven age computed by comparing elected vs FRA cumulative at matching ages. Spousal & Survivor Strategy section below tables unchanged.

**Reasoning:** No Chart.js in project; `cumulativeByAge` already aligns scenarios on calendar age (age-62 line highest early, FRA crosses later, elected crosses FRA when delay pays off). Insight survivor stat reads `person2.survivorBenefit` (not a separate spousal object).

**Files:** `app/(dashboard)/social-security/_ss-client.tsx`

**Verify:** Alan household — survivor $4,888/mo; elected vs FRA breakeven age 84 at 2.5% COLA / longevity 90.

---

## Dashboard estate summary consolidate (2026-05-30)

**Decision:** Replace beige `EstateCalloutCard` with **`EstateSummaryHeroAndMetrics`** (full-width tax hero + four metric tiles) and **`EstateTaxSnapshotPanel`** in a **`sm:grid-cols-2`** grid beside **`EstateExecutionChecklist`**. Hero is **red** when `estimatedTaxState > 0`, **amber** when federal-only. Greeting subtitle includes `state_primary`; alert pills stay compact. **`EstateSummarySection`** (readiness, planning gaps, titling) unchanged below Financial/Retirement.

**Files:** `_dashboard-client.tsx`, `EstateCalloutCard.tsx`, `DashboardIntroSection.tsx` · **Commit:** `deb0080`

---

## State exemption on dashboard tax snapshot (2026-05-30)

**Decision:** Fetch `state_estate_tax_rules` (current year + `state_primary`) in **`dashboard/_dashboard-body.tsx`** inside existing **`Promise.all`** — not a sequential query. Add **`no_portability`** column on `state_estate_tax_rules` (WA/MA/OR true); dashboard shows exemption, portability note, state taxable estate (gross − exemption), state tax. WA 2025+ exemption data corrected to **$3M** in migration.

**Migration:** `20260630110000_state_estate_tax_rules_no_portability.sql` · **Commit:** `0686f52` · **Prod:** `supabase db push` before deploy

---

## Onboarding wizard — 6 steps (2026-05-29)

**Decision:** Expand `/onboarding/wizard` from 3 to **6 steps**: assets → income → liabilities → expenses → insurance → advisor invite. Steps 3–5 optional (**Skip for now**); steps 1–2 required (no skip). Insurance saves via **`POST /api/insurance`** (not under `/api/consumer/`). **`guidedOnboardingHref`** — core complete = all five data sections have rows; wizard page redirect uses same gate.

**Files:** `_wizard-client.tsx`, `guidedOnboardingHref.ts`, `guided-onboarding-href.spec.ts` (11 tests)

**Verify:** Fresh user — 6 step indicator; skip on 3–5 only; step 5 hits `/api/insurance`

---

## Onramp guided path — wizard backfill bounce fix (2026-05-29)

**Decision:** (1) **`resolveGuidedOnboardingHref()`** — resume wizard when any of assets/income/liabilities/expenses/insurance missing after backfill; all five present → `/dashboard`. (2) **Wizard page** redirects only when wizard complete **and** all five sections have data. (3) Persona/wizard profile gates pass **`from=`** on required profile redirect.

**Reasoning:** Onramp stays visible when score &lt; 60 even after `onboarding_wizard_completed_at` is set (import backfill). Old logic linked Guide → `/onboarding/wizard` → instant redirect to `/dashboard` — felt broken.

**Files:** `lib/dashboard/guidedOnboardingHref.ts`, `app/(dashboard)/dashboard/page.tsx`, `onboarding/wizard/page.tsx`, `onboarding/persona/page.tsx`, `tests/unit/guided-onboarding-href.spec.ts`

**Verify:** `npx playwright test tests/unit/guided-onboarding-href.spec.ts --project=import-unit` · import then Guide → wizard step 2 (income), not dashboard bounce

---

## Import upload page — formats first, templates above drop zone (2026-05-29)

**Decision:** On `/import` upload step, show **`SupportedFormats`** (broker CSV, multi-sheet Excel, single-table CSV) first, then persona + single-table CSV template download blocks, then the drop zone. **`DashboardOnramp`** import card copy names broker exports, Excel, and CSV explicitly; format hint line under the card.

**Reasoning:** Drop zone first implied users must already have a file. Broker-export users never saw that they can upload Schwab/Fidelity/Vanguard CSV as-is; template seekers scrolled past the drop zone to find downloads.

**Files:** `app/(dashboard)/import/_SupportedFormats.tsx`, `_import-client.tsx`, `components/dashboard/DashboardOnramp.tsx`

**Manual verify:** `/import` — SupportedFormats visible without scroll; templates above drop zone; onramp import card shows format hint.

---

## Onramp guided path and wizard gate exemption (2026-05-30)

**Decision:** (1) `DashboardOnramp` **guided** link uses dynamic `guidedHref`: `/onboarding/persona` when `onboarding_persona` is null, else `/onboarding/wizard` — wizard page redirects to persona if skipped. (2) Add **`/dashboard`** to `wizardGateExemptPrefixes` so `WizardOnboardingGate` does not auto-redirect consumers away from the onramp before they choose Import / Guide / Self.

**Reasoning:** Linking Guide directly to `/onboarding/wizard` bounced users to persona (“What describes you?”) — felt like a loop. Layout client gate also hijacked `/dashboard` to wizard, preventing path choice.

**Manual verify:** Fresh user — Import → `/import`; Guide → persona → wizard; Self → `/assets`.

---

## Dashboard onramp for incomplete users (2026-05-30)

**Decision:** Show a lightweight `/dashboard` onramp (`DashboardOnramp`) instead of the full dashboard body when any gate fails: wizard not complete, `estate_health_scores.score` &lt; 60, or no assets/income.

**Reasoning:** Full dashboard SSR is heavy and shows empty/misleading estate figures for sparse accounts. Onramp offers three entry paths (import, wizard, manual assets) without loading `DashboardBody`.

**Gate:** `lib/dashboard/onrampGate.ts` — `ONRAMP_SCORE_THRESHOLD = 60` (single knob). **E2E:** golden-path seed calls `ensureMinEstateHealthScore(householdId, 60)` so `npm run test:e2e:golden-path` still sees `PlanProgressBar`, not onramp.

**Verify:** `npx tsx scripts/check-golden-path-onramp-gate.ts`

---

## Card component forwards div props for interactive tiles (2026-05-30)

**Decision:** Extend `components/ui/Card.tsx` with `ComponentPropsWithoutRef<'div'>` and spread `{...rest}` onto the root `<div>` so callers can pass `aria-pressed`, `role`, `tabIndex`, and other native div attributes.

**Reasoning:** Persona onboarding (`_persona-client.tsx`) sets `aria-pressed={isSelected}` on `<Card>` for toggle semantics, but the previous `Card` implementation dropped unknown props — `aria-pressed` never reached the DOM. Playwright could not assert selection state; clicking the inner `h2` was unreliable for tests targeting the interactive wrapper.

**Also shipped:** `onboarding-persona.spec.ts` clicks `page.locator('[aria-pressed]').filter({ hasText: … })`, asserts `aria-pressed="true"`, waits for `PATCH /api/consumer/profile` before navigation.

**Verify:** `npm run test:e2e:cross-role` — persona spec in bundle (12 tests).

---

## Prod API route slug conflict fix (2026-05-30)

**Decision:** Move household document list from `/api/documents/[household_id]` to `/api/documents/household/[household_id]` so it no longer collides with `/api/documents/[id]/status` at the same dynamic segment depth.

**Reasoning:** Next.js 16 on Vercel silently failed to initialize all App Router route handlers when sibling dynamic segments used different param names (`household_id` vs `id`). Pages (SSR) worked; every existing `/api/*` handler hung with 0 bytes. Build passed with no error; `getSortedRoutes()` catches it locally.

**Also shipped:** `lib/supabase/routeAuth.ts` (`getSession()` for route handlers); `GET /api/health` liveness probe; middleware matcher excludes `/api/` from Edge auth (auth per route handler).

**Commit:** `af12ff0`. **Verify:** `npm run test:e2e:security-smoke` — 7/7 on prod 2026-05-30.

---

## RPC household access guards + attorney RLS + edge auth (2026-05-29)

**Decision:** Close remaining audit follow-ups with DB and edge-layer enforcement — not app-only patches.

**RPC guards:** `assert_household_caller_access(p_household_id)` in Postgres; called at top of `calculate_estate_composition`, `calculate_gifting_summary`, and `generate_estate_recommendations`. Allows household owner, connected advisor (`advisor_clients.client_id = owner_id`), or connected attorney (`attorney_clients.client_id = household_id` via `attorney_listings.profile_id`). `service_role` bypasses for recompute cron.

**Attorney RLS:** Policies rewritten — `attorney_clients.attorney_id` is `attorney_listings.id` (not `auth.uid()`); `client_id` is `households.id`. Fixed `legal_documents` and `document_download_log` attorney policies to join through listing.

**Monte Carlo edge:** `estate-monte-carlo` validates JWT, checks owner or connected advisor, then persists with service role only after access check.

**Rate limits:** `lib/api/simpleRateLimit.ts` — 60 req/min per IP on `/api/referral/track`; 120 req/min + auth required on `/api/telemetry/horizon-input-missing`.

**Migrations:** `20260629120000_rpc_household_access_guards.sql`, `20260629130000_attorney_rls_policy_fix.sql`. **Deploy:** `supabase db push` + `supabase functions deploy estate-monte-carlo`.

---

## Security hardening — internal email routes and household access (2026-05-29)

**Decision:** Server-only email notify routes (`/api/email/advisor-notify`, `attorney-notify`, `attorney-invite`) require `x-internal-key: INTERNAL_API_KEY`. HTML in emails escaped via shared `escapeHtml()`; attorney invite `signupUrl` must match app origin.

**Household IDOR:** `assertHouseholdAccess()` added — owner or connected advisor required before RPC reads on `gifting-summary`, `estate-composition`, `strategy-configs`, `export-estate-plan`.

**Other:** Signed unsubscribe tokens (HMAC via `CRON_SECRET`); Resend inbound webhook requires cron/internal auth; `debug-tier` hidden in production; invite accept validates invited email; referral signup notify requires authenticated user with matching profile referral code; projection/run no longer accepts bare service-role Bearer without internal key header.

---

## Health score narrative + advisor first-client playbook (2026-05-29)

**Decision:** Unify health score display language across consumer and advisor surfaces; add in-product first-client activation without new DB tables.

**Track 1 — Score narrative:** `HealthScoreBadge` is the single display component. Canonical labels: Strong (75+) / Needs Attention (50–74) / At Risk (0–49). `scoreContextSentence()` on consumer surfaces; `scoreContextSentenceForAdvisor()` on advisor surfaces. Stale indicator when `computed_at` > 30 days. **Score calculation in `computeEstateHealthScore` unchanged.**

**Track 2 — Advisor playbook:** Empty state offers intake, invite, prospect (lowest friction first). First-client 3-step panel persisted in `localStorage` keyed by advisor ID — not a compliance record. Steps auto-complete on client view mount, strategy tab mount, and recommendation send. `first_client_connected` notification via existing `create_notification` RPC when advisor has exactly one active client. "Needs attention" uses existing `healthScoreMap` and `alertCountsMap` — no new queries.

---

## Professional Acquisition & Activation — intake, referral impact, meeting prep (2026-05-29)

**Decision:** Three independent acquisition/retention tracks — attorney intake invitations, advisor referral feedback loop, advisor meeting prep print export.

**Track 1 — Intake:** `attorney_intake_requests` table; attorney sends Resend email with `/intake/[token]`; consumer signup/login stores token; auto-grant attorney access on profile save; free tier 5 requests/month server-side.

**Track 2 — Referral impact:** Clicks from `referral_clicks.created_at` (not `clicked_at`); signups from `funnel_events` where `event_name = account_created` and matching `referral_code` — **not** `referral_clicks.user_id` (column does not exist). Advisor notified on attributed signup.

**Track 3 — Meeting prep:** HTML route + `window.print()` after 500ms — intentional, no PDF library dependency.

**Migration:** `20260530_attorney_intake_requests.sql`.

---

## Persona-based onboarding — routing only, not feature gates (2026-05-29)

**Decision:** Add a single "What describes you?" screen immediately after slim profile save. Answer stored on `profiles.onboarding_persona` drives first-run copy (wizard step 1, recommended import template, dashboard insight card) — **does not gate features or billing**.

**Four personas:** `business_owner`, `real_estate`, `executive`, `accumulator` — cover $2M–$30M target segment.

**Locked:**
- `persona_set_at` set once on first answer; immutable even if user changes selection later (analytics anchor).
- Sidebar navigation away from persona screen → implicit skip sets `accumulator` (most neutral fallback).
- `PersonaInsightCard` — 7-day first-run only (account `created_at`); dismiss via sessionStorage.
- Wizard enforces persona before step 1; existing users with NULL persona see screen on next wizard visit.

**Config:** `lib/onboarding/personaConfig.ts` — single source for wizard copy, first asset type, import template, dashboard emphasis.

**Migration:** `20260530_onboarding_persona.sql`.

---

## Attorney Stripe checkout + upgrade prompts + drip (2026-05-29)

**Decision:** Wire attorney monetization in three layers: (1) `POST /api/stripe/attorney-checkout` + webhook `attorney_tier` from price ID; (2) `AttorneyUpgradePrompt` at client cap, PDF export, and doc-health dashboard gates; (3) 3-step attorney onboarding drip mirroring advisor activation pattern.

**Stripe:** Checkout route returns **503** when `STRIPE_PRICE_ATTORNEY_*` env vars are unset (`TODO_*` placeholders). **Products/prices still created manually** in Stripe Dashboard before go-live.

**Gating UX:**
- Free tier at **3 active clients** → upgrade prompt on dashboard; **403** from `grant-access` and `accept-request` when at cap.
- Tier 0 → blurred doc-health preview + upgrade overlay (not hidden entirely).
- PDF export → `AttorneyUpgradePrompt` instead of plain text link.

**Drip:** Step 1 on attorney signup callback, claim-listing, and portal page visit; steps 2–3 via `GET /api/cron/notifications` → `POST /api/email/attorney-drip`. Columns: `attorney_drip_step_*_sent_at` on `profiles`. BCC `avoels@comcast.net` on sends (matches attorney-notify). **Cron timing:** step 2 when step 1 sent ≥3 days ago; step 3 when step 1 sent ≥7 days ago (mirrors advisor drip — not `created_at`). **Post-ship:** manual SQL verification ~3 days after first real attorney — see [NEXT_SESSION.md § Queued next](./NEXT_SESSION.md#queued-next-post-ship-ops).

**Deferred (low priority):** Dashboard nudge when `checkProjectionReadiness().canShowPartial` — revisit after ~2 weeks of traffic ([ROADMAP.md backlog](./ROADMAP.md)).

---

## Projections readiness vs inline profile prompts (2026-05-29)

**Decision:** Replace binary `projections.length === 0` empty state with `checkProjectionReadiness()` — requires birth year, retirement age, and (assets **or** income). When financial data exists but age fields are missing, show **`ProfileFieldPrompt`** above chart output (partial view), not a blocking empty state.

**Reasoning:** Users who filled retirement/longevity via `/scenarios` prompts still hit generic “Complete your profile” on `/projections`. Readiness is server-computed on each render; scenarios PATCH persists to DB — the bug was the empty-state condition, not cache staleness.

**`/complete` unchanged:** Still uses legacy TIER2 empty CTAs; projections-only fix in this sprint.

**Deferred:** Dashboard card when `canShowPartial` (user has assets/income but missing age fields) — low priority; see ROADMAP backlog and NEXT_SESSION § Queued next.

**Tests:** `tests/unit/projectionReadiness.spec.ts` (5 cases); `PLANNING_MISSING_PROJECTION_ACTIONS_TIER2` adds `/scenarios` link (profile + scenarios, not merged with TIER3).

---

## Attorney tier model — B2B2C (2026-05-29)

**Decision:** Add `profiles.attorney_tier` (0 = free read-only, 1 = Attorney Starter, 2 = Attorney Growth). Same adoption pattern as advisor B2B2C: free tier for trial access, paid tiers for practice-level features.

**Gating:**
- **Tier 0 (free):** Up to **3 client households** visible; document vault read/upload; **no** intake summary PDF export; **no** multi-client doc health dashboard (blurred preview + upgrade prompt as of monetization sprint).
- **Tier 1+:** Intake summary PDF (`ExportPDFButton` attorney variant); Document Gaps card; multi-client doc health table on attorney home; higher client caps (15 / 50 per `lib/attorney/attorneyTierLimits.ts`).

**Stripe:** Checkout wired (`/api/stripe/attorney-checkout`); webhook sets `attorney_tier`. **Manual step:** create products/prices and set `STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY` + `STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY` in Vercel.

**Connection lookup fix:** `attorney_clients.attorney_id` stores `attorney_listings.id` (not `auth.uid()`). Portal APIs and client detail page updated to resolve listing by `profile_id` first.

**Docs:** [SPRINT_IMPORT_ATTORNEY.md](./SPRINT_IMPORT_ATTORNEY.md), migrations `20260529120000_sprint_import_attorney.sql`, `20260529130000_attorney_drip_columns.sql`.

---

## Import expansion — normalization + multi-sheet (2026-05-29)

**Decision:** Extend Sprint F-1/F-2 import with type normalization at commit, multi-sheet Excel orchestration, persona workbooks, `real_estate` as fifth import target, and import-first onboarding fork on wizard step 1.

**Reasoning:** HNW users ($2M–$30M) often arrive with Excel workbooks; single-table-per-upload and raw type strings were the main remaining friction after Tier 1 import unlock.

**Locked UX:**
- Human-readable spreadsheet labels map to canonical slugs via `lib/import/type-normalizer.ts` (review UI shows amber "Mapped to …" + override dropdown).
- Multi-sheet workbooks: per-sheet tabs, single **Commit All** with progress.
- Onboarding: primary CTA "Upload a spreadsheet" → `/import?onboarding=true` → `/dashboard?setup=imported` toast after commit.

**Docs:** [SPRINT_IMPORT_ATTORNEY.md](./SPRINT_IMPORT_ATTORNEY.md), [CONSUMER_FLOWS.md § Bulk import](./CONSUMER_FLOWS.md).

---

## Partial PATCH merge on profile API (2026-05-27)

**Decision:** `PATCH /api/consumer/profile` merges incoming partial bodies with the user's existing household payload (`loadProfileSavePayloadForUser` + `mergeProfilePatch`) before validation and `buildHouseholdRow`. Inline `ProfileFieldPrompt` sends only the fields in the prompt plus `householdId`.

**Reasoning:** Sprint assumed pass-through from `buildHouseholdPayload` alone; without merge, partial PATCH fails validation ("Your name is required…"). Merge keeps full-profile saves unchanged while enabling deferred-field prompts on `/social-security` and `/scenarios`.

**Deduction prompt:** `needsDeductionMode()` is true only when `deduction_mode` is null/unset — explicit `standard` is a user choice and must not re-prompt.

**Verification:** `consumer-profile-save.spec.ts` (3 partial PATCH shapes) + `consumer-profile-field-prompt.spec.ts` (UI save/dismiss/deduction/PIA). Pre-flip bundle: `npm run test:e2e:go-live-profile` — [GO_LIVE_E2E.md](./GO_LIVE_E2E.md).

---

## Import at Tier 1 — intentional (2026-05-27)

**Decision:** Lower `FEATURE_TIERS.import` from **2 → 1** so all Financial-tier consumers can upload and commit CSV/XLSX without upgrading. Import **job history** UI remains Tier 2+ (`showImportHistory` on `/import`).

**Reasoning:** Spreadsheet import is the fastest onboarding path for HNW users (business owners, executives). Gating upload behind Tier 2 added friction without protecting revenue — import depth is a retention feature, not a paywall. Prior onboarding-only bypass (`allowOnboardingImport`) was inconsistent with `POST /api/ingest` tier checks.

**Audit trail:** `lib/tiers.ts` (inline comment), `tests/e2e/consumer/consumer-import-access.spec.ts`, `docs/CONSUMER_NAV_MAP.md`, `docs/SPRINT_FRICTION_REDUCTION.md`.

---

## Advisor billing handoff — automated on connect (2026-05-27)

**Decision:** Centralize consumer billing transfer when an advisor connection activates in `lib/advisor/applyAdvisorConnectionBilling.ts`. Called from invite accept, link-pending fallback, and advisor accept-request.

**Behavior:** Sets `consumer_tier = 3`, `subscription_status = 'advisor_managed'`, `subscription_plan = 'advisor_managed'`, records `previous_consumer_tier` on `advisor_clients`, and sets Stripe `cancel_at_period_end` when an active subscription exists.

**Invite completion:** Signup with `?invite=` uses `emailRedirectTo` → `/auth/callback?next=/invite/{token}`. Immediate session redirects to invite page. Dashboard mount calls `POST /api/advisor/link-pending` as email-confirmation fallback.

**Consumer-initiated connect:** `POST /api/consumer/invite-advisor` replaces mailto on onboarding and `/my-advisor`. Registered advisors get `consumer_requested` + in-app notification; unregistered advisors get Resend email with `/signup?role=advisor&connect={token}` → `/advisor/connect/[token]`. Migration `20260527140000` allows nullable `advisor_id` for pre-registration invites.

**P1 (2026-05-27):** `restoreConsumerBillingOnDisconnect` on consumer disconnect + advisor remove-client; seat limits via `advisorClientLimits.ts`; advisor empty-state + first-connection playbook; consumer `AdvisorConnectedBanner`; meeting prep email via `POST /api/advisor/share-meeting-prep`. Stripe firm products still manual — see LAUNCH_CHECKLIST § Stripe Advisor & B2B2C.

**Advisor activation + positioning (2026-05-27):** Three-step advisor drip on `profiles.advisor_drip_*` columns; `AdvisorValuePropBanner` on `/advisor` frames MWM vs PDF-first portals (eMoney-class) and B2B2C client dashboard value.

---

## Advisor Billing — Deferred to post-launch (2026-05-28)

**Decision:** No Stripe advisor products at launch. First advisors onboarded and billed manually. Advisor-connected consumers get Tier 3 via existing `getUserAccess()` `advisor_clients` check.

**What already works (no code needed):**
- `advisor_clients` connected status → automatic Tier 3 on all API/page gates
- `subscription_status = 'advisor_managed'` → Tier 3 treatment
- `isAdvisor = true` → all features unlocked in advisor portal

**What was fixed this sprint:**
- `_dashboard-body.tsx` now uses `getUserAccess().tier` (not raw `consumer_tier`) so advisor-connected consumers see correct Stage 3 dashboard behavior

**Manual process at launch:**
- Set `profiles.role = 'advisor'` for advisor accounts
- Invoice advisors directly
- Pause consumer Stripe subscription manually when advisor takes them on
- Set `subscription_status = 'advisor_managed'` in Supabase

**Recommended advisor pricing for launch conversations:**
- 1–10 clients: $149/mo
- 11–50 clients: $349/mo
- 50+: custom / enterprise

**Post-launch scope (Advisor adoption package):**
- Stripe products for advisor tiers
- Automated subscription pause/resume on advisor connect/disconnect
- Seat count enforcement
- Advisor billing portal

**Rationale for deferral:**
First advisor cohort is small and high-touch. Manual billing gives flexibility to experiment with pricing before committing to Stripe product structures. Advisor connection already grants correct access — billing automation is an ops improvement, not a blocker.

---

## Pricing — Sprint 4 (2026-05-28)

**Decision:** $29/$79/$149/mo (monthly) with $290/$790/$1,490/yr (annual, 2 months free). 14-day free trial on Estate tier (Tier 3) only.

**Context:** Pricing was never live — clean slate, no grandfathering needed.

**Rationale:**
- Previous $9/$19/$34 signaled consumer budgeting app, not professional planning infrastructure. Target segment ($2M–$30M) pays $5K–$50K/yr in attorney fees.
- $149/mo annual cost ($1,788) = 3–6% of a single estate attorney engagement. This is a price point the segment can justify and that signals professional value.
- Trial on Tier 3 only: the estate tax snapshot and execution checklist are the product's core value proof. 14 days is enough to see a personalized tax number and complete 2–3 checklist items. Tier 1 at $29 is low enough friction that a trial adds complexity without benefit.
- Annual option: 2 months free (16.7% discount). Improves cash flow, reduces monthly churn, gives a pricing anchor for the monthly option.

**Alternatives considered:**
- $49/$99/$199: Higher signal but may reduce trial conversion from life-event funnel
- Keep $9/$19/$34: Confirmed wrong for segment positioning
- Usage-based: Too complex for this stage

**Revisit:** After 90 days of live data — conversion rate by tier, trial-to-paid conversion, churn by tier.

**Go-live ops:** Stripe test mode (Phase 1) must pass before live keys (Phase 2). Annual billing UI requires all three annual price env vars — documented in [LAUNCH_CHECKLIST.md § Stripe Setup](./LAUNCH_CHECKLIST.md#stripe-setup-required-before-public_signup_opentrue).

---

## Terms acceptance + post-checkout flow — TERMS-2/3/5 (2026-05-29)

**Decision:** Stripe success redirects to `/dashboard` or `/profile` (not `/terms/accept`). Estate trial checkouts use `payment_status = no_payment_required`; dashboard grants access for `subscription_status = trialing`.

**Shipped (2026-05-27):** TERMS-1 — record `terms_accepted_at` at signup via checkbox; Section F — soft backfill banner for existing users without acceptance timestamp.

**Ops:** `npm run repair:orphaned-user -- <email>` when auth user exists without `profiles` row (`handle_new_user` missed).

---

## Golden Path — unified progress model (2026-05-29)

**Decision:** Replace buried `SetupProgressCard` as the primary progress UX with `PlanProgressBar` driven by `determinePlanStage()` — four stages (Financial Foundation → Retirement & Estate Setup → Estate Planning → Plan Complete). One `progressPct`, one `nextActionHref`. Dashboard sections gated by stage; conflicts and life events always visible.

**Show all tools:** Client toggle persists `mwm_show_all_tools` in `localStorage` (default expanded for stage 3+). Power users bypass stage gating without changing tier gates.

**Deleted:** `lib/dashboard/setupProgress.ts` (`buildDashboardSetupProgress` had zero callers; superseded by `determinePlanStage` + existing `setupProgressCounts`).

**Unchanged:** `/onboarding/wizard`, `WizardOnboardingGate`, `/unlock-estate`, `getCompletionScore`, tier gates, `EstateExecutionChecklist` (Sprint 2).

---

## Estate execution checklist — persisted consumer tasks (2026-05-28)

**Decision:** Add `estate_checklist_items` (mirrors `domicile_checklist_items` pattern) and assemble dashboard checklist from existing tables — `estate_documents`, `trusts`, `estate_health_check`, `beneficiary_conflicts`, plus consumer toggles. **No new RPCs.**

**Status hierarchy:** `flagged` (beneficiary conflicts) > `incomplete` > `complete`. Completion = auto-detected **or** consumer-checked (checkbox persists as override).

**Tier links:** `resolveEstateActionHref()` — tier 1/2 deep links route to `/estate-tax` upgrade wall; tier 3 → planning routes.

**Trust tab:** Action Checklist checkboxes map via `TRUST_TASK_TO_CHECKLIST_KEY`; unmapped tasks stay UI-only.

**Alternatives considered:** Reuse `trust-will-rules` checklist only (rejected — not persisted). New `generate_estate_checklist` RPC (rejected — sprint constraint).

---

## Estate preview UX — dashboard + upgrade wall (2026-05-28)

**Decision:** Move `EstateCalloutCard` immediately after `DashboardIntroSection`; strengthen tax headline and tier-aware CTA; personalize `/estate-tax` `UpgradeBanner` with tax exposure + named conflict; tier-aware estate/conflict links on dashboard sections via `estateDetailsHref` / `estateUpgradeHref`.

**Note:** Sidebar “Estate Summary” remains `/dashboard` (no `/estate-summary` route). Tier 1/2 still see estate tax figures on dashboard; `/estate-tax` is the upgrade wall for deep planning.

---

## Flow & perf program K–O — closed (2026-05-28)

**Decision:** Ship consumer/advisor flow consistency, bundle splits, dashboard Suspense, advisor roster alert batching, route shells, and composition `revalidateTag` on `main` before go-live flip.

**Commit anchors:** K `90d167a` · L `5da71b0` · M `c5186ca` · N `615d496` · O `3524581`.

**Deferred:** Advisor `?tab=` URL still triggers full server page load — Parallel Routes / per-tab cache is a post–go-live sprint, not a launch blocker.

---

## Sprint 19a — deferred review fixes (2026-05-28)

**Decision:** Three quick wins from codebase review without advisor tab architecture change.

| Fix | Approach |
|-----|----------|
| Allocation save | `router.refresh()` after PATCH; drop redundant GET `/api/asset-allocation` |
| Assessment history | `loadAssessmentHistory` on dashboard server; widget skips client fetch when hydrated |
| Meeting Prep | Seed brief from server props; “Refresh from latest data” for explicit regen |

**Commit:** `b7a15dd`. Full Meeting Prep query dedupe remains deferred.

---

## Post-launch perf program — closed (2026-05-27)

**Decision:** Close engineering perf sprints B–J on `main`. Sprint 18 shifts focus to remaining planning route shells (J), manual RLS isolation smoke, and Sprint 17 legal/ops go-live blockers.

**Sprint summary:** B prefetch → C lazy scenarios → D advisor code-split → E/F form refresh + profile gates → G billing links → H/I loading/error on five hot routes → J complete/estate-tax shells.

---

## Post-launch perf — error boundaries on hot routes (2026-05-27)

**Decision:** Add `error.tsx` on the same five hot prefetch routes; extract shared `RouteErrorFallback` for consistent retry UX (matches dashboard / trust-strategy pattern).

---

## Post-launch perf — loading skeletons on hot routes (2026-05-27)

**Decision:** Add route-level `loading.tsx` for server-prefetch consumer pages: monte-carlo, allocation, scenarios, social-security, projections. Skeletons mirror each page layout (dashboard / trust-strategy pattern).

**Reasoning:** Server prefetch eliminated client waterfalls but left a blank shell during slow `loadProjectionData` / Monte Carlo parallel fetches.

---

## Post-launch perf — sidebar tier-locked billing links (2026-05-27)

**Decision:** Tier-locked sidebar leaves and locked Retirement/Estate group items navigate to `/billing?returnTo={href}` instead of non-interactive greyed divs.

**Reasoning:** Dead-end lock icons blocked upgrade conversion; attorney-access items already linked to billing — extend pattern to all feature gates.

---

## Post-launch perf — profile gate consistency (2026-05-27)

**Decision:** Add `requireHouseholdRecord(fromPath)` alongside `requireMinimumViableProfile`. All consumer pages that need a household row redirect to `/profile?required=true&missing=…&from=…` instead of bare `/profile` or inline empty states.

**Reasoning:** Inconsistent gates broke the profile required banner and post-save return flow (`from` param).

**Docs:** [lib/estate/requireMinimumProfile.ts](../lib/estate/requireMinimumProfile.ts), [CONSUMER_FLOWS.md § Profile](./CONSUMER_FLOWS.md).

---

## Post-launch perf — insurance/businesses form refresh (2026-05-27)

**Decision:** Replace `window.location.reload()` on `/insurance` and `/businesses` with optimistic local state updates + `router.refresh()` after API success (matches `/assets` pattern).

**Reasoning:** Full page reloads discarded client state and added unnecessary latency after every save/delete.

---

## Post-launch perf — advisor tab code-split + domicile dedupe (2026-05-27)

**Decision:** Lazy-load all advisor client workspace tabs via `next/dynamic` in `_client-view-shell.tsx` (Overview, Estate, Retirement, Tax, Notes join existing Strategy/Domicile/Documents/Meeting Prep splits). Remove `DomicileTab` mount refetch of `/api/domicile-analysis` — server page already passes `domicileAnalysis` from loaders.

**Reasoning:** Static imports pulled every tab bundle into the client shell chunk; domicile tab duplicated data the server already fetched on tab navigation.

**Docs:** [app/advisor/clients/[clientId]/_client-view-shell.tsx](../app/advisor/clients/[clientId]/_client-view-shell.tsx), [MASTER_ARCHITECTURE.md § Advisor portal](./MASTER_ARCHITECTURE.md).

---

## Post-launch perf — Scenarios lazy B/C projection fetch (2026-05-27)

**Decision:** Defer Scenario B and C `/api/projection` calls until the user edits B/C inputs (`bActivated` / `cActivated` gates). Returning users with localStorage overrides auto-activate so saved scenarios still recalculate on load.

**Reasoning:** Every `/scenarios` visit fired two projection runs (~600ms after mount) even when users only viewed Base Case — unnecessary compute and API load.

**Docs:** [app/(dashboard)/scenarios/_scenarios-client.tsx](../app/(dashboard)/scenarios/_scenarios-client.tsx), [CONSUMER_FLOWS.md § Retirement modeling](./CONSUMER_FLOWS.md).

---

## Post-launch perf — Monte Carlo + Allocation server prefetch (2026-05-27)

**Decision:** Extract shared loaders for `/monte-carlo` and `/allocation` (same pattern as Social Security): `loadMonteCarloPrefill`, `loadMonteCarloHistory`, `loadMonteCarloAdvisorAssumptions`, `loadAssetAllocationData`. Server pages prefetch in `Promise.all`; client components initialize state from props and skip mount-time API waterfalls when hydrated.

**Reasoning:** `/monte-carlo` fired three client fetches on mount (prefill, history, advisor assumptions); `/allocation` always fetched `/api/asset-allocation` despite partial server props for targets/risk only.

**Docs:** [lib/monte-carlo/](../lib/monte-carlo/), [lib/allocation/loadAssetAllocationData.ts](../lib/allocation/loadAssetAllocationData.ts), [SCHEMA_CHANGELOG.md § Post-launch perf Sprint B](./SCHEMA_CHANGELOG.md).

---

## Post-launch perf — advisor tab loader alignment (2026-05-27)

**Decision:** `advisorDatasetIncludeForTab()` must load `scenario`, `strategyLineItems`, and `stateTax` on every tab where `needsStrategyVm` builds `advisorHorizons` (estate, tax, domicile, meeting-prep, strategy). Strategy tab uses a single dedicated line-item fetch (`strategyLineItems: false` in loader) to avoid duplicate queries.

**Reasoning:** Estate/Tax tabs showed empty or wrong horizon numbers because accepted advisor strategies were excluded from the dataset include flags.

**Docs:** [lib/advisor/loaders.ts](../lib/advisor/loaders.ts), [SCHEMA_CHANGELOG.md § Post-launch perf Sprint A](./SCHEMA_CHANGELOG.md).

---

## Post-launch perf — StrategyTab server hydration (2026-05-27)

**Decision:** When advisor client workspace loads with `?tab=strategy`, server prefetches advisor + consumer `strategy_line_items`, `strategy_configs`, and gifting summary (`calculate_gifting_summary`). Pass as `initialAdvisorLineItems`, `initialConsumerLineItems`, `initialStrategyConfigs`, `initialGiftingActuals` through `ClientViewShell` → `StrategyTab`. Client state initializes from props; `loadConsumerData(false)` on mount fetches only missing slices; `loadConsumerData(true)` after inline recommend refreshes all.

**Reasoning:** `loadConsumerData()` on every StrategyTab mount duplicated 4+ client round trips (line items ×2, configs, estate-composition) despite server already loading composition and line items for horizons.

**Docs:** [MASTER_ARCHITECTURE.md § Advisor portal](./MASTER_ARCHITECTURE.md), [SCHEMA_CHANGELOG.md § Post-launch perf](./SCHEMA_CHANGELOG.md).

---

## Post-launch perf — estate composition cache (2026-05-27)

**Decision:** Add `estate_composition_cache` (unique per `household_id` + `source_role`). `/api/recompute-estate-health` upserts consumer + advisor composition after health/conflicts/recommendations. Read path uses `getCachedComposition` (cache hit → jsonb; miss → live `classifyEstateAssets` RPC). Applied on dashboard, estate-tax, my-estate-strategy, my-estate-trust-strategy, advisor client page, `POST /api/estate-composition`.

**Reasoning:** P-2 cached recommendations; composition RPC remained on every high-traffic page load. Materializing at recompute aligns with existing `afterHouseholdWrite` pipeline.

**Migration:** `20260527180000_estate_composition_cache.sql`

**Docs:** [DATABASE_SCHEMA_REFERENCE.md § estate_composition_cache](./DATABASE_SCHEMA_REFERENCE.md), [MASTER_ARCHITECTURE.md § Estate health recompute](./MASTER_ARCHITECTURE.md#estate-health-recompute--operations).

---

## Post-launch perf — server prefetch + render-path fixes (2026-05-27)

**Decision:** (1) Social Security page calls `loadSocialSecurityData` server-side; client skips fetch when hydrated. (2) Dashboard passes `initialSetupProgress` from server counts. (3) Trust-strategy prefetches charitable summary; `CharitableGivingDashboard` accepts `initialCharitableSummary`. (4) `ConsumerStrategyPanel` dynamic import on trust-strategy. (5) Advisor strategy notification INSERT moved to `POST /api/consumer/advisor-strategy-notifications` on client mount; add `loading.tsx` / `error.tsx` for trust-strategy and dashboard.

**Reasoning:** Eliminate useEffect waterfalls and remove side-effect INSERT from trust-strategy server render path.

---

## Pre-launch tier gating — pages are authority (2026-05-27)

**Decision:** `FEATURE_TIERS` in `lib/tiers.ts` must match each gated page’s `hasFeatureAccess` check (pages are authority, not sidebar guesses). Sidebar `isLocked()` and every consumer `UpgradeBanner` gate use `hasFeatureAccess(feature, tier, isAdvisor, isTrial)` + `featureUpgradeTier(feature)` for banner copy. Drift fixed before `PUBLIC_SIGNUP_OPEN`: `real-estate`, `allocation`, `digital-assets` → tier 2; `business-succession` → tier 3; added `my-estate-strategy` / `my-estate-trust-strategy` keys.

**Reasoning:** Tier-1 users could click sidebar links that immediately hit `UpgradeBanner` (e.g. Real Estate showed unlocked at tier 1 in nav but gated at tier 2 on the page). Single helper prevents future drift.

**Docs:** [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md), [MASTER_ARCHITECTURE.md § Consumer Billing](./MASTER_ARCHITECTURE.md#consumer-billing--access-contract).

---

## Pre-launch cache revalidation on strategy writes (2026-05-27)

**Decision:** After successful `POST`/`PATCH`/`DELETE` on `/api/strategy-line-items`, call `revalidatePath` for `/my-estate-trust-strategy`, `/my-estate-strategy`, `/dashboard`, `/estate-tax` (same pattern as gift-history). Also revalidate `/scenarios` + `/projections` on growth-assumptions writes and `/allocation` + `/projections` on allocation-targets writes.

**Reasoning:** Strategy confidence changes affect server-rendered composition on multiple routes; clients were relying on `router.refresh()` alone.

**Docs:** [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md), [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md).

---

## Strategy reversal — logged withdraw, consumer-owned (2026-05-31)

**Decision:** Consumers can reverse confirmed strategies without hard-deleting rows. `PATCH /api/strategy-line-items` actions: `return_to_sandbox` (probable → illustrative), `withdraw` (`is_active=false`, `consumer_withdrawn`, optional `reversal_reason`), `demote` (certain → probable). Only `households.owner_id` may reverse. Gifting: deleting a synced gift log warns before leaving orphan plan rows; optional withdraw in same step.

**Reasoning:** Gift history and plan commitment are separate stores; delete gift alone left stale `outside_strategy_total`. Reversal preserves audit trail for advisors and compliance while restoring estate accuracy immediately via `is_active=false`.

**Docs:** [MASTER_ARCHITECTURE.md § Strategy reversal](./MASTER_ARCHITECTURE.md#consumer-and-advisor-interaction), [SCHEMA_CHANGELOG.md § Strategy reversal](./SCHEMA_CHANGELOG.md).

---

## Strategy sandbox → actuals — illustrative first, explicit promote (2026-05-27)

**Decision:** All consumer modeled strategy saves (SLAT, ILIT, charitable, GRAT/CRT/CLAT/Roth/Liquidity chips) write `confidence_level='illustrative'` first and appear in **Strategy Sandbox** on Transfer Strategies. Consumer moves a row into **In My Plan** with `PATCH /api/strategy-line-items` `{ id, promoteConfidence: true }` (`illustrative` → `probable`, consumer-owned only). Advisor recommendations still use `PATCH /api/consumer/strategy-recommendation` for accept/decline; accepted advisor rows show in **In My Plan** via `consumer_accepted`. Annual gifting and explicit charitable **Save to my plan →** may still write `probable` directly. Roth optimizer adds **Use in Transfer Strategies →** (illustrative row + deep link `?openPanel=roth`).

**Reasoning:** Prior SLAT/ILIT default `probable` bypassed review and immediately reduced taxable estate in composition. Sandbox matches advisor “model then commit” mental model and aligns chip-modeled strategies with the same promote step.

**Alternatives considered:** Auto-promote on save (rejected — no user confirmation). Single combined list without sandbox section (rejected — unclear what affects tax). Advisor promote via same PATCH (rejected — keep accept path and audit fields).

**Docs:** [MASTER_ARCHITECTURE.md § Strategy sandbox contract](./MASTER_ARCHITECTURE.md#consumer-and-advisor-interaction), [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md), [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md).

---

## Profile layout E2E — spouse toggle and live headers (2026-05-27)

**Decision:** Add `consumer-profile-spouse-layout.spec.ts` (UI) and `consumer-growth-assumptions-api.spec.ts` (API) instead of extending `consumer-api-writes`. Person-1 name uses `getByRole('textbox', { name: 'Jane', exact: true })` to avoid matching Full Name placeholder `Jane Doe`.

**Reasoning:** Profile layout refactor (`61a8130`) changed DOM only; prior Playwright suite had no coverage for smoke §3.1b–3.1c or PROF-2 growth PATCH. Split specs keep API contract tests discoverable next to Scenarios save path.

**Skipped by default:** Growth round-trip requires `PLAYWRIGHT_HOUSEHOLD_ID` from `npm run seed:e2e` ([E2E_TEST_RESET.md](./E2E_TEST_RESET.md)).

---

## Profile page layout — two-column people, brand section headers (2026-05-27)

**Decision:** Refactor `/profile` client layout only (`_profile-client.tsx`). `max-w-2xl` form width; gold left-border `ProfileSectionHeader`; sections **Household** (identity), side-by-side **people** columns when `hasSpouse` (`grid-cols-1 sm:grid-cols-2`), **Household Planning** (tax/domicile/deduction). Column headers bind to `person1Name` / `person2Name` live (`trim() || 'You'` / `'Spouse / Partner'`). Spouse toggle sits **below** the person grid (not a card header). Paired fields inside each column (birth year + retirement age; SS claiming + longevity); PIA full width. Single callout links to Scenarios + Asset Allocation. No field, validation, save path, or API changes.

**Reasoning:** PROF-1/2 removed planning-assumption inputs but left a long vertical form; two-column person layout and live names make spouse entry obvious and scannable. Narrower page width avoids sparse 1280px forms.

**Alternatives considered:** Keep separate “Your Information” and spouse cards with header checkbox (rejected — toggle read as section label). Use shared `SectionHeader` primitive (deferred — profile uses local `ProfileSectionHeader` with audit gold `#C9A84C`).

**Docs:** `CONSUMER_FLOWS.md` Profile row; `MASTER_ARCHITECTURE.md` Profile UI layout.

---

## Pre-launch RLS household scope — six tables (2026-05-27)

**Decision:** Migration `20260527150000` drops permissive `auth.uid() IS NOT NULL` policies and replaces with household owner + `advisor_clients` (via `households.owner_id = client_id`, `status = 'active'`, `accepted_at IS NOT NULL`). GST advisor writes use `/api/advisor/gst-entry` with server-side link validation and `createAdminClient` (mirrors `strategy-recommendation` / `gap-status` pattern). `SLATILITPanel` no longer inserts to `gst_ledger` from the browser.

**Reasoning:** Permissive policies OR'd with scoped policies, exposing cross-household reads/writes before public signup.

**Shipped:** `1f41ce1` (migration + docs), `7cab1be` (GST API), `35b0738` (MIGRATION_TEMPLATE advisor join). Applied on prod; `verify-loose-rls-policies.sql` returns zero rows.

---

## Security — explicit GRANTs in migrations; grant vs RLS audits (2026-05-27)

**Decision:** Add `supabase/MIGRATION_TEMPLATE.sql` requiring explicit `GRANT` + RLS in every new table migration. Prod grant audit (119 tables) shows all API roles already granted and RLS enabled — **no backfill migration**. Policy audit CSV exported for pre-launch review (`signed_in_only` advisor/consumer policies flagged separately from reference-table `USING (true)`).

**Reasoning:** PostgREST access (grants) and row isolation (policies) are different questions. Future Supabase defaults may skip auto-grants; baking grants into migrations prevents regressions. Reference tables may use `USING (true)` for authenticated read; household PII must not.

**Alternatives considered:** One-shot `GRANT ALL` migration on prod (rejected — audit shows nothing missing). Defer policy audit until post-launch (rejected for launch gate — tracked in LAUNCH_CHECKLIST as review item).

---

## PROF-1/2 — Profile cleanup: canonical homes for planning assumptions (2026-05-27)

**Decision:** Remove financial growth rates, inflation, and risk tolerance from `/profile`. **Scenarios** is the single editor for `growth_rate_accumulation`, `growth_rate_retirement`, `growth_assumptions` (RE/business), and `inflation_rate`. **Asset Allocation** (`/allocation`) edits `risk_tolerance` plus target stocks/bonds/cash. Profile save uses pass-through in `buildHouseholdRow` + fetch of existing household so PATCH profile does not overwrite Scenarios/Allocation values.

**Reasoning:** Profile should hold identity and demographic facts; planning assumptions belong with the surfaces that explain them (what-if scenarios, allocation benchmarks). Duplicating editors caused confusion after ENG-2A/2B (RE/business no longer grow at inflation).

**Alternatives considered:** Keep inflation on Profile (rejected — same “planning assumption” bucket as growth). Partial profile save API omitting household columns (rejected — pass-through is simpler for one save endpoint).

**Docs:** `MASTER_ARCHITECTURE.md` — Projection Engine Assumption Reference; `DATABASE_SCHEMA_REFERENCE.md` — households field ownership table.

---

## ENG-2 — Per-asset-class growth assumptions and post-deploy staleness bump (2026-05-27)

**Decision:** Store real estate and business growth rates in `households.growth_assumptions` jsonb (defaults 4.5% / 7.0%); keep financial accumulation/retirement on existing columns. Fix engine to use dedicated RE/business rates (not inflation). Estate MC reads advisor/consumer return mean from request, not hardcoded 7%/12% in the edge function.

**Staleness:** Migration-only backfill does not bump `households.updated_at`. A follow-up migration (`20260527130400`) sets `updated_at` for households with a saved base case so `isProjectionStale` fires and `generateBaseCase` runs on next dashboard, my-estate-strategy, or advisor client load. Saving on Scenarios (`PATCH /api/consumer/growth-assumptions`) also touches `updated_at` via `afterHouseholdWrite`.

**Alternatives considered:** One-off admin script to call `generateBaseCase` for all households (rejected — same outcome as staleness bump with less ops risk). Leaving stale rows until user edits data (rejected — confusing Projections/horizons after deploy).

**One-off QA script:** `scripts/compare-user-estate-data.ts` was not committed — service-role email comparison against production; delete rather than ship in repo.

---

## Purpose

This document records significant product, UX, and strategy decisions — what was decided, why, and what alternatives were considered. It exists so decisions made in one session don't get relitigated in the next. If a decision is here, it was made deliberately. If you want to revisit it, add a new entry rather than editing the old one.

**How to add an entry:** Date · Topic · Decision · Reasoning · Alternatives considered.

---

### May 2026 — Nav consistency: homepage uses PublicNav; billing and utility pages get brand chrome

**Decision:** Move marketing homepage into `(public)` so `/` uses the same `PublicNav` as `/pricing` and `/assess`. Add `MinimalAuthNav` for billing (authenticated, no sidebar). Add `WordmarkOnly` on token/utility layouts (invite, beneficiary, share, confirm-email, claim-listing, attorney-invite). Do not change dashboard sidebar, advisor nav, education layout, or auth login/signup (no nav is intentional).

**Reasoning:** Three surfaces had inconsistent or missing brand presence: duplicate inline homepage nav, billing with only inline back links, and utility flows with no wordmark. Attorney portal header remains a separate surface (no MWM wordmark today) — logged for a future sprint.

**Alternatives considered:** Extract homepage-only `HomepageNav` without center links (rejected — marketing consistency favors full `PublicNav`). Add full `PublicNav` to billing (rejected — wrong chrome for post-auth checkout).

---

### May 2026 — Client Summary PDF: match Attorney Summary standard

**Decision:** Upgrade `ConsumerEstatePlanPDF` to the same navy/gold structure as `AttorneyEstatePlanPDF` (brand label, purpose callout, household profile grid, gold section headers). Remove letter-grade display for consumer readiness; use `N / 100 — Early Stage` (etc.) with progress bar. Document checklist uses **Not on file** (not **Action Needed**). Enable tax + assets in `/api/export-estate-plan` for consumer role so profile figures populate.

**Reasoning:** Client Summary looked like a different product (ESTATE PLANNER header, alarming **F** grade, advisor-oriented copy). Attorney Summary is the reference standard; consumer export should feel professional and self-owned, not punitive.

**Alternatives considered:** Keep letter grades (rejected — misleading for early-stage households). Green purpose bar like attorney (rejected — gold/navy differentiates client vs attorney-ready export).

---

### May 2026 — UX-5: Strategy tab layout — horizon below recommendations, impact panel

**Decision:** Remove redundant full-width SLAT/ILIT and Advanced panels below the three-step workflow; rename Combined Strategy View to **Strategy Horizon** and place it after Step 3; add `StrategyImpactPanel` (before/after tax delta) at the top of Step 3. Scroll targets point to Step 2 Opportunities (`#strategy-opportunities`).

**Reasoning:** UX-4 inline modeling made full-width panels duplicate entry points. Advisors need impact visibility at the moment of recommendation review, then the multi-horizon table — not modeling forms repeated below the fold.

**Alternatives considered:** Keep full-width panels as fallback (rejected after UX-4 — inline panels are sufficient). Single combined section without impact panel (rejected — advisors asked for tax delta before horizon table).

---

### May 2026 — UX-5b: Remove CompositeOverlay manual entry mode

**Decision:** Remove `custom` ("Enter Strategy Reductions") mode from `CompositeOverlay`. Default to `recommendations`, which reads `strategy_line_items` via the existing read API. Keep `30m` and `100m` archetype modes for illustration.

**Reasoning:** UX-4 inline modeling in Step 2 is the single entry point for client-specific strategies. Manual dollar entry duplicated that workflow, could drift from saved recommendations, and had no DB persistence. CompositeOverlay’s role is visualization of recommended strategies, not a second entry form.

**Alternatives considered:** Keep manual mode as fallback for households without recommendations (rejected — empty state + Step 2 modeling is sufficient). Wire manual amounts into `strategy_line_items` (rejected — out of scope, wrong data contract).

---

### May 2026 — ENG-1: Estate/Tax strategy inclusion via horizon actual set

**Decision:** For advisor Estate/Tax display parity, use horizon-derived actual-set values (`advisorHorizons.today`) instead of relying solely on `calculate_estate_composition` output for strategy inclusion. Additive override path (`horizonComposition`) is advisor-only; consumer composition calls stay unchanged.

**Reasoning:** `calculate_estate_composition` filters strategy rows by `p_source_role`, so it cannot represent `(consumer rows OR accepted advisor rows)` in a single call. `strategyMappers.ts` already defines the correct actual set and horizon outputs are consistent with advisor workflow expectations.

**Alternatives considered:** Add new RPC parameter (deferred to post-launch ENG-2). Keep current advisor Estate composition path (rejected — underreports accepted advisor strategy impact).

---

### May 2026 — UX-4: Inline strategy modeling in Opportunities panel

**Decision:** Wire Step 2 catalog rows to existing `SLATILITPanel` and `AdvancedStrategyPanel` inline (expand/collapse per row) without new engines, APIs, or migrations. Centralize catalog id → panel chip mapping in `catalogToPanel.ts`; **CST** uses catalog/API key `cst` but UI chip `credit_shelter_trust` (only asymmetric case). Remove scroll-only `ModelStrategyButton`. Keep full-width panels below the three-step workflow as fallback; `scrollToStrategyModules` unchanged.

**Reasoning:** UX-3 “Model this” scrolled away from the catalog; advisors lost context. Reusing existing panels preserves `strategy_source` contracts and `useRecommendAdvanced` / SLAT·ILIT POST paths. Grep-verified chip strings prevent silent no-op panel opens.

**Alternatives considered:** New inline forms per strategy (rejected — duplicate engines). Rename `credit_shelter_trust` to `cst` in UI state (rejected — breaks `PANEL_TO_STRATEGY_SOURCE` and saved-state mapping).

---

### May 2026 — UX-3: Strategy tab three-step workflow + severity system

**Decision:** Reorganize the advisor Strategy tab into three labeled steps — **Situation** (diagnostic metrics), **Opportunities** (strategy catalog + “Model this”), **Recommendations** (advisor `strategy_line_items` by client response + AF-1 questions) — without changing `calculateAdvisoryMetrics` or consumer surfaces. Replace `!!` / ad-hoc badges with `advisoryMetricSeverity` (`●`/`!`/`✓`/`—`, max 2 active). Show a red liquidity shortfall banner when coverage &lt; 1.0x, ordered before amber exemption warnings. Peer benchmarks stay behind `NEXT_PUBLIC_ADVISOR_BENCHMARKS` (default off).

**Reasoning:** One undifferentiated page mixed diagnosis, modeling, and client recommendations. Liquidity 0.0x was critical but visually equal to low-priority warnings. Advisors need a clear path from “what’s wrong” → “what to model” → “what we sent the client.”

**Alternatives considered:** New API for recommendations list (rejected — existing `strategy_line_items` + extended client fetch). Remove Combined Strategy / Advanced panels (rejected — still needed for modeling; moved below workflow).

---

### May 2026 — UX-2: Advisor portal UX + cached advisory metrics

**Decision:** (1) Ship advisor-only UX in two passes: brand/tab load/gap workflow (pass 1) then metrics cache, estate composition UX, strategy grid (continuation). (2) Cache six core advisory metrics server-side via `unstable_cache` + `household-metrics-{householdId}` tag; invalidate on `afterHouseholdWrite`. (3) Omit Best Strategy NPV and CST Crossover from the grid until `strategy_line_items` has active amounts — show a single CTA instead. (4) Persist gap discussion state in `advisor_gap_statuses` (advisor-private, not consumer-visible).

**Reasoning:** Strategy tab re-computed eight metrics on every client render; tab-scoped loading and cache cut repeat visits. Empty outside-estate panel and small tax chip wasted advisor attention on high-liability households. Warning badges on four cards diluted urgency — cap at two by priority.

**Alternatives considered:** Persist advisory metrics in DB on recompute (deferred — matches P-2 recommendations pattern but heavier than cache for advisor-only reads). Keep eight-card grid with “Not run” placeholders (rejected — noise).

---

### May 2026 — Advisor portal roster net worth (performance)

**Decision:** Advisor home (`/advisor`) uses `loadRosterNetWorthByOwner` (batched table reads) for roster net-worth columns. Client workspace (`/advisor/clients/[id]`) still uses `calculate_estate_composition` for engine-aligned Overview figures.

**Reasoning:** One composition RPC per client made roster load scale linearly with client count and dominated TTFB. Batched reads are approximate but sufficient for sort/display on the roster; full composition remains on the client detail page.

**Alternatives considered:** Keep N RPCs for accuracy (rejected — unacceptable at 5+ clients). Batch composition RPC via new Postgres function (deferred — post-launch per PERF_SPRINT_P1).

---

### May 2026 — NAV-1: Sidebar active route indicator

**Decision:** Active nav uses `isNavItemActive(href, pathname)` with path-prefix matching (except `/dashboard` exact). Planning groups auto-expand when `groupContainsActiveItem` is true, overriding default collapsed state for Financial Planning.

**Reasoning:** Financial Planning was in `DEFAULT_CLOSED_GROUPS` and the open predicate required `!DEFAULT_CLOSED_GROUPS.has(label)`, so the group stayed collapsed on `/income` etc. — children were unmounted and the active stripe never appeared.

**Alternatives considered:** Remove Financial Planning from `DEFAULT_CLOSED_GROUPS` only (rejected — partial fix; other groups need the same active-child rule).

---

### May 2026 — OB-3b: Financial Planning sidebar + layout household query

**Decision:** (1) Remove the legacy green dashboard setup checklist (`DashboardIntroSection`); `SetupProgressCard` is the only setup UI. (2) Set all Financial Planning `FEATURE_TIERS` keys to tier 1 and exempt that group from `isLockedUser`. (3) Never gate Security, My Advisor, or Manage Subscription on `isLockedUser`. (4) Stop selecting `households.date_of_birth_1` in `getDashboardLayoutContext` — use `person1_birth_year` only (profile gate still accepts legacy `date_of_birth_1` on in-memory types if ever populated elsewhere).

**Reasoning:** Tier 1 users (e.g. `test1@rolobe.resend.app`) saw the entire Financial menu locked because the layout household query failed on a non-existent column, so `hasHousehold` was always false. Separately, onboarding users must reach Income/Assets without a household row. Upgrade paths (Retirement/Estate) stay tier-gated.

**Alternatives considered:** Require household before any Financial nav (rejected — blocks data entry). Add `date_of_birth_1` migration (rejected — `person1_birth_year` is canonical).

---

## How to use this document at the start of a session

Skim the last 5 entries and the "Active constraints" section before starting any design or engineering work. This prevents re-opening settled questions and re-explaining context that was already worked out.

---

## Active constraints (summary of decisions that affect current work)

- **Complexity stays in.** GRAT/SLAT/ILIT forms keep their technical depth. Add guided context (tooltips, plain-language explanations) but do not hide parameters. This segment wants the depth.
- **Public nav and app nav are separate chrome components.** No planning app links on the public site. No public-site links in the app sidebar.
- **Tier structure is visible in the sidebar.** Locked tiers show representative items with lock icons and upgrade CTAs — they do not disappear.
- **Advisor and attorney connections are in the sidebar footer**, not a primary planning group. They are relationship tools, not planning tools.
- **Conflict alerts must be above the fold on the dashboard.** The specific named alerts are the highest-value content. They cannot be the last thing before the footer.
- **Pricing is positioned against professional fees**, not against consumer tools. Never price-compare to LegalZoom or Trust & Will in copy or positioning.
- **The assessment is the primary public conversion mechanism.** Score is visible without an account. Full breakdown requires account creation.
- **Advisor connection queries** must use `CONNECTED_ADVISOR_CLIENT_STATUSES` from `lib/advisor/clientConnectionStatus.ts` (`active` | `accepted`) — never hardcode a single status in new code.
- **Financial Planning sidebar is never `isLockedUser`-gated.** Tier 1 data entry must work before a household row exists. `hasHousehold` comes from layout `getDashboardLayoutContext` — do not SELECT `households.date_of_birth_1` (column does not exist; breaks the query).
- **Security, My Advisor, and Manage Subscription** are never household-gated in the sidebar (OB-3b).
- **Sidebar groups auto-expand when a child route is active** (NAV-1) — required for collapsed Financial Planning to show `NAV_ACTIVE` on the current page.
- **Advisor roster net worth** uses batched table reads (`loadRosterNetWorthByOwner`), not per-client composition RPC. Client workspace uses full `calculate_estate_composition`.
- **Tailwind v4 arbitrary colors:** `text-` / `border-` / `ring-` use `color:` prefix (`text-[color:var(--mwm-gold)]`); `bg-` uses `bg-[var(--mwm-navy)]` without `color:`. Wrong prefix fails silently.
- **Referral event attribution** is per-user via `funnel_events.event_slug` at signup; `referral_clicks` is anonymous (no `user_id`). Cross-device signup may not have funnel `event_slug` — see NEXT_SESSION.md known limitations.

---

## Decision log

### May 2026 — In-app copy audit: advisor-forward, scope not disclaimer (Sprint 12)

**Decision:** Replace hedging disclaimer patterns (“Educational tool only”, “not constitute advice”, “Always consult”) with product-positioning or scope copy across dashboard, public event/assess, upgrade gates, directories, and shared links. Keep `approximately` on derived estate figures in `UpgradeBanner`. Keep beneficiary-view “informational purposes” on third-party surfaces. Scenarios comparison footer uses **`Scope:`** not **`Disclaimer:`**.

**Reasoning:** Target segment ($2M–$30M) expects a planning tool that prepares them for professional relationships — not copy that implies numbers are untrustworthy before use.

**Alternatives considered:** Remove all disclaimer bars (rejected on beneficiary/share edge cases where audience lacks product context).

---

### May 2026 — Mobile: desktop-first planning app, drawer nav on phones (Sprint 12)

**Decision:** Consumer planning app is **desktop-first** (segment 50–65, complex modeling). On viewports below `lg`, the fixed sidebar becomes an off-canvas drawer (hamburger, overlay, closes on navigate). A short note in the mobile sidebar sets expectations. **Public routes** (`(public)/layout`, event pages) stay separate — acquisition on phone is the priority there; no planning sidebar on those routes. Full responsive audit deferred post-launch.

**Reasoning:** Matches eMoney-style complex tools; avoids landscape-only use of the app shell without a full mobile redesign. Event-page mobile is the real acquisition surface.

---

### May 2026 — Pre-launch A/B collapse: personalized + score_visible (Sprint 12)

**Decision:** With no live traffic, do not wait on `funnel_events` for A/B winners. Ship **`personalized`** upgrade copy only (`getEventUpgradeValueProp` always uses `EVENT_UPGRADE_COPY`). Ship **`score_visible`** assessment behavior only (logged-out users see scores; gap report gated behind signup). Remove `lib/analytics/abTests.ts`, branching code, and `app_config` rows `ab_upgrade_copy` / `ab_assessment_gate` (migration `20260531000000_remove_ab_test_app_config.sql`). Keep `app_config` for other keys. Post-launch A/B when baseline conversion exists.

**Reasoning:** Pre-launch split tests cannot reach significance; PRODUCT_STRATEGY favors specificity over generic upgrade copy; assessment conversion depends on demonstrating value (scores) before account creation.

**Alternatives considered:** Default to higher `tier_upgraded` variant without data (N/A). Keep flags until 4 weeks live (rejected — delays launch hygiene).

---

### May 2026 — Planning empty-state CTAs: profile-only on tier-1/2 surfaces (Sprint 12)

**Decision:** `/projections` and `/complete` use `PLANNING_MISSING_PROJECTION_ACTIONS_TIER2` (profile link only). The “Generate estate plan →” link stays on tier-3 `/my-estate-strategy` (inline `POST /api/consumer/generate-base-case`). Export `planningMissingProjectionActions(tier)` for callers that need tier-aware lists; do not merge TIER2 and TIER3 into one constant.

**Reasoning:** Lifetime snapshot and projections rows come from `computeCompleteProjection` on each server render once profile inputs exist — not from `projection_scenarios`. Sending tier-2 users to `/my-estate-strategy` hit a tier-3 upgrade wall and implied a manual generate step that does not apply.

**Alternatives considered:** Inline generate on `/complete` (rejected — redundant with server-side compute). Single shared CTA list (rejected — regresses tier-2 UX).

---

### May 2026 — A/B test exit criteria (Sprint 10, settled)

**Decision (superseded May 2026 Sprint 12):** Pre-launch there was no traffic to apply this
framework. Winners chosen by product strategy prior: **`personalized`** upgrade copy,
**`score_visible`** assessment gate. See entry “Pre-launch A/B collapse” above.

**Original framework (for post-launch tests):** Primary metric `tier_upgraded` in
`funnel_events`; 50 events per variant or 4 weeks; owner Alan; secondary metric on assess
gate: `event_assess_complete` → `account_created`.

**Alternatives considered:** Gut-feel winner selection (rejected). Indefinite dual variants at
launch (rejected).

---

### May 2026 — Business succession: Path A minimal intake (Sprint 10, settled)

**Decision:** **Path A — Ship minimal.** `/business-succession` is live in the sidebar (tier 3).
Minimum intake on `households`: `succession_plan_in_place`, `succession_key_person_identified`,
`succession_buy_sell_in_place`. Dashboard shows an above-the-fold amber alert when the user has
business interests and `succession_plan_in_place` is not true. Full `BusinessSuccessionDashboard`
remains available for advisor workflows; consumer page is the minimal three-question form only.

**Reasoning:** Business-owner persona ($3M–$15M) is a primary segment; succession is their
defining need. Minimal intake closes the persona gap without blocking launch on full planning UI.

**Alternatives considered:** Path B post-launch descope (rejected — leaves dead sidebar comment
and persona gap). Full dashboard for consumers at launch (rejected — scope).

---

### May 2026 — Invite-your-advisor: Path A post-profile onboarding (Sprint 10, settled)

**Decision:** **Path A — Launch gate.** After minimum viable profile save, consumers route to
`/onboarding/invite-advisor` (email invite via `mailto:`, find-advisor link, or skip). One column
only: `profiles.onboarding_invite_advisor_completed_at`. **Skip and continue both set the same
timestamp** (dismissed = seen; no separate `skipped` boolean). NULL means the layout gate is active.
`POST /api/consumer/onboarding-invite-advisor` is used for skip. Layout gate redirects consumers
with MVP profile who have not completed this step. `/my-advisor` retains the invite card for later.

**Deploy:** Column must exist via `20260530000000_sprint9_10_gates.sql` before first prod deploy of this gate.

**Reasoning:** Aligns with PRODUCT_STRATEGY principle 4 (advisor flywheel from day one) without
building in-app advisor messaging at launch.

**Alternatives considered:** Path B footer-only on `/my-advisor` (rejected for launch).

---

### May 2026 — Advisor client link status: `active` and `accepted` (Sprint 9/10)

**Decision:** Treat `advisor_clients.status` in `('active', 'accepted')` as a connected link on
both consumer and advisor surfaces. Canonical constant: `CONNECTED_ADVISOR_CLIENT_STATUSES` in
`lib/advisor/clientConnectionStatus.ts`. New accepts write `active`; legacy `link-pending` now
writes `active` (was `accepted`). Advisor client detail loader and advisor API access checks use
the shared constant so roster + client workspace stay symmetric with `/my-advisor`.

**Connection life event at accept:** Prefer `funnel_events.event_slug` (signup/event attribution),
then `referral_clicks.event_slug` for `profiles.referral_code`, then explicit `life_events`, then
calendar triggers — implemented in `pickConnectionLifeEvent()`.

---

### May 2026 — "Ask your advisor →" links to public directory for all users

**Decision (interim):** The "Ask your advisor about this →" CTA on Transfer Strategy education
cards links to `/find-advisor` for all users, including users with a connected advisor. This
means a connected advisor does not receive any signal when their client is reviewing a strategy
they recommended.

**This is a known gap in the advisor flywheel.** The full behavior should be: if the user
has a connected advisor, this CTA offers an in-app action (message, flag, or notification).
If no connected advisor, it links to `/find-advisor`.

**Deferred to post-launch** because implementing advisor messaging or flagging is a new feature
category (not a fix) and would land in Sprint 10 or later, which risks the launch timeline.

**Post-launch:** Add an in-app advisor flag action on strategy education cards for users with
`advisor_clients` rows in accepted status.

**Superseded (2026-05-25, Sprint AF-1 — `a255616`):** Connected consumers use
`POST /api/consumer/ask-advisor` → advisor notification `consumer_strategy_question`; advisor
sees **Client Strategy Questions** on client Overview. No connected advisor → `/find-advisor`.
Session-only “Your advisor has been notified” confirmation (refresh resets UI; notification persists).

---

### June 2026 — Sprint P-2 closed; recommendations cached at recompute

**Decision:** Sprint P-2 (`47a38f3`) shipped pre-launch: `estate_health_scores.recommendations` jsonb populated during `/api/recompute-estate-health`; dashboard reads cache on load (empty array before first recompute — never live RPC on hot path). Projections serve fresh `outputs_s1_first` via cache-first branch in `loadProjectionData`. Layout uses `getDashboardLayoutContext` (React `cache()`) for single auth/profile/household/notifications load per request.

**Remaining post-launch perf:** ~~Materialize `calculate_estate_composition` at recompute~~ — shipped 2026-05-27 (`estate_composition_cache`).

**Doc:** [PERF_SPRINT_P1.md § Sprint P-2](./PERF_SPRINT_P1.md#sprint-p-2--pre-launch-refactors) · Migration: `20260602130000_sprint_p2_recommendations_cache.sql`

---

### June 2026 — Sprint P-1 closed; first post-launch perf sprint = dashboard read model

**Decision:** Sprint P-1 (`5c24160`) shipped pre-launch quick wins: dashboard `Promise.all`, advisor conflict cache read, 3s recompute debounce, server-fetched notification count, `next/font`, and `idx_assets_owner_id` / `idx_liabilities_owner_id` (applied in production).

**Post-launch engineering priority (Sprint P-2):** Production `pg_stat_statements` (Query A) shows top load from `projection_scenarios` INSERTs and estate RPCs (`calculate_estate_composition`, `generate_estate_recommendations`) on the dashboard path. **Sprint P-2 addressed** recommendations cache + projections cache-first + auth dedup (`47a38f3`). **Remaining:** materialize `calculate_estate_composition` at recompute.

**Doc:** [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) · [scripts/perf-diagnostic.sql](../scripts/perf-diagnostic.sql)

---

### May 2026 — Sprint 14 manual smoke bugs (fix before launch)

**Decision:** Two issues from manual smoke §1–7 (2026-05-23) must be fixed before LAUNCH_CHECKLIST Section 1 is fully signed off:

1. **Admin Portal in consumer sidebar** — consumers must never see admin navigation; gate on profile `role` (or equivalent) in dashboard shell.
2. **Asset add form save button** — must be reachable without browser zoom; use scrollable form body and/or sticky footer for primary save action.

**Post-launch (not blocking):** Dashboard initial load and post-profile-save render slowness — track as performance work after launch.

**Completed same sprint:** `consumer-core-recompute.spec.ts` (`93aa6f5`); manual sign-off `1e092d7`.

---

### May 2026 — Sprint 13 smoke test purpose: find launch blockers before feature freeze ends

**Decision:** Sprint 13 success is measured by staging verification (migrations, E2E, acquisition smoke A–G),
not by shipping new pillars. Two blockers were found and fixed during Sprint 13 manual smoke: (1) `rmd-start-age`
event copy hardcoded age 73 despite `getRmdStartAge()` supporting 72/73/75; (2) `advisor_directory` lacked
`referral_code` auto-generation on insert (migration `20260601000000`).

**Sprint 14:** Feature freeze — planning smoke Core 1–7 on staging; fixes only from test failures.

---

### May 2026 — `rmd-start-age` event copy uses cohort range, not a single age

**Decision:** Public-facing copy for `/event/rmd-start-age` (hero, subhead, assessment, action plan,
drip emails, advisor/attorney newsletter labels) describes RMD start ages **72, 73, or 75** by birth
year. Do not state “RMDs begin at 73” in user-facing surfaces. **SEO** `title` / `seoDescription`
may still mention 73 where search intent targets that cohort.

**Reasoning:** `getRmdStartAge()` is cohort-accurate in engines; marketing copy that hardcodes 73
is wrong for born ≤1950 (72) and ≥1960 (75). Range copy prompts users to determine their age without
requiring household data on the event page.

**Age cron:** Still fires life events at 70 and 73 for urgency — separate from legal RMD start age in projections.

---

### May 2026 — Production environment variables are a Sprint 15 launch gate

**Decision:** Before Sprint 15 go-live (domain cutover), every Production env var in
[LAUNCH_CHECKLIST.md § Vercel Production env vars](./LAUNCH_CHECKLIST.md#vercel-production-env-vars-required-before-sprint-15-go-live)
must be verified in the Vercel dashboard. `NEXT_PUBLIC_APP_URL` switches from the preview URL to
`https://mywealthmaps.com`. `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is set at launch only.
`RECOMPUTE_SECRET` must match the value in `.env.local` (shell-source `.env.local` with quoted values
if the secret contains `!` or `#`).

**Not in Vercel Production:** `SUPABASE_URL` — used only by local/staging seed scripts
(`seed-test-attorney`, `seed-test-consumer-estate`). Vercel’s Supabase integration sets URL/keys for deploys.

**Reasoning:** Missing `RECOMPUTE_SECRET` or wrong `NEXT_PUBLIC_APP_URL` silently breaks estate health
recompute and drip/referral links. A single checklist prevents ops drift between preview and production.

---

### May 2026 — "Referral loop proven" requires exact verification queries, not prose

**Decision:** The LAUNCH_CHECKLIST items "Advisor referral loop proven" and "Attorney referral
loop proven" must have exact Supabase verification queries documented before Sprint 14 begins.
Prose criteria ("a click has resolved correctly") are not sufficient for a launch gate.

**Advisor referral verified query (add to CONSUMER_RELEASE_SMOKE_TEST.md § Sprint 13):**

```sql
select rc.id, rc.referral_code, rc.listing_type, rc.advisor_directory_id, rc.created_at
from referral_clicks rc
where rc.listing_type = 'advisor'
order by rc.created_at desc
limit 5;
```

Pass = at least one row with a non-null `advisor_directory_id` and `referral_code` matching
an active row in `advisor_directory`.

**Attorney referral verified query:**

```sql
select rc.id, rc.referral_code, rc.listing_type, rc.attorney_listing_id, rc.created_at
from referral_clicks rc
where rc.listing_type = 'attorney'
order by rc.created_at desc
limit 5;
```

Pass = at least one row with non-null `attorney_listing_id`.

**Signup attribution verified query:**

```sql
select p.id, p.referral_code, p.attorney_referral_code, p.created_at
from profiles p
where p.referral_code is not null or p.attorney_referral_code is not null
order by p.created_at desc
limit 5;
```

Pass = at least one row with referral code matching a test signup.

---

### May 2026 — Event assessments separate from general assess; email capture before drip

**Decision:** Each life event page has its own 5-question assessment at `/event/[slug]/assess` (not the generic 20-question `/assess`). Anonymous users can submit email via `POST /api/email-capture` to receive a checklist; logged-in users persist to `assessment_results` with event metadata in `answers` JSONB. Email drip sequences deferred until ESP is chosen.

**Reasoning:** Event-specific questions increase relevance and conversion from SEO landing pages. Separating routes keeps the general assess as the full planning readiness funnel while event pages stay focused. Email capture stores leads immediately without blocking on drip infrastructure.

**Alternatives considered:** Single `/assess` with event query param (rejected — harder to share/bookmark per event). Dedicated `event_slug` column on `assessment_results` (deferred — JSONB metadata sufficient for Sprint 2).

---

### May 2026 — Target segment defined as $2M–$30M specifically

**Decision:** Focus exclusively on households with $2M–$30M in assets. Do not optimize for mass-market simplicity (under $500K) or ultra-HNW complexity (over $30M).

**Reasoning:** This is the only segment that is genuinely underserved today. Below $2M, LegalZoom and consumer robo-advisors are adequate. Above $30M, family offices and private banks serve the need expensively. The $2M–$30M band has complex enough finances to need real planning but no coordinated tool built for them. Over 50% have no will or plan at all. The complexity of the product (GRAT/SLAT modeling, state estate tax calculations, horizon projections) is a competitive advantage in this segment, not a UX problem.

**Alternatives considered:** Building for the mass market and growing upmarket (rejected — the product's complexity would feel overwhelming to simple-estate users, and the competitive field is crowded). Building for $30M+ (rejected — family office needs are fundamentally different and the competitive resources required are much larger).

**Implication for UX:** Never simplify features to the point of removing depth. Add guided context instead.

---

### May 2026 — Complexity is a feature, not a bug

**Decision:** Retain full technical depth in Transfer Strategy forms (GRAT §7520 Rate, Death Year, Rolling GRATs #, etc.). Add guided context (tooltips explaining what each field means, current IRS rates auto-populated where possible) but do not hide parameters behind "Advanced settings" or remove them for consumer-facing views.

**Reasoning:** A business owner modeling a GRAT before a $12M business sale wants to understand the mechanism. They've been paying $500/hour for attorneys to explain this. A tool that lets them model it themselves and bring the model to their advisor for refinement is worth real money. Hiding the depth would make the tool feel like it was built for a different audience.

**Alternatives considered:** Hiding advanced parameters behind "Advanced settings" disclosure (rejected — this segment will leave a tool that feels dumbed down). Advisor-only access to modeling depth (rejected — self-guided modeling is our core differentiation).

---

### May 2026 — Public site and app are separate navigation zones

**Decision:** Public site (education, assessment, find advisor/attorney, pricing) uses a clean top nav with no sidebar. Authenticated app uses a sidebar with planning groups only and zero public-site links.

**Reasoning:** The two zones serve fundamentally different audiences and goals. The public site has one goal: convert visitors to accounts. The app has one goal: help subscribers plan. Mixing them creates a sidebar with 30+ items that dilutes both experiences. Public content (Education Guide, Planning Assessment, Find an Advisor) does not belong in the planning nav for a paid subscriber who is in the middle of modeling their estate tax.

**Alternatives considered:** Keeping everything in one sidebar (rejected — overcrowded, confuses the planning experience, makes tier structure harder to see). Moving public content to a separate subdomain (acceptable but not required — route group separation in Next.js is sufficient).

---

### May 2026 — Advisor and attorney are distribution partners, not competitors

**Decision:** Position advisor and attorney relationships as the primary professional network that the product serves, not as alternatives to the product. "Invite your advisor" is a primary onboarding step. Advisors receive event context on new client connections. Attorneys get attorney-ready exports.

**Reasoning:** This segment already has or wants relationships with advisors and attorneys. A client who arrives with a completed household data profile and specific questions about GRAT vs SLAT timing can do a $3,000 meeting in 90 minutes instead of 3 hours. That advisor becomes our best salesperson. The referral flywheel (advisor refers client → client connects advisor → advisor recommends strategies → estate health improves → advisor looks good → advisor refers more clients) is the moat that competitors can't easily replicate.

**Alternatives considered:** Treating advisor/attorney as peripheral connection features (rejected — misses the primary distribution opportunity and the retention mechanism). Competing with advisors by providing advice (rejected — we are a planning and coordination tool, not a licensed advisor).

---

### May 2026 — Life events are the primary acquisition mechanism

**Decision:** Build event-specific landing pages for the 8 highest-priority life events (business sale, death of spouse, serious diagnosis, inheritance, divorce, approaching retirement, large RSU vest, new child). Each page targets "$2M–$30M" consequences specifically, has a 5-question event-specific assessment, and gates the full result behind account creation.

**Reasoning:** Nobody wakes up wanting estate planning software. They wake up having just sold a business or lost a parent. Life event searches ("estate planning after selling a business," "what happens to my estate if I get divorced") have high intent and low competition from mass-market tools that don't address this segment's complexity. The assessment creates personalized urgency using the user's own answers before they've created an account.

**Alternatives considered:** Generic content marketing (lower conversion intent). Paid acquisition only (no organic compounding). Building the event system after launch (rejected — life events are the front door; the public site without them is just another generic wealth management landing page).

---

### May 2026 — Dashboard conflict alerts must be above the fold

**Decision:** The "1 critical · 3 warnings" conflict alert system must be visible on the dashboard without scrolling. **Current (2026-05-30):** severity pill chips in **`DashboardIntroSection`** under the greeting — single above-the-fold surface; mid-page dismissible banner removed as duplicate. Titling badges in **`EstateSummarySection`** collapsible link to `/titling` for detail.

**Reasoning:** The named conflict alerts ("4 accounts missing beneficiaries: Yukon Denali 2019, Kubota Tractor and Accessories…") are the most valuable content on the dashboard and in the product. They demonstrate immediately that the tool understands the user's specific situation. Currently they require 3–4 scrolls to reach, which means most users never see them. No new feature is needed — just surfacing.

**Alternatives considered:** Keeping the current scroll order (rejected — the most valuable content is hidden). Replacing the score card with conflicts (rejected — the score provides important orientation context; both can coexist with the banner approach).

---

### May 2026 — Horizons page layout: cards → comparison table

**Decision:** Redesign the Estate Value and Tax Horizons page from a card-per-column layout to a comparison table with labels on the left and four value columns (Today / In 10 Years / In 20 Years / At Death). "Est. total estate tax liability" moves to a hero row at the top of the table, not the bottom.

**Reasoning:** The four columns currently repeat 8–9 identical labels four times. A user comparing across columns has to read the same label four times to find the values they want. The Scenarios page already uses the correct pattern (labels once on left, values in columns, best value highlighted) — this is a proven pattern in the product. The total tax liability number is the single most important number on the page and should not be the last item the user reads.

**Alternatives considered:** Keeping the card layout with summary numbers at the top of each card (partially implemented in revised design — hero cards show only the tax liability number, table handles the detail). Removing the column breakdown entirely in favor of a single timeline chart (rejected — the specific year breakdowns are important for planning decisions).

---

### June 2026 — ingestion_jobs column consolidation (Sprint F-1 cleanup)

**Decision:** Consolidate `ingestion_jobs` to a single 14-column schema: `file_name` and `file_type` (NOT NULL) replace legacy `original_filename` / `source_format` duplicates. Production cleanup applied via SQL; migration file rewritten to match.

**Reasoning:** Dual column names caused Postgres 23502 (NOT NULL on legacy columns) and PGRST204 (updates referencing columns missing on patched tables). One canonical name per concept simplifies code and PostgREST schema cache.

---

### June 2026 — Financial data import: CSV/XLSX only (Sprint F-1)

**Decision:** Ship bulk financial import at `/import` for **CSV and Excel only** (`.csv`, `.xlsx`, `.xls`). Defer PDF/DOCX parsing post-launch.

**Reasoning:** Tabular formats produce reliable header detection and field mapping. PDF/DOCX require best-effort text extraction with unreliable column structure — bad UX for a data-entry accelerator aimed at retirement-tier users getting data in quickly.

**Implication:** Tier 2 gate. Final schema uses `file_name` + `file_type` (NOT NULL). Smoke verified: 4 asset rows committed.

---

### May 2026 — Do not delete data on consumer→advisor plan change (Sprint C-6)

**Decision:** When Stripe fires `customer.subscription.deleted` on a cancelled consumer subscription, do **not** schedule WCPA deletion if (1) the same Stripe customer has another active or trialing subscription, or (2) the profile role is `advisor`, `financial_advisor`, `attorney`, or `admin`. The daily `process-deletions` cron re-checks both conditions and cancels pending schedules instead of executing.

**Reasoning:** Plan upgrades cancel the old subscription while a new one is created on the same customer. Scheduling deletion would destroy a paying advisor’s household data.

**Implication:** `lib/compliance/deletionGuards.ts`, `scheduleDeletionOnCancel.ts`, webhook + cron. Documented in [COMPLIANCE_CALENDAR.md](./COMPLIANCE_CALENDAR.md) and [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).

---

### May 2026 — Compliance cron alerts + privacy intake (Sprint C-7)

**Decision:** Daily `compliance-reminders` cron emails `COMPLIANCE_EMAIL` (`avoels@comcast.net`) only when checks fail (overdue deletions, deletion failures in 7d, privacy requests due within 7d) or on the 1st of the month (monthly summary). All-clear days send no email. WCPA requests tracked in `privacy_requests` with 45-day SLA; consumer intake at `/settings/security`.

**Reasoning:** Alert fatigue undermines compliance culture; a single ops inbox is sufficient pre-scale. `due_at` uses column DEFAULT not GENERATED — Postgres rejects `(received_at + interval)` as non-immutable.

**Implication:** `ddbf079`, `1ce9110`. Manual cron tests must use `https://www.mywealthmaps.com` — apex 307 to www drops `Authorization` on redirect.

---

### May 2026 — Cron tests use www host (ops)

**Decision:** Document and use `https://www.mywealthmaps.com` for manual cron `curl` tests, not the apex domain.

**Reasoning:** Vercel redirects apex → www; curl does not resend `Authorization` on cross-host redirect → spurious 401.

---

### May 2026 — Import commit succeeds when all rows are duplicates (Sprint F-2)

**Decision:** When `skip_duplicates` is true and every row matches an existing record, `POST /api/import/commit` returns **200** with `success: true`, `committed: 0`, and `skipped` count — not 400.

**Reasoning:** User explicitly chose to skip duplicates; an empty insert is a valid outcome, not a mapping failure.

**Implication:** Covered by `consumer-import.spec.ts` (`a344032`).

---

### June 2026 — Education fully public; double sticky nav fix

**Decision:** `/education/*` is fully public (no login redirect). Marketing `PublicNav` and footer are skipped on education routes; education layout provides its own sticky header. Unpublished modules (`published: false`) return 404 via `getEducationModule()`. Decision-tree suggested paths link to real module URLs.

**Reasoning:** Auth gate blocked anonymous catalog browse and broke sidebar → education flow for logged-out visitors. Stacking marketing nav + education header (both `position: sticky; top: 0; z-index: 100`) pushed education chrome below the fold on scroll, made back navigation unreachable on mobile, and intercepted clicks on module cards.

**Implication:** Run `EDUCATION_LINK_BASE_URL=https://mywealthmaps.com node scripts/validate-education-links.mjs` after education content changes. See [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) P.4, P.10.

---

### May 2026 — Sprint 1: public routes in `(public)` route group, not dashboard sidebar

**Decision:** Move `/education`, `/assess`, `/find-advisor`, and `/find-attorney` to `app/(public)/` with a passthrough layout (no dashboard sidebar). Remove those links from the app sidebar Overview group. Keep education auth-gated in its nested layout.

**Reasoning:** Public discovery and planning app are different mental models. Mixing them in the sidebar made the app feel like a marketing site. URLs stay the same; only layout grouping changes. Marketing top nav on `(public)` is deferred to Sprint 2 — education and directories already render their own headers.

**Alternatives considered:** Leaving routes at `app/` root and `app/(education)/` (rejected — inconsistent route groups). Deleting page components (rejected — breaks bookmarks and SEO).

**Implication:** `CONSUMER_NAV_MAP.md` and `middleware.ts` `PUBLIC_PATHS` must stay aligned. `/education` is in `PUBLIC_PATHS` (anonymous catalog browse allowed). Education auth gate removed 2026-06 — see entry above.

---

### May 2026 — Life event content in TypeScript, not MDX (v1)

**Decision:** Ship Sprint 2 event pages with content in `lib/events/content.ts` (typed `EventContent` records), not MDX files under `content/events/`.

**Reasoning:** Faster to ship eight complete pages with actions, assessment questions, and SEO fields in one reviewable module. No `@next/mdx` setup required. Matches education’s pattern (markdown elsewhere, app-layer rendering).

**Alternatives considered:** MDX per `ROADMAP.md` original spec (deferred). CMS / database-driven events (deferred to Sprint 3+ in-app logging).

---

### May 2026 — `advisor_directory` is the canonical advisor listing table

**Decision:** All advisor listing, connection, and referral resolution uses `advisor_directory` keyed by `profile_id` (professional's auth user id). Do not introduce or query `advisor_listings`.

**Reasoning:** Find-advisor, register, my-advisor, and referral tracking were split across table names; a single canonical table prevents ghost schema and broken referral FKs.

**Implementation:** Migration `20260522000000_advisor_referrals.sql`; `referral_clicks.listing_id` → `advisor_directory(id)`.

**Implication:** All listing/referral queries use `profile_id`, not `advisor_id`, on `advisor_directory`.

---

### May 2026 — Dual analytics: Vercel page views + custom `funnel_events`

**Decision:** Use `@vercel/analytics` for automatic route page views and a separate `funnel_events` table + `/api/analytics/funnel` for conversion steps (assess, email, signup, tier, advisor connect).

**Reasoning:** Vercel Analytics does not capture custom funnel steps or join to `referral_code` / `event_slug`. Product needs SQL-queryable events for A/B analysis and advisor attribution. Client capture is fire-and-forget (`captureFunnelEvent`) so analytics never blocks UX.

**Alternatives considered:** Vercel only (rejected — insufficient for funnel). PostHog/Mixpanel (deferred — Supabase keeps data in-house).

---

### May 2026 — A/B tests via `app_config`, not feature flags service

**Decision:** Store `ab_upgrade_copy` and `ab_assessment_gate` in `app_config`. Toggle values in Supabase dashboard without deploy.

**Reasoning:** Two experiments for Sprint 5; no need for LaunchDarkly-style infra. `getAssessmentGateVariant()` / `getUpgradeCopyVariant()` read at request time on server paths.

**Measurement:** Compare `funnel_events` and conversion rates grouped by variant (store variant in `properties` when needed).

---

### May 2026 — Event content split: `content.ts` + `content-sprint5.ts`

**Decision:** Keep original 8 events in `lib/events/content.ts`; add 16 Sprint 5 events in `lib/events/content-sprint5.ts`; merge via spread into `EVENT_CONTENT`.

**Reasoning:** Single 3k-line file is hard to review and merge. `EVENT_SLUGS = Object.keys(EVENT_CONTENT)` still drives SSG without code changes to `generateStaticParams`.

---

### May 2026 — Idempotent RLS policies in migrations

**Decision:** Wrap `create policy` statements in `DO $$ … IF NOT EXISTS (SELECT 1 FROM pg_policies …)` blocks for `life_events`, `referral_clicks`, and `funnel_events`.

**Reasoning:** Migrations were applied manually in Supabase before `supabase db push`; re-run must not fail on duplicate policy names. Tables/indexes already use `IF NOT EXISTS`.

---

### May 2026 — `/assess` server wrapper for assessment A/B gate

**Decision:** Split `app/(public)/assess/page.tsx` into server page (reads `ab_assessment_gate`) + `_assess-client.tsx` (client UI).

**Reasoning:** Gate variant must be read server-side from `app_config`; the assess UI is a large client component. `full_gate` hides scores for logged-out users; `score_visible` keeps current behavior.

---

### May 2026 — `NEXT_PUBLIC_APP_URL` as canonical public base URL

**Decision:** Use `NEXT_PUBLIC_APP_URL` for sitemap, robots, drip links, and new email CTAs. Production value: `https://estate-planner-gules.vercel.app` until domain cutover to `https://mywealthmaps.com`.

**Reasoning:** One env var avoids drift between `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` in emails and SEO metadata.

**Alternatives considered:** Hardcoding production URL in sitemap (rejected — breaks preview/staging). Keeping both env vars forever (accepted short-term; converge on `NEXT_PUBLIC_APP_URL` for new code).

---

### May 2026 — Resend drip with `INTERNAL_API_KEY`

**Decision:** Implement 3-email drip via Resend: step 1 immediately on `POST /api/email-capture`; steps 2–3 in daily notifications cron; templates in `lib/emails/drip-templates.ts` (default + 3 event-specific sequences). Internal calls authenticate with `x-internal-key: INTERNAL_API_KEY` (cron may also use `CRON_SECRET` on drip route).

**Reasoning:** ESP was deferred in Sprint 2; Resend already used for advisor/attorney connect emails. Non-blocking fetch on capture keeps API fast. `(email, source)` uniqueness drives per-capture drip state columns.

**Alternatives considered:** Dedicated drip cron route (deferred — folded into notifications cron job 7). Dedicated `event_slug` column on `email_captures` (deferred — parse from `source` prefix `event-assess-`).

---

### May 2026 — Admin funnel reads via service role

**Decision:** Admin funnel tab fetches `funnel_events` with `createAdminClient()`, not the user-scoped Supabase server client.

**Reasoning:** `funnel_events` RLS allows users to read only their own rows; admins would see empty data otherwise.

---

### May 2026 — Per-age calendar triggers use dedicated event slugs

**Decision:** Age cron (`/api/cron/age-triggers`) maps 62 → `social-security-timing`, 65 → `medicare-eligibility`, 70 and 73 → `rmd-start-age` instead of a single `approaching-retirement` slug for all milestones.

**Reasoning:** Dedicated event pages and drip/upgrade copy exist for each milestone; users see relevant content and advisors can share matching referral URLs.

**Alternatives considered:** Keep one slug and branch copy in-app only — rejected because 24-slug content model is already live.

---

### May 2026 — Advisor newsletter kit on portal (not email blast product)

**Decision:** Ship copy-paste newsletter kit in `app/advisor/_advisor-client.tsx` (grouped links, HTML email template, plain text) using `buildAllEventReferralUrls` for all 24 slugs. No automated email send from MWM to advisor list.

**Reasoning:** Advisors distribute through their own ESP; we provide assets and tracked links without storing advisor subscriber lists.

---

### May 2026 — One custom drip sequence per event slug (24 total)

**Decision:** Expand `DripEventSlug` and `EVENT_SEQUENCES` to cover all 24 life event pages. Keep `DEFAULT_SEQUENCE` only as fallback for unknown slugs.

**Reasoning:** Launch checklist required parity with public event content; age-milestone slugs (`rmd-start-age`, `medicare-eligibility`, `social-security-timing`) should match age-trigger cron messaging in drip emails.

**Implementation:** `lib/emails/drip-templates.ts` (Sprint 9).

---

### May 2026 — Signup persists both referral codes on `profiles`

**Decision:** On account creation, write `profiles.referral_code` (advisor `?ref=`) and `profiles.attorney_referral_code` (attorney `?aref=`) from sessionStorage once; mirror both in `funnel_events.properties` on `account_created`. Fire-and-forget profile update so navigation is never blocked. If both codes exist, persist both.

**Reasoning:** Funnel rows alone are hard to join for CRM-style reporting; profile columns enable durable joins to `advisor_directory` and `attorney_listings`.

**Implementation:** `20260529000000_profiles_referral_attribution.sql`; `app/(auth)/signup/_signup-form.tsx`.

---

### May 2026 — Attorney referrals use `?aref=` (separate from advisor `?ref=`)

**Decision:** Attorney event attribution uses query param `?aref=` and `referral_clicks.listing_type = 'attorney'`. Advisor `?ref=` behaviour is unchanged. Extend `referral_clicks` with `attorney_listing_id` and `attorney_profile_id` rather than a second click table.

**Reasoning:** Avoids overloading `?ref=` resolution (advisor vs attorney codes could collide). Mirrors `connection_requests.listing_type` pattern. Keeps one click ledger for admin SQL.

**Implementation:** `20260528000000_attorney_referrals.sql`; `POST /api/referral/track` with `type`; session keys `mwm_attorney_referral_code`.

---

### May 2026 — Centralized RMD start age (SECURE Act birth-year cohorts)

**Decision:** Single source of truth `getRmdStartAge(birthYear)` in `lib/calculations/rmdStartAge.ts`: age **72** (born 1950 or earlier), **73** (1951–1959), **75** (1960 or later). All engines and UI surfaces import this helper; advisor client Retirement tab uses **per-person** birth year (fixes hardcoded age 73).

**Reasoning:** Alan Voels (born 1960) and others in the 1960+ cohort must see RMD at **75**, not 73. Duplicated inline `>= 1960 ? 75 : 73` logic missed the pre-1951 age-72 cohort and left advisor Retirement messaging wrong.

**Implementation:** `rmdStartAge.ts`; consumers include `projection-complete.ts`, `lib/calculations/rmd.ts`, `lib/dashboard/calculations.ts`, `lib/monte-carlo.ts`, `app/(dashboard)/rmd/_rmd-client.tsx`, `app/advisor/clients/[clientId]/_tabs/RetirementTab.tsx`, `app/admin/debug-tab.tsx`.

**Note:** Age cron still fires `rmd-start-age` life events at ages **70** and **73** for marketing urgency; that is separate from when RMDs are **required** in projection math.

---

### May 2026 — Prospect Mode state tax path (no household RPC)

**Decision:** Prospect Mode (`/prospect`, `GET /api/advisor/prospect-pdf`) computes state estate tax via `calculateStateEstateTax` in `lib/calculations/stateEstateTax.ts` with rows from `state_estate_tax_rules`. It does **not** call the `calculate_state_estate_tax(p_household_id)` SQL RPC.

**Reasoning:** Prospect inputs are anonymous ranges — there is no household, so the RPC signature cannot apply. The TypeScript engine mirrors the RPC logic and is the same source used elsewhere for bracket-based state tax.

**Implementation:** `lib/prospect/calculateProspectSummary.ts`, `lib/prospect/getProspectTaxConfig.ts` (federal from `federal_tax_config` with OBBBA / sunset fallbacks).

---

### May 2026 — Prospect intake CTA reuses attorney send-intake route

**Decision:** Advisors send prospect intake invitations via existing `POST /api/attorney/send-intake-request`. Role guard accepts `advisor` in addition to attorney. Free-tier 5/month cap remains **attorney-only** (`attorney_tier === 0`).

**Reasoning:** Same email template, token flow, and `attorney_intake_requests` table; avoids duplicate route. Advisor name in email comes from `profiles.full_name`.

---

### May 2026 — Mobile review mode is additive (desktop-first)

**Decision:** Mobile changes are review-only: alert banner (`< lg`), stacked Accept/Decline on advisor recommendations, horizontal scroll on wide tables (projections, RMD, scenarios). No rebuild of planning surfaces for mobile.

**Reasoning:** Professionals and consumers primarily review numbers, alerts, and recs on phone; full modeling stays desktop-first.

**Implementation:** `_dashboard-client.tsx`, `StrategyRecommendationPanel.tsx`, table wrappers in projections/RMD/scenarios clients.

---

### May 2026 — Waitlist mode gates public signup pre-launch (Sprint 15)

**Decision:** While the marketing site is live but not yet accepting accounts, public signup is disabled via env flags. Visitors to `/signup` or public **Get started** CTAs see `/waitlist` (email capture only). Invite/token signup flows bypass the gate (`?invite=`, `?invite_token=` + `?firm_id=`, `?connectionToken=`).

**Reasoning:** Allow domain cutover, SEO prep, and drip testing without open self-serve signup. Runtime redirect in `middleware.ts` avoids stale static `/signup` when env vars change after build.

**Implementation:** `lib/waitlist-mode.ts`, `middleware.ts` (renamed from `proxy.ts` in `3ceb125`), `app/(public)/waitlist/`, `app/(auth)/signup/page.tsx` (`force-dynamic`), `getSignupHref()` on public CTAs, `POST /api/email-capture` skips drip for `source: 'waitlist'`. Default on when `VERCEL_ENV=production`.

**At go-live:** Set `PUBLIC_SIGNUP_OPEN=true` in Vercel Production, redeploy, verify `/signup` open. To re-enable waitlist, remove the var and redeploy. See [LAUNCH_CHECKLIST.md § Opening signups — go-live flip](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip).

---

### May 2026 — Block all crawlers pre-launch

**Decision:** `app/robots.ts` returns `disallow: /` for `userAgent: *` and omits the `sitemap` URL until product launch. `app/sitemap.ts` stays in the codebase. Google Search Console setup deferred.

**Reasoning:** Avoid indexing staging/Vercel URL and incomplete public surfaces before `mywealthmaps.com` cutover. Sitemap and verification (`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`) are ready to enable in one launch checklist.

**At launch:** See [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) for the full task list.

---

### May 2026 — My Wealth Maps design system + Tailwind v4 color syntax

**Decision:** Brand UI uses `--mwm-*` CSS tokens in `app/globals.css`, shared primitives (`Button`, `Card`, `SectionHeader`, `form`), and authenticated sidebar chrome (navy active + gold left accent). Arbitrary Tailwind color classes must use the v4 `color:` prefix.

**Reasoning:** Replaces PlanWise/indigo leftovers; silent failure in Tailwind v4 without `color:` caused invisible gold borders and plain-text banner links.

**Alternatives considered:** Hardcoded hex in components (rejected); staying on Tailwind v3 syntax (not compatible with Next 16 stack).

**Implication:** Phase 3 page sweep must use `CURSOR_PROMPT_TEMPLATE.md` replacements with `color:` on every arbitrary color utility.

---

### May 2026 — Advisor Tax tab: horizon state tax is source of truth (not local recompute)

**Decision:** On the advisor Tax and Domicile tabs, current-law state estate tax in `FederalStateWaterfall` and the current-year row in `StateTaxPanel` must use `advisorHorizons.today.stateTax` when available. Year-by-year projection rows may use `outputs_s2_first` gross estate but must be labeled as the surviving-spouse timeline, with Today vs At death horizon callouts when horizons exist.

**Reasoning:** A local bracket recompute in the waterfall could return $0 while `buildStrategyHorizons` already computed correct WA tax via `calculateStateEstateTax`. MFJ was also mis-detected when DB stored `married_filing_jointly`. Users reported federal/state waterfall showing $0 state tax while State Tax Detail showed higher estimates.

**Alternatives considered:** Recompute everywhere in UI (rejected — duplicates engine, drifts from Strategy tab). Hide projection table (rejected — advisors need year context with clear labels).

**Implication:** New advisor tax UI must not add a third state-tax code path; extend horizons or `StateTaxPanel` props. See calculation audit table in [MASTER_ARCHITECTURE.md § Calculation consistency audit](./MASTER_ARCHITECTURE.md#calculation-consistency-audit-2026-05-26).

---

### May 2026 — Persona onboarding gate uses wizard-ready profile

**Decision:** `/onboarding/persona` server gate uses `isWizardReadyProfile` (state, filing status, birth year) — not full `isMinimumViableProfile` (which also requires `person1_name`).

**Reasoning:** Persona selection follows demographics capture; a partial household SELECT on the persona page caused false redirects to `/profile?required=true` when `person1_name` was omitted from the query object even though the DB row was complete.

**Implication:** Estate planning pages and `requireMinimumViableProfile` still require name; persona/wizard funnel uses wizard-ready checks. E2E: `tests/e2e/consumer/onboarding-persona.spec.ts`.

---

### May 2026 — Cross-household isolation tests accept 403 or 404

**Decision:** Playwright IDOR matrix specs treat **403 Forbidden** and **404 Not Found** as successful denial for foreign household reads (`gifting-summary`, `estate-composition`, `export-estate-plan`).

**Reasoning:** API routes return 404 when `access.reason === 'not_found'` to avoid leaking household existence; 403 when explicitly forbidden.

**Implication:** Do not treat prod 404s on these routes during isolation test runs as broken routes. Spec: `tests/e2e/security/cross-household-isolation.spec.ts`.

---

### May 2026 — App Router slug conflict CI guard

**Decision:** CI runs `npx tsx scripts/verify-app-route-slugs.ts` on every push; fails if conflicting dynamic segments exist at the same path depth (Next.js 16 may build while Vercel silently hangs all `/api/*` handlers).

**Reasoning:** Root cause of May 2026 prod outage — `[household_id]` vs `[id]` under `/api/documents/`.

**Implication:** New API routes must not introduce sibling dynamic param names at the same depth.

---

## Template for new entries

### [Date] — [Topic]

**Decision:** [What was decided — one clear sentence]

**Reasoning:** [Why this decision was made — the key arguments]

**Alternatives considered:** [What else was evaluated and why it was rejected]

**Implication:** [What this means for future work, if not obvious]
