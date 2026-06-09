# DATABASE_SCHEMA_REFERENCE.md
# MyWealthMaps / Estate Planner — Database Schema Guide
# Last updated: May 26, 2026 (UX-2 — advisor_gap_statuses table for gap workflow tracking)

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
| Estate composition | `calculate_estate_composition` RPC + `estate_composition_cache` (post-launch read path) | Derived values; cache populated at recompute |
| Estate tax rules | `federal_tax_config`, `state_estate_tax_rules` | Estate transfer tax calculations |
| Income tax rules | `state_income_tax_brackets` | Progressive state income rules (canonical target) |
| Alerts/health | `estate_health_scores`, `household_alerts`, `beneficiary_conflicts`, `assessment_results`, `advisor_gap_statuses`, `estate_checklist_items` | Cached analytics + user assessment history; `advisor_gap_statuses` tracks advisor-private gap workflow state; `estate_checklist_items` = persisted consumer execution checklist (Sprint 2) |
| Domicile | `domicile_analysis`, `domicile_schedule`, `domicile_checklist_items` | Residency and move planning |
| Strategy tracking | `strategy_line_items`, `strategy_configs` | Recommendation and modeled strategy data |
| Gifting activity | `gift_history` | Annual/lifetime/529/medical/tuition gifts; feeds `calculate_gifting_summary` |
| Post-1976 ATG | `adjusted_taxable_gifts` | IRC §2001(b) add-back; gifting tab intake + composition RPC sum |
| Monte Carlo assumptions | `advisor_projection_assumptions`, `projection_assumption_audit` | Advisor override + consumer accept/revert workflow |

---

## Key Tables

### `profiles`

- **Key columns:** `id`, `role`, `consumer_tier`, `subscription_status`, `referral_code`, `attorney_referral_code`, `onboarding_invite_advisor_completed_at`, `onboarding_wizard_completed_at`, `full_name`, `email`, `firm_name`, `phone`, `firm_logo_url`
- **Purpose:** user identity attributes and subscription/role flags.
- **Export branding (2026-06-05):** PDF cover + meeting brief read `full_name`, `email`, `firm_name`, `phone`, `firm_logo_url` via `fetchAdvisorProfile()` → `resolveAdvisorBranding()`. Cover renders logo when `firm_logo_url` is http(s) (2026-06-06). Migration `20260605100000_profiles_branding_columns.sql` applied on prod. Advisors edit `full_name`, `firm_name`, `phone` at **`/advisor/settings`** (`PATCH /api/advisor/profile`); logo upload via **`POST/DELETE /api/advisor/profile/logo`** + bucket **`advisor-branding`** (2026-06-07).
- **Referral attribution (Sprint 9):** set once at signup from event-page sessionStorage; join `referral_code` → `advisor_directory.referral_code`, `attorney_referral_code` → `attorney_listings.referral_code`.
- **Invite-advisor gate (Sprint 10):** `onboarding_invite_advisor_completed_at` — set when consumer completes or skips `/onboarding/invite-advisor` (same timestamp for both; no separate skipped flag).
- **Onboarding wizard (Sprint OB-1):** `onboarding_wizard_completed_at` — set when consumer finishes `/onboarding/wizard` (also sets invite-advisor timestamp via `POST /api/consumer/onboarding-wizard-complete`).
- **Signup trigger:** `on_auth_user_created` → `handle_new_user()` inserts a `profiles` row (`role` from metadata; consumer defaults: `consumer_tier=1`, `subscription_status=none`). Estate trial (`trialing`) is set only by Stripe webhook after checkout.
- **Attorney weekly digest (2026-06-07):** `attorney_digest_sent_at` — last weekly digest send; cron §10 cooldown (6 days). Migration `20260703120000`.

### `households`

- **Key columns:** `id`, `owner_id`, `filing_status`, `state_primary`, `base_case_scenario_id`, `growth_rate_accumulation`, `growth_rate_retirement`, `growth_assumptions`, `person1_first_name`, `person2_first_name`, `gross_estate_estimate`, `has_minor_children`, `has_business_interests`, `succession_plan_in_place`, `succession_key_person_identified`, `succession_buy_sell_in_place`
- **Purpose:** central planning record for person/spouse demographics and modeling defaults.
- **`growth_assumptions` (jsonb):** per-asset-class rates. Keys: `real_estate` (default 4.5), `business` (default 7.0). Financial growth uses `growth_rate_accumulation` / `growth_rate_retirement`. Migration: `20260527130000_household_growth_assumptions.sql`. Post-deploy staleness: `20260527130400_bump_staleness_after_growth_assumptions.sql` bumps `updated_at` when `base_case_scenario_id` is set.

#### `households` — field ownership (post PROF-1/2)

**Edited via Profile:** name fields, birth years, retirement ages, longevity ages, SS claiming ages, PIA amounts, `state_primary`, `filing_status`, `tax_deduction_method`, `custom_deduction_amount`, onboarding metadata (`gross_estate_estimate`, `has_minor_children`, `has_business_interests`). UI: `app/(dashboard)/profile/_profile-client.tsx` — Household / People (two-column when `hasSpouse`) / Household Planning; see [CONSUMER_FLOWS.md § Profile](./CONSUMER_FLOWS.md#profile--profile).

**Edited via Scenarios:** `growth_rate_accumulation`, `growth_rate_retirement`, `growth_assumptions` (jsonb), `inflation_rate` (`PATCH /api/consumer/growth-assumptions`).

**Edited via Asset Allocation:** `risk_tolerance`, `target_stocks_pct`, `target_bonds_pct`, `target_cash_pct` (`PATCH /api/consumer/allocation-targets`).

#### Household-scoped RLS (pre-launch `20260527150000`)

These tables had permissive `auth.uid() IS NOT NULL` policies; migration replaces with owner + advisor scope:

| Table | Consumer scope | Advisor scope | App notes |
|-------|----------------|---------------|-----------|
| `gst_ledger` | `households.owner_id = auth.uid()` | `advisor_clients` → `households.owner_id` (`active`, `accepted_at` set) | Advisor writes: `POST /api/advisor/gst-entry` only |
| `liquidity_analysis` | same | same | — |
| `monte_carlo_results` | SELECT own household | SELECT connected clients | Writes: `estate-monte-carlo` edge (service role) |
| `domicile_schedule` | ALL own household | SELECT connected clients | — |
| `domicile_analysis` | `user_id = auth.uid()` (unchanged) | SELECT via advisor join (fixed) | — |
| `strategy_configs` | SELECT own household (unchanged) | ALL via advisor join; loose OR policies dropped | — |

**Verify:** `scripts/verify-loose-rls-policies.sql` (expect zero rows after migration).

- **Succession intake (Sprint 10):** minimal business succession booleans; `PATCH /api/consumer/succession-intake`.

### `advisor_clients`

- **Key columns:** `advisor_id`, `client_id`, `status`, `accepted_at`, `advisor_pdf_access`, `connection_life_event_type`, `connection_life_event_at`
- **Purpose:** advisor-client link and authorization boundary for advisor workflows.
- **Connected statuses:** use `CONNECTED_ADVISOR_CLIENT_STATUSES` (`active`, `accepted`) from `lib/advisor/clientConnectionStatus.ts` in all new queries — not a single hardcoded status.
- **Consumer UI:** `/my-advisor` reads connected link (`.in('status', ['active', 'accepted'])`); revoke sets `status='revoked'`.
- **Life event at accept (Sprint 9):** `connection_life_event_*` populated in `accept-request` via `pickConnectionLifeEvent()`.

### `advisor_gap_statuses`

- **Key columns:** `id`, `advisor_id`, `client_id`, `gap_key`, `status`, `note`, `updated_at`
- **Purpose:** Advisor-private workflow state for each planning gap. Tracks whether a gap has been discussed, deferred, or resolved in client meetings. Not visible to the consumer.
- **Status values:** `open` | `discussed` | `deferred` | `resolved`
- **Uniqueness:** `(advisor_id, client_id, gap_key)` — one status per advisor per gap per client.
- **RLS:** Advisors can read and write only their own rows (`advisor_id = auth.uid()`).
- **API:** `GET /api/advisor/gap-status?clientId=…` · `PATCH /api/advisor/gap-status` (upsert)
- **Migration:** `20260626120000_advisor_gap_statuses.sql`
- **gap_key source:** Stable gap identifiers from `computeGaps()` in `app/advisor/clients/[clientId]/_utils.ts` (UX-2).

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

- **Key columns:** `id`, `referral_code`, `listing_type` (`advisor` | `attorney`), `advisor_id`, `listing_id` (→ `advisor_directory`), `attorney_listing_id` (→ `attorney_listings`), `attorney_profile_id` (→ `auth.users`), `event_slug`, `source_url`, `resolved`, `created_at`
- **Purpose:** log event-page visits — advisor `?ref=` or attorney `?aref=`
- **RLS:** advisors read `auth.uid() = advisor_id`; attorneys read `auth.uid() = attorney_profile_id`; service role full access for API inserts
- **Migrations:** `20260522000000_advisor_referrals.sql`, `20260528000000_attorney_referrals.sql`

### `attorney_listings`

- **Key columns:** `id`, `profile_id`, `firm_name`, `contact_name`, `email`, `phone`, `website`, `city`, `state`, `bar_number`, `bio`, `fee_structure`, `specializations`, `states_licensed`, `languages`, `serves_remote`, `credentials`, `is_verified`, `is_active`, `submitted_by`, `requested_by`, `referral_code`, `created_at`
- **Legacy:** `attorney_id` column exists but is unused (always null) — use `id` as PK; `attorney_clients.attorney_id` references `attorney_listings.id`
- **Purpose:** canonical attorney listing for find-attorney, registration, and connection requests — **not** `attorney_directory`
- **Referral:** unique `referral_code`; event links use `?aref=`; resolved in `referral_clicks.attorney_listing_id`
- **Migration:** `20260528000000_attorney_referrals.sql`
- **Application:** `/attorney` portal — nav, requests inbox, firm settings **`PATCH /api/attorney/listing`**; newsletter kit; `POST /api/referral/track` with `type: 'attorney'`

### `attorney_clients`

- **Key columns:** `attorney_id` (→ `attorney_listings.id`), `client_id` (→ `households.id`), `status`, `granted_at`, `advisor_pdf_access`, `request_message`, **`matter_stage`**, **`client_status`**
- **Purpose:** attorney access to household estate plan; **`matter_stage`** / **`client_status`** are firm workflow (do not mutate consumer data).
- **FK migration:** `20260630100000_attorney_clients_fk_listing_household.sql` — aligns prod legacy FKs; adds `households_attorney_select` RLS.
- **Collaboration migration:** `20260702120000` — workflow columns + **`attorney_notes`** + **`attorney_document_requests`**.
- **Consumer UI:** `/my-attorney` and `/settings/attorney-access` read active/accepted rows; pending doc requests on `/my-attorney`; revoke via `/api/attorney/revoke-access`.

### `attorney_notes`

- **Key columns:** `attorney_listing_id`, `household_id`, `content`, `note_type` (`internal` | `meeting` | `follow_up`)
- **Purpose:** firm-private notes — **not** visible to consumer.
- **API:** `GET/POST/DELETE /api/attorney/notes`

### `attorney_document_requests`

- **Key columns:** `attorney_listing_id`, `household_id`, `document_type`, `message`, `status` (`pending` | `fulfilled` | `cancelled`), `requested_by`, `fulfilled_document_id`
- **Purpose:** attorney requests a document from consumer; consumer notified in-app; consumer owns upload path (vault).
- **API:** `GET/POST/PATCH /api/attorney/document-requests`

### `firms`

- **Key columns:** `id`, `name`, `owner_id`, `tier`, `seat_count`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`
- **Purpose:** advisor firm billing and seat management; denormalized `profiles.firm_id` / `firm_role`.
- **Migration:** `20260404000000_create_firms_and_firm_members.sql`
- **Deletion:** references `auth.users(id)` via `owner_id` — cleared by `lib/compliance/deleteUser.ts` FK scan before Auth delete (cascades `firm_members` for owned firms).

### `firm_members`

- **Key columns:** `id`, `firm_id`, `user_id`, `firm_role`, `invited_by`, `invited_email`, `invite_token`, `status`, `joined_at`
- **Purpose:** firm membership and pending invites; advisor firm checkout and invite flows.
- **Migration:** `20260404000000_create_firms_and_firm_members.sql`, `20260404120000_firm_member_pending_invites.sql`
- **Deletion:** references `auth.users(id)` via `user_id` and `invited_by` — both columns cleared by `deleteUser.ts` FK scan.

### `change_log`

- **Purpose:** field-level audit trail for data changes (service-role writes only).
- **Key columns:** includes `changed_by` referencing `auth.users(id)`
- **RLS:** service role only — no authenticated read (`20260602000000_sprint_c3_rls_fixes.sql`)
- **Deletion:** `changed_by` cleared by `deleteUser.ts` FK scan before Auth delete.

### `privacy_requests` (Sprint C-7)

- **Purpose:** WCPA consumer rights intake (deletion, access, correction, portability, opt_out); 45-day SLA.
- **Key columns:** `user_id` (nullable), `email`, `request_type`, `status`, `received_at`, `due_at` (DEFAULT `now() + 45 days`), `completed_at`, `notes`
- **RLS:** authenticated INSERT/SELECT own rows; service role full access
- **Migration:** `20260625170000_sprint_c7_privacy_requests.sql`

### `deletion_audit_log` (Sprint C-6)

- **Purpose:** immutable append-only record of every user data deletion (WCPA compliance).
- **Key columns:** `user_id`, `email`, `reason` (`user_request` \| `subscription_cancelled` \| `admin_initiated` \| `account_closed`), `initiated_by`, `dry_run`, `tables_cleared`, `rows_deleted`, `auth_deleted`, `success`, `error_message`, `completed_at`
- **RLS:** service role only — no consumer access
- **Migration:** `20260625120000_sprint_c6_deletion_compliance.sql`
- **Note:** never UPDATE or DELETE rows from this table
- **Verification:** after real deletions, run `npm run verify:deletion -- --email user@example.com` — must PASS before responding to the user ([COMPLIANCE_CALENDAR.md](./COMPLIANCE_CALENDAR.md))

### `deletion_schedule` (Sprint C-6; retry Admin-A)

- **Purpose:** queue of future automated deletions (30 days post-cancellation by default).
- **Key columns:** `user_id`, `email`, `reason`, `scheduled_for`, `stripe_customer_id`, `scheduled_by`, `status` (`pending` \| `executed` \| `cancelled`), `executed_at`, `cancelled_at`, `cancel_reason`, `retry_count`, `next_retry_at`, `last_error` (Admin-A)
- **RLS:** service role only
- **Cron:** `GET /api/cron/process-deletions` selects `pending` where `scheduled_for <= now()` and (`next_retry_at` is null or `<= now()`); backoff 1h / 4h / 24h / 72h on failure; email after 3 retries
- **Webhook:** inserts on consumer churn; skips plan-change / role-upgrade cases

### `ops_tasks` (Admin-A)

- **Purpose:** calendar compliance obligations (weekly UX audit, monthly security audit, quarterly B&O, annual DPA review, Gate 3 one-time tasks).
- **Key columns:** `slug` (unique), `title`, `description`, `cadence` (`daily` \| `weekly` \| `monthly` \| `quarterly` \| `annual` \| `once`), `next_due_at`, `last_completed_at`, `last_completed_by`, `completion_method`, `completion_notes`, `status`, `auto_complete`, `script_command`, `category`
- **RLS:** service role only (admin UI via `createAdminClient()`)
- **API:** `GET/PATCH/POST /api/admin/ops-tasks` — PATCH advances `next_due_at` by cadence on complete
- **Cron:** `compliance-reminders` emails on due/overdue tasks

### `cron_health` (Admin-A)

- **Purpose:** last-run tracking for Vercel cron jobs (Ops Home status grid).
- **Key columns:** `job_name` (PK), `last_run_at`, `last_status` (`ok` \| `warning` \| `error` \| `unknown`), `last_message`, `consecutive_failures`
- **RLS:** service role only
- **Writer:** `lib/cron/recordCronHealth.ts` at end of each cron handler

### `ingestion_jobs` (Sprint F-1)

- **Purpose:** transient store for file-import parse results between upload and commit.
- **Key columns (16):** `id`, `owner_id`, `household_id`, `status` (`pending` \| `mapped` \| `committed` \| `failed`), `file_type` (`csv` \| `xlsx`, NOT NULL), `file_name` (NOT NULL), `detected_table`, `headers` (jsonb), `rows` (jsonb), `field_map` (jsonb), `row_count`, `error_message`, `created_at`, `committed_at`, `header_row_index` (integer, Sprint F-2), `sheet_name` (text, Sprint F-2, Excel only)
- **RLS:** owner-scoped ALL policy (`owner_id = auth.uid()`)
- **Migration:** `20260602140000_sprint_f1_ingestion_jobs.sql` — verified in production
- **Note:** rows older than 24h safe to purge manually; no automated cleanup yet

### `assets`, `liabilities`, `income`, `expenses`

- **Purpose:** core projection input tables.
- **Notes:** timestamp changes in these tables are used for staleness detection.
- **`income.annual_growth_rate`:** optional per-source compound growth from `start_year` (default 0). Migration: `20260527130300_income_growth_rate.sql`.
- **Sprint F-2:** optional `ingestion_job_id` uuid → `ingestion_jobs(id)` on rows created via `/import` commit (NULL for manual entry).

### `real_estate`

- **Key columns:** `owner_id`, `current_value`, `mortgage_balance`, `monthly_payment`, `planned_sale_year`, `situs_state`, `titling`
- **Purpose:** property FMV and mortgage dynamics in projection and estate views; `situs_state` = physical location (multi-state probate alert on dashboard).

### `businesses`

- **Purpose:** authoritative business valuation source.
- **Note:** `business_interests` remains present for legacy compatibility in some paths.

### `insurance_policies`

- **Key columns:** `user_id`, `death_benefit`, `cash_value`, `cash_value_growth_rate`, `is_ilit`, `description`, `policy_type`
- **`cash_value_growth_rate`:** annual cash value compounding in projections (default 0). Migration: `20260527130200_insurance_cash_value_growth.sql`.
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
- **Consumer writes:** `GET` / `POST` / `PATCH` / `DELETE` `/api/consumer/adjusted-taxable-gifts` — same auth pattern as gift-history; `afterHouseholdWrite` + revalidate strategy/estate paths.
- **UI:** `components/gifting/AdjustedTaxableGiftsSection.tsx` on gifting tab (distinct from Form 709 prior gifts in `GiftingDashboard`).
- **Composition:** migration `20260701120000` restores ATG sum in `calculate_estate_composition`; `EstateCompositionCard` shows `adjusted_taxable_gifts` when &gt; 0.

### `strategy_line_items`

- **Key columns:** `id`, `household_id`, `source_role`, `strategy_source`, `amount`, `consumer_accepted`, `consumer_rejected`, `accepted_at`
- **Purpose:** strategy recommendation and acceptance audit layer.
- **Current behavior notes:**
  - advisor recommendations are written via advisor API routes (`source_role='advisor'`)
  - consumer-entered strategies are written via `POST /api/strategy-line-items` with `source_role='consumer'` (optional `scenario_name` for display; e.g. annual gifting on `/my-estate-trust-strategy`, charitable as `strategy_source` `daf` or `charitable` with `scenario_name='base'` from `CharitableStrategyForm` on the DAF panel, SLAT/ILIT as `strategy_source` `slat`/`ilit` from `SlatStrategyForm` / `IlitStrategyForm` via `lib/consumer/consumerStrategyLineItems.ts`); `category` required by DB check — API defaults from `strategy_source` when omitted (`lib/strategy/resolveStrategyLineItemCategory.ts`); SLAT/ILIT use `category: 'trust_exclusion'`; charitable consumer saves use `category: 'charitable'`
  - **Upsert key (active rows):** partial unique index `strategy_line_items_upsert_active_idx` on `(household_id, strategy_source, source_role, COALESCE(projection_year,-1), COALESCE(scenario_name,''))` WHERE `is_active=true` (migration `20260516000001`)
  - **`strategy_source` allowlist** includes `daf`, `charitable`, `ilit`, `liquidity`, `roth`, `slat` (in addition to gifting, trust, etc.; `charitable` added in `20260518120000`, `slat` in `20260516000001`)
  - **`confidence_level`:** `illustrative` (sandbox — excluded from `outside_strategy_total`), `probable` (in plan), `certain` (completed). Consumer modeled saves (SLAT, ILIT, charitable, GRAT/CRT/CLAT/Roth/Liquidity chips) default to **`illustrative`** via `lib/consumer/consumerStrategyLineItems.ts`; consumer promotes own row with `PATCH /api/strategy-line-items` `{ id, promoteConfidence: true }` (`illustrative` → `probable`). Annual gifting and explicit **Save to my plan →** paths may write `probable` directly. `calculate_estate_composition` sums only `certain` + `probable` for outside reduction; `illustrative` excluded
  - consumer dashboard reads active advisor rows for `StrategyRecommendationPanel` (accept/decline via `/api/consumer/strategy-recommendation`)
  - consumer removal uses `DELETE /api/strategy-line-items` by `id` (preferred) or legacy household + `strategy_source` + `source_role` (+ optional `scenarioName`); sets `is_active=false`, row retained for audit
  - **Reversal columns (2026-05-31):** `consumer_withdrawn`, `withdrawn_at`, `reversal_reason`, `reversed_from`, `previously_active_at` — consumer-owned audit trail; `PATCH` actions `return_to_sandbox`, `withdraw`, `demote`, `promote` on `/api/strategy-line-items`
  - **Cache (2026-05-27):** successful `POST` / `PATCH` / `DELETE` on `/api/strategy-line-items` call `afterHouseholdWrite` then `revalidatePath` for `/my-estate-trust-strategy`, `/my-estate-strategy`, `/dashboard`, `/estate-tax` (same pattern as gift-history)
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

- **Key columns:** `id`, `email`, `source`, `score`, `captured_at`, `created_at`, `drip_step_1_sent_at`, `drip_step_2_sent_at`, `drip_step_3_sent_at`, `unsubscribed_at`, `invited_at`, `invite_label`
- **Purpose:** marketing leads from public assessment and event assessment email capture flows; Resend drip sequence tracking; waitlist invite tracking (Admin P1).
- **Constraints:** unique `(email, source)` — duplicate inserts ignored by API.
- **RLS:** service role full access; `anon` / `authenticated` may insert via `POST /api/email-capture` (no public read).
- **Drip:** step 1 on capture (`POST /api/email-capture` → `POST /api/email/drip`); steps 2–3 via notifications cron; unsubscribe sets `unsubscribed_at`.
- **Admin waitlist:** `/admin` → Waitlist tab — `GET /api/admin/waitlist` (converted = `profiles` row with same email); `POST …/invite`, `…/bulk-invite` sets `invited_at` + `invite_label`.
- **Migrations:** `20260520000000_create_email_captures.sql`, `20260524000000_email_captures_drip.sql`, `20260709140000_email_captures_invite_tracking.sql`

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

- **Key columns:** `state`, `tax_year`, `min_amount`, `max_amount`, `rate_pct`, `exemption_amount`, **`no_portability`** (2026-06-30 — WA/MA/OR true)
- **Purpose:** progressive state estate transfer tax brackets.

### `state_income_tax_brackets`

- **Key columns:** `state`, `tax_year`, `filing_status`, `min_amount`, `max_amount`, `rate_pct`
- **Purpose:** progressive state income tax brackets.
- **Status:** canonical source (all engines; `state_income_tax_rates` dropped pre-go-live).

### `state_inheritance_tax_rules`

- **Key columns:** `state`, `tax_year`, `beneficiary_class`, `min_amount`, `max_amount`, `rate_pct`, `exemption_amount`
- **Purpose:** state inheritance tax by beneficiary class (spouse, child, sibling, other).
- **Coverage:** 6 states — IA, KY, MD, NE, NJ, PA (`MODELED_INHERITANCE_TAX_STATES`). Iowa repealed 2025+ (0% rows).
- **Migration:** `20260708130000_seed_state_inheritance_tax_rules_2026.sql` (24 rows for tax year 2026).

### `advisor_projection_assumptions`

- **Key columns:** `advisor_id`, `client_household_id`, `is_preset`, `is_default`, `is_active`, assumption fields, `real_estate_growth_pct`, `business_growth_pct`, `shared_at`, `accepted_by_client`, `accepted_at`
- **Purpose:** advisor Monte Carlo scenario assumptions and consumer acceptance state. Presets (`is_preset = true`, `client_household_id` null) are advisor-wide templates; at most one `is_default` preset per advisor (partial unique index `advisor_projection_assumptions_one_default_preset_idx`).
- **Growth overrides:** `real_estate_growth_pct` / `business_growth_pct` null = use household `growth_assumptions`. Migration: `20260527130100_advisor_growth_assumption_overrides.sql`.
- **Migration:** `20260517185228_add_is_default_to_advisor_projection_assumptions.sql`
- **Acceptance behavior:** consumer accept/revert toggles `accepted_by_client`/`accepted_at` on household-linked rows; latest accepted row is consumer-effective state.
- **Consumer UI (Session 98):** `/dashboard` and `/my-estate-strategy` server pages fetch rows where `accepted_by_client=true` or `shared_at` is set; `MonteCarloScenarioBanner` calls `/api/monte-carlo/advisor-assumptions` for accept/revert with `router.refresh()`.

### `projection_assumption_audit`

- **Purpose:** field-level change audit for assumption edits.

### `estate_health_scores`

- **Key columns:** `household_id`, `score`, `component_scores`, `computed_at`, `recommendations` (jsonb — cached `generate_estate_recommendations` output; Sprint P-2)
- **Purpose:** cached health score summary + recommendations (read path should avoid recomputing synchronously).

### `estate_checklist_items`

- **Key columns:** `household_id`, `task_key`, `completed`, `completed_at`, `notes`
- **task_key allowlist:** `will_on_file`, `dpoa_on_file`, `healthcare_directive`, `trust_funded`, `beneficiaries_updated`, `titling_reviewed`, `guardian_named`, `annual_gifts_logged`
- **RLS:** consumer own household; advisor read connected clients (`advisor_clients` active + `accepted_at` not null)
- **API:** `GET` + `PATCH` `/api/consumer/estate-checklist`
- **Purpose:** consumer-toggled execution checklist items; merged on dashboard with auto-detected status from `estate_documents`, `trusts`, `estate_health_check`, and `beneficiary_conflicts` via `buildEstateExecutionChecklist()` — no new RPCs
- **Added:** Sprint 2 (execution checklist)
- **Migration:** `20260528120000_estate_checklist_items.sql`

### `estate_composition_cache`

- **Key columns:** `household_id`, `source_role` (`consumer` \| `advisor`), `composition` (jsonb — full `calculate_estate_composition` payload), `lifetime_gifts_used`, `computed_at`
- **Unique:** `(household_id, source_role)`
- **Purpose:** materialized estate composition at recompute time; read via `getCachedComposition` (cache miss falls back to live RPC)
- **Writes:** service role only — `/api/recompute-estate-health` upserts after household writes
- **RLS:** household owner SELECT; advisor SELECT via active `advisor_clients` link
- **Migration:** `20260527180000_estate_composition_cache.sql`

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
- `state_inheritance_tax_rules` for state inheritance tax (6 modeled states)

### Legacy/transition

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

**Total in repo:** **77** timestamped SQL files — `supabase/migrations/[0-9]*.sql` (excludes `VERIFY_session27_migrations.sql` and `reference/`). Count with: `ls -1 supabase/migrations/[0-9]*.sql | wc -l`

- `20260427190300_create_state_income_tax_brackets_2026.sql`
- `20260428000001_create_advisor_projection_assumptions.sql`
- `20260428000002_strategy_line_items_acceptance_fields.sql`
- `20260430000000_create_assessment_results.sql`
- `20260430100000_seed_federal_tax_brackets_2026.sql`
- `20260514100000_connection_requests_status_accepted_cancelled.sql` — extends `connection_requests_status_check` to allow `accepted` and `cancelled` (required for claim-listing accept + consumer cancel API)
- `20260520000000_create_email_captures.sql` — `email_captures` table for public marketing lead capture
- `20260521000000_create_life_events.sql` — `life_events` for in-app logging and age triggers
- `20260522000000_advisor_referrals.sql` — `advisor_directory.referral_code`, `referral_clicks`
- `20260528000000_attorney_referrals.sql` — `attorney_listings.referral_code`, attorney columns on `referral_clicks`
- `20260529120000_sprint_import_attorney.sql` — `legal_documents.doc_status`; `document_gap_dismissals`; `profiles.attorney_tier`
- `20260529130000_attorney_drip_columns.sql` — `profiles.attorney_drip_step_1_sent_at` … `_3_sent_at`
- `20260526000000_onboarding_wizard_fields.sql` — `households.person1_first_name`, `person2_first_name`, `gross_estate_estimate`, `has_minor_children`, `has_business_interests`; `profiles.onboarding_wizard_completed_at`
- `20260526000001_handle_new_user_trigger.sql` — `handle_new_user()` + `on_auth_user_created` on `auth.users` (inserts `profiles` with `trial_started_at`; supersedes older trigger migrations that used `trial_ends_at`)
- `20260530000000_sprint9_10_gates.sql` — `profiles.onboarding_invite_advisor_completed_at`; `advisor_clients.connection_life_event_*`; `households.succession_*`
- `20260531000000_remove_ab_test_app_config.sql` — removes pre-launch A/B rows from `app_config` (Sprint 12)
- `20260523000000_funnel_events.sql` — `funnel_events`
- `20260523000001_app_config_ab_tests.sql` — A/B flags in `app_config`
- `20260524000000_email_captures_drip.sql` — drip + unsubscribe columns on `email_captures`
- `20260602000000_sprint_c3_rls_fixes.sql` — Sprint C-3 RLS policy fixes (`236890c`); advisor joins `active` + `accepted`
- `20260602120000_sprint_p1_indexes.sql` — Sprint P-1 — `idx_assets_owner_id`, `idx_liabilities_owner_id` (`5c24160`)
- `20260602130000_sprint_p2_recommendations_cache.sql` — Sprint P-2 — `estate_health_scores.recommendations` jsonb (`47a38f3`)
- `20260527180000_estate_composition_cache.sql` — Post-launch perf — materialized composition at recompute; `getCachedComposition` read path
- `20260625170000_sprint_c7_privacy_requests.sql` — Sprint C-7 — `privacy_requests` WCPA intake ✅ prod
- `20260625120000_sprint_c6_deletion_compliance.sql` — Sprint C-6 — `deletion_audit_log`, `deletion_schedule` ✅ prod (`4d9571e`, `01b997a`)
- `20260602150000_sprint_f2_import_traceability.sql` — Sprint F-2 — `ingestion_job_id` on financial tables; `header_row_index`, `sheet_name` on `ingestion_jobs`
- `20260602140000_sprint_f1_ingestion_jobs.sql` — Sprint F-1 — `ingestion_jobs` 14-column schema + RLS (verified prod)
- `20260701120000_restore_atg_in_calculate_estate_composition.sql` — ATG add-back in `calculate_estate_composition` RPC
- `20260702120000_attorney_collaboration_workflow.sql` — `attorney_clients` workflow columns; `attorney_notes`; `attorney_document_requests`
- `20260703120000_attorney_digest_sent_at.sql` — `profiles.attorney_digest_sent_at` (weekly digest cooldown for cron §10)
- `20260708120000_cleanup_legacy_tax_tables.sql` — purge tax years 2023–2025 from rollover tables; drop `state_income_tax_rates`; backfill `federal_estate_tax_brackets.tax_year`
- `20260708130000_seed_state_inheritance_tax_rules_2026.sql` — 24 inheritance rows for 2026 (6 states × 4 beneficiary classes)
- `20260610120000_admin_ops_tasks.sql` — `ops_tasks`, `cron_health` (Admin-A)
- `20260610130000_deletion_retry_policy.sql` — `deletion_schedule` retry columns (Admin-A)
- `20260709140000_email_captures_invite_tracking.sql` — `email_captures.invited_at`, `invite_label` (Admin P1)

**`app_config`:** Terms and other feature keys. Pre-launch A/B rows `ab_upgrade_copy` / `ab_assessment_gate` removed in `20260531000000_remove_ab_test_app_config.sql` (Sprint 12 — personalized upgrade copy and score-visible assess shipped in code).

---


## Schema changelog (session notes)

Session-by-session migration and application-layer notes (Sessions 43–130) live in **[SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md)**.

When you change schema or RPCs, update the **table/RPC sections above** in this file and add a short entry to the changelog (schema migrations only need a one-line pointer if details are in the migration file).

