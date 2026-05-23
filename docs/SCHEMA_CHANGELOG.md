# Schema changelog (session notes)

Historical session-by-session audit trail moved from `DATABASE_SCHEMA_REFERENCE.md` so the schema reference stays focused on **current authoritative state**.

For live table/RPC definitions, use [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md).

**Session coverage:** Entries from Session 94 onward are the primary audit trail for this file. Sessions 43–93 (and selected lower numbers) are carried over from the original schema reference where they had schema impact. Sessions 1–50, gaps between carried-over blocks (e.g. 63–74, 77–78, 80–87, 89–90), and sessions without schema impact before 94 are not recorded here — that reflects history, not missing files.

---

## Sprint 14 — consumer-core-recompute E2E (May 2026)

**No schema change.**

- **Tests:** `tests/e2e/consumer/consumer-core-recompute.spec.ts` — smoke §2.4 (asset POST → `computed_at` poll 15s → dashboard).
- **Helper:** `tests/e2e/helpers/estate-health-poll.ts` — shared poll; `consumer-gift-history` imports (25s / 1.5s unchanged).
- **Docs:** `E2E_RELEASE_TEST_PLAN.md`; staging verified (~15.5s core-recompute, ~9.7s gift recompute).

## Sprint 13 closed — staging verified (May 2026)

- **Migrations:** 67 applied (local + remote in sync).
- **E2E:** 51 passed, 0 failed, 1 skipped on staging URL.
- **Smoke:** CONSUMER_RELEASE_SMOKE_TEST acquisition & attribution A–G passed.
- **Blockers fixed:** `rmd-start-age` public copy (72–75 range); `20260601000000` advisor `referral_code` trigger.
- **Ops:** `INTERNAL_API_KEY` on Vercel Production; test seed scripts committed.

## Advisor directory referral_code trigger (June 2026)

- **Migration:** `20260601000000_advisor_directory_referral_code_trigger.sql`
  - `public.generate_advisor_referral_code()` — before insert on `advisor_directory`; 8-char code from `gen_random_uuid()` when `referral_code` is null.

## `rmd-start-age` public copy — SECURE Act range (May 2026)

**No schema change.**

- **Content:** `lib/events/content-sprint5.ts` — hero, subhead, `whatChanges`, actions, assessment questions use ages **72–75** by birth year (not fixed 73).
- **Drip:** `lib/emails/drip-templates.ts` — `rmd-start-age` email 1–2 headlines/body aligned.
- **Newsletter labels:** advisor + attorney dashboards — `RMD start age (72–75, by birth year)`.
- **SEO:** `title` / `seoDescription` may still reference 73 for search intent.

## Sprint 13 — Test seed scripts, smoke test extension, prod env matrix (May 2026)

**No schema change** (except advisor trigger migration above).

- **Scripts:** `seed-test-attorney.ts`, `seed-test-advisor.ts`, `seed-test-consumer-estate.ts`.
- **Docs:** CONSUMER_RELEASE_SMOKE_TEST acquisition A–G; LAUNCH_CHECKLIST Production env matrix; NEXT_SESSION test account refs.

## Sprint 12 — A/B collapse, persona alerts, planning empty CTAs, copy audit (May 2026)

**Copy (no migration):** In-app copy audit across dashboard, `(public)/`, landing (`app/page.tsx`), share estate-flow. See DECISION_LOG.

- **Migration:** `20260531000000_remove_ab_test_app_config.sql` — deletes `ab_upgrade_copy`, `ab_assessment_gate` from `app_config`.
- **Removed:** `lib/analytics/abTests.ts`; assess/upgrade A/B branching.
- **Shipped:** personalized `EVENT_UPGRADE_COPY` only; assess `score_visible` behavior only.
- **Verify:** `scripts/verify-event-upgrade-copy.ts` — 24 slugs × tier 2/3 strings.
- **Loader:** `loadDashboardCoreInputs` — `real_estate` select adds `situs_state` (same parallel fetch).
- **Application:** `lib/dashboard/personaAlerts.ts` — business $5M/$10M + multi-state RE (≥2 distinct `situs_state`).
- **Application:** `lib/planning/planningEmptyState.ts` — `TIER2` vs `TIER3` empty-state CTAs.

## RMD start age — SECURE Act cohort fix (May 2026)

- **No schema change.**
- **Engine:** `lib/calculations/rmdStartAge.ts` — `getRmdStartAge(birthYear)` (72 / 73 / 75 by cohort).
- **Bug fix:** `app/advisor/clients/[clientId]/_tabs/RetirementTab.tsx` — was hardcoded `rmdAge = 73`; now per-person birth year (e.g. born 1960 → start at **75**).
- **Aligned:** `projection-complete.ts`, `lib/calculations/rmd.ts`, `lib/dashboard/calculations.ts`, `lib/monte-carlo.ts`, `app/(dashboard)/rmd/_rmd-client.tsx`, `app/(dashboard)/roth/page.tsx`, `app/(dashboard)/my-estate-trust-strategy/page.tsx`, `app/admin/debug-tab.tsx`.
- **Tests:** `scripts/test-engines.ts` — cohort assertions for 1949–1970 birth years.

## Sprint 9–10 — gates migration, succession, invite-advisor, connection context (May 2026)

- **Migration:** `20260530000000_sprint9_10_gates.sql`
  - `profiles.onboarding_invite_advisor_completed_at` — invite-advisor layout gate (NULL = active; skip and complete both set timestamp)
  - `advisor_clients.connection_life_event_type`, `connection_life_event_at` — snapshot at accept
  - `households.succession_plan_in_place`, `succession_key_person_identified`, `succession_buy_sell_in_place`
- **Application:** `lib/life-events/connectionContext.ts` — `pickConnectionLifeEvent()` (funnel → referral_clicks → life_events)
- **Application:** `lib/advisor/clientConnectionStatus.ts` — `CONNECTED_ADVISOR_CLIENT_STATUSES`
- **Application:** `lib/app-url.ts` — `getAppUrl()` for email links
- **Routes:** `/onboarding/invite-advisor`, `/business-succession` minimal intake; `PATCH /api/consumer/succession-intake`; `POST /api/consumer/onboarding-invite-advisor`
- **Tiers:** `FEATURE_TIERS['digital-assets'] = 2`

## Sprint 9 — signup attribution, full drip, robots (May 2026)

- **Migration:** `20260529000000_profiles_referral_attribution.sql` — `profiles.referral_code`, `profiles.attorney_referral_code` (indexed, nullable).
- **Signup:** `app/(auth)/signup/_signup-form.tsx` — reads/clears `mwm_referral_*` and `mwm_attorney_referral_*`; fire-and-forget profile update; `account_created` funnel `properties` includes `advisor_referral_code` / `attorney_referral_code`.
- **Email:** `lib/emails/drip-templates.ts` — `DripEventSlug` expanded to all 24 event slugs; custom `EVENT_SEQUENCES` for each.
- **SEO:** `app/robots.ts` — permissive allow/disallow + sitemap URL.

## Sprint 8 — attorney referral attribution (May 2026)

- **Migration:** `20260528000000_attorney_referrals.sql` — `attorney_listings.referral_code` (unique, backfilled); `referral_clicks.listing_type` (`advisor` | `attorney`); `attorney_listing_id` → `attorney_listings(id)`; `attorney_profile_id` → `auth.users(id)`; attorney RLS select policy.
- **API:** `POST /api/referral/track` — `type: 'attorney'` resolves `attorney_listings`; advisor path unchanged; both set `listing_type`.
- **Application:** `_referral-tracker.tsx` — `?aref=` + `mwm_attorney_referral_code` sessionStorage; `lib/events/referral.ts` — `buildAttorneyReferralUrl`, `buildAllAttorneyEventReferralUrls`; attorney portal newsletter kit.

## Sprint 7 — funnel depth, newsletter kit, drip + personalization (May 2026)

- **Admin:** `app/admin/page.tsx` — 30-day `funnelStepCounts`; `tierConversion` via `funnel_events` + `profiles.consumer_tier`; props to `funnel-tab.tsx` (**By Tier** tab).
- **Advisor:** `app/advisor/_advisor-client.tsx` — Newsletter Kit (24 event links, email + plain-text copy); `lib/events/referral.ts` — `buildAllEventReferralUrls` for all `EVENT_SLUGS`.
- **Email:** `lib/emails/drip-templates.ts` — custom `EVENT_SEQUENCES` for all 12 `DripEventSlug` union members; 12 other event slugs (outside union) use `DEFAULT_SEQUENCE`.
- **Product:** `lib/events/upgradeContext.ts` — `EVENT_UPGRADE_COPY` for all 24 slugs (tier 2/3).
- **Cron:** `app/api/cron/age-triggers/route.ts` — per-age event slugs (62/65/70/73).
- **No schema change (superseded by Sprint 8):** attorney referral was advisor-only until `20260528000000_attorney_referrals.sql`.

## Pre-launch SEO gate (May 2026)

- **Application:** `app/robots.ts` — `disallow: /` for all crawlers; sitemap URL commented out until launch.
- **Application:** `proxy.ts` — `PUBLIC_PATHS` adds `/education`, `/sitemap.xml`, `/robots.txt` (public access without auth).
- **Application:** `app/layout.tsx` — optional `metadata.verification.google` via `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` (enable at launch).

## Sprint 6 — admin funnel, attorney PDF, SEO, Resend drip (May 2026)

- **Admin:** `app/admin/funnel-tab.tsx` — reads `funnel_events` via `createAdminClient()` (service role; user client cannot read funnel rows).
- **PDF:** `AttorneyEstatePlanPDF` in `components/pdf/EstatePlanPDF.tsx`; `POST /api/export-estate-plan?variant=attorney` adds `beneficiary_conflicts`, `assets` summary, tax RPCs.
- **SEO:** `app/sitemap.ts` (static routes + `EVENT_SLUGS` event + assess URLs); initial `app/robots.ts` (allow public, disallow app routes) — superseded by pre-launch block above.
- **Migration:** `20260524000000_email_captures_drip.sql` — `drip_step_1/2/3_sent_at`, `unsubscribed_at` on `email_captures`.
- **Email:** `lib/emails/drip-templates.ts`; `POST /api/email/drip` (Resend; auth `INTERNAL_API_KEY` or `CRON_SECRET`); `GET /api/email/unsubscribe`.
- **Cron:** `app/api/cron/notifications/route.ts` job 7 — drip steps 2–3 by age since step 1.
- **Capture:** `app/api/email-capture/route.ts` fires drip step 1 (non-blocking) after insert.

## Sprint 5 — analytics + funnel events (May 2026)

- **Package:** `@vercel/analytics` — `<Analytics />` in `app/layout.tsx` (automatic page views).
- **Migration:** `20260523000000_funnel_events.sql` — `funnel_events` table + RLS + indexes (policies idempotent via `pg_policies` check).
- **Migration:** `20260523000001_app_config_ab_tests.sql` — seeds `ab_upgrade_copy`, `ab_assessment_gate` in `app_config`.
- **Migration hygiene:** `20260521000000`, `20260522000000` — RLS policies wrapped for safe re-run after manual SQL apply.
- **API:** `POST /api/analytics/funnel` — custom funnel events (admin insert).
- **Client:** `lib/analytics/useFunnelEvent.ts`, `lib/analytics/abTests.ts`, `lib/analytics/trackUpgrade.ts`.
- **Instrumentation:** event page view, assess start/complete, email capture, signup, Stripe tier upgrade, advisor accept.
- **A/B:** `/assess` server wrapper passes `ab_assessment_gate` variant (`score_visible` | `full_gate`).
- **Content:** `lib/events/content-sprint5.ts` — 16 additional event slugs (24 total).

## Sprint 4 — advisor referrals + distribution (May 2026)

- **Migration:** `20260522000000_advisor_referrals.sql` — `advisor_directory.referral_code` (unique); `referral_clicks` with FK to `advisor_directory(id)` and `auth.users`; RLS for advisor read + service role writes.
- **API:** `POST /api/referral/track` — resolves `?ref=` against `advisor_directory`; logs resolved/unresolved clicks.
- **Application:** Event pages mount `_referral-tracker.tsx`; advisor portal shows per-event referral URLs (`lib/events/referral.ts`). All listing queries use `advisor_directory` + `profile_id` (not `advisor_listings`).
- **No schema change:** attorney export UI (`/print` dual mode), plan readiness card reads existing `estate_health_scores`.

## Sprint 3 — life_events (May 2026)

- **Migration:** `20260521000000_create_life_events.sql` — `life_events` table; RLS users own rows; indexes on `user_id` and unacknowledged.
- **API:** `app/api/consumer/life-events` — POST/GET/PATCH; valid `event_type` from `EVENT_SLUGS`.
- **Cron:** `app/api/cron/age-triggers` — calendar_trigger inserts; registered in `vercel.json`.

## Ops — notification cron consolidation (May 2026)

- No database schema changes.
- **Vercel cron** (`vercel.json`) is the sole scheduled trigger for `GET /api/cron/notifications` (`0 14 * * *`).
- Deleted `.github/workflows/daily-notifications-cron.yml` (preview URL workflow).
- `.github/workflows/cron-notifications.yml`: schedule disabled; `workflow_dispatch` only; production URL `https://estate-planner-gules.vercel.app/api/cron/notifications`.

## Sprint 2 complete (May 2026) — Marketing, life events, email capture

- **Migration:** `20260520000000_create_email_captures.sql` — `email_captures` table (`email`, `source`, `score`, `captured_at`); unique `(email, source)`; RLS (service role full access + anon/authenticated insert for API route).
- **API:** `POST /api/email-capture` persists leads from event assessment email capture UI.
- **Track A:** `app/(public)/_components/public-nav.tsx` + `(public)/layout.tsx` shared nav; `app/page.tsx` segment copy + social proof; `app/(public)/pricing/page.tsx` (moved from `app/pricing/`); `proxy.ts` adds `/event` to `PUBLIC_PATHS`.
- **Track B:** `lib/events/types.ts`, `lib/events/content.ts` (8 events); `app/(public)/event/[slug]/page.tsx` (SSG, `generateMetadata`, schema.org JSON-LD); `app/(public)/event/[slug]/assess/page.tsx` (event-specific 5-question assessment).
- **Assess gating:** `app/(public)/assess/page.tsx` — logged-out users see overall + pillar scores; gap report gated behind account creation.

## Sprint 1 (May 2026) — UI / route group only

- No database schema or migration changes.
- Route moves (URLs unchanged):
  - `app/(education)/education/*` → `app/(public)/education/*`
  - `app/assess/page.tsx` → `app/(public)/assess/page.tsx`
  - `app/find-advisor/*` → `app/(public)/find-advisor/*`
  - `app/find-attorney/*` → `app/(public)/find-attorney/*`
- New `app/(public)/layout.tsx` (passthrough fragment).
- Consumer sidebar: Overview = Profile + Estate Summary; My Attorney → footer; upgrade gates use `UpgradeBanner` `householdContext` with lightweight `state_primary` query in gate branches.

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

## Session 125 Note

- Schema: migration `20260518120000` — adds `charitable` to `strategy_line_items_strategy_source_check` (`daf` and `category: 'charitable'` already present).
- Application-layer — `GiftingDashboard.tsx` Gift History tab: year-grouped table; client-side `splitElectedYears` from all annual gifts with `form_709_filed=true`; year header **Gift Split Elected ✓** badge; MFJ-only **Split available — file Form 709** when year has annual gifts but no split (no new RPC).
- Application-layer — `CharitableStrategyForm.tsx` on DAF Transfer Strategies panel: strategy type dropdown (DAF / direct charitable), annual amount, recipient, notes; `strategy_source` `daf`|`charitable`, `category: 'charitable'`, `scenario_name: 'base'`; green pill when `daf` or `charitable` saved; legacy DAF calculator removed from consumer panel.
- E2E: `consumer-strategy-writes.spec.ts` (10 cases) — DAF/direct POST/DELETE; composition check via `POST /api/estate-composition` (relative `outside_strategy_total` increase: 2s wait after write + `expect.poll` up to 20s for async recompute, not hardcoded totals). Hardened cleanup: `PLAYWRIGHT_SCENARIOS` registry, `try/finally` per write test, `test.afterEach` sweep, pre-delete `daf`/`charitable` `base` before charitable tests so David Chen fixture state does not leak between runs.

## Session 124 Note

- No database schema or migration changes were introduced in Session 124 (SLAT/ILIT consumer modeling uses existing `strategy_line_items` allowlist and `trust_exclusion` category).
- Application-layer — Transfer Strategies (`ConsumerStrategyPanel`):
  - `components/consumer/SlatStrategyForm.tsx` — contribution amount, funding source (`metadata.funding_source`), notes; MFJ form guard + pill gate; save/remove via `lib/consumer/consumerStrategyLineItems.ts`.
  - `components/consumer/IlitStrategyForm.tsx` — policy dropdown from `insurance_policies` (`user_id`) or manual coverage amount; `metadata.policy_id` / `policy_label` when policy selected.
  - `lib/consumer/consumerStrategyLineItems.ts` — `CONSUMER_BASE_SCENARIO_NAME = 'base'`, `saveConsumerStrategyLineItem` / `removeConsumerStrategyLineItem` → `POST`/`DELETE` `/api/strategy-line-items`; defaults `confidence_level: 'probable'`, `metric_target: 'taxable_estate'`, `sign: -1`.
  - `my-estate-trust-strategy/page.tsx` passes `ownerUserId={user.id}`; panel reloads saved rows (`amount`, `metadata`) and calls `router.refresh()` after write.
  - Education card collapses when saved (`StrategyEducationCard` `defaultOpen={!saved}`); green pill dot when `strategy_source` in saved set.
- Engine: active consumer SLAT/ILIT rows flow through existing `outside_strategy_items` / `outside_strategy_total` aggregation in `calculate_estate_composition` (no RPC change).
- Types: `StrategyLineItemSource` includes `slat` in `lib/estate/types.ts` (`ilit` was already present).

## Session 122 Note

- No database schema or migration changes were introduced in Session 122.
- Application-layer changes:
  - `app/(dashboard)/dashboard/page.tsx` — server `calculate_gifting_summary` + `classifyEstateAssets(..., lifetimeGiftsUsed)`; passes `estateCallout` to client.
  - `components/dashboard/EstateCalloutCard.tsx` — gross estate, headroom before federal tax, est. federal/state tax; link `/estate-tax`.
  - `lib/estate/exemptionLabels.ts` — `computeHeadroomBeforeFederalTax(exemption_available, gross, outside_strategy_total)` aligns dashboard callout with My Estate Strategy horizons (`federalExemption − insideTotal`); RPC `exemption_remaining` remains `exemption_available − taxable_estate` for tax-engine surfaces (e.g. estate-tax snapshot).
  - `components/estate-flow/EstateFlowDiagram.tsx` — `buildEdgeLabelLanes` (file-local rendering helper; not under `lib/`) + label background/stagger for overlapping edges.

## Session 121 Note

- Schema (Step 7): `20260517120000` — drop `adjusted_taxable_gift` from `strategy_line_items_strategy_source_check` (pre-flight count must be 0). `20260517120100` — remove `v_atg` from `calculate_estate_composition` (no ATG add-back to `taxable_estate`; `lifetime_gifts_used` unchanged). Reference: `supabase/migrations/reference/live_calculate_estate_composition.sql`.
- Application-layer — Transfer Strategies: `ConsumerStrategyPanel` educational cards (`STRATEGY_INFO`, SLAT/ILIT pills, MFJ gating); liquidity panel `Math.round()` on `estimatedStateTax` / `estimatedFederalTax` for number inputs. Consumer save forms for SLAT/ILIT deferred to Session 124.
- Application-layer — gift-history: `POST /api/consumer/gift-history` returns **201**; `lib/strategy/*` drops `adjusted_taxable_gift` from allowed sources; `EstateComposition.adjusted_taxable_gifts` optional (RPC no longer returns it after 7B).
- E2E: `tests/e2e/consumer/consumer-gift-history.spec.ts` (9 cases); consumer project **50** tests. Playwright account: `david@rolobe.resend.app` / household `3967698f-00d2-4746-ab90-6209e90b3d68` in `.env.test`. Recompute case needs `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Session 120 Note

- Schema: migration `20260516140000_calculate_estate_composition_add_lifetime_gifts.sql` — `calculate_estate_composition` gains `p_lifetime_gifts_used numeric DEFAULT 0`; `v_exemption := GREATEST(0, v_exemption - p_lifetime_gifts_used)` after federal config null guard; return adds `lifetime_gifts_used`; `SET search_path = public`; GRANT on `(uuid, text, numeric)`. Built from live `pg_get_functiondef` (`supabase/migrations/reference/live_calculate_estate_composition.sql` + `scripts/build-estate-composition-lifetime-gifts-migration.mjs`). `v_atg` / `adjusted_taxable_gifts` unchanged (Step 7).
- Application-layer changes:
  - `classifyEstateAssets` + `my-estate-trust-strategy/page.tsx` + `estate-tax/page.tsx` + `my-estate-strategy/page.tsx` + `POST /api/estate-composition` — pass `lifetime_exemption_used` into composition RPC.
  - `lib/estate/types.ts` — `lifetime_gifts_used?`, `exemption_used?`, `source_role?` on `EstateComposition`.
  - `lib/estate/exemptionLabels.ts` — shared labels: lifetime gifts used, federal exemption (after gifts), headroom before federal tax, lifetime exemption remaining (gifting).
  - `estate-tax/_estate-tax-client.tsx` — standardized summary card + headroom line (no long duplicate explanation).
  - `EstateCompositionCard.tsx` — same labels on inside panel and waterfall.
  - `my-estate-strategy/_my-estate-strategy-client.tsx` — horizon columns use shared labels; inside/outside sub-row no longer says “Exemption remaining”.
  - `GiftingDashboard.tsx` — `priorTaxableGifts` useMemo; prior section controlled open; lifetime meter uses RPC `lifetime_exemption_used` only (no double-count of annual overflow); gifting summary uses **Lifetime gifts used** / **lifetime exemption remaining**.
  - `CollapsibleSection.tsx` — optional `open` / `onOpenChange`.
  - `lib/utils/formatCurrency.ts` — shared `formatDollars` / `formatDollarsCompact`; `TrustDocumentsPanel` estate value display.
  - `my-estate-strategy/_my-estate-strategy-client.tsx` — `lifetimeGiftsUsed` prop; horizon **Lifetime gifts used** row (link to `/my-estate-trust-strategy?tab=gifting` when &gt; 0).

## Session 119 Note

- No database schema or migration changes were introduced in Session 119.
- Application-layer changes (`components/GiftingDashboard.tsx` only):
  - Trim `recipient_name`, `notes`, `recipient_relationship` on gift form POST bodies; reject whitespace-only recipient names.
  - Prior gift form: read-only **Form 709 — Taxable gift** badge; `gift_type: 'lifetime'` on submit; auto-check `form_709_filed` when amount entered; helper text for amber pending-filing indicator.

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

## Session 126 Note

- Migration `20260517185228_add_is_default_to_advisor_projection_assumptions.sql`: `is_default boolean NOT NULL DEFAULT false` + partial unique index `advisor_projection_assumptions_one_default_preset_idx` on `(advisor_id) WHERE is_preset = true AND is_default = true`.
- Preset rows: `is_preset = true`, `client_household_id` null, `scenario_name` required on create; unset assumption numerics stored as null (Monte Carlo engine uses `MONTE_CARLO_SYSTEM_DEFAULTS`).
- Application-layer:
  - `/api/advisor/presets` — GET (default first, then `created_at` DESC), POST (`is_preset` explicit); `/api/advisor/presets/[id]` — PATCH/DELETE with ownership guard; `/api/advisor/presets/[id]/default` — clear all advisor preset defaults then set one.
  - `/advisor/presets` — `PresetManager` (CRUD + set default); `MonteCarloAssumptionsPanel` auto-loads default on mount + “Load preset” dropdown (UI-only until advisor saves scenario).
- E2E: `tests/e2e/advisor/advisor-presets.spec.ts` (API CRUD, consumer 403, UI pre-fill). Playwright seeds: `scripts/seed-michael-johnson-advisor-demo.ts` (Johnson client for advisor2), `scripts/seed-advisor2-playwright-fixture.ts` (household `90cc8759-…` strategy-recommendation link).

## Session 127 Note

- No new schema migration. Uses existing `households.state_primary`, `households.filing_status`, `households.person1_birth_year`, `trusts.excludes_from_estate`, `trusts.funding_amount`, `state_estate_tax_rules`, and `calculate_gifting_summary` RPC.
- Application-layer:
  - `lib/estate/profileGate.ts` + `requireMinimumViableProfile` — gated consumer pages redirect to profile when minimum fields missing.
  - `TrustDocumentsPanel` (trust-strategy tab): headroom via `computeHeadroomBeforeFederalTax`, federal exemption remaining after lifetime gifts, `~Est. Tax Saved` on excluded trusts using marginal `rate_pct` from `state_estate_tax_rules`.

