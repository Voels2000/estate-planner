# DATABASE_SCHEMA_REFERENCE.md
# MyWealthMaps / Estate Planner — Database Schema Guide
# Last updated: April 28, 2026 (Session 41)

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
| Alerts/health | `estate_health_scores`, `household_alerts`, `beneficiary_conflicts` | Cached analytics + notifications |
| Domicile | `domicile_analysis`, `domicile_schedule`, `domicile_checklist_items` | Residency and move planning |
| Strategy tracking | `strategy_line_items`, `strategy_configs` | Recommendation and modeled strategy data |
| Monte Carlo assumptions | `advisor_projection_assumptions`, `projection_assumption_audit` | Advisor override workflow |

---

## Key Tables

### `profiles`

- **Key columns:** `id`, `role`, `consumer_tier`, `subscription_status`
- **Purpose:** user identity attributes and subscription/role flags.

### `households`

- **Key columns:** `id`, `owner_id`, `filing_status`, `state_primary`, `base_case_scenario_id`
- **Purpose:** central planning record for person/spouse demographics and modeling defaults.

### `advisor_clients`

- **Key columns:** `advisor_id`, `client_id`, `status`
- **Purpose:** advisor-client link and authorization boundary for advisor workflows.

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

### `strategy_line_items`

- **Key columns:** `household_id`, `source_role`, `strategy_source`, `amount`, `consumer_accepted`, `consumer_rejected`
- **Purpose:** strategy recommendation and acceptance audit layer.

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

- **Key columns:** `advisor_id`, `client_household_id`, `is_active`, assumption fields, `shared_at`, `accepted_by_client`
- **Purpose:** advisor Monte Carlo scenario assumptions.

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
- mixed strategy write APIs (`strategy-line-items`/`strategy-configs` vs advisor recommendation route)

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
| `calculate_gifting_summary` | Gifting summary outputs |
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

---

## Session 41 Note

- No database schema or migration changes were introduced in Session 41.
- Changes in this session are application-layer refactors only (consumer projections and dashboard modularization).

