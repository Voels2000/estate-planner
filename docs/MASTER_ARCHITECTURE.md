# MASTER_ARCHITECTURE.md
# MyWealthMaps / Estate Planner — Full Architecture Reference
# Last updated: April 28, 2026 (Session 62 / advisor route orchestration polish)

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
| Federal income tax | Code constants | `computeCompleteProjection()` | Annual code update required |
| State income tax | `state_income_tax_brackets` (target canonical source) | Current: projection + roth internal logic; shared engine used by breakeven | Transition still in progress |
| State inheritance tax | `state_inheritance_tax_rules` | `InheritanceTaxWaterfall.tsx` | Admin-managed |

Important:

- `state_income_tax_rates` is **legacy** and should be phased out.
- Projection and breakeven are bracket-based; some non-engine surfaces still read legacy rates.

---

## Tax Engine Architecture

### State Estate Tax Chain

1. Fetch `state_estate_tax_rules` by `.eq('state', household.state_primary)`.
2. Build `stateBrackets`.
3. Call `calculateStateEstateTax(...)` from `lib/calculations/stateEstateTax.ts`.
4. Feed into `computeColumnTaxes(...)` and `buildStrategyHorizons(...)` in `lib/my-estate-strategy/horizonSnapshots.ts`.
5. Pass typed horizon outputs to UI; UI should not recalculate estate tax.

### State Income Tax Chain

**Current (as built):**

- `moveBreakeven.ts` uses `lib/calculations/stateIncomeTax.ts`.
- `projection-complete.ts` uses internal progressive bracket logic.
- `roth-analysis.ts` uses internal progressive logic (bracket-aware).

**Target:**

- Projection and Roth should call the shared `stateIncomeTax.ts` engine directly.

### Projection Engine (Backbone)

- File: `lib/calculations/projection-complete.ts`
- Entry points: `app/api/projection/route.ts`, `lib/actions/generate-base-case.ts`
- Includes: federal income tax, state income tax, capital gains tax, NIIT, payroll tax, IRMAA.
- Uses progressive state brackets by filing status and year.

---

## Strategy Recommendation Workflow

### Current

- Advisor recommendation writes are mixed:
  - New path: `/api/advisor/strategy-recommendation`
  - Legacy paths: `/api/strategy-line-items`, `/api/strategy-configs`

### Target

- Single advisor write path through `/api/advisor/strategy-recommendation` with advisor-client link validation.

### Invariants

1. Consumer model should only include:
   - `source_role='consumer'` OR
   - advisor rows with `consumer_accepted=true`.
2. Keep acceptance/rejection history (do not hard-delete for audit).
3. Accepted recommendation amounts should be immutable; revisions create new rows.

---

## Monte Carlo Workflow

### Current

- Defaults live in code: `MONTE_CARLO_SYSTEM_DEFAULTS`.
- Advisor assumptions saved in `advisor_projection_assumptions`.
- Advisor-side comparison flow exists.
- Consumer accept/revert flow is planned.

### Target

- Consumer remains on defaults until advisor scenario is explicitly accepted.
- Engine remains pure (`runMonteCarloSimulation(input, assumptions)`).

---

## Staleness + Regeneration Contract

Projection snapshots are stale when `projection_scenarios.calculated_at` is older than:

- `households.updated_at`
- latest changes in: assets, liabilities, income, expenses, real_estate, businesses, business_interests, insurance_policies
- latest `state_income_tax_brackets.created_at`

Runtime behavior:

- Pages render from stored snapshots for speed.
- If stale, trigger background base-case regeneration.

---

## Compliance Matrix (Current)

| Surface | Tax Type | Source | Status |
|---------|----------|--------|--------|
| Estate composition card | State estate | `calculate_estate_composition` RPC | Implemented |
| My Estate Strategy horizons | State estate | `buildStrategyHorizons` + `calculateStateEstateTax` | Implemented |
| Advisor strategy horizons | State estate | `advisorHorizons` | Implemented |
| Domicile State Tax panel | State estate | `state_estate_tax_rules` | Implemented |
| Move breakeven | State income + estate | `stateIncomeTax.ts` + estate tax logic | Implemented |
| Projection engine | State income | internal progressive logic | Implemented |
| Roth optimizer | State income | internal progressive logic | Implemented |

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
- `app/api/projection/monte-carlo/route.ts`
- `app/api/advisor/monte-carlo-assumptions/route.ts`

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

---

## Known Transitional Exceptions

1. Some surfaces still query `state_income_tax_rates`.
2. Projection and Roth are not yet importing shared `stateIncomeTax.ts` directly.
3. Advisor strategy writes still run through mixed routes.

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

1. Complete migration off `state_income_tax_rates`.
2. Normalize advisor strategy write path.
3. Finish Monte Carlo consumer acceptance flow.
4. Keep this file updated with **Current vs Target** deltas each session.

