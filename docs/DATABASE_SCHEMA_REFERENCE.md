# DATABASE_SCHEMA_REFERENCE.md
# MyWealthMaps / Estate Planner — Database Schema Guide
# Last updated: May 16, 2026 (Session 118 / gift_history consumer API + horizon lifetime gifts)

---

## Purpose

This document describes the application data model at a practical engineering level:

- what each core table stores
- how tables relate
- which tables are authoritative
- which tables are legacy/transition

This is a developer reference, not a full SQL DDL dump.

---

## Core Entity Map

| Domain | Primary Table(s) | Notes |
|-------|-------------------|------|
| Identity & access | `profiles`, `advisor_clients` | `profiles.id = auth.uid()` |
| Household model | `households` | One primary planning container per owner |
| Financial inputs | `assets`, `liabilities`, `income`, `expenses`, `real_estate`, `businesses`, `insurance_policies` | Projection inputs |
| Projection outputs | `projection_scenarios` | Stores generated snapshots (`outputs_*`) |
| Estate composition | `calculate_estate_composition` RPC + related tables | Derived values |
| Estate tax rules | `federal_tax_config`, `state_estate_tax_rules` | Estate transfer tax calculations |
| Income tax rules | `state_income_tax_brackets` | Progressive state income rules (canonical target) |
| Alerts/health | `estate_health_scores`, `household_alerts`, `beneficiary_conflicts`, `assessment_results` | Cached analytics + user assessment history |
| Domicile | `domicile_analysis`, `domicile_schedule`, `domicile_checklist_items` | Residency and move planning |
| Strategy tracking | `strategy_line_items`, `strategy_configs` | Recommendation and modeled strategy data |
| Gifting activity | `gift_history` | Annual/lifetime/529/medical/tuition gifts; feeds `calculate_gifting_summary` |
| Post-1976 ATG (legacy intake) | `adjusted_taxable_gifts` | Separate from `gift_history`; IRC §2001(b) ATG — not yet wired to horizons |
| Monte Carlo assumptions | `advisor_projection_assumptions`, `projection_assumption_audit` | Advisor override + consumer accept/revert workflow |

---

## Key Tables

### `profiles`

- **Key columns:** `id`, `role`, `consumer_tier`, `subscription_status`
- **Purpose:** user identity attributes and subscription/role flags.

### `households`

- **Key columns:** `id`, `owner_id`, `filing_status`, `state_primary`, `base_case_scenario_id`
- **Purpose:** central planning record for person/spouse demographics and modeling defaults.

### `advisor_clients`

- **Key columns:** `advisor_id`, `client_id`, `status`, `accepted_at`, `advisor_pdf_access`
- **Purpose:** advisor-client link and authorization boundary for advisor workflows.
- **Consumer UI:** `/my-advisor` reads accepted connection (`status='accepted'`) joined to `profiles` and `advisor_listings`; revoke sets `status='revoked'`.

### `attorney_clients`

- **Key columns:** `attorney_id`, `client_id` (household id), `status`, `granted_at`, `advisor_pdf_access`
- **Purpose:** attorney access to household estate plan; distinct from `connection_requests` pending/claim flow.
- **Consumer UI:** `/my-attorney` and `/settings/attorney-access` read active/accepted rows; revoke via `/api/attorney/revoke-access`.

### `assets`, `liabilities`, `income`, `expenses`

- **Purpose:** core projection input tables.
- **Notes:** timestamp changes in these tables are used for staleness detection.

### `real_estate`

- **Key columns:** `owner_id`, `current_value`, `mortgage_balance`, `monthly_payment`, `planned_sale_year`
- **Purpose:** property FMV and mortgage dynamics in projection and estate views.

### `businesses`

- **Purpose:** authoritative business valuation source.
- **Note:** `business_interests` remains present for legacy compatibility in some paths.

### `insurance_policies`

- **Key columns:** `user_id`, `death_benefit`, `cash_value`, `is_ilit`
- **Important:** uses `user_id` (not `owner_id`).

### `projection_scenarios`

- **Key columns:** `household_id`, `scenario_type`, `outputs_s1_first`, `outputs_s2_first`, `calculated_at`
- **Purpose:** persisted projection snapshots used by multiple pages/tabs.

### `gift_history`

- **Key columns:** `id`, `household_id`, `owner_id`, `tax_year`, `donor_person`, `recipient_name`, `recipient_relationship`, `amount`, `gift_type`, `form_709_filed`, `notes`, `created_at`
- **Purpose:** consumer-logged gifts for annual exclusion tracking, Form 709 lifetime gifts, and specialty exclusions (529, direct medical/tuition).
- **`gift_type` values (application):** `annual`, `lifetime`, `529`, `medical`, `tuition`
- **`donor_person`:** `person1` | `person2` (MFJ households; UI labels from `households.person1_name` / `person2_name`)
- **RPC:** `calculate_gifting_summary(p_household_id)` aggregates rows and returns `lifetime_exemption_used`, annual caps, per-recipient audit, and `gifts` JSON array (single read path for `GiftingDashboard`).
- **Consumer writes (Session 118):** `POST` / `PATCH` / `DELETE` `/api/consumer/gift-history` — `requireOwnedHouseholdId`, row verify via `household_id` + `owner_id`, `afterHouseholdWrite`, `revalidatePath` on strategy/gifting pages. No browser Supabase writes from dashboard UI.
- **Horizon engine (Session 118):** `lifetime_exemption_used` from the RPC is passed as `lifetimeGiftsUsed` into `buildStrategyHorizons` so federal exemption on horizon columns matches the gifting tab (engine does not call the RPC).
- **UI:** `components/GiftingDashboard.tsx` — annual gifts via **Log a Gift**; prior Form 709 lifetime gifts via **Prior taxable gifts** collapsible (`gift_type='lifetime'`, amber left border when `form_709_filed=false`).

### `adjusted_taxable_gifts`

- **Key columns:** `household_id`, `gift_year`, `amount`, `recipient_description`, `three_year_clawback`, `notes`
- **Purpose:** post-1976 adjusted taxable gifts (IRC §2001(b)) — **distinct** from `gift_history` lifetime rows used for planning UX and `calculate_gifting_summary`.
- **Note:** Not merged into horizon `lifetimeGiftsUsed` in Session 118; keep both concepts separate until a unified ATG intake is designed.

### `strategy_line_items`

- **Key columns:** `id`, `household_id`, `source_role`, `strategy_source`, `amount`, `consumer_accepted`, `consumer_rejected`, `accepted_at`
- **Purpose:** strategy recommendation and acceptance audit layer.
- **Current behavior notes:**
  - advisor recommendations are written via advisor API routes (`source_role='advisor'`)
  - consumer-entered strategies are written via `POST /api/strategy-line-items` with `source_role='consumer'` (optional `scenario_name` for display; e.g. annual gifting on `/my-estate-trust-strategy`, charitable total as `strategy_source='daf'` from `CharitableGivingDashboard`); `category` required by DB check — API defaults from `strategy_source` when omitted (`lib/strategy/resolveStrategyLineItemCategory.ts`)
  - **Upsert key (active rows):** partial unique index `strategy_line_items_upsert_active_idx` on `(household_id, strategy_source, source_role, COALESCE(projection_year,-1), COALESCE(scenario_name,''))` WHERE `is_active=true` (migration `20260516000001`)
  - **`strategy_source` allowlist** includes `liquidity`, `roth`, `slat` (in addition to gifting, trust, charitable, etc.)
  - consumer dashboard reads active advisor rows for `StrategyRecommendationPanel` (accept/decline via `/api/consumer/strategy-recommendation`)
  - consumer removal uses `DELETE /api/strategy-line-items` (sets `is_active=false` for matching household + `strategy_source` + `source_role`; row retained for audit)
  - consumer accept/reject operations update advisor rows via `consumer_accepted` / `consumer_rejected` / `accepted_at`
  - advisor read APIs may include rejected rows for declined-history visibility, while calculation surfaces filter rejected rows from active impact
  - `my-estate-trust-strategy` and `my-estate-strategy` horizon builds include consumer rows; trust-strategy page merges consumer + non-rejected advisor items before `buildStrategyHorizons`
  - `calculate_estate_composition` RPC already sums all active `strategy_line_items` (no `source_role` filter) — do not add consumer amounts again in page-level `strategyImpact` totals

### `assessment_results`

- **Key columns:** `id`, `user_id`, `taken_at`, `overall_score`, `financial_score`, `retirement_score`, `estate_score`, `financial_pct`, `retirement_pct`, `estate_pct`, `answers`
- **Purpose:** persist planning-readiness assessment runs so dashboard and assessment history surfaces can show latest and prior scores.
- **RLS policy:** users can insert/select only rows where `user_id = auth.uid()`.
- **Application behavior note:** when assessment results are generated while signed out, UI now prompts for account creation/sign-in before persistence; authenticated users continue to write rows to `assessment_results`.
- **Restore behavior note:** signed-out runs are cached client-side under `mwm_pending_assessment` and inserted after auth return (within 30-minute freshness window), then cache is cleared.

### `connection_requests`

- **Key columns:** `id`, `listing_type`, `listing_id`, `profile_id`, `consumer_id`, `message`, `status`, `claim_token`, `created_at`
- **Purpose:** canonical connection-request ledger across advisor and attorney listing flows.
- **Status values (application + migration `20260514100000_connection_requests_status_accepted_cancelled.sql`):**
  - `pending` — consumer submitted; awaiting professional action
  - `accepted` — professional claimed/responded via `claim-listing` flow
  - `cancelled` — consumer cancelled pending request via cancel API
  - `active`, `revoked` — retained from earlier attorney-access migration constraint history (see `20260401000000_attorney_access_fields.sql`)
- **Current application routes using this table:**
  - `POST /api/advisor-directory/request-connect` (insert `pending` + `claim_token`)
  - `POST /api/attorney-directory/request-connect` (insert `pending` + `claim_token`)
  - `POST /api/connection-requests/cancel` (consumer-owned pending → `cancelled`; uses admin client after auth/ownership checks)
- **Read surfaces:**
  - `app/claim-listing/[token]/page.tsx` — lookup by `claim_token`, update to `accepted`
  - `app/(dashboard)/my-advisor/page.tsx` — latest pending advisor request for consumer
  - `app/(dashboard)/my-attorney/page.tsx` — all pending attorney requests for consumer
  - `app/find-attorney/page.tsx` — pending listing IDs to disable duplicate connect UI

### `state_estate_tax_rules`

- **Key columns:** `state`, `tax_year`, `min_amount`, `max_amount`, `rate_pct`, `exemption_amount`
- **Purpose:** progressive state estate transfer tax brackets.

### `state_income_tax_brackets`

- **Key columns:** `state`, `tax_year`, `filing_status`, `min_amount`, `max_amount`, `rate_pct`
- **Purpose:** progressive state income tax brackets.
- **Status:** canonical target source.

### `state_income_tax_rates` (legacy)

- **Purpose:** older flat-rate table.
- **Status:** transition/cleanup remaining; phase out queries over time.

### `advisor_projection_assumptions`

- **Key columns:** `advisor_id`, `client_household_id`, `is_active`, assumption fields, `shared_at`, `accepted_by_client`, `accepted_at`
- **Purpose:** advisor Monte Carlo scenario assumptions and consumer acceptance state.
- **Acceptance behavior:** consumer accept/revert toggles `accepted_by_client`/`accepted_at` on household-linked rows; latest accepted row is consumer-effective state.
- **Consumer UI (Session 98):** `/dashboard` and `/my-estate-strategy` server pages fetch rows where `accepted_by_client=true` or `shared_at` is set; `MonteCarloScenarioBanner` calls `/api/monte-carlo/advisor-assumptions` for accept/revert with `router.refresh()`.

### `projection_assumption_audit`

- **Purpose:** field-level change audit for assumption edits.

### `estate_health_scores`

- **Key columns:** `household_id`, `score`, `component_scores`, `computed_at`
- **Purpose:** cached health score summary (read path should avoid recomputing synchronously).

### `household_alerts`

- **Purpose:** household-level alerts.
- **Constraint note:** `rule_id` should never be null.

---

## Important Relationships

- `profiles.id` → `households.owner_id`
- `households.id` → `projection_scenarios.household_id`
- `households.base_case_scenario_id` → `projection_scenarios.id`
- `households.id` → `strategy_line_items.household_id`
- `advisor_clients.client_id` maps to `households.owner_id` (advisor access context)

---

## Authoritative vs Legacy

### Authoritative now

- `businesses` (vs legacy business-interest-only paths)
- `state_estate_tax_rules` for state estate tax
- `state_income_tax_brackets` for bracket-based state income tax behavior

### Legacy/transition

- `state_income_tax_rates` (still read in some non-engine surfaces)
- consumer path still uses legacy-named `/api/strategy-line-items` endpoint (single canonical consumer path today)
- consumer accept/reject path for advisor recommendations now lives in `/api/consumer/strategy-recommendation` (application-layer route only; no schema change)

---

## Staleness/Regeneration Inputs

Projection snapshots should be invalidated when newer data exists in:

- `households.updated_at`
- `assets`, `liabilities`, `income`, `expenses`, `real_estate`, `businesses`, `business_interests`, `insurance_policies`
- latest `state_income_tax_brackets.created_at`

---

## RPCs Used Heavily

| RPC | Purpose |
|-----|---------|
| `calculate_estate_composition` | Estate asset/tax composition |
| `calculate_domicile_risk` | Domicile risk scoring |
| `generate_estate_recommendations` | Gap/recommendation generation |
| `calculate_gifting_summary` | Gifting summary outputs (`lifetime_exemption_used`, annual caps, `gifts` array); horizon callers pass `lifetime_exemption_used` as `lifetimeGiftsUsed` |
| `get_state_exemptions` | State exemption batch lookup |
| `upsert_household_alert` | Safe alert writes |

---

## Suggested Maintenance Practice

After each schema-affecting session:

1. Add new migration ID to this document.
2. Update authoritative/legacy status if changed.
3. Update relationship notes if FKs or key joins changed.
4. Note any temporary compatibility paths to remove later.

---

## Migration Reference (Recent)

- `20260427190300_create_state_income_tax_brackets_2026.sql`
- `20260428000001_create_advisor_projection_assumptions.sql`
- `20260428000002_strategy_line_items_acceptance_fields.sql`
- `20260430000000_create_assessment_results.sql`
- `20260430100000_seed_federal_tax_brackets_2026.sql`
- `20260514100000_connection_requests_status_accepted_cancelled.sql` — extends `connection_requests_status_check` to allow `accepted` and `cancelled` (required for claim-listing accept + consumer cancel API)

---

## Session 94 Note

- Schema/migration changes introduced:
  - `20260514100000_connection_requests_status_accepted_cancelled.sql` — `connection_requests.status` check now includes `accepted` and `cancelled`.
- Application-layer changes (no new tables):
  - `POST /api/connection-requests/cancel` for consumer pending-request cancellation.
  - New consumer routes `/my-attorney` (connections + pending requests) and enhanced `/my-advisor` (pending request + cancel).
  - Education module frontmatter `published: false` on three meta modules; `listEducationModules()` filters unpublished entries.

## Session 95 Note

- No database schema or migration changes were introduced in Session 95.
- Application-layer changes (existing `strategy_line_items` table):
  - `my-estate-trust-strategy/page.tsx` fetches `source_role='consumer'` rows alongside advisor rows and merges both into `buildStrategyHorizons`.
  - `my-estate-trust-strategy/_client.tsx` adds gifting scenario **Save to my plan →** (`POST /api/strategy-line-items`) and **Your Saved Strategies** display on the Transfer Strategies tab.
  - `my-estate-strategy/page.tsx` unchanged — already includes consumer rows in `actualStrategyLineItems`.

## Session 96 Note

- No database schema or migration changes were introduced in Session 96.
- Application-layer changes (existing `strategy_line_items` + `/api/recompute-estate-health`):
  - `my-estate-trust-strategy/_client.tsx`: `router.refresh()` after gifting save and consumer strategy remove; **Remove from plan** on saved strategies table; non-blocking estate health recompute after save/remove.
  - `CharitableGivingDashboard.tsx`: **Save to my plan →** for total donated (`strategy_source='daf'`), with `router.refresh()` and recompute on success.

## Session 97 Note

- No database schema or migration changes were introduced in Session 97.
- Application-layer changes:
  - `POST /api/strategy-line-items` now persists optional `scenario_name` on consumer upserts.
  - `my-estate-trust-strategy/_client.tsx`: optional gifting **Program name** saved as `scenario_name`.
  - New `components/consumer/StrategyRecommendationPanel.tsx`; wired on `/dashboard` via `dashboard/page.tsx` + `_dashboard-client.tsx` for advisor recommendation accept/decline.

## Session 98 Note

- No database schema or migration changes were introduced in Session 98.
- Application-layer changes:
  - New `components/consumer/MonteCarloScenarioBanner.tsx` and `lib/monte-carlo/consumerAssumptionScenarios.ts` for consumer MC scenario accept/revert UI.
  - `dashboard/page.tsx` and `my-estate-strategy/page.tsx` pre-fetch `advisor_projection_assumptions` for the banner.
  - `real-estate/_real-estate-client.tsx` and `liabilities/page.tsx` call `/api/recompute-estate-health` after successful add/update/delete.

## Session 99 Note

- No database schema or migration changes were introduced in Session 99.
- Application-layer changes:
  - `assets/page.tsx`, `income/_income-client.tsx`, and `expenses/_expenses-client.tsx` call non-blocking `POST /api/recompute-estate-health` after successful add/update/delete (`householdId` passed from server pages for income/expenses).
  - `my-estate-trust-strategy/_client.tsx`: gifting **Compare a second scenario** UI (side-by-side comparison + save).

## Session 100 Note

- No database schema or migration changes were introduced in Session 100.
- Application-layer changes:
  - `POST /api/strategy-line-items`: upsert lookup includes `scenario_name` when provided (named consumer gifting plans are distinct rows); `DELETE` accepts optional `scenarioName` to deactivate one named row.
  - `my-estate-trust-strategy/_client.tsx`: Remove button passes `scenario_name`; loading state uses composite key `strategy_source::scenario_name`.
  - New consumer write routes (POST/PATCH/DELETE): `/api/consumer/assets`, `/api/consumer/real-estate`, `/api/consumer/liabilities`, `/api/consumer/income`, `/api/consumer/expenses`. Each touches `households.updated_at` and calls `triggerEstateHealthRecompute`.
  - Dashboard pages for those entities migrated off direct Supabase client writes; `income/actions.ts` server actions removed in favor of `/api/consumer/income`.

## Session 101 Note

- No database schema or migration changes were introduced in Session 101.
- Application-layer changes:
  - New `lib/consumer/afterHouseholdWrite.ts` — shared `touchHousehold`, `triggerHouseholdRecompute`, `afterHouseholdWrite`, `resolveOwnedHouseholdId`.
  - All `/api/consumer/{assets,real-estate,liabilities,income,expenses}` routes refactored to use `afterHouseholdWrite`.
  - `/api/strategy-line-items` POST/DELETE and `/api/consumer/strategy-recommendation` PATCH/DELETE now call `afterHouseholdWrite` (fixes client recompute calls that lacked `x-recompute-secret`).
  - Removed client-side `/api/recompute-estate-health` from trust-strategy client, `CharitableGivingDashboard`, and `StrategyRecommendationPanel`.
  - `expenses/page.tsx` server select includes `start_month` / `end_month`; real-estate and expenses clients sync props from server refresh without post-save `loadData()`.

## Session 102 Note

- No database schema or migration changes were introduced in Session 102.
- Application-layer changes:
  - `/assets` and `/liabilities`: split into server `page.tsx` + `_assets-client.tsx` / `_liabilities-client.tsx` (no client mount `loadData()`); save handlers patch local state from API JSON then `router.refresh()`.
  - `useMemo` for grouped row keys on assets, liabilities, income, and expenses clients.
  - Deleted unused `app/api/assets/[id]/route.ts` and orphan `income/_add-income-modal.tsx`, `income/_income-table.tsx`.

## Session 103 Note

- No database schema or migration changes were introduced in Session 103.
- Application-layer changes:
  - Real-estate, expenses, and income clients patch list state from consumer API JSON on save; income keeps synced local state for deletes.
  - Consumer entity routes use `requireOwnedHouseholdId` (POST/PATCH) and `resolveOwnedHouseholdId` (DELETE) from `lib/consumer/afterHouseholdWrite.ts`.
  - `lib/estate/triggerEstateHealthRecompute.ts` logs production misconfiguration and recompute failures; see `MASTER_ARCHITECTURE.md` → “Estate health recompute — operations” for env vars and smoke checklist.

## Session 104 Note

- No database schema or migration changes were introduced in Session 104.
- Application-layer changes:
  - `triggerHouseholdRecompute` / `getConsumerAppUrl()` used by dashboard, my-estate-strategy, advisor client view, and `/api/households/[id]` (replaces empty app URL fallbacks).
  - `afterHouseholdWriteForOwner` on `/api/businesses/[id]` and `/api/insurance/[id]`; strategy-recommendation uses `resolveOwnedHouseholdId`; strategy-line-items PATCH calls `afterHouseholdWrite`.

## Session 105 Note

- No database schema or migration changes were introduced in Session 105.
- Application-layer changes:
  - `lib/projections/loadProjectionData.ts` — shared projection fetch/compute for `/api/projection` and `/projections` page.
  - Server-prefetch: `/projections`, `/scenarios` (household + base case), `/profile` (`buildProfileFormInitial`), `/health-check` (household + prior answers).
  - `/titling/_titling-client.tsx` — `router.refresh()` + prop sync replaces client `reloadData()`.

## Session 106 Note

- No database schema or migration changes were introduced in Session 106.
- Application-layer changes:
  - `PATCH /api/consumer/profile` — server-side profile + household upsert; `afterHouseholdWrite` on save; `_profile-client.tsx` no longer writes directly via Supabase client.
  - `POST /api/businesses` — `afterHouseholdWriteForOwner` after insert (recompute parity with `[id]` routes).

## Session 107 Note

- No database schema or migration changes were introduced in Session 107.
- Application-layer changes:
  - `PUT /api/consumer/estate-health-check` — upserts `estate_health_check`; `afterHouseholdWrite`; `_health-check-client.tsx` no longer writes via Supabase client.
  - `POST` / `PATCH` / `DELETE` `/api/consumer/household-people` — CRUD on `household_people` with ownership checks; `lib/family/householdPeople.ts` shared payload/GST helpers; `_my-family-client.tsx` uses consumer API + `router.refresh()`.

## Session 108 Note

- No database schema or migration changes were introduced in Session 108.
- Application-layer changes:
  - `POST` / `PATCH` / `DELETE` `/api/consumer/asset-beneficiaries` and `POST …/bulk` — beneficiary CRUD; `lib/titling/assetBeneficiaries.ts`; updates `households.last_beneficiary_review`; `_titling-client.tsx` beneficiary paths use API.
  - `PATCH /api/consumer/allocation-targets` — `households.target_*_pct` with sum-to-100 validation; `_allocation-client.tsx` + server prefetch on `/allocation`.
  - `POST /api/consumer/generate-base-case` — `afterHouseholdWrite` after successful `generateBaseCase`.
  - Playwright: `consumer-api-writes.spec.ts`, `consumer-financial-writes.spec.ts`, `consumer-strategy-writes.spec.ts`, updated `dashboard.spec.ts`.

## Session 109 Note

- Migration `20260516000001_strategy_line_items_upsert_idx_scenario_name.sql`:
  - Adds `source_role` column if missing (`consumer` | `advisor`).
  - Drops legacy `strategy_line_items_household_source_year_unique`; adds `strategy_line_items_upsert_active_idx` (partial unique on active rows, includes `scenario_name`).
  - Extends `strategy_source` check constraint with `liquidity`, `roth`, `slat`.
- Application-layer changes:
  - `lib/strategy/resolveStrategyLineItemCategory.ts` — valid category resolution for `POST /api/strategy-line-items` (fixes invalid default `category: 'other'`).
  - Consumer UI passes `category` on gifting/charitable saves; liquidity panel uses `category: 'liability'`.

## Session 118 Note

- No database schema or migration changes were introduced in Session 118.
- Application-layer changes (existing `gift_history` table + `calculate_gifting_summary` RPC):
  - `lib/my-estate-strategy/horizonSnapshots.ts` — `lifetimeGiftsUsed` on `BuildHorizonsInput` / `estimateFederalEstateTaxSnapshot` (`exemption = max(0, statutory − lifetimeGiftsUsed)`).
  - Horizon callers: `my-estate-strategy/page.tsx`, `my-estate-trust-strategy/page.tsx`, `lib/advisor/strategyMappers.ts` + advisor client page.
  - `POST` / `PATCH` / `DELETE` `/api/consumer/gift-history` — consumer gift CRUD; `afterHouseholdWrite`.
  - `components/GiftingDashboard.tsx` — API writes, **Prior taxable gifts (Form 709)** section, donor selector for MFJ.

## Session 117 Note

- No database schema or migration changes were introduced in Session 117.
- Application-layer changes:
  - `POST` / `DELETE` `/api/consumer/digital-assets` — digital asset inventory CRUD; `afterHouseholdWrite`.
  - Trust POST sets `household_id` on insert; `lib/trusts/trustPayload.ts` aligned to live schema (no `excluded_from_estate`).

## Session 116 Note

- No database schema or migration changes were introduced in Session 116.
- Application-layer only: trust UI merge (`TrustDocumentsPanel`, `/trust-will` redirect), educational planning-topic presentation (`lib/estate/planningTopicPresentation.ts`).

## Session 115 Note

- No database schema or migration changes were introduced in Session 115.
- Application-layer cleanup (Phase A): `docs/CONSUMER_NAV_MAP.md`; sidebar/page title alignment; removed dead `asset-allocation` client duplicate; `lib/tiers.ts` feature keys aligned with page gates.

## Session 114 Note

- No database schema or migration changes were introduced in Session 114.
- Application-layer changes:
  - `POST /api/consumer/scenario-snapshots` — inserts archived comparison rows into `projections` (distinct from live `projection_scenarios` base case); `lib/scenarios/buildScenarioSnapshot.ts`; ownership via `requireOwnedHouseholdId`.
  - `_scenarios-client.tsx` save action uses consumer API (no browser Supabase write).

## Session 113 Note

- No database schema or migration changes were introduced in Session 113.
- Application-layer cleanup:
  - Deleted unused `lib/projections/loaders/loadProjectionPageData.ts` (canonical path: `lib/projections/loadProjectionData.ts` on server).
  - Playwright `@playwright/test` 1.59 → 1.60; removed `tests/e2e/example.spec.ts` (Playwright.dev scaffold; not in `playwright.config` projects).

## Session 112 Note

- No database schema or migration changes were introduced in Session 112.
- Application-layer changes:
  - `POST` / `PATCH` / `DELETE` `/api/consumer/trusts` — CRUD on `trusts` with ownership checks; `lib/trusts/trustPayload.ts`; `afterHouseholdWrite`.
  - `app/(dashboard)/trust-will/page.tsx` — server prefetch + `getTrustWillRecommendations` / `getTrustWillChecklist`.
  - `_trust-will-client.tsx` and `my-estate-trust-strategy/_client.tsx` — trust saves/deletes via consumer API (no browser Supabase writes).

## Session 111 Note

- No database schema or migration changes were introduced in Session 111.
- Application-layer changes:
  - `POST /api/consumer/entity-titling` — upserts `asset_titling` / `real_estate_titling` / `insurance_policy_titling` / `business_titling` and updates parent entity titling fields (`titling`, `liquidity`, `cost_basis`, `basis_date`); `lib/titling/entityTitling.ts`; `afterHouseholdWrite`.
  - `_titling-client.tsx` `TitlingModal` uses consumer API (no client Supabase writes on `/titling`).

## Session 110 Note

- No database schema or migration changes were introduced in Session 110.
- Application-layer changes:
  - `POST /api/insurance` — `afterHouseholdWriteForOwner` after policy insert (PATCH/DELETE on `[id]` already had recompute).
  - `lib/strategy/upsertStrategyLineItem.ts` — shared upsert for `/api/strategy-line-items` POST and `/api/advisor/strategy-recommendation` POST; maps advisor `low|medium|high` → `illustrative|probable|certain`.
  - `/api/advisor/strategy-recommendation` POST/DELETE — `afterHouseholdWrite`; inserts include `category`, `metric_target`, `scenario_id`.
  - `AdvancedStrategyPanel` passes `category`, `metric_target`, `scenario_id`, `scenarioName` on advisor recommend.

---

## Session 43 Note

- No database schema or migration changes were introduced in Session 43.
- Changes in this session are application-layer refactors only (dashboard route UI componentization).

## Session 44 Note

- No database schema or migration changes were introduced in Session 44.
- Changes in this session are application-layer refactors only (extraction of dashboard estate summary UI composition).

## Session 45 Note

- No database schema or migration changes were introduced in Session 45.
- Changes in this session are application-layer refactors only (extraction of dashboard intro/setup UI composition).

## Session 46 Note

- No database schema or migration changes were introduced in Session 46.
- Changes in this session are application-layer refactors only (new shared net worth view-model module and adoption in consumer/advisor UI paths).

## Session 47 Note

- No database schema or migration changes were introduced in Session 47.
- Changes in this session are application-layer refactors only (new shared retirement snapshot view-model module and dashboard adoption).

## Session 48 Note

- No database schema or migration changes were introduced in Session 48.
- Changes in this session are application-layer refactors only (shared tax scope badge mapper and advisor metrics UI adoption).

## Session 49 Note

- No database schema or migration changes were introduced in Session 49.
- Changes in this session are application-layer refactors only (shared projection summary cards view-model and consumer projections page adoption).

## Session 50 Note

- No database schema or migration changes were introduced in Session 50.
- Changes in this session are application-layer refactors only (shared projection staleness helper contract and adoption across consumer/advisor pages).

## Session 51 Note

- No database schema or migration changes were introduced in Session 51.
- Changes in this session are application-layer refactors only (advisor staleness query orchestration extracted to `lib/advisor/loaders.ts`).

## Session 52 Note

- No database schema or migration changes were introduced in Session 52.
- Changes in this session are application-layer refactors only (advisor client access/bootstrap query orchestration extracted to `lib/advisor/clientPageLoaders.ts`).

## Session 53 Note

- No database schema or migration changes were introduced in Session 53.
- Changes in this session are application-layer refactors only (advisor bulk client dataset query orchestration extracted to `lib/advisor/loaders.ts`).

## Session 54 Note

- No database schema or migration changes were introduced in Session 54.
- Changes in this session are application-layer refactors only (advisor dataset normalization/mapping extracted to `lib/advisor/mappers.ts`).

## Session 55 Note

- No database schema or migration changes were introduced in Session 55.
- Changes in this session are application-layer refactors only (advisor export payload mapping extracted to `lib/advisor/exportMappers.ts`).

## Session 56 Note

- No database schema or migration changes were introduced in Session 56.
- Changes in this session are application-layer refactors only (shared advisor export contract typing extracted to `lib/advisor/types.ts` and propagated to consumer modules).

## Session 57 Note

- No database schema or migration changes were introduced in Session 57.
- Changes in this session are application-layer refactors only (advisor mapper input/output typing hardening and route-level typed consumption updates).

## Session 58 Note

- No database schema or migration changes were introduced in Session 58.
- Changes in this session are application-layer refactors only (advisor route type-assertion cleanup after mapper type alignment).

## Session 59 Note

- No database schema or migration changes were introduced in Session 59.
- Changes in this session are application-layer refactors only (shared advisor loader result contract introduced and mapper boundary aligned to it).

## Session 60 Note

- No database schema or migration changes were introduced in Session 60.
- Changes in this session are application-layer refactors only (advisor strategy/horizon mapping extracted to `lib/advisor/strategyMappers.ts`).

## Session 61 Note

- No database schema or migration changes were introduced in Session 61.
- Changes in this session are application-layer refactors only (advisor domicile checklist read and advisor access-log write extracted to shared advisor loaders).

## Session 62 Note

- No database schema or migration changes were introduced in Session 62.
- Changes in this session are application-layer readability refactors only (advisor client route orchestration comments/import grouping; no behavior change).

## Session 75 Note

- No new schema migration required.
- Existing `advisor_projection_assumptions` acceptance fields (`accepted_by_client`, `accepted_at`) are now actively used by the consumer Monte Carlo accept/revert flow.

## Session 76 Note

- No database schema or migration changes were introduced in Session 76.
- Legacy application module `lib/calculations/projection.ts` was removed after zero-caller validation; projection runtime remains on `projection-complete.ts`.

## Session 79 Note

- No database schema or migration changes were introduced in Session 79.
- Application-layer strategy workflow updates now use existing `strategy_line_items` acceptance fields (`consumer_accepted`, `consumer_rejected`, `accepted_at`) for consumer accept/reject and advisor declined-visibility behavior.

## Session 88 Note

- No database schema or migration changes were introduced in Session 88.
- Changes in this session are application-layer only:
  - Design-system/UX refresh across education and landing surfaces.
  - Middleware guard update in `proxy.ts` to allow unauthenticated root (`/`) pass-through before profile queries.

## Session 91 Note

- Schema/migration changes introduced:
  - Added `assessment_results` table + index + RLS policies for per-user assessment persistence.
  - Seeded 2026 federal income tax brackets for `single` and `married_joint` in `federal_tax_brackets`.
- Compatibility note:
  - Seed migration includes `tax_year` compatibility handling for environments that previously used `year`.

## Session 92 Note

- No database schema or migration changes were introduced in Session 92.
- Changes in this session are application-layer only:
  - Attorney directory route/client moved to `app/find-attorney/*` and aligned to the existing attorney connection-request API path.
  - Assessment results UX now surfaces a signed-out save CTA before persistence.

## Session 93 Note

- No database schema or migration changes were introduced in Session 93.
- Changes in this session are application-layer only:
  - Public advisor directory moved to `app/find-advisor/*` with legacy `/advisor-directory` redirecting to `/find-advisor`.
  - Assessment results flow now includes local-storage pending payload restore (`mwm_pending_assessment`) after authentication.

