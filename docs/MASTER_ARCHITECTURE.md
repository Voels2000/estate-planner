# MASTER_ARCHITECTURE.md
# MyWealthMaps / Estate Planner — Full Architecture Reference
# Last updated: April 30, 2026 (Session 90 / planning readiness assessment route)

---

## Purpose

This is the architecture reference for engineering handoff and implementation consistency.
It documents both:

- **Current implementation** (as built)
- **Target architecture** (where migration is still in progress)

---

## Core Principles — Single Sources of Truth

| Tax | Data Source | Engine | Notes |
|-----|-------------|--------|-------|
| Federal estate tax | `federal_tax_config` | `lib/calculations/estate-tax.ts` | Admin-managed |
| State estate tax | `state_estate_tax_rules` | `lib/calculations/stateEstateTax.ts` | Admin-managed |
| Federal income tax | `federal_tax_brackets` (canonical) | `computeCompleteProjection()` | Admin-managed only; canonical engine now requires DB brackets |
| State income tax | `state_income_tax_brackets` (canonical) | `stateIncomeTax.ts` (shared) | Canonical for user-facing calculations |
| State inheritance tax | `state_inheritance_tax_rules` | `InheritanceTaxWaterfall.tsx` | Admin-managed |

Important:

- `state_income_tax_rates` is **legacy** and retained only as a read-only admin archive.
- User-facing calculations are bracket-based; remaining legacy table usage is admin archive/maintenance only.

---

## Tax Engine Architecture

### State Estate Tax Chain

1. Fetch `state_estate_tax_rules` by `.eq('state', household.state_primary)`.
2. Build `stateBrackets`.
3. Call `calculateStateEstateTax(...)` from `lib/calculations/stateEstateTax.ts`.
4. Feed into `computeColumnTaxes(...)` and `buildStrategyHorizons(...)` in `lib/my-estate-strategy/horizonSnapshots.ts`.
5. Pass typed horizon outputs to UI; UI should not recalculate estate tax.

### Advisor Cross-Tab State Tax Parity

**Current (as built):**

- Advisor **Strategy**, **Tax**, and **Domicile** tabs now align on the same primary "today" estate base for state estate tax comparisons:
  - Prefer `advisorHorizons.today.grossEstate` (from `buildStrategyHorizons(...)`).
  - Fall back to mapped scenario/estate composition values when horizon data is unavailable.
- Advisor tax calculations across these tabs now consistently use `household.state_primary` as the primary state source for state estate tax comparisons (with guarded fallback to claimed domicile where needed for non-tax domicile UX).

**Effect:**

- Cross-tab state estate tax numbers are now expected to match when viewing equivalent scenario conditions.
- Planned domicile transitions still influence **domicile risk** and **breakeven target prefill**, but no longer silently change tab-to-tab state estate tax basis.

### Federal Estate Tax Parity

**Current (as built):**

- Consumer and advisor strategy horizon outputs continue to come from shared `buildStrategyHorizons(...)` in `lib/my-estate-strategy/horizonSnapshots.ts`.
- Advisor **Tax** tab now uses horizon-derived federal estimate for current-law mode:
  - Require `advisorHorizons.today.federalTaxEstimate` + horizon gross-estate input for current-law display.
  - If missing, show an explicit "horizon inputs missing" warning (no silent fallback substitution).
- Consumer trust-strategy estate context now aligns to horizon-derived federal values:
  - Require `advisorHorizons.today.federalExemption` and `advisorHorizons.today.federalTaxEstimate`.
  - If missing, surface a page warning and keep federal context unavailable until horizon inputs are restored.
- Missing-input observability hooks are now in place:
  - Advisor Tax tab emits one client-side telemetry event to `/api/telemetry/horizon-input-missing`.
  - Consumer trust-strategy page emits a structured server log event when horizon federal inputs are missing.
  - Advisor Strategy tab now emits telemetry when required `today` horizon tax inputs are missing.

**Effect:**

- Federal estate tax numbers are expected to match across advisor and consumer views when they are evaluating the same household/scenario snapshot.
- Remaining differences should now only come from intentional scenario mode differences (for example, advisor stress-test law scenario toggles) rather than mixed data sources or fallback substitutions.

### Shared Label-Basis Contract (Estate + Tax Panels)

**Current (as built):**

- Canonical helper: `lib/tax/labelTaxBasis.ts` (`buildEstateTaxYearBasis`).
- Contract now enforced in advisor state tax detail:
  - Current-year label uses today actual gross estate basis.
  - Future-year labels use projection-row gross estate basis.
  - Missing projection years remain unavailable instead of silently falling back to current estate.
- Advisor Tax tab now uses horizon `today` basis for gross estate and federal tax parity checks.

**Effect:**

- The same label now maps to the same estate basis inside advisor tax surfaces (`FederalStateWaterfall` + `StateTaxPanel`), eliminating current-year basis drift.

### Strategy Set Contract (Actual vs Projected)

**Current (as built):**

- Canonical strategy sets are now explicitly separated before horizon computation:
  - `actualStrategies`: consumer-entered plus advisor items that are consumer-accepted.
  - `pendingAdvisorStrategies`: advisor-entered items not yet accepted/rejected.
  - `projectedAdvisorStrategies`: actual + pending advisor strategies.
- Advisor Strategy tab now computes two horizon payloads from the same engine (`buildStrategyHorizons`):
  - `advisorHorizons` (actual)
  - `advisorHorizonsProjected` (projected with pending advisor recommendations)
- Consumer My Estate Strategy now follows the same dual-horizon contract:
  - Default view shows actual estate (entered/approved only).
  - Read-only what-if toggle shows projected values if pending advisor recommendations were accepted.
- Advisor Combined Strategy view now threads the selected mode (`actual` vs `projected`) into `CompositeOverlay`, and displays inside/outside estate boundary snapshot values from the same selected horizon payload.

**Effect:**

- Inside/outside estate totals for any given label are now driven by one strategy-set definition per mode (actual vs projected), avoiding mixed-path drift across advisor and consumer strategy surfaces.

### State Income Tax Chain

**Current (as built):**

- `moveBreakeven.ts` uses `lib/calculations/stateIncomeTax.ts`.
- `projection-complete.ts` now calls `lib/calculations/stateIncomeTax.ts`.
- `roth-analysis.ts` now uses `lib/calculations/stateIncomeTax.ts` for state marginal/effective tax logic.
- `moveBreakeven.ts` now evaluates state income tax deltas by labeled tax year (`currentYear + n`) rather than a single latest-year bracket snapshot.
- Shared helper introduced for year-labeled income tax basis:
  - `lib/tax/incomeTaxTimeline.ts`
  - Builds canonical yearly labels and state-income-tax savings series used by move-breakeven.
- Roth conversion year handling now also consumes the shared income-tax label mapping helper (`buildIncomeTaxLabelsFromYears`) so state marginal and incremental state-tax lookups use the same year-label contract.

**Target:**

- Keep all state income tax call paths on `stateIncomeTax.ts` shared logic.

### Projection Engine (Backbone)

- File: `lib/calculations/projection-complete.ts`
- Entry points: `app/api/projection/route.ts`, `lib/actions/generate-base-case.ts`
- Includes: federal income tax, state income tax, capital gains tax, NIIT, payroll tax, IRMAA.
- Uses progressive state brackets by filing status and year.

### Federal Income Tax Chain

**Canonical path (production backbone):**

- `lib/calculations/projection-complete.ts`
  - Reads `federal_income_tax_brackets` input supplied from `federal_tax_brackets` table.
  - Selects brackets by filing status and tax year (nearest available year <= projection year, else latest available year).
  - No hardcoded federal fallback in canonical path; missing brackets are treated as a configuration error.

**Loader wiring now in place:**

- `app/api/projection/route.ts` loads `federal_tax_brackets` and passes rows into `computeCompleteProjection(...)`.
- `lib/actions/generate-base-case.ts` loads `federal_tax_brackets` and passes rows into `computeCompleteProjection(...)` for saved base-case scenarios.

Canonical projection path is `computeCompleteProjection` only; legacy `lib/calculations/projection.ts` has been removed.

---

## Strategy Recommendation Workflow

### Current

- Advisor recommendation writes are unified:
  - Canonical advisor write path: `/api/advisor/strategy-recommendation`
  - Advisor recommendation reads: `/api/advisor/strategy-recommendations-read`
- Consumer save/progress writes through `/api/strategy-line-items`.
- Consumer accept/reject of advisor recommendations is now handled by `/api/consumer/strategy-recommendation`:
  - `PATCH` marks advisor item accepted (`consumer_accepted=true`, `accepted_at` set, `consumer_rejected=false`)
  - `DELETE` marks advisor item rejected (`consumer_rejected=true`, `consumer_accepted=false`)
- Advisor read path now includes both active and client-rejected advisor items for visibility;
  composability/waterfall calculations exclude rejected rows.

### Target

- Keep advisor recommendation writes on `/api/advisor/strategy-recommendation` with advisor-client link validation.
- Optionally migrate consumer save/progress to a dedicated consumer route family (or keep `/api/strategy-line-items` as canonical).

### Invariants

1. Consumer model should only include:
   - `source_role='consumer'` OR
   - advisor rows with `consumer_accepted=true`.
2. Keep acceptance/rejection history (do not hard-delete for audit).
3. Accepted recommendation amounts should be immutable; revisions create new rows.
4. Advisor surfaces may display rejected rows as declined history, but rejected rows must be excluded from active strategy impact calculations.

---

## Monte Carlo Workflow

### Current

- Defaults live in code: `MONTE_CARLO_SYSTEM_DEFAULTS`.
- Advisor assumptions saved in `advisor_projection_assumptions`.
- Advisor-side comparison flow exists.
- Consumer accept/revert flow is implemented via `advisor_projection_assumptions.accepted_by_client` + `accepted_at`.
- Consumer endpoint: `/api/monte-carlo/advisor-assumptions` (read latest shared + accepted scenario, accept, revert).
- Consumer UI (`/monte-carlo`) applies accepted advisor assumptions to page-level assumption inputs (inflation and simulation count).

### Target

- Consumer remains on defaults until advisor scenario is explicitly accepted.
- Engine remains pure (`runMonteCarloSimulation(input, assumptions)`).
- Expand consumer Monte Carlo engine parity so all advisor assumption fields are consumed uniformly across both advisor and consumer Monte Carlo surfaces.

---

## Staleness + Regeneration Contract

Projection snapshots are stale when `projection_scenarios.calculated_at` is older than:

- `households.updated_at`
- latest changes in: assets, liabilities, income, expenses, real_estate, businesses, business_interests, insurance_policies
- latest `state_income_tax_brackets.created_at`
- latest `federal_tax_brackets.created_at`

Runtime behavior:

- Pages render from stored snapshots for speed.
- If stale, trigger background base-case regeneration.

---

## Consumer Billing + Access Contract

**Current (as built):**

- Consumer billing page now shows all consumer subscription tiers at initial purchase entry:
  - Financial
  - Retirement
  - Estate
- Tier-based feature gating remains enforced by `lib/tiers.ts` (`FEATURE_TIERS`) and dashboard/layout access checks.
- Missing-data guardrails remain in place across core planning surfaces (generate/retry flows, unavailable-state banners, and horizon-missing telemetry).

**Download policy (explicit):**

- Educational/on-screen content may be available during trial.
- Trial users **cannot** download exports/PDF artifacts.
- Download endpoints must require paid-active subscription state (not `trialing`), with minimum paid tier checks applied per surface.
- Enforcement now wired in:
  - `app/api/export-estate-plan/route.ts` requires paid-active consumer status and Tier 3 for PDF export.
  - `app/api/documents/download/[document_id]/route.ts` requires paid-active consumer status for document downloads.
  - `app/api/documents/[household_id]/route.ts` aligns `can_download` metadata with paid-active consumer status so trial users are not shown downloadable actions.

---

## Education Guide Architecture

**Current (as built):**

- Education route family is implemented under `app/(education)/education/*`.
- Education pages are auth-gated (`app/(education)/education/layout.tsx`); users must be logged in before viewing.
- Content is markdown-first:
  - Module files live under `content/education/modules/*.md`
  - Additional long-form pages use `content/education/decision-tree.md` and `content/education/glossary.md`
- Markdown ingestion is handled by `lib/education/loaders.ts` (frontmatter + body parsing).

**Progress and learning UX:**

- Progress is persisted per user in DB:
  - `education_progress` table (migration: `20260429131500_create_education_progress.sql`)
  - RLS policies enforce own-row access.
- Progress API:
  - `GET/POST /api/education/progress`
- Catalog and module UI now include:
  - Pillar/complexity filters
  - Search by title/summary/tags
  - Guided path bundles (Foundations, Estate Advanced, Scenario)
  - Path-start CTA (jumps to first incomplete module in selected path)
  - Completion progress bar
  - Next recommended + continue learning CTA
  - Recently completed strip
  - Module-level resume banner

**Education download policy:**

- Prep sheet page is visible on-screen for logged-in users.
- Download endpoint (`/api/education/prep-sheet/download`) enforces paid-active consumer status (Tier 1+) and blocks trial download.

**Navigation + landing integration:**

- Sidebar navigation now includes `Education Guide` under Overview.
- Root route behavior (`app/page.tsx`) is now:
  - Signed-out users: public education-first marketing landing page
  - Signed-in users with profile: redirect to `/education`
  - Signed-in users without profile: redirect to `/profile`
- Root middleware guard behavior (`proxy.ts`) now explicitly allows unauthenticated `/` requests to pass through after login redirect checks, preventing profile lookups for signed-out landing-page traffic.
- New public assessment route is available at `/assess`:
  - File: `app/assess/page.tsx`
  - Client-rendered 20-question planning readiness flow across financial, retirement, and estate pillars
  - Includes intro, guided question progression with progress bar, and results with pillar-level gap scoring

**Design system + education UI refresh:**

- Shared visual system artifacts are now documented and versioned in:
  - `DESIGN_SYSTEM.md`
  - `assets/design-system.css`
- The education route family and root landing surface now share the same updated visual language (typography, spacing, cards, badges, and call-to-action treatment) for consistent signed-out and signed-in transitions.
- Education markdown rendering now has explicit prose styling hooks in `app/(education)/education/education-theme.css` under `.education-prose-content*` selectors (headings, paragraph/list rhythm, links, blockquotes, table chrome, and inline/preformatted code treatment) so module/decision-tree/glossary content remains visually consistent with the design system.

**Content coverage status:**

- Module library now includes core foundations, tax/probate/trust deep dives, advisor prep, scenario set, and advanced strategy education topics (ILIT, QPRT, FLP/FLLC, charitable trusts, asset protection, multi-state, business succession).

---

## Compliance Matrix (Current)

| Surface | Tax Type | Source | Status |
|---------|----------|--------|--------|
| Estate composition card | State estate | `calculate_estate_composition` RPC | Implemented |
| My Estate Strategy horizons | State estate | `buildStrategyHorizons` + `calculateStateEstateTax` | Implemented |
| Advisor strategy horizons | State estate | `advisorHorizons` | Implemented |
| Advisor Strategy/Tax/Domicile parity | State estate | Shared `advisorHorizons.today.grossEstate` basis + `household.state_primary` state source | Implemented |
| Advisor + Consumer federal parity | Federal estate | Shared horizon outputs (`federalExemption`, `federalTaxEstimate`) with guarded fallback only | Implemented |
| Advisor tax label basis | Estate basis mapping | `buildEstateTaxYearBasis` (`today`=actual, future=projection) | Implemented |
| Domicile State Tax panel | State estate | `state_estate_tax_rules` | Implemented |
| Move breakeven | State income + estate | `stateIncomeTax.ts` + estate tax logic | Implemented |
| Projection engine | State income | `stateIncomeTax.ts` shared engine | Implemented |
| Roth optimizer | State income | `stateIncomeTax.ts` shared engine helpers | Implemented |

---

## Legacy State Income Tax Usage Trace (Current)

This section enumerates the remaining place where the legacy flat-rate table is still read.

### Still reading `state_income_tax_rates`

- `app/admin/tax-rules-tab.tsx`
  - Legacy archive view for `state_income_tax_rates` remains for historical reference.

### Already on bracket-based path

- `lib/calculations/projection-complete.ts`
  - Uses `stateIncomeTax.ts` with `state_income_tax_brackets` inputs.
- `lib/domicile/moveBreakeven.ts`
  - Uses shared progressive engine in `lib/calculations/stateIncomeTax.ts`.
- `app/(dashboard)/domicile-analysis/page.tsx` + `app/(dashboard)/domicile-analysis/_domicile-results.tsx`
  - Now read/display from `state_income_tax_brackets` (no legacy `state_income_tax_rates` read).
- `app/(dashboard)/roth/page.tsx` + `lib/calculations/roth-analysis.ts`
  - Now read `state_income_tax_brackets` and use shared `stateIncomeTax.ts` functions for state marginal and incremental state tax.

### Optional cleanup target

1. Keep `state_income_tax_rates` as a compatibility archive only, or remove the table/admin archive surface once historical visibility is no longer needed.
2. Continue retiring non-canonical/legacy helpers as part of the `projection.ts` deprecation cleanup path.

### Federal income tax consistency target

1. Keep admin-managed `federal_tax_brackets` as the single source of truth for federal income tax in the canonical projection engine.
2. Continue using bracket-table timestamp staleness triggers so admin bracket edits regenerate projections.
3. Ensure required bracket coverage by filing status/year in non-prod seed data and admin maintenance workflow.

---

## Key Files

### Engines

- `lib/calculations/stateEstateTax.ts`
- `lib/calculations/stateIncomeTax.ts` (shared income tax engine)
- `lib/calculations/projection-complete.ts`
- `lib/calculations/roth-analysis.ts`
- `lib/domicile/moveBreakeven.ts`
- `lib/my-estate-strategy/horizonSnapshots.ts`
- `lib/projections/loaders/loadProjectionPageData.ts` (consumer projections data loading)
- `lib/projections/mappers/mapProjectionRows.ts` (consumer projections API row mapping)
- `lib/projections/selectors/getProjectionSummary.ts` (consumer projections derived metrics)
- `lib/dashboard/calculations.ts` (shared SS/RMD calculation helpers)
- `lib/dashboard/setupProgress.ts` (dashboard setup progress derivation)
- `lib/dashboard/retirementSnapshot.ts` (retirement horizon snapshot derivation)
- `lib/dashboard/rmdStatus.ts` (RMD requirement/planned rollup derivation)
- `lib/dashboard/incomeSnapshot.ts` (income, expense, SS, and savings snapshot derivation)
- `lib/dashboard/loaders.ts` (dashboard Supabase/admin query orchestration)
- `lib/dashboard/mappers.ts` (dashboard health/conflict/allocation view-model mapping)

### APIs

- `app/api/projection/route.ts`
- `app/api/advisor/generate-base-case/route.ts`
- `app/api/advisor/strategy-recommendation/route.ts`
- `app/api/advisor/strategy-recommendations-read/route.ts`
- `app/api/consumer/strategy-recommendation/route.ts`
- `app/api/projection/monte-carlo/route.ts`
- `app/api/advisor/monte-carlo-assumptions/route.ts`
- `app/api/monte-carlo/advisor-assumptions/route.ts`

### Consumer UI Composition (Current)

- Route: `app/(dashboard)/projections/page.tsx`
- Local UI components are split under `app/(dashboard)/projections/_components/*`
- Shared projection route types are centralized in `lib/projections/types.ts`
- This refactor is structure-only (no behavior/calculation change); projection math still comes from `projection-complete.ts`
- Dashboard route `app/(dashboard)/dashboard/page.tsx` is decomposed into helper modules under `lib/dashboard/*` (calculations, loaders, and mappers) with no behavior changes.
- Dashboard empty-state rendering is componentized under `app/(dashboard)/dashboard/_components/*` to keep the route file orchestration-focused.
- Dashboard client route composition in `app/(dashboard)/_dashboard-client.tsx` now delegates rendering to feature components under `app/(dashboard)/_components/dashboard/*` (`DashboardIntroSection`, `FinancialSummarySection`, `RetirementSummarySection`, `EstateSummarySection`) while keeping data flow unchanged.
- Shared financial rollup view-models are now being introduced under `lib/view-models/*`; `lib/view-models/netWorthSummary.ts` is used by both consumer dashboard and advisor overview surfaces.
- `lib/view-models/retirementSnapshot.ts` now centralizes dashboard retirement snapshot object construction (composition-only refactor; calculations remain in `lib/dashboard/retirementSnapshot.ts` + `lib/dashboard/incomeSnapshot.ts`).
- `lib/view-models/taxScopeBadges.ts` now centralizes advisory metric scope badge mapping (`federal`, `state`, `both`, `strategy`) to keep label/class semantics consistent where scope chips are rendered.
- `lib/view-models/projectionSummaryCards.ts` now centralizes consumer projection summary card composition (labels, values, highlights) while calculation inputs still come from the shared projections selector pipeline.
- Projection staleness contract logic is now centralized in `lib/projections/staleness.ts` (`getLatestTimestampMs`, `isProjectionStale`) and adopted by consumer dashboard + advisor client page staleness checks.
- Advisor client staleness fetch orchestration is now extracted into `lib/advisor/loaders.ts` (`loadAdvisorProjectionStaleness`) so `app/advisor/clients/[clientId]/page.tsx` focuses on page composition rather than timestamp query plumbing.
- Advisor client page bootstrap access/ownership reads are now extracted into `lib/advisor/clientPageLoaders.ts` (`loadAdvisorContextOrRedirect`, `loadAdvisorClientLinkOrRedirect`, `loadAdvisorClientHouseholdOrRedirect`) to keep route guards consistent and reduce page-level query noise.
- Advisor client bulk tab data fetch orchestration is now extracted into `lib/advisor/loaders.ts` (`loadAdvisorClientDatasets`) so the route can consume a single loader result instead of maintaining a large inline `Promise.all` query block.
- Advisor client post-fetch normalization/mapping is now extracted into `lib/advisor/mappers.ts` (`mapAdvisorClientDatasets`) for beneficiary normalization, scenario output selection, and dataset shaping before route composition.
- Advisor export payload assembly is now extracted into `lib/advisor/exportMappers.ts` (`buildAdvisorExportPayloads`) so the advisor client route no longer owns PDF/Excel/export-panel payload construction logic.
- Shared advisor export panel contract typing is now centralized in `lib/advisor/types.ts` (`AdvisorExportPanelProps`) and consumed by both export mappers and advisor client shell props.
- Advisor dataset mapper typing is now hardened in `lib/advisor/mappers.ts` with explicit mapper interfaces and typed output shaping; advisor route composition now consumes typed mapper outputs without broad `any` payload contracts.
- Advisor client route-level assertions for `businesses`, `liabilities`, `businessInterests`, and `insurancePolicies` were removed after mapper output typing alignment, reducing local type coercion in `app/advisor/clients/[clientId]/page.tsx`.
- A named shared loader result contract (`AdvisorClientDatasetsResult`) is now exported from `lib/advisor/loaders.ts` and reused by advisor mappers, so loader/mapping boundaries align on a single typed dataset envelope.
- Advisor strategy/horizon view-model assembly is now extracted into `lib/advisor/strategyMappers.ts` (`buildAdvisorStrategyViewModels`), removing horizon computation and `scenarioForStrategy` assembly from the route body.
- Advisor route side-effect and auxiliary fetches are further centralized in `lib/advisor/loaders.ts` via `loadAdvisorDomicileChecklist` and `logAdvisorClientAccess`, reducing remaining route-level Supabase plumbing.
- Advisor client route orchestration readability was polished in `app/advisor/clients/[clientId]/page.tsx` (grouped imports + explicit phase comments) with no behavior or query changes.
- High-impact comment/header audit is complete for core projection/dashboard/advisor routes, loaders, tabs, and APIs; sprint-specific file headers were replaced with stable purpose comments to improve maintainability without changing behavior.
- Shared strategy horizon impact table is now introduced at `components/shared/StrategyHorizonTable.tsx` and used in advisor combined strategy view plus consumer trust-strategy review flow.
- Advisor combined recommendations view now separates active vs declined recommendations; declined items remain visible for advisor context but are excluded from composite impact calculations.
- Strategy source normalization now treats `cst`, `roth`, and `liquidity` as canonical strategy sources in recommendation save/read and saved-state indicators.

---

## Known Transitional Exceptions

1. User-facing Roth + Domicile surfaces are now bracket-based; remaining `state_income_tax_rates` usage is admin legacy maintenance only.
2. Legacy `lib/calculations/projection.ts` has been removed; canonical projection path is `projection-complete.ts`.
3. Consumer save/progress still uses legacy-named `/api/strategy-line-items` (single endpoint path).

---

## Pre-Release Checklist for Tax/Engine Changes

- `npm run build` passes
- Lint/types pass on changed modules
- Spot-check `/projections`
- Spot-check `/roth`
- Spot-check advisor domicile breakeven
- Confirm staleness-trigger regeneration
- Decide/execute backfill for stored scenarios

---

## Open Backlog (High Priority)

1. Deferred cleanup: keep `/api/strategy-line-items` as canonical consumer path for now; revisit `/api/consumer/strategy-*` endpoint naming during a broader consumer API label cleanup.
2. Expand consumer Monte Carlo engine parity with advisor assumption fields beyond inflation/simulation count.
3. Keep this file updated with **Current vs Target** deltas each session.

