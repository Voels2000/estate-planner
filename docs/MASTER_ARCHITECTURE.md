# MASTER_ARCHITECTURE.md
# MyWealthMaps / Estate Planner — Full Architecture Reference
# Last updated: 2026-05-25 (OB-3 setup progress; AF-1; OB-1/OB-2; Sprint 17 go-live prep)

---

## Purpose

This is the architecture reference for engineering handoff and implementation consistency.
It documents both:

- **Current implementation** (as built)
- **Target architecture** (where migration is still in progress)

**Related docs:** [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) (why/segment) · [ROADMAP.md](./ROADMAP.md) (sprints) · [NEXT_SESSION.md](./NEXT_SESSION.md) (current sprint handoff) · [DECISION_LOG.md](./DECISION_LOG.md) (settled decisions) · [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) (journeys) · [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md) (routes) · [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) (go-live test user reset) · [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) · [E2E_RELEASE_TEST_PLAN.md](./E2E_RELEASE_TEST_PLAN.md) (automated vs manual smoke) · [UX_LANGUAGE_AUDIT_SPRINT.md](./UX_LANGUAGE_AUDIT_SPRINT.md) (compliance language policy) · [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) (C-4 billing) · [LEGAL_TODO.md](./LEGAL_TODO.md) (C-5 legal gate) · [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) (P-1 + P-2 perf) · [UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md) (merge/release checklist) · [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md) (session history)

---

## Consumer and advisor interaction

Consumers and advisors share one **household** data model but operate in separate app trees:

| App tree | Path | Users |
|----------|------|--------|
| Consumer | `app/(dashboard)/` | Household owner |
| Advisor | `app/advisor/` | Advisor with accepted `advisor_clients` link |

**Shared computation:** Federal/state estate figures are expected to match across portals when viewing the same household snapshot, because both use `buildStrategyHorizons()` and `calculate_estate_composition` (parity work Sessions 118–121).

### Handoff channels

**1. Strategy recommendations**

- Advisor writes `strategy_line_items` with `source_role='advisor'` via `/api/advisor/strategy-recommendation`.
- Consumer UI: dashboard `StrategyRecommendationPanel`; trust-strategy **Transfer Strategies** tab (“Advisor Recommended Strategies”).
- Consumer accept/reject: `PATCH` / `DELETE` on `/api/consumer/strategy-recommendation` sets `consumer_accepted` / `consumer_rejected`.
- Accepted rows join consumer-entered lines in **actual** horizon and composition calculations.

**2. Monte Carlo assumptions**

- Rows in `advisor_projection_assumptions`; changes audited in `projection_assumption_audit`.
- Consumer: `MonteCarloScenarioBanner` on `/dashboard` and `/my-estate-strategy`; `/api/monte-carlo/advisor-assumptions` (read, accept, revert).
- Advisor presets (Session 126): separate `is_preset` rows; not the same as per-client shared scenarios.

**3. Access and notifications**

- Link boundary: `advisor_clients` with `status` in `CONNECTED_ADVISOR_CLIENT_STATUSES` (`'active'` | `'accepted'`). Import from `lib/advisor/clientConnectionStatus.ts` — do not hardcode a single status in new code.
- Advisor workspace: `/advisor/clients/[clientId]?tab=…`
- Consumer: `/my-advisor` (connection, revoke, pending `connection_requests`); optional `advisor_pdf_access`.
- Attorneys: `attorney_clients`, `/my-attorney`, `/settings/attorney-access` (parallel, not advisor portal).

**Consumer strategy questions (Sprint AF-1 — shipped):**

- Transfer Strategies **About this strategy** card: **Ask your advisor about this →**
  - Connected advisor (`advisor_clients` + `CONNECTED_ADVISOR_CLIENT_STATUSES`): `POST /api/consumer/ask-advisor` → `create_notification` type `consumer_strategy_question` to advisor
  - No connected advisor: redirect `/find-advisor`
  - Advisor: client Overview **Client Strategy Questions** card; notifications marked read on `/advisor/clients/[clientId]` load

**Advisor flywheel — shipped (Sprint 9/10 + AF-1):**

| Feature | Implementation |
|---------|----------------|
| Life-event at connect | `pickConnectionLifeEvent()` on accept — priority: `funnel_events.event_slug` → `referral_clicks.event_slug` (via `profiles.referral_code`) → `life_events`; stored on `advisor_clients.connection_life_event_*`; banner on advisor Overview |
| Invite-your-advisor | `/onboarding/invite-advisor`; `profiles.onboarding_invite_advisor_completed_at` (skip sets same timestamp); layout gate in `(dashboard)/layout.tsx` |
| Setup progress (OB-3) | `SetupProgressCard` + `GET /api/consumer/setup-progress`; wizard gate via `shouldRequireWizardOnboarding` + `checkHouseholdHasData`; exempt routes in `wizardGateExemptPrefixes.ts`; Tier 1 import upload while `!onboarding_wizard_completed_at` (history Tier 2+) |
| Sidebar unlock (OB-3b) | Financial Planning tier 1 + exempt from `isLockedUser`; Security / My Advisor / Billing always on; old dashboard setup checklist removed; My Advisor onboarding contextual note |
| Superuser sidebar (SU-1) | `isSuperuser` on `SidebarNav`; `isLockedUser = hasHousehold === false && !isSuperuser && !isAdvisor && !isAdmin` |
| Layout household (OB-3b fix) | `getDashboardLayoutContext` selects `id, state_primary, filing_status, person1_birth_year` only — **not** legacy `date_of_birth_1` (no DB column) |
| Sidebar active route (NAV-1) | `isNavItemActive()` + `groupContainsActiveItem()` in `sidebar-nav.tsx`; groups auto-expand when a child is active; `NAV_ACTIVE` navy + gold left accent |
| Advisor portal perf | Roster: `loadRosterNetWorthByOwner` (batched reads). Client workspace: parallel staleness/composition/datasets; scoped tax tables — [PERF_SPRINT_P1.md § Advisor portal](./PERF_SPRINT_P1.md#advisor-portal-quick-wins-2026-05-26) |
| Advisor portal UX-2 | Navy/gold brand; `advisorDatasetIncludeForTab()`; `PlanStatusCard` + `advisor_gap_statuses`; `getCachedAdvisoryMetrics` (120s cache); estate composition advisor variant — SCHEMA_CHANGELOG UX-2 |
| Advisor portal UX-3 | Strategy tab three-step workflow (`StrategyTabContent`): Situation / Opportunities / Recommendations; `advisoryMetricSeverity` + `StrategyAlertBanners`; `OpportunitiesPanel` catalog; `RecommendationsPanel` + client questions; benchmarks behind `ADVISOR_BENCHMARKS` — SCHEMA_CHANGELOG UX-3 |
| Advisor portal UX-4 | Step 2 Opportunities rows expand inline to `SLATILITPanel` / `AdvancedStrategyPanel` via `InlineStrategyPanel` + `catalogToPanel.ts` (CST: catalog `cst`, chip `credit_shelter_trust`); full-width modeling sections unchanged below — SCHEMA_CHANGELOG UX-4 |
| Connection status | `CONNECTED_ADVISOR_CLIENT_STATUSES` in `lib/advisor/clientConnectionStatus.ts` |

**Known limitations / open gaps:**

| Gap | Notes | Sprint |
|-----|-------|--------|
| Cross-device event slug attribution | `referral_clicks` has no `user_id`; anonymous click log. Per-user slug from `funnel_events` at signup; cross-device signup may miss `event_slug` on funnel row — see NEXT_SESSION.md | Post-launch if needed |
| Session-persistent “asked” state on strategy cards | Confirmation resets on refresh; notification persists in DB | V2 if needed |

Sidebar portal link visibility: [CONSUMER_NAV_MAP.md → Sidebar portal links](./CONSUMER_NAV_MAP.md#sidebar-portal-links-consumer-layout).

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
- As of Session 118, federal exemption on all horizon columns subtracts **lifetime gifts already used** (`lifetimeGiftsUsed` on `BuildHorizonsInput`, default `0`):
  - Callers fetch `calculate_gifting_summary` and pass `lifetime_exemption_used` into `buildStrategyHorizons` / `estimateFederalEstateTaxSnapshot` (`exemption = max(0, statutory − lifetimeGiftsUsed)`).
  - Engine stays pure — no RPC inside `horizonSnapshots.ts`.
  - Wired on `my-estate-strategy/page.tsx`, `my-estate-trust-strategy/page.tsx`, advisor client page via `lib/advisor/strategyMappers.ts`.
  - Aligns strategy horizon federal exemption with the gifting tab’s `lifetime_exemption_used` (sourced from `calculate_gifting_summary`).
- As of Session 120 (Step 4), `calculate_estate_composition` accepts `p_lifetime_gifts_used numeric DEFAULT 0` (migration `20260516140000`). As of Session 121 (Step 7), `v_atg` / `adjusted_taxable_gifts` add-back removed from the RPC (`20260517120100`); `adjusted_taxable_gift` dropped from `strategy_line_items.strategy_source` check (`20260517120000`). Legacy `adjusted_taxable_gifts` table remains for intake only. `classifyEstateAssets` passes `calculate_gifting_summary.lifetime_exemption_used` on trust-strategy, estate-tax, **my-estate-strategy**, and `POST /api/estate-composition`.
- As of Session 120, composition RPC `exemption_remaining` = `exemption_available − taxable_estate` (tax-engine field after admin deductions). Consumer-facing **Headroom before federal tax** on dashboard and My Estate Strategy horizons uses `computeHeadroomBeforeFederalTax()` in `lib/estate/exemptionLabels.ts` (`exemption_available − inside estate`, where inside = gross minus `outside_strategy_total`) — not raw RPC `exemption_remaining`. Other labels: **Lifetime gifts used**, **Federal exemption (after gifts)**, **Lifetime exemption remaining** (Gifting tab only).
- As of Session 120, shared `lib/utils/formatCurrency.ts` (`formatDollars`, `formatDollarsCompact`) — `TrustDocumentsPanel` estimated taxable estate uses `formatDollars` (whole dollars, no raw `toLocaleString` decimals). **My Estate Strategy** horizon columns show **Lifetime gifts used** between gross estate and federal exemption (`lifetimeGiftsUsed` prop from `calculate_gifting_summary`; links to gifting tab when &gt; 0).
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

### Calculation consistency audit (2026-05-26)

**Fixed in this pass:**

| Issue | Resolution |
|-------|------------|
| Tax tab waterfall $0 state tax vs State Tax Detail | `FederalStateWaterfall` uses horizon `stateTax` for current-law; no silent local recompute when horizon present |
| MFJ detection (`married_filing_jointly` vs `mfj`) | `isMFJFilingStatus()` on advisor Tax, Strategy, Domicile tabs + `GET /api/advisor/strategy-tab` |
| Survivor timeline vs today | `StateTaxPanel` labels + `projectionTimelineNote`; Domicile tab passes same horizon callouts |

**Known remaining gaps (documented, follow-up):**

| Surface | Risk |
|---------|------|
| `MeetingPrepTab` | **Fixed** — `meetingPrepBriefFromHorizons(advisorHorizons)`; full Today / 10 / 20 / At Death tax strip |
| `lib/calculations/estate-tax-projection.ts` | Death-year rows may use deprecated `computeStateEstateTaxFromBrackets` (no portability / NY cliff) |
| `lib/actions/generate-base-case.ts` | MFJ check includes `married_filing_jointly` but not full `isMFJFilingStatus` alias set |
| PDF / Gifting UI | Display-only `filing_status === 'mfj'` — cosmetic, not tax engine |
| Consumer `/estate-tax` | Uses unified engine + `filingForTax` helper — reference implementation |

**Rule:** Current-law advisor state tax display must come from `advisorHorizons.today` (or explicit missing-input warning). Projection year tables must label `outputs_s2_first` survivor timeline when present.

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
- As of Session 95, consumer-entered `strategy_line_items` (`source_role='consumer'`) are fetched in parallel with advisor items on `my-estate-trust-strategy/page.tsx` and merged before `buildStrategyHorizons`. Consumer items appear first in the merged array (established reality), then advisor items (recommendations). The engine treats them identically — `source_role` is not on `BuildHorizonsInput`; attribution is display-only, not calculation.
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
  - Canonical advisor write path: `/api/advisor/strategy-recommendation` (used by `StrategyOverlay`, `AdvancedStrategyPanel`, `SLATILITPanel` — does not write `strategy_configs`)
  - Advisor recommendation reads: `/api/advisor/strategy-recommendations-read`
  - As of Session 110, advisor POST/DELETE use `lib/strategy/upsertStrategyLineItem.ts` (required `category`, `metric_target`, DB `confidence_level` enum, `afterHouseholdWrite` on write and soft-delete).
- Consumer save/progress writes through `/api/strategy-line-items` (shared upsert in `lib/strategy/upsertStrategyLineItem.ts` on `household_id` + `strategy_source` + `source_role` + `scenario_name` when provided, else `scenario_name IS NULL`; ownership checked before write).
- As of Session 97, consumer dashboard (`/dashboard`) loads active advisor `strategy_line_items` and renders `StrategyRecommendationPanel` for accept/decline with `router.refresh()`; estate health recompute runs server-side on accept/reject (Session 101).
- Gifting scenario save supports an optional **Program name** (`scenario_name`); **Your Saved Strategies** displays `scenario_name` when set.
- `my-estate-trust-strategy/page.tsx` now fetches consumer and advisor `strategy_line_items` in parallel, merges them for `buildStrategyHorizons` (consumer first, advisor second), and passes `consumerLineItems` to the client for the Transfer Strategies tab.
- As of Session 122, `/dashboard` (`dashboard/page.tsx`) fetches `calculate_gifting_summary` server-side, passes `lifetime_exemption_used` into `classifyEstateAssets`, and renders `components/dashboard/EstateCalloutCard.tsx` below net worth (gross estate, headroom before federal tax, est. federal/state tax, link to `/estate-tax`). Display-only props — no client RPC. Headroom uses `computeHeadroomBeforeFederalTax` (`lib/estate/exemptionLabels.ts`) — `exemption_available − inside estate` (gross minus `outside_strategy_total`), matching My Estate Strategy horizons; not raw RPC `exemption_remaining` (which uses taxable estate after admin deductions).
- As of Session 122, advisor/consumer SVG estate flow (`components/estate-flow/EstateFlowDiagram.tsx`) uses colocated `buildEdgeLabelLanes` (rendering-only; not in `lib/`) to stagger overlapping edge labels plus dark label backgrounds.
- As of Session 121, `components/consumer/ConsumerStrategyPanel.tsx` (Transfer Strategies tab) shows a collapsible **About this strategy** card (`STRATEGY_INFO` + `StrategyEducationCard`) above each active panel’s model form — full name, description, best for, and personalized `contextNote` from `EstateContext` + `filingStatus` (illiquid %, IRA balance, exemption headroom, MFJ gating). Pills include **SLAT** and **ILIT**. SLAT pill is grayed and non-clickable when `filingStatus !== 'married_joint'`; the SLAT form is also disabled for non-MFJ. `filingStatus` is passed from `my-estate-trust-strategy/_client.tsx` via `giftingScenario.filing`. Advisor CTA links to `/find-advisor`. Uses `formatDollarsCompact` from `lib/utils/formatCurrency.ts`.
- As of Session 124, consumer **SLAT** (`SlatStrategyForm`) and **ILIT** (`IlitStrategyForm`) save via `lib/consumer/consumerStrategyLineItems.ts` → `POST`/`DELETE` `/api/strategy-line-items` (`strategy_source` `slat`/`ilit`, `category` `trust_exclusion`, `scenario_name` `base`, `source_role` `consumer`, default `confidence_level` `probable` so rows flow into `outside_strategy_total`). SLAT: contribution amount, funding source metadata, notes. ILIT: policy dropdown from `insurance_policies` by `user_id` (`ownerUserId` from page) or manual coverage amount. Saved rows show green summary + edit/remove; education card collapses when saved (`defaultOpen={!saved}`). `router.refresh()` + `reloadSaved()` after write.
- As of Session 125, **Gift History** in `GiftingDashboard.tsx` groups gifts by tax year with client-side split-election badges (all years with any annual gift where `form_709_filed=true` → **Gift Split Elected ✓**; MFJ households see **Split available — file Form 709** on years with annual gifts but no split). Consumer **charitable** modeling: `CharitableStrategyForm` on the DAF panel (`strategy_source` `daf` or `charitable`, `category` `charitable`, `scenario_name` `base`); migration `20260518120000` adds `charitable` to `strategy_source` allowlist. Playwright `consumer-strategy-writes.spec.ts` uses `try/finally` deletes, `afterEach` scenario sweep, and pre-cleanup of shared `base` rows before DAF/charitable/composition tests.
- Gifting scenario calculator on `my-estate-trust-strategy/_client.tsx` exposes **Save to my plan →** (persists consumer line item via `POST /api/strategy-line-items`).
- As of Session 99, the gifting tab adds **Compare a second scenario** (side-by-side totals + **Save comparison to plan →**). As of Session 100, each named plan is a distinct row (upsert key includes `scenario_name`); **Your Saved Strategies** Remove passes `scenarioName` so only the targeted row is deactivated.
- As of Session 96, after consumer strategy save or remove on trust-strategy surfaces, the client calls `router.refresh()` so server-rendered horizons update immediately.
- As of Session 101, `POST`/`DELETE` on `/api/strategy-line-items` and `PATCH`/`DELETE` on `/api/consumer/strategy-recommendation` call `lib/consumer/afterHouseholdWrite` (touch `households.updated_at` + `triggerEstateHealthRecompute`). Clients no longer call `/api/recompute-estate-health` directly (that route requires `x-recompute-secret`).
- **Your Saved Strategies** table supports **Remove** per row (`DELETE /api/strategy-line-items` soft-deactivates via `is_active=false`; optional `scenarioName` scopes delete to one named consumer strategy).
- `CharitableGivingDashboard` exposes **Save to my plan →** for logged charitable totals (`strategy_source='daf'`, `source_role='consumer'`) via `/api/strategy-line-items`, with `router.refresh()` only on the client.
- `my-estate-strategy/page.tsx` already builds `actualStrategyLineItems` from all active rows (consumer + consumer-accepted advisor) — no duplicate fetch required.
- Consumer accept/reject of advisor recommendations is handled by `/api/consumer/strategy-recommendation`:
  - `PATCH` marks advisor item accepted (`consumer_accepted=true`, `accepted_at` set, `consumer_rejected=false`) and runs `afterHouseholdWrite`
  - `DELETE` marks advisor item rejected (`consumer_rejected=true`, `consumer_accepted=false`) and runs `afterHouseholdWrite`
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

### Estate and Tax Tab Strategy Inclusion (ENG-1)

**Advisor Estate tab:**
- Uses `advisorHorizons.today` for advisor composition overrides (`horizonComposition`).
- `outsideStrategyTotal` uses horizon output (`outsideCertainProbableTotal + outsideIllustrativeTotal`) from the actual strategy set.
- `estimatedFederalTax` and `estimatedStateTax` are horizon-derived for advisor display parity.
- Pending (not-yet-accepted) advisor recommendations are not included in the actual horizon set.
- Consumer composition path (`calculate_estate_composition` with `p_source_role='consumer'`) remains unchanged.

**Advisor Tax tab:**
- Current-law federal estimate uses `advisorHorizons.today.federalTaxEstimate`.
- Current-law state estimate uses `advisorHorizons.today.stateTax`.
- Includes the actual strategy set (consumer rows + consumer-accepted advisor rows).
- Sunset / No Exemption stress test remains exemption-free and does not reuse horizon federal estimate.

**Why advisor estate/tax display does not rely only on composition RPC:**
- `calculate_estate_composition` filters strategy rows by `p_source_role`.
- It cannot directly express: consumer rows **OR** advisor rows where `consumer_accepted=true`.
- `strategyMappers.ts` pre-separates actual vs pending sets correctly; horizons consume those sets.
- ENG-1 uses horizon-derived values for advisor parity without changing RPC contract.

---

## Monte Carlo Workflow

### Current

- Defaults live in code: `MONTE_CARLO_SYSTEM_DEFAULTS`.
- Advisor assumptions saved in `advisor_projection_assumptions`.
- **Advisor presets (Session 126):** `is_preset = true` rows with `client_household_id` null; `is_default` marks the preset auto-loaded into the Monte Carlo recommendation form (partial unique index `advisor_projection_assumptions_one_default_preset_idx`). CRUD via `/api/advisor/presets` (+ `PATCH …/[id]/default` clears other defaults before set). UI: `/advisor/presets` (`PresetManager` — list, create, edit, delete, ★ default) and “Load preset” on `MonteCarloAssumptionsPanel` (default applied on mount when no active client scenario; manual load does not auto-save). Unset numeric fields are stored as **null** (not `0`) so `monteCarloAssumptionsFromRow` / `MONTE_CARLO_SYSTEM_DEFAULTS` apply. Helpers: `lib/advisor/advisorPresetAssumptions.ts`, `requireAdvisorUser.ts`, `monteCarloFromRow.ts`.
- Advisor-side comparison flow exists.
- Consumer accept/revert flow is implemented via `advisor_projection_assumptions.accepted_by_client` + `accepted_at`.
- Consumer endpoint: `/api/monte-carlo/advisor-assumptions` (read latest shared + accepted scenario, accept, revert).
- As of Session 98, `MonteCarloScenarioBanner` on `/dashboard` and `/my-estate-strategy` shows pending shared scenarios (side-by-side vs `MONTE_CARLO_SYSTEM_DEFAULTS`), accept/revert actions, and active-scenario badge; server pages pre-fetch rows via `lib/monte-carlo/consumerAssumptionScenarios.ts`.
- Consumer UI (`/monte-carlo`) applies accepted advisor assumptions to page-level assumption inputs (inflation and simulation count).
- `StrategyOverlay` already writes advisor recommendations via `/api/advisor/strategy-recommendation` (`useRecommendStrategy`); no `strategy_configs` path.

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
- As of Session 100, consumer financial input writes are normalized through `/api/consumer/*` routes (`assets`, `real-estate`, `liabilities`, `income`, `expenses`). Dashboard clients call these routes only — no inline household re-fetch or client-side recompute on those pages.
- As of Session 101, all consumer write routes and strategy-line-item writes share `lib/consumer/afterHouseholdWrite` (`touchHousehold` + `triggerEstateHealthRecompute` with `x-recompute-secret`). `/real-estate` and `/expenses` clients use `router.refresh()` only (no redundant client `loadData()` after save); server pages pass full row shapes including expense `start_month` / `end_month`.
- As of Session 102, `/assets` and `/liabilities` follow the same server-prefetch pattern as `/real-estate` and `/income`: server `page.tsx` fetches rows + reference data; `_assets-client.tsx` / `_liabilities-client.tsx` hold UI state, patch from API responses on save, and call `router.refresh()`. Grouped table keys use `useMemo` on assets, liabilities, income, and expenses. Removed unused `app/api/assets/[id]` and orphan income table/modal components.
- As of Session 103, `/real-estate`, `/expenses`, and `/income` clients also patch local state from consumer API JSON on save (same pattern as assets/liabilities). Consumer write routes use `requireOwnedHouseholdId` / `resolveOwnedHouseholdId` from `lib/consumer/afterHouseholdWrite.ts` instead of duplicated household queries. `triggerEstateHealthRecompute` logs misconfigured production env, HTTP failures, and network errors (recompute remains best-effort; saves are not blocked).
- As of Session 104, all server-side recompute callers use `triggerHouseholdRecompute` / `getConsumerAppUrl()` (no empty `NEXT_PUBLIC_APP_URL` fallbacks). `afterHouseholdWriteForOwner` covers businesses and insurance PATCH/DELETE; strategy-recommendation uses `resolveOwnedHouseholdId`; strategy-line-items PATCH triggers `afterHouseholdWrite` when status changes.
- As of Session 110, `POST /api/insurance` calls `afterHouseholdWriteForOwner` (aligned with `/api/insurance/[id]`). Advisor `POST`/`DELETE` on `/api/advisor/strategy-recommendation` call `afterHouseholdWrite`.
- As of Session 105, `/projections`, `/scenarios`, `/profile`, and `/health-check` use server `page.tsx` + client components with prefetched data (`lib/projections/loadProjectionData.ts` shared with `/api/projection`). `/titling` was already server-prefetched; titling client syncs props after `router.refresh()` instead of client `reloadData()`.
- As of Session 106, profile saves go through `PATCH /api/consumer/profile` (`lib/profile/buildHouseholdPayload.ts`) with `afterHouseholdWrite` so estate health recompute runs after household/profile updates. `POST /api/businesses` uses `afterHouseholdWriteForOwner` (aligned with business PATCH/DELETE).
- As of Session 127, **minimum viable profile gate** (`lib/estate/profileGate.ts`, `requireMinimumViableProfile`): consumer pages `/estate-tax`, `/my-estate-strategy`, `/my-estate-trust-strategy` redirect to `/profile?required=true&missing=...&from=...` when `state_primary`, `filing_status`, or `person1_birth_year` (birth year) is missing. Profile page shows amber required banner; save redirects to `from` when complete. Dashboard uses `EmptyStateCard` for zero gross estate / zero retirement accounts (not gated). Trusts tab (`TrustDocumentsPanel` on trust-strategy) shows gift-aware exemption remaining, headroom, and `~Est. Tax Saved` on `excludes_from_estate` trusts using marginal rate from `state_estate_tax_rules`.
- **Canonical consumer write APIs (Session 127 note):** `/api/businesses`, `/api/businesses/[id]`, `/api/insurance`, `/api/insurance/[id]` remain the live paths used by dashboard forms and advisor estate tab; no `/api/consumer/businesses` mirror yet — route namespace cleanup deferred.
- As of Session 107, estate health check answers save through `PUT /api/consumer/estate-health-check` (`afterHouseholdWrite`); `/my-family` CRUD uses `POST` / `PATCH` / `DELETE` on `/api/consumer/household-people` with shared payload logic in `lib/family/householdPeople.ts`. Both pages were already server-prefetched; clients patch local state from API JSON and call `router.refresh()`.
- As of Session 108, titling beneficiary CRUD uses `/api/consumer/asset-beneficiaries` (plus `POST …/bulk` for gap defaults); saves touch `households.last_beneficiary_review` and `afterHouseholdWrite`. Allocation target mix saves through `PATCH /api/consumer/allocation-targets` (server-prefetched on `/allocation`). `POST /api/consumer/generate-base-case` calls `afterHouseholdWrite` after successful generation. Playwright: `tests/e2e/consumer/consumer-api-writes.spec.ts`, `consumer-financial-writes.spec.ts`, `consumer-strategy-writes.spec.ts`, `consumer-titling.spec.ts`, `consumer-trust-crud.spec.ts`, updated `dashboard.spec.ts`; advisor `advisor-strategy-recommendation.spec.ts`, `advisor-presets.spec.ts` (Session 126), plus UI specs under `tests/e2e/advisor/`.
- As of Session 111, titling row + entity field saves (title type, notes, titling, liquidity, cost basis) use `POST /api/consumer/entity-titling` (`lib/titling/entityTitling.ts`); `_titling-client.tsx` `TitlingModal` no longer writes via browser Supabase. `/titling` reads remain server-prefetched on `page.tsx`.
- As of Session 112, trust CRUD uses `POST` / `PATCH` / `DELETE` on `/api/consumer/trusts` (`lib/trusts/trustPayload.ts`) with `afterHouseholdWrite`. (Session 116: trust UI consolidated on trust-strategy tab; see Phase A½ above.)
- As of Session 117, trust writes set `household_id` from `requireOwnedHouseholdId` on POST insert (alongside `owner_id`). `lib/trusts/trustPayload.ts` no longer references `excluded_from_estate` (column removed; use `excludes_from_estate` + `funding_amount` only). `TRUST_SELECT` aligned to live schema.
- As of Session 117, digital asset inventory uses `POST` / `DELETE` on `/api/consumer/digital-assets` with household ownership check, `afterHouseholdWrite`, and `revalidatePath('/digital-assets')`. UI: server `page.tsx` + `_digital-assets-client.tsx` (local list state updated on save/delete, same pattern as `/assets` and `/income`); `DigitalAssetIntakeForm` uses try/catch/finally + `router.refresh()`. Legacy `createDigitalAsset` server action remains in `beneficiary-grant-actions.ts` but is no longer called from the dashboard form.
- As of Session 118, `gift_history` CRUD uses `POST` / `PATCH` / `DELETE` on `/api/consumer/gift-history` with `requireOwnedHouseholdId`, `owner_id` + `household_id` verify on PATCH/DELETE, `afterHouseholdWrite`, and `revalidatePath` for `/my-estate-trust-strategy` and `/my-estate-strategy`. As of Session 121, `POST` returns **201**; Playwright coverage in `consumer-gift-history.spec.ts` (9 cases). `components/GiftingDashboard.tsx` no longer inserts/deletes via browser Supabase; uses `parseApiError`, try/finally on saves, and `refreshAfterGiftWrite()` (`router.refresh()` + RPC reload). New collapsible **Prior taxable gifts (Form 709)** section for `gift_type='lifetime'` rows; MFJ **Gifted by** donor selector on prior + annual forms (`donor_person` required on API). Reads still use client `calculate_gifting_summary` RPC (unchanged).
- As of Session 119, `GiftingDashboard` submit handlers trim `recipient_name`, `notes`, and `recipient_relationship` (annual form); block save when recipient name is whitespace-only. Prior gift form shows read-only **Form 709 — Taxable gift** badge (type hardcoded `lifetime` on submit), auto-checks `form_709_filed` when amount is entered (editable; helper text for amber pending-filing indicator).
- As of Session 120, **Prior taxable gifts (Form 709)** lists `priorTaxableGifts` from `summary.gifts` (`gift_type === 'lifetime'` via `useMemo`); section uses controlled `CollapsibleSection` `open` / `onOpenChange` (no localStorage) and auto-expands when rows exist. Row format: amount · year · recipient · Form 709 filed ✓; amber left border when unfiled. `CollapsibleSection` supports optional controlled open state for other parents.
- As of Session 120, `GiftingDashboard` lifetime meter uses `summary.lifetime_exemption_used` only (RPC already includes annual overflow in that field — do not add client `annualOverflowToLifetime` again).
- As of Session 125, Transfer Strategies DAF panel uses `CharitableStrategyForm` (see Session 125 bullet above). Session 124 added SLAT/ILIT consumer forms; Session 121 added educational cards for all advanced panels.
- As of Session 113, removed unused client loader `loadProjectionPageData.ts` (projections use server `loadProjectionData` only). Playwright devDependency bumped to 1.60; removed default `example.spec.ts` scaffold (e2e runs `consumer/`, `advisor/`, `public/` only).
- As of Session 114, `/scenarios` “Save” archives comparison results via `POST /api/consumer/scenario-snapshots` (`lib/scenarios/buildScenarioSnapshot.ts` → `projections` table). Scenario math remains `GET /api/projection` with query overrides; no `afterHouseholdWrite` on snapshot-only saves.
- As of Session 115 (Phase A consumer cleanup), canonical nav/URL/title/tier map lives in `docs/CONSUMER_NAV_MAP.md`. Sidebar labels aligned with page `<h1>` titles; duplicate `asset-allocation/_allocation-client.tsx` removed (`/asset-allocation` still redirects to `/allocation`). `FEATURE_TIERS`: fixed `projections` key, `allocation` tier 2, added `trust-will` tier 3.
- As of Session 116 (Phase A½ trust merge), full Trust & Will UI lives on **Gifting, Strategies & Trusts** → **Trusts & Documents** tab (`/my-estate-trust-strategy?tab=trusts`). Shared `components/consumer/TrustDocumentsPanel.tsx` + `lib/trusts/loadTrustWillGuidance.ts`; `/trust-will` redirects to that tab (no separate sidebar link). Sidebar **Gifting, Strategies & Trusts** opens `?tab=trusts`; tab clicks sync URL via `router.replace`.
- As of Session 116, consumer planning-topic lists use educational framing (not personalized advice): `lib/estate/planningTopicPresentation.ts`, `PlanningTopicsList` (estate recommendations RPC), `EducationalTopicsCards` (gifting, charitable, business succession, incapacity). Prevalence labels: “Common in many estate plans” / “Often discussed in planning” / “Depends on your situation”. `lib/trust-will-rules.ts` recommendation copy softened. Domicile, Roth, Social Security, Monte Carlo, and dashboard conflict actions use similar non-directive language. **Advisor Recommendations** panel unchanged (explicit advisor accept/decline workflow).
- As of Session 109, `POST /api/strategy-line-items` resolves `category` via `lib/strategy/resolveStrategyLineItemCategory.ts` (no invalid default `'other'`). Consumer gifting/charitable saves pass explicit categories; DB allows `strategy_source` values including `ilit`, `liquidity`, `roth`, and `slat`. Migration `20260516000001_strategy_line_items_upsert_idx_scenario_name.sql` replaces the legacy unique key with a partial unique index on active rows: `(household_id, strategy_source, source_role, projection_year, scenario_name)` — aligned with named consumer scenario upserts.
- As of Session 124, consumer SLAT/ILIT modeling shares `lib/consumer/consumerStrategyLineItems.ts` and upserts one active row per `(household_id, strategy_source, source_role, scenario_name='base')`. Do not use raw Supabase inserts from the browser for these strategies.

---

## Estate health recompute — operations

Consumer and strategy writes call `afterHouseholdWrite` → `triggerEstateHealthRecompute`, which POSTs to `/api/recompute-estate-health` with header `x-recompute-secret`. The route runs `computeEstateHealthScore`, `detectConflicts`, and `generate_estate_recommendations` (cached to `estate_health_scores.recommendations`) in the background so dashboard pages stay fast. **Sprint P-2:** dashboard reads recommendations from cache on load — no live RPC call.

**Required environment (staging + production):**

| Variable | Purpose |
|----------|---------|
| `RECOMPUTE_SECRET` | Shared secret; must match on the caller and `/api/recompute-estate-health` |
| `NEXT_PUBLIC_APP_URL` | Public app URL used for the server-to-server recompute `fetch` (e.g. `https://mywealthmaps.com` at launch) |

If either is missing in production, recompute is skipped and a **one-time** `console.warn` is emitted per process. Failed recompute attempts log `console.error` with `householdId`, HTTP status, and response snippet — search hosting logs (e.g. Vercel) for `[triggerEstateHealthRecompute]`.

**Full Production env matrix (Sprint 15 go-live):** [LAUNCH_CHECKLIST.md § Vercel Production env vars](./LAUNCH_CHECKLIST.md#vercel-production-env-vars-required-before-sprint-15-go-live).

---

## Production environment variables (Sprint 15 go-live)

Before domain cutover, verify **every** variable in **Vercel → Settings → Environment Variables → Production**.
Authoritative checklist: [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).

| Variable | Where it's needed | Launch note |
|----------|-------------------|-------------|
| `NEXT_PUBLIC_APP_URL` | Sitemap, drip links, referral URLs, recompute `fetch` | Replace preview URL with `https://mywealthmaps.com` |
| `RECOMPUTE_SECRET` | `afterHouseholdWrite` → `/api/recompute-estate-health` | Must match `.env.local` (quote value if it contains `!` or `#`) |
| `RESEND_API_KEY` | Drip and transactional email | Confirm set |
| `COMPLIANCE_EMAIL` | `/api/cron/compliance-reminders` ops inbox (Sprint C-7) | ✅ `avoels@comcast.net` |
| `INTERNAL_API_KEY` | Drip + cron internal server calls | Confirm set |
| `CRON_SECRET` | `/api/cron/notifications`, `/api/cron/age-triggers` | Confirm set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser Supabase client | Confirm set |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client, webhooks, server writes bypassing RLS | Confirm set (often via Vercel Supabase integration) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | `app/layout.tsx` Search Console meta | Set at launch only |
| `PUBLIC_SIGNUP_OPEN` | Opens public signup at go-live | Set `true` at go-live |
| `WAITLIST_MODE` | `middleware.ts` + server signup redirect | Optional — default on in Production |
| `NEXT_PUBLIC_WAITLIST_MODE` | Client `getSignupHref()` in public CTAs | Optional — redeploy when changed |

**Not in Vercel Production:** `SUPABASE_URL` — only for local/staging seed scripts. Vercel Supabase integration supplies project URL/keys for deploys.

**Opening signups (go-live flip):** Complete [LEGAL_TODO.md](./LEGAL_TODO.md) and C-4 manual Stripe walkthrough ([BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md)) first. Go-live day: Supabase Auth ON → verify `/auth/callback` → set `PUBLIC_SIGNUP_OPEN=true` in Vercel Production → redeploy → Core §1–3 smoke with fresh email. See [LAUNCH_CHECKLIST.md § Opening signups — go-live flip](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip).

**Waitlist mode (pre-launch):** Default on when `VERCEL_ENV=production`. `middleware.ts` redirects `/signup` → `/waitlist` (renamed from `proxy.ts` in `3ceb125`). Invite query params bypass.

**Test account seed scripts (staging / local, not Vercel env):**

| Script | Purpose |
|--------|---------|
| **`scripts/seed-e2e-fixtures.ts`** | **Canonical go-live reset** — all `@mywealthmaps.test` users, households, directory listings, `.env.test` output ([E2E_TEST_RESET.md](./E2E_TEST_RESET.md)) |
| `scripts/e2e-test-identities.ts` | Single source of truth for E2E emails, passwords, referral codes |
| `scripts/prune-e2e-household-artifacts.ts` | Removes Playwright-named rows without deleting users |
| `scripts/seed-michael-johnson-advisor-demo.ts` | Called by master seed for advisor client workspace |
| `scripts/seed-test-consumer-estate.ts` | Legacy: tier bump only for an existing email |
| `scripts/seed-test-attorney.ts` | Legacy: use `seed:e2e` instead |

```bash
npm run seed:e2e
# copy printed block → .env.test
npm run test:e2e:complete -- --workers=1
```

See [CONSUMER_RELEASE_SMOKE_TEST.md § Test data setup](./CONSUMER_RELEASE_SMOKE_TEST.md#test-data-setup-staging--pre-sprint-14).

**Post-deploy smoke checklist (manual, ~5 min):**

1. Log in as a test consumer with an existing household.
2. Note dashboard estate health (or `estate_health_scores.computed_at` in Supabase).
3. Add or edit one financial row (asset, income, or expense).
4. Wait a few seconds; refresh dashboard — score or “last updated” should change.
5. Optional: add or edit a beneficiary on `/titling`; refresh dashboard — beneficiary-related score/gaps should update.
6. Optional: save target allocation on `/allocation` (sliders must sum to 100%).
7. Optional: save two **named** gifting scenarios on trust-strategy; remove one by name only.
8. Optional: accept or decline one advisor recommendation on the dashboard.

**Playwright E2E (complete suite — May 2026):** See [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) and [E2E_RELEASE_TEST_PLAN.md](./E2E_RELEASE_TEST_PLAN.md). **253 tests** in 41 files: **137 consumer**, **45 advisor**, **59 public**, **2 attorney**, **7 import-unit** (+ 3 setup projects).

| Command | Projects |
|---------|----------|
| `npm run test:e2e:complete` | consumer + advisor + attorney + public |
| `npm run test:e2e:consumer` | consumer-setup + consumer (137) |
| `npm run test:e2e:advisor` | advisor-setup + advisor (45) |
| `npm run test:e2e:attorney` | attorney-setup + attorney (2) — requires `seed-test-attorney.ts` on target env |
| `npm run test:e2e:public` | public (59) |
| `npm run test:import:unit` | import parse unit (7) |
| `npm run test:import:api` | import commit API (consumer project subset) |

**Staging verification (2026-05-25, `PLAYWRIGHT_BASE_URL` staging, `--workers=1`):** consumer **127 passed / 5 skipped** (strategy tests need `PLAYWRIGHT_HOUSEHOLD_ID`; import API can flake under load); advisor **45 passed**; public **57 passed / 2 skipped**; attorney setup **requires** portal user from `scripts/seed-test-attorney.ts` (default creds fail if not seeded). Re-run failures with `--workers=1` before treating as regressions.

**Consumer coverage highlights:** route regression (full CONSUMER_NAV_MAP), sidebar/footer contract, estate-tier gates, profile save, UI asset save, health-check wizard, family CRUD, titling on real assets, billing, digital assets, life events, terms accept, import access, strategy recommendation panel (when advisor linked). **`consumer-core-recompute.spec.ts`** automates CONSUMER_RELEASE_SMOKE_TEST §2.4.

**Required env (`.env.test`):** `PLAYWRIGHT_CONSUMER_EMAIL`, `PLAYWRIGHT_CONSUMER_PASSWORD`, `PLAYWRIGHT_HOUSEHOLD_ID`, `PLAYWRIGHT_ADVISOR_EMAIL`, `PLAYWRIGHT_ADVISOR_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY` (profile + referral asserts), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (recompute poll). Optional: `PLAYWRIGHT_CONSUMER_TIER1_*`, `PLAYWRIGHT_ATTORNEY_*`, `PLAYWRIGHT_ADVISOR_REFERRAL_CODE`, `PLAYWRIGHT_ATTORNEY_REFERRAL_CODE`.

**Advisor client seed:** included in `npm run seed:e2e` (Michael Johnson → `e2e-client.johnson@mywealthmaps.test`).

**Manual release smoke** ([CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md)) still required for production sign-off — dollar math, Stripe C-4, drip inbox, full signup attribution to Supabase.

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

- Education route family is implemented under `app/(public)/education/*` (Sprint 1 route-group move from `app/(education)/education/*`).
- Education is **fully public** — no login required. `app/(public)/education/layout.tsx` shows optional “← My Dashboard” when signed in or “Log in” when signed out; module progress toggle renders only when authenticated.
- **Layout chrome:** `app/(public)/layout.tsx` skips marketing `PublicNav` and footer on `/education/*` (via `x-pathname` from `middleware.ts`) so education uses its own sticky header only — avoids double sticky nav that previously stacked marketing nav + education header at `position: sticky; top: 0; z-index: 100` and blocked module card clicks.
- Content is markdown-first:
  - Module files live under `content/education/modules/*.md`
  - Additional long-form pages use `content/education/decision-tree.md` and `content/education/glossary.md`
- Markdown ingestion is handled by `lib/education/loaders.ts` (frontmatter + body parsing).
- **Published catalog filter:** `listEducationModules()` returns only modules where frontmatter `published` is not `false` (default published when key omitted). `getEducationModule()` also returns `null` for unpublished slugs → 404 (direct URL cannot bypass catalog). Three meta/prep modules are explicitly unpublished: `compliance-and-disclaimers`, `advisor-question-sets`, `planning-readiness-checklists` (22 modules visible in catalog of 25 files).
- **Link validation:** `scripts/validate-education-links.mjs` — bundle slug alignment, decision-tree module links, HTTP status for all published/unpublished modules and static education routes. Run after content changes: `EDUCATION_LINK_BASE_URL=https://mywealthmaps.com node scripts/validate-education-links.mjs`.

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

- **Sprint 1:** Education, Assessment, Find Advisor, and Find Attorney are **not** in the app sidebar Overview group. They live under `app/(public)/` with URLs unchanged (`/education`, `/assess`, `/find-advisor`, `/find-attorney`). Overview sidebar = Profile + Estate Summary only.
- **Dashboard footer (2026-06):** `📖 Education Guide` link in sidebar footer for consumers and superusers → `/education` (public; not tier-gated).
- Root route behavior (`app/page.tsx`) is now:
  - Signed-out users: public education-first marketing landing page
  - Signed-in users with profile: redirect to `/dashboard`
  - Signed-in users without profile: redirect to `/profile`
- Root middleware guard behavior (`proxy.ts`) now explicitly allows unauthenticated `/` requests to pass through after login redirect checks, preventing profile lookups for signed-out landing-page traffic.
- Public assessment route at `/assess` (`app/(public)/assess/page.tsx`):
  - 20-question planning readiness flow across financial, retirement, and estate pillars
  - **Logged-out results:** overall score + pillar breakdown visible; full gap report / next steps gated behind account creation (`showSaveCTA` → signup/login CTA)
  - **Logged-in results:** full recommended next steps; persists to `assessment_results`
  - Signed-out runs cached in `mwm_pending_assessment` and restored after auth (30-minute window)
- Public middleware path exceptions now include `/advisor-directory` so directory discovery remains available without forced auth redirect.
- Public attorney discovery route now lives at `/find-attorney`:
  - Files: `app/(public)/find-attorney/page.tsx`, `app/(public)/find-attorney/_attorney-directory-client.tsx`
  - Not in app sidebar; linked from marketing landing and public flows
  - Connection requests from the attorney directory client post to `/api/attorney-directory/request-connect`
- Public advisor discovery now lives at `/find-advisor`:
  - Files: `app/(public)/find-advisor/page.tsx`, `app/(public)/find-advisor/_advisor-directory-client.tsx`
  - Connection requests from the public advisor directory client post to `/api/advisor-directory/request-connect`
  - Legacy public route `/advisor-directory` now redirects server-side to `/find-advisor`
- Signed-out landing page (`app/page.tsx`) now includes a **Find a professional** section with cards linking to `/find-advisor` and `/find-attorney`; bottom advisor CTA strip also links to `/find-advisor` (replacing `/advisor-directory`).
- Marketing copy for education module count is aligned to **20+ learning modules** on hero and education path card.

**Public layout + marketing (Sprint 2 Track A):**

- `app/(public)/layout.tsx` renders shared sticky top nav via `app/(public)/_components/public-nav.tsx` (Education · **Life Events** · Assessment · Find Advisor · Find Attorney · Pricing · Log in · Get started).
- Routes under `(public)/` inherit this nav: assess, find-advisor, find-attorney, **pricing**, **`/events`**, event pages. **`/education/*` is excluded** — education layout provides its own header.
- Root landing `app/page.tsx` is **outside** `(public)` and keeps its own inline nav; includes social proof section and life-event quick-start (links to `/events`). Homepage copy targets **$2M–$30M** segment.
- `middleware.ts` `PUBLIC_PATHS` includes `/event`, `/events`, `/pricing`, `/education`, `/waitlist`, `/sitemap.xml`, `/robots.txt` for unauthenticated access. Sets `x-pathname` on all public routes for layout detection. When waitlist mode is on, `/signup` is redirected to `/waitlist` in middleware before the public-path pass-through (invite/token query params bypass).

**Life event hub (Sprint UX-1):**

- `app/(public)/events/page.tsx` — public catalog of all **24** slugs grouped by category (Business & Wealth, Family & Relationships, Health & Retirement); links to `/event/[slug]`; footer CTA → `/assess`.
- `lib/events/catalog.ts` — `getEventsGroupedForHub()`, `filterEventsByQuery()`, `sortEventsByRelevance()` for hub + dashboard picker.

**Life event landing pages (Sprint 2):**

- Dynamic route: `app/(public)/event/[slug]/page.tsx` — SSG via `generateStaticParams` over `EVENT_SLUGS` from `lib/events/content.ts`.
- Event-specific assessment: `app/(public)/event/[slug]/assess/page.tsx` — 5 questions from `event.assessmentQuestions`, gap detection, email capture for anonymous users.
- Content schema: `lib/events/types.ts` (`EventContent`, `EventAction`, `EventAssessmentQuestion`, urgency/category enums).
- **24 published slugs** — `EVENT_SLUGS` from `lib/events/content.ts` + `lib/events/content-sprint5.ts` (8 original + 16 Sprint 5).
- Each page: hero + urgency badge, “what changes” bullets, prioritized action plan, assessment teaser → `/event/[slug]/assess`, optional advisor/attorney CTAs, related events.
- SEO: `generateMetadata` + schema.org Article JSON-LD (`headline`, `description`, author/publisher, `mainEntityOfPage`).
- Referral + funnel: `_referral-tracker.tsx` posts `?ref=` to `/api/referral/track` and fires `event_page_view` via `/api/analytics/funnel`.
- Content is **TypeScript** (`EventContent` records), not MDX.

**Email capture + drip (Sprint 2 + Sprint 6):**

- API: `POST /api/email-capture` → `email_captures` (`email`, `source`, `score`, unique on `(email, source)`).
- Used by event assessment results (`source=event-assess-{slug}`). **Drip (Sprint 6):** step 1 fired non-blocking to `POST /api/email/drip`; steps 2–3 in `GET /api/cron/notifications` job 7; templates in `lib/emails/drip-templates.ts`; unsubscribe via `GET /api/email/unsubscribe`.
- Tracking columns: `drip_step_1/2/3_sent_at`, `unsubscribed_at` (migration `20260524000000_email_captures_drip.sql`).
- Event assessment saves for logged-in users write to `assessment_results` with `_event_slug` / `_type: 'event'` in `answers` JSONB (no dedicated `event_slug` column).
- **Dashboard picker (Sprint UX-1):** `LifeEventBanner` on `/dashboard` — searchable modal over all 24 events; logs `life_events` (`source: user`); navigates to `/event/[slug]/assess`; shows logged events with Review links.

**SEO (Sprint 6):**

- `app/sitemap.ts` — static public routes + all `EVENT_SLUGS` event and assess URLs; base URL from `NEXT_PUBLIC_APP_URL`.
- `app/robots.ts` — **pre-launch:** `disallow: /` for all crawlers; sitemap line commented out. **At launch:** allow public routes, disallow app routes, uncomment sitemap URL.

**Admin funnel (Sprint 6 + Sprint 7):**

- Tab on `/admin` — `app/admin/funnel-tab.tsx`; server fetch in `app/admin/page.tsx` via `createAdminClient()` (funnel_events not readable with user RLS).
- **Sprint 7:** 30-day `funnelStepCounts` for bar chart; `tierConversion` (join `funnel_events.user_id` → `profiles.consumer_tier`); **By Tier** tab.
- Slug/referral breakdowns use 30-day queries; embedded SQL cheat sheet for weekly review.

**Consumer professional connection surfaces (current):**

| Surface | Route | Purpose |
|---------|-------|---------|
| My Advisor | `/my-advisor` | Accepted `advisor_clients` + `advisor_directory` listing (`profile_id`); invite-via-email when no connection; pending requests; access log; revoke |
| Print / export | `/print` | Tier 3+ consumers; `ExportPDFButton` → `ConsumerEstatePlanPDF` / `AttorneyEstatePlanPDF` (`components/pdf/EstatePlanPDF.tsx`). Document title **Estate Planning Preparation Report**; page-1 `DISCLAIMER_STRINGS.pdfCover`; attorney variant attributes preparer by user name (`prepared_by_name` from `/api/export-estate-plan`) |
| My Attorney | `/my-attorney` | Active `attorney_clients` rows (household-scoped) + pending attorney `connection_requests`; revoke via `/api/attorney/revoke-access` |
| Attorney access settings | `/settings/attorney-access` | PDF download toggles and per-attorney revoke; cross-links to `/my-attorney` for pending/connection details |
| Cancel pending request | `POST /api/connection-requests/cancel` | Consumer cancels own pending row (`status → cancelled`) via admin client after ownership check |

**Pending connection request UX:**

- `my-advisor/page.tsx` loads latest pending `connection_requests` (`listing_type='advisor'`) when no accepted `advisor_clients` row exists; enriches with `advisor_directory` firm/location.
- `my-attorney/page.tsx` loads pending attorney requests and merges `attorney_listings` for display.
- Clients call cancel API; on success, UI shows confirmation and `router.refresh()` on advisor path so server state stays aligned.
- Claim/accept flow for professionals remains on `app/claim-listing/[token]/page.tsx` (admin updates `connection_requests.status` to `accepted`).

**Signup/profile onboarding from discovery flows:**

- Signup form honors `redirectTo` query param; maps `/find-advisor`, `/find-attorney`, and `/assess` to `/profile?from=…` after consumer signup.
- Profile page shows contextual welcome banner when arriving from assessment restore (`mwm_pending_assessment`), find-advisor, or find-attorney flows.

**Sidebar navigation (Sprint 0 + Sprint 1 + OB-3b + SU-1 + NAV-1):**

- **Overview group:** Profile + Estate Summary only (no public-site links).
- **Active indicator (NAV-1):** `usePathname()` drives `isNavItemActive()` per leaf (`/dashboard` exact; other routes allow subpaths; `?tab=` hrefs match on path). Groups in `DEFAULT_CLOSED_GROUPS` (Financial, Retirement, Estate) **auto-expand** when any child is active so the navy/gold `NAV_ACTIVE` stripe is visible.
- **Financial Planning:** all items tier 1 in `FEATURE_TIERS`; group **never** blocked by `isLockedUser` (primary data entry).
- **`isLockedUser`:** `hasHousehold === false && !isSuperuser && !isAdvisor && !isAdmin`. `hasHousehold` from `getDashboardLayoutContext` (`households` row by `owner_id`; must not select non-existent columns).
- **Security** (`/settings/security`): always enabled in main nav (not tier- or household-gated).
- **Footer block:** **My Advisor** and **Manage Subscription** always enabled; **My Attorney** (consumer, tier 2+) still respects `isLockedUser`; then **Sign out**. Attorney access settings removed from sidebar (still at `/settings/attorney-access`).
- **"Your plan" badge** on the active unlocked planning group header (Financial / Retirement / Estate).
- **`UpgradeBanner`** (`app/(dashboard)/_components/UpgradeBanner.tsx`): optional `householdContext` (`state_primary`, optional `grossEstate`, `firstName`) on all tier-gated consumer pages; gate branches use a lightweight `households` query when full household load runs after the gate.

**Design system + education UI refresh (2026-05):**

- **Canonical tokens:** `app/globals.css` — `--mwm-*` brand variables + short aliases (`--navy`, `--gold`, …).
- **Docs & Cursor prompts:** `DESIGN_SYSTEM.md` (My Wealth Maps), `CURSOR_PROMPT_TEMPLATE.md` (§22 pointer + Phase 3 sweep).
- **Shared primitives:** `components/ui/Button`, `Card`, `SectionHeader`; `components/ui/form.ts` / `lib/ui/form.ts`; `lib/utils.ts` (`cn`).
- **Authenticated chrome:** `app/(dashboard)/_components/sidebar-nav.tsx` (navy active fill, gold left accent, gold “M” logo), `dashboard-shell.tsx` (off-white page shell), `LifeEventBanner.tsx` (gold action links).
- **Tailwind v4 rule:** arbitrary colors in class names need the `color:` prefix (e.g. `text-[color:var(--mwm-gold)]`) or styles fail silently. Required for Phase 3 indigo sweep across planning pages.
- **Commits:** `d173b00` (tokens + primitives), `249bf85` / `7a1a121` (sidebar + banner), Phase 2d shell audit in follow-up commits.
- Legacy reference: `assets/design-system.css` (education/static HTML).
- Education prose: `app/(public)/education/education-theme.css` — `.education-prose-content*` selectors aligned with brand typography and card language.

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
- `lib/projections/loadProjectionData.ts` (shared projection fetch for `/api/projection`, `/projections`, `/scenarios`, `/complete` pages; **Sprint P-2:** cache-first via `outputs_s1_first` when not stale)
- `lib/projections/staleness.ts` (`isProjectionStale`, `getLatestTimestampMs`)
- `lib/access/getDashboardLayoutContext.ts` (React `cache()` — layout auth/profile/household/notifications dedup; Sprint P-2; household select: `person1_birth_year` not `date_of_birth_1`)
- `lib/projections/mappers/mapProjectionRows.ts` (consumer projections API row mapping)
- `lib/projections/selectors/getProjectionSummary.ts` (consumer projections derived metrics)
- `lib/calculations/rmdStartAge.ts` (canonical SECURE Act RMD start age by birth year: 72 / 73 / 75)
- `lib/calculations/rmd.ts` (full RMD engine — IRS tables, aggregation, inherited IRA rules)
- `lib/dashboard/calculations.ts` (shared SS/RMD helpers; re-exports `getRmdStartAge`, `calcRmdAmount`)
- `lib/dashboard/setupProgress.ts` (dashboard setup progress derivation)
- `lib/dashboard/retirementSnapshot.ts` (retirement horizon snapshot derivation)
- `lib/dashboard/rmdStatus.ts` (RMD requirement/planned rollup derivation)
- `lib/dashboard/incomeSnapshot.ts` (income, expense, SS, and savings snapshot derivation)
- `lib/dashboard/loaders.ts` (dashboard Supabase/admin query orchestration)
- `lib/dashboard/mappers.ts` (dashboard health/conflict/allocation view-model mapping)

### APIs

- `app/api/projection/route.ts`
- `app/api/advisor/generate-base-case/route.ts`
- `lib/strategy/upsertStrategyLineItem.ts` (shared strategy line item upsert for consumer and advisor routes)
- `app/api/advisor/strategy-recommendation/route.ts`
- `app/api/advisor/strategy-recommendations-read/route.ts`
- `app/api/consumer/strategy-recommendation/route.ts`
- `app/api/consumer/digital-assets/route.ts`
- `app/api/consumer/gift-history/route.ts`
- `app/api/consumer/trusts/route.ts`
- `lib/trusts/trustPayload.ts` (`buildTrustRow`, `TRUST_SELECT`)
- `app/api/projection/monte-carlo/route.ts`
- `app/api/advisor/monte-carlo-assumptions/route.ts`
- `app/api/monte-carlo/advisor-assumptions/route.ts`
- `app/api/connection-requests/cancel/route.ts`
- `app/api/advisor-directory/request-connect/route.ts`
- `app/api/attorney-directory/request-connect/route.ts`

### Consumer UI Composition (Current)

- Route: `app/(dashboard)/projections/page.tsx`
- Local UI components are split under `app/(dashboard)/projections/_components/*`
- Shared projection route types are centralized in `lib/projections/types.ts`
- This refactor is structure-only (no behavior/calculation change); projection math still comes from `projection-complete.ts`
- Dashboard route `app/(dashboard)/dashboard/page.tsx` is decomposed into helper modules under `lib/dashboard/*` (calculations, loaders, and mappers) with no behavior changes. Session 122 adds gift-aware `classifyEstateAssets` + `EstateCalloutCard` on the same server page.
- Dashboard empty-state rendering is componentized under `app/(dashboard)/dashboard/_components/*` to keep the route file orchestration-focused.
- Dashboard client route composition in `app/(dashboard)/_dashboard-client.tsx` now delegates rendering to feature components under `app/(dashboard)/_components/dashboard/*` (`DashboardIntroSection`, `FinancialSummarySection`, `RetirementSummarySection`, `EstateSummarySection`) while keeping data flow unchanged.
- Shared financial rollup view-models are now being introduced under `lib/view-models/*`; `lib/view-models/netWorthSummary.ts` is used by both consumer dashboard and advisor overview surfaces.
- **RMD start age (SECURE Act cohorts):** `getRmdStartAge(birthYear)` in `lib/calculations/rmdStartAge.ts` — born ≤1950 → **72**, 1951–1959 → **73**, ≥1960 → **75**. Used by projection engine, dashboard `rmdStatus`, RMD Calculator, Roth analysis, Monte Carlo, trust-strategy annual RMD estimate, and advisor client **Retirement** tab (per-person birth year; no hardcoded 73). **Event page** `/event/rmd-start-age` (`content-sprint5.ts`) and drip templates use **range copy** (72–75); SEO meta may still say 73.
- **Advisor referral codes:** `20260601000000_advisor_directory_referral_code_trigger.sql` — `generate_advisor_referral_code()` before insert on `advisor_directory` when `referral_code` is null.
- `lib/view-models/retirementSnapshot.ts` now centralizes dashboard retirement snapshot object construction (composition-only refactor; calculations remain in `lib/dashboard/retirementSnapshot.ts` + `lib/dashboard/incomeSnapshot.ts`).
- `lib/view-models/taxScopeBadges.ts` now centralizes advisory metric scope badge mapping (`federal`, `state`, `both`, `strategy`) to keep label/class semantics consistent where scope chips are rendered.
- `lib/view-models/projectionSummaryCards.ts` now centralizes consumer projection summary card composition (labels, values, highlights) while calculation inputs still come from the shared projections selector pipeline.
- Projection staleness contract logic is now centralized in `lib/projections/staleness.ts` (`getLatestTimestampMs`, `isProjectionStale`) and adopted by consumer dashboard + advisor client page staleness checks.
- Advisor client staleness fetch orchestration is now extracted into `lib/advisor/loaders.ts` (`loadAdvisorProjectionStaleness`) so `app/advisor/clients/[clientId]/page.tsx` focuses on page composition rather than timestamp query plumbing.
- Advisor client page bootstrap access/ownership reads are now extracted into `lib/advisor/clientPageLoaders.ts` (`loadAdvisorContextOrRedirect`, `loadAdvisorClientLinkOrRedirect`, `loadAdvisorClientHouseholdOrRedirect`) to keep route guards consistent and reduce page-level query noise.
- Advisor client bulk tab data fetch orchestration is now extracted into `lib/advisor/loaders.ts` (`loadAdvisorClientDatasets`) so the route can consume a single loader result instead of maintaining a large inline `Promise.all` query block. Client route runs staleness, composition RPC, and datasets **in parallel**; state tax/income rules are scoped to advisor states + projection years (not full national tables).
- Advisor roster net worth uses `lib/advisor/rosterNetWorth.ts` (`loadRosterNetWorthByOwner`) — batched reads on `/advisor`, not per-client `calculate_estate_composition`.
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
- Consumer connection pages: `app/(dashboard)/my-advisor/*`, `app/(dashboard)/my-attorney/*`, `app/(dashboard)/settings/attorney-access/*`.
- Education catalog: `components/education/EducationModuleCatalog.tsx` (bundle paths unchanged; loader supplies published-only module list).
- Digital assets: `app/(dashboard)/digital-assets/page.tsx`, `_digital-assets-client.tsx`, `_components/DigitalAssetIntakeForm.tsx`, `_components/DigitalAssetList.tsx`.
- Gifting: `components/GiftingDashboard.tsx` (trust-strategy gifting tab); summary via `calculate_gifting_summary` RPC; writes via `/api/consumer/gift-history`; Gift History year headers with gift-split election badges (Session 125).
- Transfer Strategies (trust-strategy tab): `components/consumer/ConsumerStrategyPanel.tsx` (orchestration, pills, `STRATEGY_INFO` education cards, saved-state reload).
- SLAT consumer form: `components/consumer/SlatStrategyForm.tsx` (MFJ guard, funding source metadata).
- ILIT consumer form: `components/consumer/IlitStrategyForm.tsx` (policy dropdown / manual amount; reads `insurance_policies` by `user_id`).
- Charitable consumer form: `components/consumer/CharitableStrategyForm.tsx` (DAF panel; `daf` or `charitable` source).
- Consumer strategy writes: `lib/consumer/consumerStrategyLineItems.ts` → `app/api/strategy-line-items/route.ts` → `lib/strategy/upsertStrategyLineItem.ts` + `lib/consumer/afterHouseholdWrite.ts`.
- Trust-strategy page: `app/(dashboard)/my-estate-trust-strategy/page.tsx` (server fetch, `ownerUserId`, `estateContext`, `filingStatus`); `my-estate-trust-strategy/_client.tsx` (tabs, passes props to panel).
- **Financial data import (Sprint F-1 + F-2):** `app/(dashboard)/import/page.tsx`, `_import-client.tsx`; `POST /api/ingest`; `POST /api/import/commit`; `DELETE /api/import/jobs/[id]`; `lib/import/ingestConfig.ts`, `lib/import/parseFile.ts`; `public/templates/`; tests: `tests/unit/import-parse.spec.ts`, `tests/e2e/consumer/consumer-import.spec.ts`, `tests/fixtures/import/`.

---

## Financial Data Import (Sprint F-1 + F-2)

**Current (as built):**

- Route: `/import` — tier **2+** (`FEATURE_TIERS.import`; `hasFeatureAccess('import', …)` on page and parse API).
- **Supported formats:** CSV (`.csv`), Excel (`.xlsx`, `.xls`) only. PDF/DOCX deferred post-launch (unreliable structured extraction).
- **Three-step UX:** upload → review (field mapping + inline row edit) → commit confirmation. Import history from `ingestion_jobs`.
- **Parse API:** `POST /api/ingest` — multipart `file`; optional `sheet_name` for Excel; papaparse (CSV) + SheetJS `xlsx`; scans first 20 rows for header row (`header_row_index`); auto-detect target table; alias/substring `field_map` suggestion; persists parse in `ingestion_jobs` (`header_row_index`, `sheet_name`); returns `job_id`, `headers`, `rows`, `field_map`, `detected_table`, `table_fields`, `header_row_index`, `sheet_names`.
- **Commit API:** `POST /api/import/commit` — maps rows via user-adjusted `field_map`; pre-commit duplicate check on key fields → **409** `duplicates_found` unless `skip_duplicates` or `force_all`; sets `ingestion_job_id` on inserted rows; bulk `insert` into `assets` | `liabilities` | `income` | `expenses`; marks job `committed`. Returns **200** with `committed: 0` when `skip_duplicates` filters all rows (`a344032`).
- **Cancel pending:** `DELETE /api/import/jobs/[id]` — owner-scoped; removes job during review.
- **Target tables + required fields:** assets (`name`, `type`, `value`); liabilities (`name`, `type`, `balance`); income (`source`, `amount`, `start_year`); expenses (`category`, `amount`, `start_year`).
- **Templates:** `public/templates/import-sample*.csv` — downloadable from import UI.
- **Migrations:** `20260602140000_sprint_f1_ingestion_jobs.sql` — 16-column final shape on `ingestion_jobs` (`file_name`, `file_type` NOT NULL). **Verified in production** (F-1 smoke). `20260602150000_sprint_f2_import_traceability.sql` — `ingestion_job_id` on four financial tables; apply before F-2 deploy if not applied.
- **Automated verification:** `npm run test:import:unit` (7 tests, no auth); `npm run test:import:api` (8 tests, `.env.test`, tier 2+, F-2 migration on test DB). Fixtures in `tests/fixtures/import/`; regenerate XLSX via `scripts/generate-import-fixtures.ts`.

**Post-launch backlog:** PDF/DOCX text extraction; automated purge of `ingestion_jobs` rows older than 24h; optional commit-from-`job_id` without re-posting rows for large files.

---

## Known Transitional Exceptions

1. User-facing Roth + Domicile surfaces are now bracket-based; remaining `state_income_tax_rates` usage is admin legacy maintenance only.
2. Legacy `lib/calculations/projection.ts` has been removed; canonical projection path is `projection-complete.ts`.
3. Consumer save/progress still uses legacy-named `/api/strategy-line-items` (single endpoint path).

---

## Release verification

**All merges:** follow [UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md) (build, doc sync, spot-check affected surfaces).

**Additional spot-checks when tax/engine logic changes:**

- `/projections` — base case still regenerates when stale
- `/roth` — state marginal path uses bracket engine
- Advisor client domicile breakeven — state income timeline labels
- Confirm staleness-trigger regeneration after financial write
- Decide whether stored `projection_scenarios` need backfill after bracket/RPC changes
- **RMD cohort smoke:** household with `person1_birth_year = 1960` → dashboard “not required until” year = birth year + **75**; advisor client Retirement tab shows RMD start **75** (not 73)

Manual consumer deploy smoke: [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) (~10 min core).

**After education content changes:** `EDUCATION_LINK_BASE_URL=https://mywealthmaps.com node scripts/validate-education-links.mjs` (also in [UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md) verification pass).

---

## Scheduled jobs (cron)

| Job | Route | Schedule | Trigger |
|-----|-------|----------|---------|
| Daily notifications | `GET /api/cron/notifications` | `0 14 * * *` (14:00 UTC daily) | **Vercel cron** (`vercel.json`) |
| Age-based life events | `GET /api/cron/age-triggers` | `0 15 * * *` (15:00 UTC daily) | **Vercel cron** (`vercel.json`) |
| Scheduled deletions | `GET /api/cron/process-deletions` | `0 2 * * *` (02:00 UTC daily) | **Vercel cron** (Sprint C-6) |
| Compliance reminders | `GET /api/cron/compliance-reminders` | `0 8 * * *` (08:00 UTC daily) | **Vercel cron** (Sprint C-7); emails `COMPLIANCE_EMAIL` |

**Auth:** `Authorization: Bearer ${CRON_SECRET}` on every cron request.

**Manual cron tests:** Use `https://www.mywealthmaps.com/...` — `https://mywealthmaps.com` (apex) 307-redirects to www and curl does not resend `Authorization` → false 401.

**Implementation:** `app/api/cron/notifications/route.ts` — uses `createAdminClient()`; creates in-app + email notifications via `create_notification` RPC for: stale plan (30d), estate milestones ($1M / $5M / $13.61M), MFA reminder, profile completion nudge, subscription renewal (7d).

**GitHub Actions:** `.github/workflows/cron-notifications.yml` — **manual only** (`workflow_dispatch`). Schedule removed to avoid duplicating or racing Vercel cron. Production URL: `https://estate-planner-gules.vercel.app/api/cron/notifications`. Requires `CRON_SECRET` in GitHub repo secrets.

**Removed:** `.github/workflows/daily-notifications-cron.yml` (duplicate workflow hitting a rotating Vercel preview URL).

**Age triggers (Sprint 3 + Sprint 7):** `GET /api/cron/age-triggers` — daily 15:00 UTC (`vercel.json`); inserts `life_events` with `source='calendar_trigger'` when birth year hits ages 62, 65, 70, or 73 (deduped per user/event/year). **Sprint 7 slugs:** 62 → `social-security-timing`, 65 → `medicare-eligibility`, 70/73 → `rmd-start-age`.

**Data deletion (Sprint C-6 — Washington WCPA):**

- **Single path:** `lib/compliance/deleteUser.ts` — CLI (`scripts/gdpr-delete-user.ts`), admin execute API, daily cron, `--rolobe` cleanup script.
- **Tables:** `deletion_schedule` (pending automated deletions); `deletion_audit_log` (append-only compliance record).
- **FK scan before Auth delete:** `notifications`, `assessment_results`, `funnel_events`, `privacy_requests`, `deletion_schedule`, `ingestion_jobs`, `change_log`, `firms`, `firm_members`, `profiles`, `email_captures` (by email). `referral_clicks` via advisor_id / attorney_profile_id OR delete.
- **Orphan Auth users:** no `profiles` row → FK sweep + Auth delete + audit log (no early return).
- **Auth delete:** hard delete with soft-delete fallback; warn when soft delete used (`deleted_at` set — monthly ops check).
- **Verification:** `verifyDeletion()` in-process; standalone `npm run verify:deletion -- --email …` — **PASS required** before WCPA response.
- **Webhook:** `customer.subscription.deleted` → schedule deletion +30 days via `scheduleDeletionOnCancel.ts` — **skipped** if customer has another active/trialing subscription (plan change) or profile role is advisor/attorney/admin (`deletionGuards.ts`).
- **Reactivation:** `customer.subscription.updated` with `status=active` → cancel pending `deletion_schedule` rows.
- **Cron:** `app/api/cron/process-deletions/route.ts` — re-checks role and active subscription before execute; cancels schedule if user upgraded.
- **Admin:** `/admin` → Data & Compliance tab (`DeletionCompliance.tsx`); `GET /api/admin/deletions`, `POST /api/admin/deletions/execute`.
- **Migration:** `20260625120000_sprint_c6_deletion_compliance.sql` — ✅ applied in production.
- **Ops:** [COMPLIANCE_CALENDAR.md](./COMPLIANCE_CALENDAR.md).

**Privacy requests (Sprint C-7 — WCPA):**

- **Table:** `privacy_requests` — five request types; `due_at` DEFAULT (`now() + 45 days`); statuses `pending` / `in_progress` / `completed` / `denied`.
- **Consumer:** `POST /api/consumer/privacy-request` from `/settings/security`; confirmation email with reference ID + due date.
- **Admin:** Data & Compliance → Privacy Requests; `GET/PATCH /api/admin/deletions` (`view=privacy`).
- **Reminders:** `compliance-reminders` cron — overdue deletions, deletion failures (7d), urgent privacy requests (7d), monthly summary (1st only); emails `COMPLIANCE_EMAIL` only when action needed.
- **Migration:** `20260625170000_sprint_c7_privacy_requests.sql` — ✅ applied in production.

**Compliance infrastructure summary (C-6 + C-7 — live 2026-05-25):**

| What | How | Status |
|------|-----|--------|
| 30-day post-cancellation deletion | Stripe webhook → `deletion_schedule` → 2am cron | ✅ Live |
| Plan-change guard | Webhook + cron double-check | ✅ Live |
| Deletion audit trail | `deletion_audit_log` append-only | ✅ Live |
| Admin deletion UI | `/admin` → Data & Compliance | ✅ Live |
| Daily compliance check | 8am cron → `avoels@comcast.net` if issues | ✅ Live |
| WCPA privacy requests | In-app form + 45-day SLA tracking | ✅ Live |
| Email senders | `hello@`, `noreply@`, `privacy@` (Resend → Comcast) | ✅ Live |
| Migrations | **76** timestamped files in `supabase/migrations/`; through `20260626120000` | ✅ Clean |

**Commits:** C-6 `4d9571e`, `01b997a` · C-7 `ddbf079`, `1ce9110`

**In-app life events (Sprint 3):**

- Table: `life_events` (`user_id`, `event_type`, `event_date`, `acknowledged`, `source` = `user` | `calendar_trigger`).
- API: `app/api/consumer/life-events/route.ts` — POST (log event + recompute), GET, PATCH (acknowledge).
- UI: `LifeEventBanner` on dashboard (`pendingLifeEvents` from server); links to `/event/[slug]`.
- Upgrade personalization: `lib/events/upgradeContext.ts` → `getEventUpgradeValueProp()` on tier-gated pages.
- Advisor notify on POST: `notifyAdvisorOfLifeEvent()` via admin `create_notification` RPC (1h cooldown).
- Cron backup: job 6 in `/api/cron/notifications` for recent unacknowledged `life_events`.

**Advisor/attorney distribution (Sprint 4):**

- **Referral:** `lib/events/referral.ts` — advisor `?ref=` (`buildAllEventReferralUrls`) and attorney `?aref=` (`buildAllAttorneyEventReferralUrls`) for all **24** slugs; `_referral-tracker.tsx` → `POST /api/referral/track` with `type: 'advisor' | 'attorney'`; `referral_clicks` with `listing_type`.
- **Advisor portal:** `app/advisor/page.tsx` + `_advisor-client.tsx` **Newsletter Kit** (`?ref=`).
- **Attorney portal (Sprint 8):** `app/(attorney)/attorney/page.tsx` + `_attorney-dashboard-client.tsx` **Newsletter Kit** (`?aref=`, blue styling).
- **Plan readiness:** `PlanStatusCard` on advisor client Overview (`estate_health_scores.score` + gap counts; replaces `PlanReadinessCard`).
- **Gap workflow (UX-2):** `advisor_gap_statuses` + `GapStatusSelector` on Overview gap rows; `GET`/`PATCH` `/api/advisor/gap-status`.
- **Advisory metrics (UX-2):** `getCachedAdvisoryMetrics` on Strategy tab (six core metrics cached server-side).
- **Strategy tab UX (UX-3):** `StrategyTabContent` + `lib/advisor/advisoryMetricSeverity.ts`; `getActiveIndicatorMetricIds` caps severity indicators at 2 (`●` critical, `!` warning); liquidity shortfall banner when coverage &lt; 1.0x.
- **Strategy tab UX (UX-4):** Opportunities catalog rows expand inline (`InlineStrategyPanel`, `catalogToPanel.ts`); recommend refreshes Step 3 via `loadConsumerData` + `router.refresh`. Modeling sections (Combined Strategy, SLAT/ILIT, Advanced, Monte Carlo) remain below the three-step workflow as full-width fallback.
- **Attorney export:** `app/(dashboard)/print/_print-client.tsx` + `AttorneyEstatePlanPDF` — cover disclaimer, user attribution, title **Estate Planning Preparation Report** (Sprint C-2b, 2026-05-24).

**Analytics & A/B (Sprint 5):**

- **Vercel Analytics:** `@vercel/analytics` — `<Analytics />` in `app/layout.tsx` (automatic page views).
- **Custom funnel:** table `funnel_events`; `POST /api/analytics/funnel`; `lib/analytics/useFunnelEvent.ts` (fire-and-forget).
- **Instrumented events:** `event_page_view`, `event_assess_start`, `event_assess_complete`, `email_captured`, `account_created`, `tier_upgraded`, `advisor_connected`.
- **Upgrade copy (Sprint 12):** `getEventUpgradeValueProp()` in `lib/events/upgradeContext.ts` always uses personalized `EVENT_UPGRADE_COPY` (24 slugs × tier 2/3). Verify: `scripts/verify-event-upgrade-copy.ts`.
- **Assessment (Sprint 12):** `/assess` always shows scores to logged-out users; full gap report gated behind signup (`_assess-client.tsx`). Pre-launch A/B flags removed from `app_config`.
- **Signup attribution (Sprint 9):** `mwm_referral_*` and `mwm_attorney_referral_*` in sessionStorage → `profiles.referral_code` / `profiles.attorney_referral_code` + `account_created` funnel (`properties.advisor_referral_code`, `properties.attorney_referral_code`); keys cleared after signup.
- **Waitlist mode (Sprint 15):** `lib/waitlist-mode.ts` — default on for `VERCEL_ENV=production`; flip with `PUBLIC_SIGNUP_OPEN=true` at go-live. `middleware.ts` runtime redirect (`3ceb125`, renamed from `proxy.ts`).

**Email drip (Sprint 6–9):** Custom `EVENT_SEQUENCES` for all **24** event slugs (`DripEventSlug` union complete); `DEFAULT_SEQUENCE` only for unknown/null slugs. Steps 1–3 via capture + notifications cron.

**Current sprint (Sprint 14):** Manual smoke §1–7 **passed** 2026-05-23; §2.4 automated (`93aa6f5`). **Open:** hide Admin Portal for consumers; asset form save in viewport. Optional §8–11 + drip 2–3 remain.

**Sprint 12 (closed):** A/B collapse (personalized + score_visible); persona dashboard alerts; mobile drawer nav; full in-app copy audit (`DisclaimerBanner`, public surfaces, upgrade gates).

**Sprint C-2b (closed 2026-05-24):** Compliance language policy — `lib/compliance/language-policy.ts`, `scripts/audit-ux-language.sh`, CI workflow; all `DISCLAIMER_STRINGS` surfaces wired. See [UX_LANGUAGE_AUDIT_SPRINT.md](./UX_LANGUAGE_AUDIT_SPRINT.md).

**Sprint C-3 (closed 2026-06-02):** RLS policy fixes — `20260602000000_sprint_c3_rls_fixes.sql` (`236890c`). Auth callback, confirm-email, MFA middleware, security headers, PII logging (`56a4407`). Advisor-scoped policies use `CONNECTED_ADVISOR_CLIENT_STATUSES` (`active`, `accepted`) via `lib/advisor/clientConnectionStatus.ts`. Critical fix: `businesses` advisor SELECT no longer uses `auth.uid() IS NOT NULL`.

**Sprint C-4 (code complete 2026-06-02):** Billing disclosures — `lib/compliance/billing-disclosures.ts`; pre-checkout copy; self-serve cancel; `invoice.upcoming` renewal reminders (`462bda9`). Manual Stripe Dashboard verify remains — [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md).

**Sprint P-1 (closed 2026-06-02):** Performance quick wins — dashboard `Promise.all`, advisor conflict cache read, 3s recompute debounce, server-fetched notification count, `next/font`, owner_id indexes on `assets`/`liabilities` (`5c24160`). Production indexes verified. Diagnostics: [scripts/perf-diagnostic.sql](../scripts/perf-diagnostic.sql).

**Sprint P-2 (closed 2026-06-02):** Pre-launch perf refactors — `estate_health_scores.recommendations` cache (recompute persists RPC output; dashboard reads cache); projections cache-first in `loadProjectionData`; layout auth dedup via `getDashboardLayoutContext` (`47a38f3`). Migration: `20260602130000_sprint_p2_recommendations_cache.sql`. See [PERF_SPRINT_P1.md § Sprint P-2](./PERF_SPRINT_P1.md#sprint-p-2--pre-launch-refactors).

**Sprint C-5 (code complete 2026-06-02):** Privacy Policy (`/privacy`), Terms of Service (`/terms`), `LegalFooterLinks`, sitemap/robots (`2e1dff3`, `695a860`). Post-checkout terms accept at `/terms/accept`. Legal placeholders + counsel sign-off — [LEGAL_TODO.md](./LEGAL_TODO.md).

**Sprint 11 (closed):** Planning-app coherence — `PlanningSurfaceNav`, charitable empty state, `/complete` + `/projections` profile-only empty CTAs (`PLANNING_MISSING_PROJECTION_ACTIONS_TIER2`).
Sprints 9–10 closed: life-event-on-connect, Digital Assets tier 2, `getAppUrl()`, minimal business
succession, invite-advisor onboarding, A/B criteria in DECISION_LOG. See [ROADMAP.md](./ROADMAP.md).

---

## Migration status (at a glance)

| Area | Current | Target | Notes |
|------|---------|--------|--------|
| Consumer strategy writes | `/api/strategy-line-items` | Optional `/api/consumer/strategy-*` rename | Canonical path today; do not duplicate |
| Businesses / insurance writes | `/api/businesses`, `/api/insurance` | `/api/consumer/*` mirror (deferred) | Documented in CONSUMER_FLOWS |
| ATG intake | `adjusted_taxable_gifts` table only; no unified UI | Single intake feeding §2001(b) | See [Open design decisions](#open-design-decisions) |
| ATG → horizons / composition | Not wired; only `calculate_gifting_summary.lifetime_exemption_used` affects `lifetimeGiftsUsed` / `p_lifetime_gifts_used` | §2001(b) ATG in composition and horizon exemption | Backlog #3 |
| `gift_history` lifetime rows | Planning UX + `calculate_gifting_summary` | Stay separate until ATG design | Form 709 prior gifts section |
| Consumer Monte Carlo | Inflation + simulation count from accepted advisor row | Full advisor assumption parity | Backlog item below |
| Federal income tax | `federal_tax_brackets` required in canonical projection | No hardcoded fallback | Implemented |
| State income tax | `state_income_tax_brackets` in user paths | Retire `state_income_tax_rates` archive | Admin archive only |
| Estate health recompute | Server `afterHouseholdWrite` + secret header; persists score, conflicts, recommendations | No client `/api/recompute-estate-health` | Session 101+; recommendations cache P-2 |
| Projections load | Cache-first `outputs_s1_first` when fresh | Full 11-query compute when stale or overrides | Sprint P-2 |
| Trust UI | Single page `/my-estate-trust-strategy` tabs | `/trust-will` redirect only | Session 116 |

---

## Open design decisions

### ATG vs `gift_history` (IRC §2001(b))

Two concepts must stay separate until product designs unified intake:

| Concept | Storage | Used for |
|---------|---------|----------|
| Planning gifts | `gift_history` (+ `calculate_gifting_summary`) | Annual exclusion UI, lifetime meter, horizon `lifetimeGiftsUsed`, composition `p_lifetime_gifts_used` |
| Adjusted taxable gifts (ATG) | `adjusted_taxable_gifts` | Future §2001(b) taxable-gift add-back intake |

**Current:** Session 121 removed ATG add-back from `calculate_estate_composition`; `gift_history` `gift_type='lifetime'` rows are **not** ATG. Unified ATG intake is **not designed**.

**When designing intake:** update this section, `DATABASE_SCHEMA_REFERENCE.md` (`adjusted_taxable_gifts`, `gift_history`), and [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) gifting tab.

---

## Open Backlog

### High priority — Sprint 17 (go-live prep)

1. **LEGAL_TODO.md** — counsel handoff (flag ToS §10/§11/§13; one consolidated redline); placeholders + redlines in one commit — **blocks `PUBLIC_SIGNUP_OPEN`**
2. **C-4 manual verify** — Stripe Dashboard + production walkthrough — [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md)
3. **Stripe production billing** — production keys; checkout + webhook on production.
4. **Go-live day ops** — Supabase Auth ON → `PUBLIC_SIGNUP_OPEN=true`; Core §1–3 smoke with fresh email. [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)
5. **Drip step 2 production verify** — `npm run verify:drip -- --email e2e-drip@mywealthmaps.test` (day 3+).
6. **Estate composition read model (post-launch)** — materialize `calculate_estate_composition` at recompute; recommendations done in P-2; highest remaining ceiling per Query A / [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md).

### High priority — confirmed post-launch

1. **ATG intake & horizon wiring (IRC §2001(b)):** Design unified `adjusted_taxable_gifts` intake;
   wire §2001(b) ATG into estate composition and horizon `lifetimeGiftsUsed`. Session 121 removed
   add-back from RPC. (See Open design decisions section.)
2. **Consumer Monte Carlo full parity** — expand assumption fields beyond inflation/simulation count
   to match full advisor assumption set.
3. **`/api/strategy-line-items` → optional consumer namespace cleanup** — keep as canonical path
   for now; revisit during a broader `/api/consumer/*` label cleanup.
4. **Mirror `/api/businesses` and `/api/insurance`** under `/api/consumer/*` or document permanent
   legacy status.
5. **"Ask your advisor →" in-app action for connected users** — currently links to `/find-advisor`
   for all users including those with a connected advisor. Post-launch: CTA should offer an in-app
   flag or message when `advisor_clients` row exists in `CONNECTED_ADVISOR_CLIENT_STATUSES`. (See DECISION_LOG.)
6. **Cross-device referral event slug** — optional `profiles.referral_event_slug` at signup if product
   requires event context when sessionStorage does not survive to account creation (see NEXT_SESSION.md).

### Confirmed post-launch (no Sprint assignment)

- ~~`/education` in `middleware.ts` `PUBLIC_PATHS`~~ — ✅ done (`a138608`); education fully public; double sticky nav fixed on `/education/*`
- Blended family as separate slug (optional; `remarriage-blended-family` covers today)
- Admin funnel: attorney click breakdown by `listing_type` (can ship Sprint 10 if time permits)

Keep this file updated with **Current vs Target** deltas and the [Migration status](#migration-status-at-a-glance) table each session.

