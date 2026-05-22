# DATABASE_SCHEMA_REFERENCE.md
# MyWealthMaps / Estate Planner — Database Schema Guide
# Last updated: May 17, 2026 (Session 127 — profile gate, trusts UI; no schema change)

**Session history:** [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md) · **Consumer journeys:** [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md)

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
- **Consumer UI:** `/my-advisor` reads accepted connection (`status='accepted'`) joined to `profiles` and `advisor_directory` (via `profile_id`); revoke sets `status='revoked'`.

### `advisor_directory`

- **Key columns:** `id`, `profile_id`, `firm_name`, `contact_name`, `email`, `city`, `state`, `bio`, `credentials`, `specializations`, `is_verified`, `is_active`, `referral_code`, `submitted_by`
- **Purpose:** canonical advisor listing table for find-advisor, registration, connection requests, and referral resolution.
- **Referral:** unique `referral_code` per row; `referral_clicks.listing_id` FK references `advisor_directory(id)`.
- **Application:** `app/(public)/find-advisor`, `my-advisor`, `app/advisor` referral lookup, `POST /api/referral/track`.
- **Migration:** `20260522000000_advisor_referrals.sql` (adds `referral_code`; do not use legacy `advisor_listings`).

### `funnel_events`

- **Key columns:** `id`, `event_name`, `user_id`, `session_id`, `properties`, `referral_code`, `event_slug`, `source_url`, `created_at`
- **Purpose:** custom conversion funnel tracking (complements Vercel Analytics page views).
- **RLS:** users read own rows; service role full access for API inserts.
- **Migration:** `20260523000000_funnel_events.sql`
- **API:** `POST /api/analytics/funnel`

### `referral_clicks`

- **Key columns:** `id`, `referral_code`, `advisor_id`, `listing_id`, `event_slug`, `source_url`, `resolved`, `created_at`
- **Purpose:** log event-page visits with `?ref=`; resolved when code matches `advisor_directory` only (unresolved rows when code is unknown or attorney-only — Sprint 8).
- **RLS:** advisors read own rows (`auth.uid() = advisor_id`); service role full access for API inserts.
- **Migration:** `20260522000000_advisor_referrals.sql`

### `attorney_listings`

- **Key columns:** `id`, `profile_id`, `firm_name`, `contact_name`, `email`, `city`, `state`, `bio`, `is_verified`, `is_active` (no `referral_code` column today)
- **Purpose:** canonical attorney listing for find-attorney, registration, and connection requests — **not** `attorney_directory` (that table does not exist).
- **Consumer UI:** `/my-attorney` pending rows join `attorney_listings` for display.
- **Sprint 8 backlog:** add `referral_code` (unique) for event-page attorney attribution parallel to `advisor_directory`.

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

- **Key columns:** `user_id`, `death_benefit`, `cash_value`, `is_ilit`, `description`, `policy_type`
- **Important:** uses `user_id` (not `owner_id`) — architectural decision #8; ILIT consumer form (`IlitStrategyForm`) queries by `user_id` (`ownerUserId` from `my-estate-trust-strategy/page.tsx`).

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
- **Estate composition (Session 120, Step 4):** `classifyEstateAssets` passes `p_lifetime_gifts_used` (`lifetime_exemption_used` from gifting RPC) into `calculate_estate_composition(p_household_id, p_source_role, p_lifetime_gifts_used)`. Reduces federal `v_exemption` after config null guard; return includes `lifetime_gifts_used`. Distinct from `adjusted_taxable_gifts` (ATG add-back to taxable estate). Migration `20260516140000` — regenerate from `supabase/migrations/reference/live_calculate_estate_composition.sql` via `scripts/build-estate-composition-lifetime-gifts-migration.mjs` if prod diverges again.
- **UI:** `components/GiftingDashboard.tsx` — annual gifts via **Log a Gift**; prior Form 709 lifetime gifts via **Prior taxable gifts** collapsible (`priorTaxableGifts` = `summary.gifts` filtered `gift_type='lifetime'`; controlled open, auto-expand when rows exist; amber border when `form_709_filed=false`). Session 119: trim on submit; prior form badge + Form 709 auto-check.

### `adjusted_taxable_gifts`

- **Key columns:** `household_id`, `gift_year`, `amount`, `recipient_description`, `three_year_clawback`, `notes`
- **Purpose:** post-1976 adjusted taxable gifts (IRC §2001(b)) — **distinct** from `gift_history` lifetime rows used for planning UX and `calculate_gifting_summary`.
- **Last significant change:** Session 121 — removed ATG add-back from `calculate_estate_composition`; table remains for future intake only.
- **Open design:** Unified ATG intake not built. See [MASTER_ARCHITECTURE.md → Open design decisions](./MASTER_ARCHITECTURE.md#open-design-decisions) (ATG vs `gift_history`).

### `strategy_line_items`

- **Key columns:** `id`, `household_id`, `source_role`, `strategy_source`, `amount`, `consumer_accepted`, `consumer_rejected`, `accepted_at`
- **Purpose:** strategy recommendation and acceptance audit layer.
- **Current behavior notes:**
  - advisor recommendations are written via advisor API routes (`source_role='advisor'`)
  - consumer-entered strategies are written via `POST /api/strategy-line-items` with `source_role='consumer'` (optional `scenario_name` for display; e.g. annual gifting on `/my-estate-trust-strategy`, charitable as `strategy_source` `daf` or `charitable` with `scenario_name='base'` from `CharitableStrategyForm` on the DAF panel, SLAT/ILIT as `strategy_source` `slat`/`ilit` from `SlatStrategyForm` / `IlitStrategyForm` via `lib/consumer/consumerStrategyLineItems.ts`); `category` required by DB check — API defaults from `strategy_source` when omitted (`lib/strategy/resolveStrategyLineItemCategory.ts`); SLAT/ILIT use `category: 'trust_exclusion'`; charitable consumer saves use `category: 'charitable'`
  - **Upsert key (active rows):** partial unique index `strategy_line_items_upsert_active_idx` on `(household_id, strategy_source, source_role, COALESCE(projection_year,-1), COALESCE(scenario_name,''))` WHERE `is_active=true` (migration `20260516000001`)
  - **`strategy_source` allowlist** includes `daf`, `charitable`, `ilit`, `liquidity`, `roth`, `slat` (in addition to gifting, trust, etc.; `charitable` added in `20260518120000`, `slat` in `20260516000001`)
  - consumer SLAT/ILIT/charitable rows should use `confidence_level='probable'` (default in `consumerStrategyLineItems.ts`) so they aggregate into `outside_strategy_total` in `calculate_estate_composition` (`certain` + `probable` only; `illustrative` excluded)
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
- **Application behavior note:** general `/assess` shows overall + pillar scores when signed out; full gap report gated behind account. Event assessments at `/event/[slug]/assess` store `_event_slug` and `_type: 'event'` inside `answers` JSONB (pillar score columns duplicated to `overall_score` for event runs).
- **Restore behavior note:** signed-out runs are cached client-side under `mwm_pending_assessment` and inserted after auth return (within 30-minute freshness window), then cache is cleared.

### `life_events`

- **Key columns:** `id`, `user_id`, `event_type`, `event_date`, `acknowledged`, `source`, `created_at`
- **Purpose:** user-logged life changes and age-based calendar triggers for dashboard banner and upgrade copy personalization.
- **`source` values:** `user` (dashboard picker), `calendar_trigger` (daily cron at ages 62/65/70/73).
- **`event_type`:** one of eight slugs from `lib/events/content.ts` (`EVENT_SLUGS`).
- **RLS:** users can read/write only rows where `user_id = auth.uid()`.
- **Migration:** `20260521000000_create_life_events.sql`

### `email_captures`

- **Key columns:** `id`, `email`, `source`, `score`, `captured_at`, `created_at`, `drip_step_1_sent_at`, `drip_step_2_sent_at`, `drip_step_3_sent_at`, `unsubscribed_at`
- **Purpose:** marketing leads from public assessment and event assessment email capture flows; Resend drip sequence tracking.
- **Constraints:** unique `(email, source)` — duplicate inserts ignored by API.
- **RLS:** service role full access; `anon` / `authenticated` may insert via `POST /api/email-capture` (no public read).
- **Drip:** step 1 on capture (`POST /api/email-capture` → `POST /api/email/drip`); steps 2–3 via notifications cron; unsubscribe sets `unsubscribed_at`.
- **Migrations:** `20260520000000_create_email_captures.sql`, `20260524000000_email_captures_drip.sql`

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
  - `app/(public)/find-attorney/page.tsx` — pending listing IDs to disable duplicate connect UI

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

- **Key columns:** `advisor_id`, `client_household_id`, `is_preset`, `is_default`, `is_active`, assumption fields, `shared_at`, `accepted_by_client`, `accepted_at`
- **Purpose:** advisor Monte Carlo scenario assumptions and consumer acceptance state. Presets (`is_preset = true`, `client_household_id` null) are advisor-wide templates; at most one `is_default` preset per advisor (partial unique index `advisor_projection_assumptions_one_default_preset_idx`).
- **Migration:** `20260517185228_add_is_default_to_advisor_projection_assumptions.sql`
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
| `calculate_estate_composition` | Estate asset/tax composition; args `(uuid, text DEFAULT 'consumer', numeric DEFAULT 0)` — third arg `p_lifetime_gifts_used` reduces federal exemption (Session 120) |
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
- `20260520000000_create_email_captures.sql` — `email_captures` table for public marketing lead capture
- `20260521000000_create_life_events.sql` — `life_events` for in-app logging and age triggers
- `20260522000000_advisor_referrals.sql` — `advisor_directory.referral_code`, `referral_clicks`
- `20260523000000_funnel_events.sql` — `funnel_events`
- `20260523000001_app_config_ab_tests.sql` — A/B flags in `app_config`
- `20260524000000_email_captures_drip.sql` — drip + unsubscribe columns on `email_captures`

**`app_config` keys (Sprint 5 A/B):** `ab_upgrade_copy` (`"personalized"` | `"generic"`), `ab_assessment_gate` (`"score_visible"` | `"full_gate"`). Toggle in Supabase SQL editor; no deploy required.

---


## Schema changelog (session notes)

Session-by-session migration and application-layer notes (Sessions 43–127) live in **[SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md)**.

When you change schema or RPCs, update the **table/RPC sections above** in this file and add a short entry to the changelog (schema migrations only need a one-line pointer if details are in the migration file).

