# Schema changelog (session notes)

Historical session-by-session audit trail moved from `DATABASE_SCHEMA_REFERENCE.md` so the schema reference stays focused on **current authoritative state**.

For live table/RPC definitions, use [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md).

**Session coverage:** Entries from Session 94 onward are the primary audit trail for this file. Sessions 43–93 (and selected lower numbers) are carried over from the original schema reference where they had schema impact. Sessions 1–50, gaps between carried-over blocks (e.g. 63–74, 77–78, 80–87, 89–90), and sessions without schema impact before 94 are not recorded here — that reflects history, not missing files.

---

# Last updated: 2026-06-18 (attorney drip unsubscribe; recompute fail-closed; checkout API guards)

---

## Attorney drip unsubscribe + recompute/checkout hardening (2026-06-18)

**Migration:** `20260718120000_attorney_drip_unsubscribed_at.sql` — nullable `profiles.attorney_drip_unsubscribed_at`; `GET /api/email/unsubscribe?type=attorney` (PR #37).

**App (code only):**
- `lib/api/internalApiAuth.ts` — `requireRecomputeAuth` fail-closed (`RECOMPUTE_SECRET`; header `x-recompute-secret`) — PR #35
- `lib/billing/processConsumerCheckout.ts` + `consumerCheckoutBlockReason()` — API/UI checkout eligibility parity — PR #36
- `lib/email/applyEmailUnsubscribe.ts` — attorney/advisor/capture routing — PR #37
- Sentry webhook capture (#32), `trackTierUpgrade` ordering (#34), isolation CI (#30), notification hygiene doc (#38), promotion runbook doc sync (#39)

**Verify:** `npx playwright test tests/unit/internalApiAuth.spec.ts tests/unit/consumerCheckoutBlockReason.spec.ts tests/unit/processConsumerCheckout.spec.ts tests/unit/applyEmailUnsubscribe.spec.ts --project=import-unit`

**Status:** Code on **`staging`** (PRs #28–#39). Prod Vercel deploy pending staging→`main` promotion — see [PROMOTION_STAGING_TO_MAIN.md](./PROMOTION_STAGING_TO_MAIN.md). Migration column already on prod DB; route code follows deploy.

---

## Pre-launch FOR ALL RLS leak + structural coverage gate (2026-06-15)

**Migrations (apply in order on staging + prod before deploy):**
- `20260713130000_fix_health_scores_alerts_permissive_rls.sql` — drop `TO public` + `USING (true)` **FOR ALL** on `estate_health_scores`, `household_alerts`, `beneficiary_conflicts`; replace with `TO service_role` + scoped owner/advisor SELECT
- `20260713140000_rls_coverage_gate_fixes.sql` — `businesses` advisor UPDATE: explicit `WITH CHECK` (Postgres had defaulted `true`); `estate_flow_share_links`: drop `public_select_share_link_by_token`, add `get_share_link_display_meta()` SECURITY DEFINER RPC
- `20260713150000_service_role_policy_grant_alignment.sql` — `funnel_events`, `referral_clicks`: `TO service_role` (was `TO {public}` + `auth.role()` predicate)

**Exposure / timeline:** FOR ALL leak = cross-tenant read/write/delete (integrity + availability). Found on staging via `verify:rls` 2026-06-13; fixed pre-launch; **zero production rows affected** ([DECISION_LOG.md](./DECISION_LOG.md)).

**Gate:** `scripts/assert-rls-coverage.sql` — structural tenant-scope check (tenancy columns, not 21-table list); wired into `npm run verify:rls` / `release:preflight`. Expect **27/27** checks on fixed schema.

**App:** `app/share/estate-flow/[token]/page.tsx` · `lib/estate-flow/snapshotFlow.ts` — share metadata via RPC.

**Tests:** `tests/e2e/security/cross-household-isolation.spec.ts` (revoked-link lifecycle) · `tests/unit/attorneyClientCap.spec.ts` · `lib/authz/householdScopedTables.ts` · full `HOUSEHOLD_SCOPED_TABLES` JWT matrix in `runRlsVerification.ts`.

**Verify:** `npm run verify:rls` · `npm run test:e2e:security-isolation -- --workers=1` · `npx playwright test tests/unit/attorneyClientCap.spec.ts --project=import-unit`

**Prod apply:** 2026-06-15 — all three migrations applied via SQL; `assert-rls-coverage` → 0 rows.

**PR:** #22 (merged)

---

## WA Regime D — state estate tax rules + CST RPC (2026-06-15)

**Migrations:**
- `20260613120000_wa_regime_d_state_estate_tax_rules.sql` — WA `state_estate_tax_rules` 2025–2030: $3M exemption, restored 10–20% schedule incl. **19.5%** band $7M–$9M taxable
- `20260613130000_cst_funding_cap_calculate_estate_composition.sql` — `calculate_estate_composition` survivor formula `(G − X) − exemption` for with-CST path
- `20260613140000_wa_dor_table_w_content_brackets.sql` — `state_estate_tax_content` JSON brackets aligned to DOR Table W

**App:**
- `lib/estate/waRegime.ts` · `resolveStateEstateBrackets.ts` — Engine B override for WA (Regime D forward planning)
- `lib/calculations/stateEstateTax.ts` — bypass funding cap, first-death $0 guard, projection-aware CST growth
- `lib/estate/waRegimeDorGoldens.ts` · `tests/unit/waRegime.spec.ts` — RCW 83.100.040 golden vectors ($6M→$910K … $10M→$1.69M)

**Verify:** `npx playwright test tests/unit/waRegime.spec.ts --project=import-unit` · post-migration `npm run verify:estate -- --preset voels --check-goldens`

---

## Code-only — deletion schema drift + E2E beneficiary seed (2026-06-15)

| Change | Detail |
|--------|--------|
| **deleteUser schema drift** | `lib/compliance/deleteUserSchema.ts` — missing table: warn + skip; missing column: abort + audit `schema_skip` (no silent WCPA false-green) |
| **E2E advisor client** | `seedE2eAdvisorClientHousehold()` → `asset_beneficiaries` (3 rows on 401k); `verifyE2eAccounts()` count check |
| **Ops** | `scripts/check-auth-emails.ts` — auth lookup after purge |
| **Launch tracker** | v4 UI + `npm run sync:launch-tracker` → [LAUNCH.md](./LAUNCH.md) scoreboard **44/55** |

**No migration.**

---

## Code audit Sprint C + D + roster/domicile alignment (2026-06-12, code only)

| Change | Detail |
|--------|--------|
| **Recompute debounce (Vercel)** | `triggerEstateHealthRecompute` + `triggerBackgroundBaseCaseAndRecompute` — `after()` + 3s per-household coalescing on Vercel (matches local; same eventual scores) |
| **Advisor roster** | `app/advisor/page.tsx` — parallel fetches after `clientIds` known |
| **Strategy configs** | `POST`/`DELETE` `/api/strategy-configs` → `afterHouseholdWrite` (bundle invalidation + recompute; same as other consumer writes) |
| **Domicile API** | `lib/domicile/assertDomicileSubjectAccess` — advisor link must be `active` or `accepted` (`CONNECTED_ADVISOR_CLIENT_STATUSES`) |
| **Shared roster net worth** | `lib/roster/rosterNetWorth.ts` — advisor + attorney home use `loadRosterNetWorthByOwner`; `RosterNetWorthColumnHeader` + tooltip (“Est. Net Worth”) |
| **Dead code** | Removed unused components/libs, deprecated exports, superseded seed scripts; `/advisor/prospect` page removed (redirect unchanged) |

**Deferred:** gifting cache; dashboard query dedupe.

---

## Code audit Sprint A — import hook + E2E ops (2026-06-12, code only)

| Change | Detail |
|--------|--------|
| **Import commit** | `POST /api/import/commit` → `afterHouseholdWriteForOwner` after successful bulk insert |
| **Meeting prep** | `share-meeting-prep` + `meeting-prep-pdf` — `estate_composition_cache` filtered by `source_role: consumer` |
| **E2E** | `E2E_SKIP_RECOMPUTE` in `triggerEstateHealthRecompute`; `security-smoke` local vs `security-smoke:prod`; `cross-role` uses `advisor-client-setup` |

---

## Pre-launch DB perf — dashboard bundle + MC staleness (2026-06-12)

**Migration:** `20260712120000_household_projection_inputs_hash.sql`

| Change | Detail |
|--------|--------|
| **`households.projection_inputs_hash`** | SHA-256 of MC input fields; `NULL` after `touchHousehold` until precompute completes |
| **App — bundle** | `lib/dashboard/loadDashboardBundle.ts` — consolidated dashboard fetch + 60s TTL; `invalidateDashboardBundle` on write |
| **App — MC** | `computeProjectionInputsHash` · `loadScenarioMonteCarloWithStaleness` · `runEstateMonteCarloAsync` writes hash on success |
| **App — gap fix** | `PATCH /api/households/[id]` → `touchHousehold` before recompute |

**Verify:** `npm run verify:estate -- --preset voels --check-goldens` · `npx tsc --noEmit`

---

## Go-live P1 performance (2026-06-11) — application layer

**No new migrations.** `loadScopedEstateTaxReferenceData`, `partitionStrategyLineItems`, `triggerBackgroundBaseCaseAndRecompute`, attorney recommendations cache-only path, dashboard query dedups.

---

## Go-live P0 performance (2026-06-11) — application layer

**No new migrations.** Attorney composition prefetch + vault access; `export-estate-plan` owner_id fix; advisor `/api/advisor/client-export-payload` lazy export; tab-gated advisor loads; composition `lifetime_gifts_used` cache invalidation; projections stale-cache path.

---

## Recompute path dedupe + alert batch upsert (2026-06-11)

**Migrations:** `20260709170000_optimize_generate_estate_recommendations.sql`, `20260709180000_batch_upsert_household_alerts.sql`, `20260709180100_drop_generate_estate_recommendations_overload.sql`

| Change | Detail |
|--------|--------|
| **`generate_estate_recommendations(uuid, jsonb DEFAULT NULL)`** | Optional `p_composition`; drops nested `calculate_state_estate_tax`; uses `estimated_tax_federal` / `estimated_tax_state` from composition |
| **Recompute route** | Gifting → composition ×2 → recommendations with consumer composition → cache (3× composition → 2×) |
| **`upsert_household_alerts_batch`** | One RPC per `detectConflicts` upsert loop |
| **`resolve_household_alerts_batch`** | Inline `UPDATE … rule_id = ANY(p_rule_ids)` (replaces 6× internal `resolve_household_alert`) |
| **App** | `loadEstatePlanningDashboard` + `PlanningGapsSection` read `estate_health_scores.recommendations` cache |

---

## Supabase Disk IO optimization (2026-06-11)

**Migrations:** `20260709150000_optimize_calculate_state_estate_tax.sql`, `20260709160000_batch_resolve_household_alerts.sql`

| Change | Detail |
|--------|--------|
| **`idx_state_estate_tax_rules_state_tax_year`** | `(state, tax_year)` — supports indexed bracket lookups |
| **`calculate_state_estate_tax`** | Replaced unfiltered year scan + redundant EXISTS/MIN/loop pattern with indexed queries |
| **`resolve_household_alerts_batch`** | New RPC; `lib/conflict-detector.ts` calls once per `detectConflicts` |
| **Verify** | Voels (`avoels@outlook.com`) post-migration: WA ~$261K `estimated_state_tax` |
| **Future** | Optional 9-index batch if IO still high — [NEXT_SESSION.md](./NEXT_SESSION.md) |

---

## Pricing surfaces alignment + firm seat billing (2026-06-10)

**No schema migration.** Application-layer billing alignment:

| Change | Detail |
|--------|--------|
| **`/pricing`** | Advisor per-seat + attorney tiers from `lib/tiers.ts`; `_pricing-advisor-checkout.tsx` |
| **`/api/stripe/checkout`** | Consumer-only; legacy advisor price IDs removed |
| **`/api/stripe/firm-checkout`** | `{ priceId, seatCount }`; tier-band validation |
| **Webhook** | Firm checkout → `firms.seat_count` = Stripe subscription quantity |
| **`/billing`** | Firm owner seat picker pre-subscribe |
| **`lib/tiers.ts`** | `ADVISOR_FIRM_SEAT_RANGES`; enterprise $89/seat |

**Env template:** `.env.live-stripe` (gitignored) for live `STRIPE_PRICE_*` + webhook secret.

---

## State estate tax content system (2026-06-09)

**Migration `20260615000000_state_estate_tax_content.sql`:**

| Change | Detail |
|--------|--------|
| **`state_estate_tax_content`** | Public `/learn/[state]-estate-tax` page data — 13 estate-tax states seeded; anon/authenticated SELECT; service_role writes via admin API |
| **Columns** | `exemption_amount`, `brackets`/`quirks` JSONB, scenario worked-example fields, `last_reviewed`, `law_effective_date` |
| **Audit** | `app_config` key `state_tax_content_audit_log` (admin PATCH trail) |
| **Cron** | `notifications` §11 — Monday staleness check → `COMPLIANCE_EMAIL` |

**Not merged with Engine B:** `stateEstateTax.ts` calculation data remains separate.

---

## Admin P1 — federal tax config editor, user detail, waitlist (2026-06-09)

**Migration `20260709140000_email_captures_invite_tracking.sql`:** `invited_at timestamptz` + `invite_label text` added to `email_captures`.

**No other schema changes;** all three fixes are application-layer on existing tables (`federal_tax_config`, `profiles`, `email_captures`, `app_config`).

---

## Admin-A — Ops Home + ops_tasks engine (2026-06-09)

**Migrations:** `20260610120000_admin_ops_tasks.sql`, `20260610130000_deletion_retry_policy.sql`

| Change | Detail |
|--------|--------|
| **`ops_tasks`** | Calendar obligation tracker — 13 seeded tasks (weekly/monthly/quarterly/annual/once) from `COMPLIANCE_CALENDAR.md` + `LAUNCH_GATE.md` Gate 3; service_role only |
| **`cron_health`** | Per-job last-run status for 5 Vercel crons; seeded with `unknown` until first run |
| **`deletion_schedule`** | `retry_count`, `next_retry_at`, `last_error` — exponential backoff on cron failure |
| **API** | `GET/PATCH/POST /api/admin/ops-tasks`; `GET/POST /api/admin/cron-health`; `POST /api/admin/privacy-requests` |
| **Cron** | `lib/cron/recordCronHealth.ts` wired into all 5 crons; `compliance-reminders` alerts on ops tasks + cron failures |
| **Admin UI** | `/admin` default tab **Ops Home** (`ops-home-tab.tsx`); **Directories** tab; privacy **Add request** in Data & Compliance |

**Files:** `app/admin/ops-home-tab.tsx`, `lib/admin/opsTasks.ts`, `lib/email/deletionRetryAlertEmail.ts`, `lib/email/postDeployFailureEmail.ts`

---

## Private beta signup links (2026-06-08)

**No migration.** Waitlist bypass for friends via secret URL while `PUBLIC_SIGNUP_OPEN` stays off.

| Change | Detail |
|--------|--------|
| **Env** | `BETA_SIGNUP_TOKEN` — Vercel Production only (server-side; not `NEXT_PUBLIC_`) |
| **URL** | `/signup?access=TOKEN&label=cohort-name` — label optional, used for cohort tracking |
| **Cookies** | `mwm_beta_signup`, `mwm_beta_signup_label` — HttpOnly, 30 days, set in `middleware.ts` |
| **Funnel** | `beta_signup_link_viewed`; `account_created` with `properties.signup_source: beta_access_link` |
| **Admin** | Funnel tab — **Private Beta Signup Links** (views, accounts, conversion by label) |
| **Tests** | `tests/unit/waitlist-mode.spec.ts` — token + cookie bypass |

**Files:** `lib/waitlist-mode.ts`, `middleware.ts`, `app/(auth)/signup/page.tsx`, `_beta-signup-tracker.tsx`, `_signup-form.tsx`, `app/admin/page.tsx`, `app/admin/funnel-tab.tsx`

---

## CI build placeholders (2026-06-08)

**No migration.** `.github/workflows/ci.yml` — `Production build` step env only.

| Change | Detail |
|--------|--------|
| **Problem** | `next build` imports Stripe/Resend at route collection; CI lacked keys → build failed → blocked deploys when GitHub checks required |
| **Fix** | Dummy `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` on CI build step only |
| **Not in scope** | Real secrets stay in Vercel env (Production + Preview); placeholders never deployed |
| **Remaining** | UX language audit still fails CI (13 instances) — separate from build |

**Commits:** `201e9be`, `b9eef05`

---

## Pre-go-live tax data cleanup + inheritance seed (2026-06-08)

**Migrations:** `20260708120000_cleanup_legacy_tax_tables.sql`, `20260708130000_seed_state_inheritance_tax_rules_2026.sql`

| Change | Detail |
|--------|--------|
| **Purge** | Delete `tax_year` 2023–2025 from `federal_tax_brackets`, `state_income_tax_brackets`, `state_estate_tax_rules`, `state_inheritance_tax_rules`, `irmaa_brackets`, `federal_estate_tax_brackets` |
| **Drop** | `state_income_tax_rates` (flat-rate legacy; engines use `state_income_tax_brackets`) |
| **Backfill** | `federal_estate_tax_brackets.tax_year = 2026` where null |
| **Seed** | `state_inheritance_tax_rules` — 24 rows for 2026 (IA, KY, MD, NE, NJ, PA × spouse/child/sibling/other) |
| **App** | Admin tax-rules tab: removed deprecated flat-rate section; year picker 2026+; removed `computeStateEstateTaxFromBrackets` |
| **Test** | `tests/unit/tax-year-selection.spec.ts` — 2026-only bracket selection |

**Verify:** `npm run verify:tax-coverage` → all 7 domains PASS for 2026.

---

## B2B2C connection billing columns + attorney_managed (2026-06-07)

**Migration:** `20260704120000_b2b2c_connection_billing.sql`

- `advisor_clients` + `attorney_clients`: `billing_transferred`, `billing_transferred_at`, `previous_consumer_tier`, `consumer_subscription_cancel_at`
- `profiles.subscription_status`: adds `attorney_managed`

**Application:** `lib/billing/managedConsumerBilling.ts` — env toggles `B2B2C_*`. Policy: [BILLING_B2B2C_POLICY.md](./BILLING_B2B2C_POLICY.md).

---

## Admin deletion email lookup (2026-06-07)

**Session 133** — No migration. Admin portal UX:

| Change | Detail |
|--------|--------|
| **`GET /api/admin/deletions?view=lookup&email=`** | Resolves UUID from `profiles` or auth users (admin-only) |
| **`DeletionCompliance.tsx`** | Execute tab: email → **Look up** auto-fills UUID; **Execute →** from Scheduled Deletions / Privacy Requests |

**Workflow:** `/admin` → Data & Compliance → Execute Deletion → enter email → Look up → dry run → execute.

---

## Go-live auth purge + deleteUser coverage (2026-06-07)

**Session 132** — No migration. Application-layer only:

| Change | Detail |
|--------|--------|
| **`scripts/cleanup-test-accounts.ts`** | `--purge-unprotected`, `--dry-run`, `--yes`; `GO_LIVE_PROTECTED` + case-insensitive guard |
| **`lib/compliance/deleteUser.ts`** | Extended household/owner table lists; `advisor_notes` / `advisor_gap_statuses` OR delete; skip missing tables |
| **npm** | `cleanup:purge`, `cleanup:purge:dry-run` |
| **Prod outcome** | **10** auth users remain; Johnson + rolobe stragglers purged with audit log |

**Verify:** `npm run cleanup:purge:dry-run` → 0 to delete · `npm run verify:deletion -- --email …` after any WCPA delete

---

## Estate verification suite — app-only (2026-06-07)

**Session 131** — No migration. Added cross-surface verification harness:

| Surface | Route / module |
|---------|----------------|
| Matrix CLI | `npm run verify:estate` → `lib/verify/runEstateVerification.ts` |
| Lifecycle | `runStrategyLifecycleVerification.ts` (e2e `--lifecycle`) |
| HTTP scrape | `scrapeEstateHttpSurfaces.ts` (`--http`) |
| User API | `POST /api/verify-estate-plan` |
| UI | `/settings/security` — Verify my plan |

**Goldens:** `tests/fixtures/estate-golden/{voels,e2e,voels-advisor}.json`

---

**Migration:** `20260630120000_advisor_branding_storage.sql`

| Resource | Detail |
|----------|--------|
| Bucket | `advisor-branding` — public read |
| Path | `{advisor_user_id}/logo.{png\|jpg\|webp}` |
| Limits | 2 MB · PNG/JPEG/WebP MIME types |
| RLS | Authenticated insert/update/delete own folder only; public SELECT |

**App:** `POST/DELETE /api/advisor/profile/logo` → updates **`profiles.firm_logo_url`** with public object URL.

---

## MC Phase 3 signals — monte_carlo_results columns (2026-06-05)

**Migration:** `20260605110000_mc_phase3_signals.sql`

| Column | Type | Purpose |
|--------|------|---------|
| `wa_threshold_prob_by_year` | jsonb | Per-year `{ year, age_p1, pct_above_threshold }[]` from fan P10–P90 ladder vs `stateBrackets[0].exemption_amount` |
| `first_tax_year_p10` | integer | First calendar year where P10 gross exceeds state exemption |
| `longevity_depletion_pct` | integer | Estimated % paths below floor at death year |
| `depletion_floor_amount` | numeric | Floor constant (`MC_DEPLETION_FLOOR` = 500_000) |

**App:** `runEstateMonteCarloAsync` upsert · `loadScenarioMonteCarlo` SELECT. UI wiring shipped — see Phase 3 MC UI complete in DECISION_LOG.

---

## Codebase cleanup + perf/constants (2026-06-05)

**No migration.**

| Change | Detail |
|--------|--------|
| Deleted | `AssetAllocationSummary.tsx`, `app/(attorney)/attorney/_attorney-client.tsx` |
| `lib/gifting/perRecipientLimit.ts` | Central annual exclusion constants + RPC-aware helper |
| `lib/household/getHouseholdForOwner.ts` | `React.cache()` full household for dashboard |
| `components/advisor/MonteCarloFanChart.tsx` | Extracted memoized SVG fan chart |
| `estate-tax/page.tsx` | Removed unused asset/RE/business queries |
| `my-advisor/page.tsx` | `advisor_clients` order + limit for multi-row safety |
| PDF | `firstTaxYearP10` on `PDFReportData` + `narrativeEngine` |

---

## `/estate-tax` — WA threshold probability copy (2026-06-05)

**No migration.** Application-layer only.

| Change | Detail |
|--------|--------|
| `estate-tax/page.tsx` | `loadScenarioMonteCarlo` via `households.base_case_scenario_id`; pass `wa_threshold_prob_by_year[0]` |
| `_estate-tax-client.tsx` | Probability sentence after state tax waterfall row when `pct_above_threshold > 0` |

---

## Projections EstateOutlookChart — state exemption threshold line (2026-06-05)

**No migration.** Application-layer only.

| Change | Detail |
|--------|--------|
| `projections/page.tsx` | Fetch `state_estate_tax_rules.exemption_amount` for `household.state_primary` (current tax year; fallback latest year) |
| `EstateOutlookChart` | Optional `stateExemption` prop — amber dashed Y reference line + legend when > 0 |
| `_projections-client.tsx` | Pass-through prop from server |

**Note:** Uses static exemption amount from rules table — not stored MC **`wa_threshold_prob_by_year`**.

---

## Advisor profiles branding + migration history sync (2026-06-05)

**Migrations:**
- `20260605100000_profiles_branding_columns.sql` — `profiles.firm_name`, `firm_logo_url` (idempotent `phone`)
- `20260605000000_mc_percentiles.sql` — MC `percentiles_by_year`, unique `scenario_id` index
- `20260529120500_sprint_import_attorney.sql` — renumbered from duplicate `20260529120000`; `drop policy if exists` on `document_gap_dismissals`

**Prod apply:** Schema pre-existed from manual applies; `supabase migration repair` + renumber (`11a867d`). `supabase db push` → remote up to date.

**App:** `fetchAdvisorProfile` → `resolveAdvisorBranding` on PDF/brief; temporary debug logs removed pre-launch (`52ddc23`).

---

## Advisor Profile Settings UI (2026-06-05)

**App (no migration):** `/advisor/settings` · `GET`/`PATCH` `/api/advisor/profile` — partial update of `full_name`, `firm_name`, `phone` on `profiles` where `id = auth.uid()`. Logo upload UI placeholder only; `firm_logo_url` write deferred.

**Verify:** `scripts/verify-advisor-settings-voels.ts` — Voels GET/PATCH + PDF cover firm name.

---

## Tax Horizons + Advisor portal polish (2026-05-30)

**Scope:** Application-layer UI only — no migrations.

| Area | Change |
|------|--------|
| `/my-estate-strategy` | Readiness pill; bypass bar; remove embedded completeness/topics; grouped assets in flow (`56762ad`) |
| Advisor Strategy tab | Alert hierarchy; severity cards; `estimateStrategySavings`; composite waterfall gate; MC empty state |
| Advisor Estate tab | Liquidity hero; composition + waterfall / conflict two-col; doc alert; beneficiary-by-account; flow summary + toggle; 6 account groups |
| Advisor Retirement tab | Wire `YearRow[]` + `loadSocialSecurityData` + `runRothAnalysis`; readiness hero; income snapshot; SS survivor/breakeven; RMD timeline; withdrawal sequencing |
| Advisor PDF export | `narrativeEngine.ts` (`currentFederalExemption`, `dedupeActionItems`); page 3 exemption aligned with cover; API `?type=report` |
| `/roth` | Methodology note expansion (`6cb942a`); bracket headroom fix (`cae89fc`) |
| Shared | `lib/estate/parseBypassTrustSavings.ts`, `lib/advisor/estimateStrategySavings.ts`, `lib/calculations/roth-analysis.ts` |

---

## Dashboard estate summary + state exemption (2026-05-30)

**Migrations:** `20260630110000_state_estate_tax_rules_no_portability.sql`

| Change | Detail |
|--------|--------|
| `state_estate_tax_rules.no_portability` | `boolean NOT NULL DEFAULT false`; `true` for WA, MA, OR |
| WA exemption data | Rows with `tax_year >= 2025` updated to **$3,000,000** where below $3M |
| Dashboard fetch | `dashboard/_dashboard-body.tsx` — `state_estate_tax_rules` in existing `Promise.all` |
| UI | `EstateTaxSnapshotPanel` — exemption, portability note, state taxable, state tax |

**Commits:** `deb0080` (layout consolidate) · `0686f52` (exemption wire)

**Apply on remote:** `supabase db push` before deploy that reads `no_portability`.

---

## Attorney clients FK alignment + households attorney SELECT (2026-05-30)

**Migration:** `20260630100000_attorney_clients_fk_listing_household.sql`

| Change | Detail |
|--------|--------|
| `attorney_clients.attorney_id` | FK → `attorney_listings.id` (legacy prod had `profiles.id`) |
| `attorney_clients.client_id` | FK → `households.id` (backfill from owner auth id where needed) |
| `households_attorney_select` | Attorney SELECT on connected client households (vault detail page) |

**Apply on remote:** `supabase db push` — **prod applied 2026-05-30**.

---

## RPC household access guards + attorney RLS (2026-05-29)

**Migrations:** `20260629120000_rpc_household_access_guards.sql` · `20260629130000_attorney_rls_policy_fix.sql`

| Change | Detail |
|--------|--------|
| `assert_household_caller_access(uuid)` | Postgres helper; owner, connected advisor, or connected attorney; `service_role` bypass |
| RPC guards | `calculate_estate_composition`, `calculate_gifting_summary`, `generate_estate_recommendations` |
| `attorney_clients` RLS | `attorney_id` → `attorney_listings.id`; consumer `client_id` → `households.id` |
| `legal_documents` / `document_download_log` | Attorney policies join via `attorney_listings.profile_id = auth.uid()` |

**Apply on remote:** both migrations + `supabase functions deploy estate-monte-carlo`. **Prod applied 2026-05-29** on `fnzvlmrqwcqwiqueevux`; verify via `scripts/verify-security-sprint-20260629.sql`.

---

## Professional Acquisition & Activation (2026-05-29)

**Migration:** `20260530_attorney_intake_requests.sql`

| Change | Detail |
|--------|--------|
| `attorney_intake_requests` | Attorney → client email invitations; token, status lifecycle, 14-day expiry |
| Intake accept | Public `/intake/[token]`; sessionStorage token → `POST /api/consumer/complete-intake-request` |
| Attorney UI | Send intake modal; pending requests list; 5/mo free cap |
| Advisor impact | `GET /api/advisor/referral-impact`; `ReferralImpactPanel` on advisor portal |
| Referral notify | `notifyAdvisorOfReferredSignup` on consumer signup with advisor ref |
| Meeting prep PDF | `GET /api/advisor/meeting-prep-pdf/[clientId]` — HTML print one-pager |

**Apply on remote:** `20260530_attorney_intake_requests.sql` (before Vercel deploy).

---

## Persona-based onboarding (2026-05-29)

**Migration:** `20260530_onboarding_persona.sql`

| Change | Detail |
|--------|--------|
| `profiles.onboarding_persona` | `TEXT` CHECK — `business_owner` \| `real_estate` \| `executive` \| `accumulator`; NULL until answered |
| `profiles.persona_set_at` | Timestamptz — set once on first persona save; immutable for analytics |

**Code (no new tables):** `/onboarding/persona` selection screen; post-profile redirect; persona-aware wizard step 1 (`lib/onboarding/personaConfig.ts`); `PersonaInsightCard` on dashboard (7-day account age, sessionStorage dismiss); funnel events `persona_*`; `PATCH /api/consumer/profile` accepts persona-only updates; wizard gate exempt `/onboarding/persona`.

**Apply on remote:** `20260530_onboarding_persona.sql`.

---

## Attorney monetization — checkout + drip (2026-05-29)

**Migration:** `20260529130000_attorney_drip_columns.sql`

| Change | Detail |
|--------|--------|
| `profiles.attorney_drip_step_1_sent_at` | Timestamptz — welcome email on attorney activation |
| `profiles.attorney_drip_step_2_sent_at` | Timestamptz — day-3 intake workflow email (cron) |
| `profiles.attorney_drip_step_3_sent_at` | Timestamptz — day-7 upgrade prompt email (cron) |

**Code (no new tables):** `POST /api/stripe/attorney-checkout`; webhook sets `profiles.attorney_tier` from Stripe price ID; `POST /api/email/attorney-drip`; `lib/attorney/sendAttorneyDripStep.ts`; `components/attorney/AttorneyUpgradePrompt.tsx`; client cap enforcement in `grant-access` + `accept-request`.

**Apply on remote:** `20260529130000_attorney_drip_columns.sql` (after `20260529120000_sprint_import_attorney.sql`).

---

## Attorney weekly digest cooldown (2026-06-07)

**Migration:** `20260703120000_attorney_digest_sent_at.sql`

| Change | Detail |
|--------|--------|
| `profiles.attorney_digest_sent_at` | Timestamptz — last weekly digest email sent; 6-day cooldown for cron §10 |

**Code:** `GET /api/cron/notifications` §10 (Fridays, 6-day cooldown) → `POST /api/email/attorney-digest`; `lib/emails/attorney-digest-template.ts`, `lib/attorney/getAttorneyDigestData.ts`, `lib/attorney/sendAttorneyDigest.ts`. Content: document gaps (`getMissingDocumentAlerts` + `document_gap_dismissals`), pending `attorney_document_requests`, stale `matter_stage` (30+ days, not `complete`). Skips send when nothing actionable.

**Apply on remote:** `20260703120000_attorney_digest_sent_at.sql`.

---

## Projections empty state fix (2026-05-29) — code only

| Change | Files |
|--------|-------|
| Shared readiness check (birth year, retirement age, assets/income) | `lib/planning/projectionReadiness.ts` |
| Targeted empty state + inline `ProfileFieldPrompt` on partial data | `app/(dashboard)/projections/page.tsx`, `_projections-client.tsx`, `_components/ProjectionEmptyState.tsx` |
| Projection-only inline prompts (birth year + retirement age) | `lib/profile/profileFieldPromptDefs.ts` → `buildProjectionPlanningFields()` |
| TIER2 CTA adds `/scenarios` link | `lib/planning/planningEmptyState.ts` |
| Unit tests (5 cases) | `tests/unit/projectionReadiness.spec.ts` |

**No migration.** Fixes gap where users who filled deferred fields via `/scenarios` prompts still saw generic “Complete your profile” on `/projections`.

---

---

---

---

## Trial + assessment conversion (2026-05-27)

| Change | Files |
|--------|-------|
| Signup defaults `subscription_status = 'none'` (free Tier 1); Stripe-only Estate trial | `20260527130500_fix_signup_subscription_defaults.sql`, `lib/tiers.ts`, `app/(dashboard)/layout.tsx` |
| Assessment → recommended plan → `/billing?plan=` | `lib/assessment/recommendPlanFromScores.ts`, `app/(public)/assess/_assess-client.tsx`, `app/billing/` |

**Apply on remote:** `20260527130500_fix_signup_subscription_defaults.sql`

---

## Inline profile prompts (2026-05-27) — code only

| Change | Files |
|--------|-------|
| `ProfileFieldPrompt` + session dismiss + save-hidden anti-flash | `components/profile/ProfileFieldPrompt.tsx` |
| Partial PATCH merge on profile API | `lib/profile/mergeProfilePatch.ts`, `loadProfileSavePayloadForUser.ts`, `app/api/consumer/profile/route.ts` |
| SS + Scenarios wiring | `social-security/_social-security-page-client.tsx`, `scenarios/_scenarios-client.tsx` |
| Field defs; deduction prompt when `deduction_mode` null only | `lib/profile/profileFieldPromptDefs.ts` |
| E2E partial PATCH + ProfileFieldPrompt UI | `tests/e2e/consumer/consumer-profile-save.spec.ts`, `consumer-profile-field-prompt.spec.ts` |
| Go-live commands | `npm run test:e2e:go-live-profile`, `docs/GO_LIVE_E2E.md` |

**No migration.** Replaces interim `ProfileIncompleteInlinePrompt` from friction-reduction sprint.

---

## Friction reduction sprint (2026-05-27) — code only

| Change | Files |
|--------|-------|
| Import feature tier 1 (`FEATURE_TIERS.import = 1`); history UI Tier 2+ | `lib/tiers.ts`, `app/(dashboard)/import/page.tsx` |
| Slim profile minimum-complete (name, birth year, state, filing; spouse if applicable) | `lib/profile/buildHouseholdPayload.ts`, `lib/estate/profileGate.ts`, `app/(dashboard)/profile/_profile-client.tsx` |
| Inline profile prompts on `/social-security`, `/scenarios` | `components/profile/ProfileIncompleteInlinePrompt.tsx`, `lib/profile/profileInlinePrompts.ts` |
| Dashboard quick-add asset modal | `components/dashboard/QuickAddAssetModal.tsx`, `app/(dashboard)/_dashboard-client.tsx` |
| Wizard funnel instrumentation (`wizard_completed`, `wizard_abandoned`) | `app/(dashboard)/onboarding/wizard/_wizard-client.tsx`, `app/admin/funnel-tab.tsx` |

**No migration.** Wizard gate behavior unchanged (instrumentation only).

---

| Change | Files |
|--------|-------|
| Canonical ToS from code (`TERMS_OF_SERVICE_VERSION` `2026-06-02`) | `lib/legal/terms-of-service-sections.ts`, `lib/terms/getCanonicalTerms.ts`, `lib/terms/flattenLegalSections.ts` |
| `/api/terms/content`, `recordTermsAcceptance` use canonical terms | `app/api/terms/content/route.ts`, `lib/terms/recordTermsAcceptance.ts` |
| Sync legacy Estate Planner seed → My Wealth Maps in `app_config` | `supabase/migrations/20260527120000_sync_terms_app_config_mwm.sql` |

**Apply on remote:** `20260527120000_sync_terms_app_config_mwm.sql`

---

## TERMS-2/3/5 — billing checkout fixes (2026-05-29, code only)

| Change | Files |
|--------|-------|
| Trial checkout `no_payment_required` on terms fallback | `app/(auth)/terms/accept/page.tsx` |
| `trialing` in dashboard `hasAccess` | `app/(dashboard)/layout.tsx` |
| Stripe success → dashboard/profile | `app/api/stripe/checkout/route.ts` |
| Orphan auth → profiles repair script | `scripts/repair-orphaned-auth-user.ts`, `npm run repair:orphaned-user` |

**Shipped (2026-05-27):** TERMS-1 signup checkbox; Section F backfill banner (soft, non-blocking).

**No schema migration** (`terms_accepted_at` already in `20260331000001_profiles_terms.sql`).

---

## Stripe annual toggle guard (2026-05-28, code only)

| Change | Files |
|--------|-------|
| `isAnnualBillingConfigured()` / `hasPriceConfig()` | `lib/billing/stripePrices.ts` |
| Hide toggle when annual IDs missing | `BillingPeriodToggle.tsx`, billing + pricing clients |
| Server passes `annualBillingAvailable` | `app/billing/page.tsx`, `app/(public)/pricing/page.tsx` |

**No schema migration.** Prevents client crash when toggling annual without `STRIPE_PRICE_*_ANNUAL` env vars.

---

## Advisor dashboard tier fix (2026-05-28, code only)

| Change | Files |
|--------|-------|
| Dashboard uses resolved access tier | `app/(dashboard)/dashboard/_dashboard-body.tsx` — `consumerTier = access.tier` via `getUserAccess()` |
| Unlock banner tier check | same file — `isConsumerTier2` uses `access.tier === 2` |

**Effect:** Advisor-connected consumers (`advisor_clients` active/accepted) and `subscription_status = 'advisor_managed'` see Stage 3 golden path, direct estate links, and no unlock banner — matching sidebar and page gates.

**No schema migration.**

---

## Sprint 4 — consumer pricing (2026-05-28, code only)

| Change | Files |
|--------|-------|
| Price ID config + tier mapping | `lib/billing/stripePrices.ts` |
| Plan display catalog | `lib/billing/consumerPlanCatalog.ts` |
| Upgrade banner pricing lines | `lib/billing/upgradePricingCopy.ts` |
| Tier prices 29/79/149 | `lib/tiers.ts` (`TIER_PRICES`, `CONSUMER_PRICE_IDS` from env) |
| Checkout — period + 14-day Estate trial | `app/api/stripe/checkout/route.ts` |
| Webhook — tier from price ID, trialing status | `app/api/stripe/webhook/route.ts` |
| Billing UI — monthly/annual toggle | `app/billing/_billing-client.tsx`, `components/billing/BillingPeriodToggle.tsx` |
| Public pricing — toggle + new copy | `app/(public)/pricing/page.tsx`, `_pricing-consumer-plans.tsx` |
| Upgrade gates — new price copy | `app/(dashboard)/_components/UpgradeBanner.tsx` |

**Pricing:** Financial $29/mo ($290/yr) · Retirement $79/mo ($790/yr) · Estate $149/mo ($1,490/yr) · 14-day trial on Estate only. Price IDs from env (`STRIPE_PRICE_*`); legacy monthly IDs as dev fallback.

**No schema migration.**

---

## Golden Path — guided dashboard (2026-05-29, code only)

| Change | Files |
|--------|-------|
| Unified plan stages 1–4 | `lib/dashboard/determinePlanStage.ts` |
| Hero progress + next action | `components/dashboard/PlanProgressBar.tsx` |
| Stage-based section visibility | `_dashboard-client.tsx`, `_dashboard-body.tsx` |
| SetupProgressCard demoted | `SetupProgressCard.tsx` (detail in stage 1) |
| Removed unused 6-step builder | deleted `lib/dashboard/setupProgress.ts` |
| E2E smoke | `golden-path-show-all-tools.spec.ts`, `seed-golden-path-stage1.ts` |

**No schema migration.** `localStorage` key: `mwm_show_all_tools`.

---

## Estate execution checklist — Sprint 2 (2026-05-28)

| Change | Files |
|--------|-------|
| `estate_checklist_items` table + RLS | `20260528120000_estate_checklist_items.sql` |
| Task allowlist + trust task mapping | `lib/estate/estateChecklistTaskKeys.ts` |
| Unified builder (no new RPCs) | `lib/dashboard/buildEstateExecutionChecklist.ts`, `lib/dashboard/estateUpgradeHref.ts` |
| Consumer API | `GET` / `PATCH` `/api/consumer/estate-checklist` |
| Dashboard UI | `EstateExecutionChecklist.tsx`, `_dashboard-body.tsx`, `_dashboard-client.tsx` |
| Trust tab persistence | `TrustDocumentsPanel.tsx`, `my-estate-trust-strategy/page.tsx`, `_client.tsx` |

**Apply migration:** `supabase db push --include-all --yes` (or deploy pipeline).

**Estate preview UX (same release, pre-checklist):** `EstateCalloutCard` tier CTA; callout after intro; tier-aware conflict/estate links (`estateUpgradeHref`); personalized `/estate-tax` upgrade wall.

---

## Post-launch perf Sprint J — complete + estate-tax shells (2026-05-27, code only)

| Route | Files |
|-------|-------|
| `/complete` | `loading.tsx`, `error.tsx` |
| `/estate-tax` | `loading.tsx`, `error.tsx` |

---

## Post-launch perf Sprint 19a — deferred review fixes (2026-05-28, code only)

| Change | Files |
|--------|-------|
| Allocation save: `router.refresh()` only (no duplicate GET) | `_allocation-client.tsx` |
| Dashboard assessment history server prefetch | `loadAssessmentHistory.ts`, `AssessmentHistoryWidget.tsx`, `_dashboard-body.tsx` |
| Meeting Prep: instant brief from server seed; optional refresh | `MeetingPrep.tsx`, `MeetingPrepTab.tsx` |

---

| Change | Files |
|--------|-------|
| Route shells | `assets/loading`, `titling/loading+error`, `advisor/loading+error`, `my-estate-strategy/error` |
| Composition cache invalidation | `afterHouseholdWrite.ts` → `revalidateTag(household-composition-{id})` |

---

## Post-launch perf Sprint N — advisor tab perf (2026-05-28, code only)

| Change | Files |
|--------|-------|
| Batch roster alert counts | `rosterAlertCounts.ts`, `advisor/page.tsx`, `AdvisorAlertBadge.tsx` |
| Strategy tab hydrate gate | `StrategyTab.tsx` |

---

## Post-launch perf Sprint M — dashboard Suspense (2026-05-28, code only)

| Change | Files |
|--------|-------|
| Async dashboard body + Suspense | `dashboard/page.tsx`, `_dashboard-body.tsx` |

---

## Post-launch perf Sprint L — bundle + duplicate fetch (2026-05-28, code only)

| Change | Files |
|--------|-------|
| Recharts lazy-loaded on Monte Carlo | `MonteCarloCharts.tsx`, `_monte-carlo-client.tsx` |
| PDF renderer lazy on export click | `ExportPDFButton.tsx` |
| Dead `ProjectionsView` removed | deleted `_projections-view.tsx` |
| Estate planning dashboard server prefetch | `loadEstatePlanningDashboard.ts`, `EstatePlanningDashboard.tsx` |

---

## Post-launch perf Sprint K — consumer flow consistency (2026-05-28, code only)

| Change | Files |
|--------|-------|
| `router.refresh()` replaces full reload on P&C, my-estate-strategy base-case, advisor/attorney invite, Strategy tab base-case | `_pc-insurance-form-client.tsx`, `_my-estate-strategy-client.tsx`, `_advisor-client.tsx`, `StrategyTab.tsx`, `_attorney-client.tsx` |
| Trust-strategy strategy panel server hydrate | `ConsumerStrategyPanel.tsx`, `my-estate-trust-strategy/page.tsx` |
| Charitable CRUD via consumer API | `app/api/consumer/charitable-donations/route.ts`, `CharitableGivingDashboard.tsx` |

---

## Post-launch perf Sprint I — error boundaries (2026-05-27, code only)

| Area | Change |
|------|--------|
| **RouteErrorFallback** | Shared `app/(dashboard)/_components/RouteErrorFallback.tsx` |
| **error.tsx** | monte-carlo, allocation, scenarios, social-security, projections |

---

## Post-launch perf Sprint H — loading skeletons (2026-05-27, code only)

| Route | File |
|-------|------|
| `/monte-carlo` | `app/(dashboard)/monte-carlo/loading.tsx` |
| `/allocation` | `app/(dashboard)/allocation/loading.tsx` |
| `/scenarios` | `app/(dashboard)/scenarios/loading.tsx` |
| `/social-security` | `app/(dashboard)/social-security/loading.tsx` |
| `/projections` | `app/(dashboard)/projections/loading.tsx` |

---

## Post-launch perf Sprint G — sidebar billing links (2026-05-27, code only)

| Area | Change |
|------|--------|
| **sidebar-nav.tsx** | `billingHrefForNavItem()`; tier-locked leaves + group items link to billing |

---

## Post-launch perf Sprint F — profile gate consistency (2026-05-27, code only)

| Area | Change |
|------|--------|
| **requireHouseholdRecord** | `lib/estate/requireMinimumProfile.ts` — shared missing-household redirect |
| **Pages** | health-check, social-security, digital-assets, settings/attorney-access |
| **Trust-strategy** | Empty-state paragraph → `requireMinimumViableProfile` redirect |
| **Types** | `requireMinimumViableProfile` assertion; `ProfileGateHousehold.id` |

---

## Post-launch perf Sprint E — insurance/businesses form refresh (2026-05-27, code only)

| Area | Change |
|------|--------|
| **Insurance** | `_insurance-form-client.tsx` — local state + `router.refresh()` |
| **Businesses** | `_business-form-client.tsx` — same pattern |

---

## Post-launch perf Sprint D — advisor tab code-split + domicile dedupe (2026-05-27, code only)

| Area | Change |
|------|--------|
| **ClientViewShell** | `dynamic()` for Overview, Estate, Retirement, Tax, Notes; nav skeletons for all tabs |
| **DomicileTab** | Sync `domicileAnalysis` from props; removed mount `/api/domicile-analysis` fetch |

**Docs:** [MASTER_ARCHITECTURE.md § Advisor portal](./MASTER_ARCHITECTURE.md), [DECISION_LOG.md](./DECISION_LOG.md).

---

## Post-launch perf Sprint C — Scenarios lazy B/C fetch (2026-05-27, code only)

| Area | Change |
|------|--------|
| **Lazy activation** | `bActivated` / `cActivated` gates debounced B/C projection fetches |
| **localStorage** | Stored overrides set activated on load so returning users still get results |
| **UX** | `awaitingCalculation` hint on ScenarioEditor when not yet run |

**Docs:** [CONSUMER_FLOWS.md § Retirement modeling](./CONSUMER_FLOWS.md), [DECISION_LOG.md](./DECISION_LOG.md).

---

## Post-launch perf Sprint B — Monte Carlo + Allocation prefetch (2026-05-27, code only)

| Area | Change |
|------|--------|
| **Monte Carlo loaders** | `lib/monte-carlo/loadMonteCarloPrefill.ts`, `loadMonteCarloHistory.ts`, `loadMonteCarloAdvisorAssumptions.ts` |
| **Monte Carlo page** | Server prefetch → `initialPrefill`, `initialHistory`, `initialAdvisorAssumptions` on `MonteCarloClient` |
| **Monte Carlo API** | `/api/monte-carlo/prefill`, `GET /api/monte-carlo`, `GET /api/monte-carlo/advisor-assumptions` delegate to loaders |
| **Allocation loader** | `lib/allocation/loadAssetAllocationData.ts` |
| **Allocation page** | `initialAllocationData` prop; client skips mount fetch when hydrated |

**Docs:** [MASTER_ARCHITECTURE.md § Monte Carlo Workflow](./MASTER_ARCHITECTURE.md#monte-carlo-workflow), [DECISION_LOG.md](./DECISION_LOG.md).

---

## Post-launch perf Sprint A — advisor correctness (2026-05-27, code only)

| Area | Change |
|------|--------|
| **Advisor tab includes** | estate/tax/domicile/meeting-prep: `scenario` + `strategyLineItems` + `stateTax` where horizons built |
| **Strategy tab dedupe** | `strategyLineItems: false` in loader; `strategyLineItemsForHorizons()` in `lib/estate/strategyLedger.ts` |
| **Trust guidance** | `loadTrustWillGuidance(..., preloadedComposition?)` |
| **Meeting Prep** | Server `estateComposition`; `?tab=strategy` deep links; `router.refresh()` after recalculate |
| **Upgrade banner** | `getCachedComposition` in `loadUpgradeBannerHouseholdContext` |
| **Dashboard loading** | Estate Summary skeleton copy |
| **Notifications** | Trust-strategy POST gated by `sessionStorage` per household |

---

## Post-launch perf sprint (2026-05-27)

| Area | Change |
|------|--------|
| **StrategyTab hydration** | Server prefetch line items (advisor + consumer), strategy configs, gifting actuals when `tab=strategy`; `fetchStrategyLineItemsWithClient` / `fetchStrategyConfigsWithClient` in `lib/estate/strategyLedger.ts` |
| **SS prefetch** | `lib/social-security/loadSocialSecurityData.ts`; page passes `ssData`; API route reuses loader |
| **Setup progress** | Dashboard server `fetchSetupProgressCounts` → `initialSetupProgress` |
| **Charitable** | Trust-strategy page RPC + `CharitableGivingDashboard` `initialCharitableSummary` |
| **Dynamic import** | `ConsumerStrategyPanel` via `next/dynamic` on trust-strategy `_client.tsx` |
| **Notifications** | `createAdvisorStrategyNotifications` + `POST /api/consumer/advisor-strategy-notifications`; removed INSERT from trust-strategy `page.tsx` render |
| **Loading/error** | `my-estate-trust-strategy/loading.tsx`, `error.tsx`; `dashboard/error.tsx` |
| **Composition cache** | Migration `20260527180000_estate_composition_cache.sql`; `getCachedComposition` / `upsertCompositionCache`; recompute route writes both roles |

**Deploy:** `supabase db push` for `20260527180000` before expecting warm cache.

**Docs:** [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md), [DECISION_LOG.md](./DECISION_LOG.md).

---

## Pre-launch consistency fixes (2026-05-27, code only)

| Area | Change |
|------|--------|
| **Tier gating** | `FEATURE_TIERS` aligned to page gates; `hasFeatureAccess` + `featureUpgradeTier` on sidebar and all gated pages |
| **Redirects** | `/digital-assets`: auth `/login`; missing household → `/profile?required=true` |
| **Advisor Strategy tab** | Server passes `advisoryMetricsInput` (`liquidAssets`, `ilitDeathBenefit`) — removes `grossEstate * 0.3` placeholder |
| **Advisor composition** | `calculate_gifting_summary` before `classifyEstateAssets(..., lifetimeGiftsUsed)` — advisor exemption matches consumer for lifetime gifts |
| **Accept/reject** | `my-estate-trust-strategy/_client.tsx` checks `res.ok`; error state; no optimistic update on failure |
| **Cache** | `revalidatePath` on strategy-line-items POST/PATCH/DELETE; growth-assumptions; allocation-targets |

**Docs:** [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md), [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md).

---

## Strategy sandbox → actuals (2026-05-27, no migration)

**Code only** — `strategy_line_items.confidence_level` enum unchanged; application contract tightened.

| Area | Change |
|------|--------|
| **Consumer default** | `saveConsumerStrategyLineItem` default `illustrative`; SLAT/ILIT/charitable forms + modeled chips write sandbox first |
| **Promote** | `PATCH /api/strategy-line-items` `{ id, promoteConfidence: true }` — consumer-owned rows only; `illustrative` → `probable` |
| **UI** | `StrategySandboxSection` + `StrategyConfirmedSection` on Transfer Strategies; `partitionStrategyLineItems` in `lib/consumer/strategyLineItemViews.ts` |
| **Labels** | `lib/strategy/strategyLabels.ts` shared by sandbox components + `StrategyRecommendationPanel` |
| **Roth** | `/roth` **Use in Transfer Strategies →** saves illustrative `roth` row; navigates `?tab=strategies&openPanel=roth` |
| **Docs** | [MASTER_ARCHITECTURE.md § Strategy sandbox contract](./MASTER_ARCHITECTURE.md#consumer-and-advisor-interaction), [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) Transfer Strategies |

**Advisor path unchanged:** `/api/advisor/strategy-recommendation` + consumer `PATCH /api/consumer/strategy-recommendation` for accept/decline.

**Commits (intended):** `fix(strategy): SLAT and ILIT illustrative` · `feat(strategy): sandbox → actuals UI` · `feat(roth): Roth optimizer handoff`

---

## Strategy reversal lifecycle (2026-05-31)

**Migration:** `20260531120000_strategy_line_items_reversal.sql` — `consumer_withdrawn`, `withdrawn_at`, `reversal_reason`, `reversed_from`, `previously_active_at`.

**API:** `PATCH /api/strategy-line-items` with `action`: `promote` | `return_to_sandbox` | `demote` | `withdraw` (consumer household owner only).

**UI:** `ReversalModal`, `StrategyConfirmedSection` reversal actions, gifting plan card + `GiftDeleteWarningModal`, advisor Step 3 **Withdrawn by Client**, consumer Strategy History collapsible.

---

## Pre-launch RLS household scope (2026-05-27)

**Migration:** `20260527150000_prelaunch_rls_household_scope.sql`

- Replaces `auth.uid() IS NOT NULL` policies on `gst_ledger`, `liquidity_analysis`, `monte_carlo_results`, `domicile_schedule`, `domicile_analysis` (advisor SELECT), `strategy_configs` (4 loose advisor policies + tighten manage policy).
- Advisor scope: `advisor_clients` → `households.owner_id` with `status = 'active'` AND `accepted_at IS NOT NULL`.
- App: `POST/DELETE /api/advisor/gst-entry` (advisor_clients validation + `createAdminClient` insert); `SLATILITPanel` no longer writes `gst_ledger` from browser.

**Verify on prod:** `scripts/verify-loose-rls-policies.sql` → zero rows. Post-fix export: `docs/audits/rls-policies-post-fix-2026-05-27.csv`.

**Commits:** `1f41ce1` (migration), `7cab1be` (`/api/advisor/gst-entry` + `SLATILITPanel`), `35b0738` (`MIGRATION_TEMPLATE.sql` advisor join comment).

---

## Security — migration template + grant/RLS audits (2026-05-27, no migration)

**Code/docs only:**

- `supabase/MIGRATION_TEMPLATE.sql` — standard `CREATE TABLE` + explicit `GRANT` + RLS policies (future-proof vs Supabase Oct 2026 default); advisor join uses `client_id` → `households.owner_id` (`35b0738`)
- `scripts/audit-table-grants-rls.sql`, `scripts/audit-rls-policies.sql`, `scripts/audit-rls-policies-risk.sql`
- `docs/audits/table-grants-rls-2026-05-27.csv` — 119 tables; all `authenticated`/`service_role`/`anon` grants present; RLS enabled — **no grant fix migration**
- `docs/audits/rls-policies-*.csv` — pre-launch data-isolation baseline

---

## Profile layout redesign — two-column people (2026-05-27, no migration)

**Code only:** `app/(dashboard)/profile/_profile-client.tsx` — layout/typography only.

- Page heading navy `text-[#0F1B3C]`; form container `max-w-2xl`
- **Household** card (was “Personal Information”) — Full Name, Email, Household Name
- **People** — Person 1 / Person 2 columns when `hasSpouse`; live headers from `person1Name` / `person2Name`; spouse checkbox below grid
- **Household Planning** (was “Tax & Location”) — filing status + primary state in one row; merged Scenarios/Allocation callout
- Welcome banner, `ProfileRequiredBanner`, wizard intro + wizard household card unchanged
- Save: `PATCH /api/consumer/profile` unchanged; `ProfileSavePayload` unchanged
- E2E: `consumer-profile-spouse-layout.spec.ts` (layout smoke §3.1b–3.1c)

**No schema change.**

---

## PROF-1/2 — Profile cleanup: assumption UI homes (2026-05-27, no migration)

**Code only (four commits):**

| Commit | Scope |
|--------|--------|
| PROF-1 | Remove growth rate inputs from Profile; pass-through in `buildHouseholdPayload` + profile API |
| PROF-2 | Inflation → Scenarios (`PATCH /api/consumer/growth-assumptions`); risk → `/allocation` (`PATCH /api/consumer/allocation-targets`) |
| PROF-3 | Consumer copy: RE/business growth, `ProjectionAssumptions` → Scenarios source links |
| DOC-1 | `MASTER_ARCHITECTURE.md` assumption reference; `DATABASE_SCHEMA_REFERENCE.md` field ownership |

**No schema change** — `households` columns unchanged; only which UI writes them.

---

## ENG-2 — Growth assumptions engine + UI (2026-05-27)

**Migrations (apply in order; redeploy `estate-monte-carlo` edge function before app deploy):**

| Migration | Purpose |
|-----------|---------|
| `20260527130000_household_growth_assumptions.sql` | `households.growth_assumptions` jsonb; backfill `real_estate` 4.5, `business` 7.0 |
| `20260527130100_advisor_growth_assumption_overrides.sql` | `advisor_projection_assumptions.real_estate_growth_pct`, `business_growth_pct` |
| `20260527130200_insurance_cash_value_growth.sql` | `insurance_policies.cash_value_growth_rate` default 0 |
| `20260527130300_income_growth_rate.sql` | `income.annual_growth_rate` default 0 |
| `20260527130400_bump_staleness_after_growth_assumptions.sql` | `UPDATE households SET updated_at = NOW()` where `base_case_scenario_id` IS NOT NULL — forces regen on next visit |

**Commits (bisect-friendly, one per ENG item):**

| Commit | Scope |
|--------|--------|
| `5589b89` | ENG-2A — RE/business growth fix; estate MC dynamic return/vol |
| `51fff01` | ENG-2B — `growth_assumptions` jsonb, Scenarios/Projections UI, advisor overrides |
| `604b1b9` | ENG-2C — insurance cash value growth |
| `9101ac5` | ENG-2D — income `annual_growth_rate` |
| `8e90fa4` | ENG-2E — MC alignment surfacing |

**Deploy order:** `supabase db push` → `supabase functions deploy estate-monte-carlo` → push app → migration `20260527130400` (or include in same `db push`).

**Staleness note:** Backfill does not invalidate cached `projection_scenarios` rows. After deploy, users see new rates on Scenarios save (touches `updated_at`) or on next dashboard/strategy/advisor visit once staleness bump migration runs.

**Code (summary):** `lib/types/growthAssumptions.ts`, `components/projections/GrowthAssumptionInputs.tsx`, `app/api/consumer/growth-assumptions/route.ts`, engine changes in `projection-complete.ts`.

---

## Nav consistency — homepage, billing, utility pages (2026-05-27, no migration)

**Code only:**

- **Homepage:** `app/page.tsx` → `app/(public)/page.tsx`; inherits `PublicNav` + footer from `(public)/layout.tsx` (removed inline nav and duplicate footer).
- **Billing:** `app/billing/layout.tsx` + `MinimalAuthNav` (wordmark + back to dashboard); removed redundant back links from `_billing-client.tsx`.
- **Utility/token flows:** `WordmarkOnly` on layouts for `invite`, `beneficiary`, `share/estate-flow`, `auth/confirm-email`, `attorney-invite`, `claim-listing`.
- **Shared components:** `components/nav/MwmWordmark.tsx`, `MinimalAuthNav.tsx`, `WordmarkOnly.tsx`.
- **Docs:** `MASTER_ARCHITECTURE.md` — Layout and Navigation Reference table.

**Unchanged:** `(dashboard)`, `advisor`, `(public)/education`, `(auth)`, `(attorney)`, `(advisor-tools)`, `admin` layouts.

**No migrations.**

---

## Client Summary PDF brand upgrade (2026-05-27, no migration)

**Code only (`components/pdf/EstatePlanPDF.tsx`, `app/(dashboard)/print/_print-client.tsx`, `app/api/export-estate-plan/route.ts`):**

- **ConsumerEstatePlanPDF** aligned to Attorney Summary visual standard: navy header `MY WEALTH MAPS — CLIENT ESTATE SUMMARY`; metadata uses client name in Prepared By; gold purpose callout; Household Profile grid; Estate Plan Readiness without letter grade (`N / 100 — stage` + progress bar); Document Status with **Not on file** / **On file**.
- **`/api/export-estate-plan`:** consumer role now receives tax + assets payload (`includeFinancialProfile`) for household profile figures in Client Summary.
- **`/print` UI:** updated export card copy; gold **New** badge on Attorney Summary; data-ownership note at page bottom.
- **AttorneyEstatePlanPDF:** unchanged.

**No migrations.**

---

## UX-5 — Strategy tab restructure (2026-05-26, no migration)

**Code only (advisor Strategy tab layout; zero consumer routes):**

- Removed redundant full-width `SLATILITPanel` + `AdvancedStrategyPanel` below the three-step workflow; scroll helpers target `#strategy-opportunities` (Step 2).
- Renamed "Combined Strategy View" → **Strategy Horizon** (`id="strategy-horizon"`); section repositioned below Step 3.
- **Step 3** → "Recommendations & Impact"; `StrategyImpactPanel` at top (Current / Projected / With Accepted tax comparison from `advisorHorizons` + `advisorHorizonsProjected`; `outsideCertainProbableTotal + outsideIllustrativeTotal`, `stateTax`).
- `id="strategy-opportunities"` on Step 2 wrapper for scroll target.

**No engine changes. No API changes. No migrations.** Inline modeling (UX-4) is the sole strategy entry path.

---

## UX-5b — Remove manual strategy reductions from CompositeOverlay (2026-05-26, no migration)

**Code only (`components/advisor/CompositeOverlay.tsx`; zero consumer routes):**

- Removed `custom` mode: `customStrategies` state, "This Household" button, "Enter Strategy Reductions" form.
- Default mode: `recommendations` (loads via `/api/advisor/strategy-recommendations-read`).
- Mode type narrowed: `recommendations` | `30m` | `100m`.
- Empty state copy references Step 2 inline modeling.
- Unchanged: recommendations fetch/list, `30m`/`100m` archetypes, `advisorHorizons` boundary snapshot, `StrategyHorizonTable` sibling.

**No API changes. No migrations.**

---

## ENG-1 — Estate/Tax strategy inclusion audit (2026-05-26, no migration)

**Code only (advisor Estate/Tax parity; zero consumer route changes):**

- **Audit conclusion:** `calculate_estate_composition` filters strategy rows by `source_role` only, so one RPC call cannot express `(consumer rows OR accepted advisor rows)`.
- **Canonical actual set:** `lib/advisor/strategyMappers.ts` remains source of truth (`actual = consumer + advisor where consumer_accepted=true`).
- **Estate tab (Option B):** advisor page now builds `advisorEstateComposition` from `advisorHorizons.today` and passes it through `ClientViewShell`; `EstateCompositionCard` adds additive `horizonComposition` override for advisor display parity.
- **Outside strategy total source:** advisor composition uses horizon `outsideCertainProbableTotal + outsideIllustrativeTotal` (current output shape) for accepted-strategy inclusion.
- **Indicators:** Estate and Tax tabs show a subtle “Includes $X in accepted strategies” indicator when applicable.
- **Tax tab verification:** current-law federal/state were already horizon-driven; stress-test (`no_exemption`) path unchanged.

**No RPC changes. No migrations. No engine changes.** Consumer composition path (`classifyEstateAssets(..., 'consumer')`) unchanged.

---

## UX-4 — Inline strategy modeling in Opportunities (2026-05-26, no migration)

**Code only (advisor Strategy tab Step 2; zero consumer routes):**

- **Section A:** `strategyCatalog.ts` — `annual-gifting` → `annual_gifting`; catalog extended to 11 strategies (CRT, CLAT, Liquidity, Roth, Revocable Trust); `deriveHighlightedStrategies` uses `annual_gifting` + highlights `liquidity` when coverage &lt; 1.5x.
- **Section B:** `StrategyTab.tsx` — `inlineStrategyId`, `catalogToPanel.ts` (`cst` catalog id → chip `credit_shelter_trust`), bundled `inlinePanelProps` `{ slatIlit, advanced }`; inline `onRecommend` → `loadConsumerData()` + `router.refresh()` + row collapse.
- **Section C:** `SLATILITPanel` + `AdvancedStrategyPanel` — additive `initialActivePanel?`, `onRecommend?` (SLAT/ILIT: two POST handlers; Advanced: single `useRecommendAdvanced` / `toggle` path for all chips). Full-width instances below three-step workflow unchanged.
- **Section D–F:** `InlineStrategyPanel`, `StrategyOpportunityRow` expand toggle (replaces scroll-only `ModelStrategyButton`); `OpportunitiesPanel` `isSent` from advisor `strategy_line_items` (`strategy_source` = catalog id, including `cst`).
- **Deleted:** `ModelStrategyButton.tsx`.

**No new migrations, engines, or API routes.** `strategy_source` strings and `POST /api/advisor/strategy-recommendation` unchanged.

---

## UX-3 — Strategy tab restructure (2026-05-26, no migration)

**Code only (advisor Strategy tab; zero consumer routes):**

- **Section A:** `lib/advisor/advisoryMetricSeverity.ts` — four-state severity (`●` / `!` / `✓` / `—`); `getActiveIndicatorKeys()` max 2; `StrategyAlertBanners` (red liquidity &lt; 1.0x before amber exemption); removed `!!` from metric cards.
- **Section B:** `components/advisor/strategy/StrategyTabContent.tsx` — three steps: Situation (`SituationMetricsGrid`) → Opportunities (`OpportunitiesPanel` + catalog) → Recommendations (`RecommendationsPanel` pending/accepted/declined). Combined Strategy / SLAT·ILIT / Advanced / Monte Carlo unchanged below.
- **Section C:** `lib/featureFlags.ts` (`NEXT_PUBLIC_ADVISOR_BENCHMARKS`); `lib/advisor/benchmarks.ts` + `BenchmarkBadge` (off by default).
- **Section D:** Client strategy questions in Step 3 (same `strategyQuestions` feed as Overview AF-1).
- **Data:** `fetchStrategyLineItems('advisor')` extended with `id`, `consumer_accepted` / `consumer_rejected`, timestamps for recommendation rows.
- **Meeting Prep (same deploy):** `meetingPrepBriefFromHorizons` — tax brief uses `advisorHorizons` + full horizon strip.

**No new migrations or API routes.** `calculateAdvisoryMetrics` / `getCachedAdvisoryMetrics` unchanged — UI reorganization only.

---

## Advisor tax parity — Tax / Domicile / Strategy (2026-05-26, no migration)

**Code only:**

- **Root cause:** `FederalStateWaterfall` recomputed state tax locally while horizons used `calculateStateEstateTax` via `buildStrategyHorizons` — could show $0 WA tax when brackets path failed while State Tax Detail showed correct horizon values. Year table uses `outputs_s2_first` (survivor timeline), so later years can exceed “today” gross estate.
- **Fix:** Tax + Domicile tabs pass `stateTaxFromHorizon` / `horizonTodayStateTax` into waterfall and `StateTaxPanel`; timeline + Today vs At death labels; `isMFJFilingStatus()` replaces `filing_status === 'mfj'` on advisor Strategy, Tax, Domicile tabs and `GET /api/advisor/strategy-tab`.
- **Canonical sources:** `lib/my-estate-strategy/horizonSnapshots.ts` + `lib/calculations/stateEstateTax.ts`; UI must not recompute current-law state tax when horizon values exist.

**Follow-up:** Meeting Prep horizon alignment shipped in UX-3 commit. **Still open:** `estate-tax-projection.ts` death-year rows / PDF-Gifting display `'mfj'` checks.

---

## UX-2 — Advisor portal UX + gap workflow (2026-05-26)

**Migration:** `20260626120000_advisor_gap_statuses.sql`

- Table `advisor_gap_statuses` — advisor-private gap workflow (`open` | `discussed` | `deferred` | `resolved`); unique `(advisor_id, client_id, gap_key)`; RLS `advisor_id = auth.uid()`.
- API: `GET` / `PATCH` `/api/advisor/gap-status`.
- `gap_key` from stable keys in `app/advisor/clients/[clientId]/_utils.ts` `computeGaps()`.

**Code (pass 1 + continuation, no further migrations):**

- Brand: navy advisor header, gold tab underlines (`app/advisor/layout.tsx`, client tab shell).
- Tab-scoped datasets: `advisorDatasetIncludeForTab()` in `lib/advisor/loaders.ts`.
- Overview: `PlanStatusCard`, critical-gap banner, `GapStatusSelector`.
- Estate: `EstateCompositionCard` advisor variant — collapsed outside estate when empty; prominent tax callout; amber no-transfer banner.
- Strategy: `getCachedAdvisoryMetrics` (`unstable_cache`, 120s, tag `household-metrics-{householdId}`); 6-card grid + CTA when modules not run; warning `!` cap at 2; low-exemption banner.
- Cache invalidation: `revalidateTag` in `afterHouseholdWrite`.
- Tax tab: “Sunset / No Exemption Stress Test” label.

**Docs:** [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) · [PERF_SPRINT_P1.md](./archive/sprints/PERF_SPRINT_P1.md)

---

## Advisor portal performance (2026-05-26) — Roster + client load (no schema migration)

**Code only:**

- `lib/advisor/rosterNetWorth.ts` — batched assets/liabilities/real estate/business/insurance reads for `/advisor` roster (replaces N× `calculate_estate_composition` per client).
- `app/advisor/clients/[clientId]/page.tsx` — parallel staleness + composition + `loadAdvisorClientDatasets`; parallel link/household; non-blocking access log and strategy-question mark-read.
- `lib/advisor/loaders.ts` — state estate/income tax queries scoped to advisor states + projection years; `skipGlobalTaxTableStaleness` on advisor client staleness check.

**Commit:** `8c526de` · **Detail:** [PERF_SPRINT_P1.md § Advisor portal](./archive/sprints/PERF_SPRINT_P1.md#advisor-portal-quick-wins-2026-05-26)

---

## Sprint NAV-1 (2026-05-26) — Sidebar active route indicator (no schema migration)

**Code only:** `sidebar-nav.tsx` — `isNavItemActive()` / `groupContainsActiveItem()` via `usePathname()`; planning groups with an active child auto-expand (fixes Financial Planning stuck collapsed in `DEFAULT_CLOSED_GROUPS`); `/dashboard` exact match only; query-string hrefs match on path segment.

**Commit:** `be92947`

---

## Sprint OB-3b (2026-05-26) — Sidebar unlock + layout household query (no schema migration)

**Code only:**

- Removed legacy `DashboardIntroSection` setup checklist; `SetupProgressCard` is the only dashboard setup UI.
- **Financial Planning** sidebar items: all `FEATURE_TIERS` keys at tier 1; group exempt from `isLockedUser` (data entry must work before/without household row).
- **Security**, **My Advisor**, **Manage Subscription**: never gated by `isLockedUser`.
- **My Advisor:** onboarding contextual note when `!connection && !wizardComplete && !pendingRequest`.
- **Bugfix:** `getDashboardLayoutContext` no longer selects non-existent `households.date_of_birth_1` (Postgres `42703` → `hasHousehold` always false → entire Financial menu locked). Primary DOB is `person1_birth_year` only.

**Commits:** `6d2bff3`, `1660f27`, `d50a982` (household query + master docs)

---

## Sprint SU-1 (2026-05-25) — Superuser sidebar (no schema migration)

**Code only:** `isSuperuser` prop on consumer `SidebarNav`; `isLockedUser` staff bypass (`!isSuperuser && !isAdvisor && !isAdmin`); Advisor Portal visible for `role === 'advisor' || isAdmin || isSuperuser`; middleware `is_admin` → superuser alignment.

**Commit:** `3c0d28b`

---

## Sprint OB-3 (2026-05-25) — Setup progress + wizard gate (no schema migration)

**Code only:** `GET /api/consumer/setup-progress`; `SetupProgressCard`; wizard gate uses `checkHouseholdHasData` + `wizardGateExemptPrefixes`; Tier 1 import upload during onboarding (UI gate only).

**Commit:** `3376134`

---

## Sprint AF-1 (2026-05-25) — Consumer strategy questions (no schema migration)

**Code only:** `POST /api/consumer/ask-advisor` inserts advisor notification type `consumer_strategy_question` via `create_notification` RPC (`p_cooldown: '0 seconds'`). Metadata: `strategy_type`, `strategy_name`, `client_id`, `household_id`, `plan_url`.

**Commit:** `a255616`

---

## Sprint OB-1 (2026-05-25) — Onboarding wizard fields

**Migration:** `20260526000000_onboarding_wizard_fields.sql` — `profiles.onboarding_wizard_completed_at` + extended household/profile fields for wizard.

**Commits:** `b1c7b49`, `fd00b69`

**Prod:** Apply migration before deploying OB-1 code ([LAUNCH.md](./archive/LAUNCH_CHECKLIST.md)).

---

## `handle_new_user` trigger (2026-05-25) — signup profile creation

**Migration:** `20260526000001_handle_new_user_trigger.sql` — canonical `handle_new_user()` + `on_auth_user_created` on `auth.users`. Inserts `profiles` with `trial_started_at` (supersedes older triggers using `trial_ends_at`).

**Commit:** `1133b4f`

**Prod:** **Required before open signups** — without trigger, new users may have no `profiles` row.

---

## Import expansion + attorney workflow (2026-05-29)

**Migration:** `20260529120000_sprint_import_attorney.sql`

| Change | Detail |
|--------|--------|
| `legal_documents` | `doc_status` (`draft`, `pending_execution`, `executed`, `recorded`, `superseded`, `uploaded`); `executed_date`; `status_notes` |
| `document_gap_dismissals` | `(household_id, attorney_id, gap_key)` unique; attorney-dismissed intake gaps |
| `profiles.attorney_tier` | `int` default 0 — free (3 clients) / Starter (15) / Growth (50) |

**Import code (no new financial tables):** `real_estate` added as import commit target only; uses existing `real_estate` table.

**APIs:** `PATCH /api/documents/[id]/status`; `POST /api/attorney/gap-dismissals`.

**Docs:** [SPRINT_IMPORT_ATTORNEY.md](./archive/sprints/SPRINT_IMPORT_ATTORNEY.md), [DECISION_LOG.md](./DECISION_LOG.md).

---

## Session cleanup (2026-05-25) — FK dependency fixes for deleteUser

Fixed `lib/compliance/deleteUser.ts` — three tables were missing from
`FK_TABLES_TO_USER`, causing Auth hard-delete failures during staging cleanup:

- **`firms`** (`owner_id`) — `firms_owner_id_fkey` blocked deletion
- **`firm_members`** (`user_id`, `invited_by`) — `firm_members_user_id_fkey` blocked deletion
- **`change_log`** (`changed_by`) — `change_log_changed_by_fkey` blocked deletion

All added to `FK_TABLES_TO_USER` and `DELETION_ORDER` (via FK map).

**Also hardened in same session** (`aea4bf6`, `3cdd9b5`):

- Orphaned Auth users (no `profiles` row) → Auth delete + audit log (no early return)
- `deleteAuthUserWithFallback()` — hard delete, soft delete fallback, post-delete verify
- `verifyDeletion()` — post-deletion row-count check on high-value tables
- `scripts/verify-deletion.ts` — `npm run verify:deletion -- --email …`
- `scripts/cleanup-test-accounts.ts --purge-unprotected` — go-live auth purge (`npm run cleanup:purge`)
- `scripts/cleanup-test-accounts.ts --rolobe` — legacy `@rolobe.resend.app` retirement
- `scripts/verify-drip-sequence.ts` — `npm run verify:drip` (replaces manual rolobe inbox check)

**Auth table clean:** **10 accounts** (4 real + 6 `@mywealthmaps.test`) after go-live purge 2026-06-07.
All `@rolobe.resend.app` accounts deleted; soft-deleted scrambled accounts hard-deleted.

---

## E2E test identity reset v2 (2026-05-25) — scripts only (no schema)

- **`scripts/e2e-test-identities.ts`** — canonical `@mywealthmaps.test` emails, `E2eTest!2026Mwm`, referral codes `e2eadv01` / `e2eatt01`
- **`scripts/seed-e2e-fixtures.ts`** + **`seed-e2e-lib.ts`** — master seed; prints `.env.test`
- **`scripts/prune-e2e-household-artifacts.ts`** — cleanup Playwright rows
- **Docs:** [E2E_TEST_RESET.md](./E2E_TEST_RESET.md), `.env.test.example`
- **npm:** `seed:e2e`, `seed:e2e:fast`, `prune:e2e`

---

## Playwright complete E2E suite (2026-05-25) — docs + tests (no schema)

**Scope:** Expanded Playwright from ~51 core tests to **253** across consumer (137), advisor (45), public (59), attorney (2), import-unit (7). New specs: route regression, sidebar contract, profile/UI saves, health-check wizard, family CRUD, titling on real assets, billing, digital assets, life events, terms accept, all event slugs, referral track API, attorney portal, advisor RMD/newsletter kit.

**Docs:** [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md), [CONSUMER_FLOWS.md §7](./CONSUMER_FLOWS.md#7-e2e-map-living-contracts), [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md), [E2E_RELEASE_TEST_PLAN.md](./E2E_RELEASE_TEST_PLAN.md).

**Staging verify (`--workers=1`):** consumer 127 pass / 5 skip; advisor 45 pass; public 57 pass / 2 skip. Attorney project requires `scripts/seed-test-attorney.ts` on target DB.

**Commands:** `npm run test:e2e:complete`, `test:e2e:consumer`, `test:e2e:advisor`, `test:e2e:public`, `test:e2e:attorney`.

---

## Multi-state privacy (2026-06-20) — engineering draft; counsel redline pending

**Migration:** `20260721120000_privacy_requests_appeal_due_at.sql` (pending prod)

- **`privacy_requests.appeal_due_at`:** set when admin marks status `appealed` (+60 days); compliance cron alerts within 7 days

**Migration:** `20260720120000_privacy_requests_appealed_status.sql` (pending prod)

- **`privacy_requests.status`:** adds `appealed`; index `idx_privacy_requests_due_at` includes appealed in open-request filter
- **Policy:** `lib/legal/privacy-policy-sections.ts` v `2026-06-20` + `lib/legal/privacy-policy-addenda.ts`
- **GPC:** `lib/privacy/globalPrivacyControl.ts` + middleware cookie
- **Emails:** `lib/email/privacyRequestDecisionEmail.ts` (denial + appeal instructions)
- **Docs:** `docs/legal/COUNSEL_PRIVACY_REVIEW.md`, `PRIVACY_COUNSEL_ENGINEERING_MATRIX.md`

**Post-counsel engineering:** see [PRIVACY_COUNSEL_ENGINEERING_MATRIX.md](./legal/PRIVACY_COUNSEL_ENGINEERING_MATRIX.md) — conditional work by counsel answer (MHMD, GPC consumption, assess consent checkbox, self-service export, etc.).

---

## Sprint C-7 (2026-05-25) — Compliance reminders + privacy requests ✅ LIVE

**Migrations:** `20260625170000_sprint_c7_privacy_requests.sql` (applied prod)

- **`privacy_requests`:** five WCPA rights; `due_at` DEFAULT (`now() + 45 days`) — not GENERATED (Postgres immutability); consumer INSERT at `/settings/security`
- **Cron:** `GET /api/cron/compliance-reminders` (8am UTC) → `COMPLIANCE_EMAIL` (`avoels@comcast.net`); no email when all clear
- **APIs:** `POST /api/consumer/privacy-request`; admin `GET view=privacy`, `PATCH` status
- **Commits:** `ddbf079`, `1ce9110` (`due_at` migration fix)

---

## Sprint C-6 (2026-05-25) — Data deletion & WCPA compliance ✅ LIVE

**Migration:** `20260625120000_sprint_c6_deletion_compliance.sql` (applied prod) — **commits `4d9571e`, `01b997a`**

- **`deletion_audit_log`:** append-only audit trail for all deletions (reason, initiated_by, row counts, success)
- **`deletion_schedule`:** pending/executed/cancelled automated deletions; indexed on `scheduled_for` where `status=pending`
- **Code:** `deleteUser.ts`, webhook schedule + plan-change guards, `process-deletions` cron, admin Data & Compliance tab, `gdpr-delete-user.ts` CLI

---

## Sprint F-2 (2026-06-02) — Import UX & Intelligence

**Migration:** `20260602150000_sprint_f2_import_traceability.sql`

- `assets`, `liabilities`, `income`, `expenses`: `ingestion_job_id` uuid column added (nullable; set when row created via import; enables traceability + undo)
- `ingestion_jobs`: `header_row_index` integer, `sheet_name` text columns added
- Indexes: `idx_[table]_ingestion_job_id` on all four financial tables

**Features:**

- Header row auto-detection (scans first 20 rows, scores against aliases)
- Excel sheet picker (multi-sheet workbooks)
- Inline row editor at review step (edit/delete rows before commit)
- Duplicate detection with skip/import-all options
- Post-import deep link to view imported rows
- `ingestion_job_id` tagged on all committed rows
- Richer alias matching (substring + expanded broker/accounting terms)
- Pending import delete/cancel (`DELETE /api/import/jobs/[id]`)

**Apply migration before deploy** — commit route writes `ingestion_job_id`.

**Tests (`a344032`):** `npm run test:import:unit` (7); `npm run test:import:api` (8). Fixtures in `tests/fixtures/import/`.

---

## Sprint F-1 — Import feature (2026-06-02)

**Migration:** `20260602140000_sprint_f1_ingestion_jobs.sql` — **commits `d3400b1` → `b5bb0b1`**

- **`ingestion_jobs` table:** 14-column final schema — `file_name` (text NOT NULL), `file_type` (`csv` \| `xlsx` NOT NULL), `owner_id`, `household_id`, `status`, `detected_table`, `headers`, `rows`, `field_map`, `row_count`, `error_message`, `created_at`, `committed_at`
- **Production cleanup:** dropped legacy duplicate columns; consolidated `original_filename` → `file_name`, `source_format` → `file_type`
- **RLS:** owner-scoped ALL policy
- **Indexes:** `owner_id`, `created_at DESC`
- **Verified:** CSV parse → field mapping → commit 4 asset rows → `status = committed`

---

## Sprint P-2 — Recommendations cache (2026-06-02)

**Migration:** `20260602130000_sprint_p2_recommendations_cache.sql` — **commit `47a38f3`**

**Schema change:**

- `estate_health_scores.recommendations` jsonb DEFAULT `'[]'::jsonb — cached output of `generate_estate_recommendations` RPC

**Apply:** Run in Supabase SQL Editor or `npx supabase db push` before deploying code that selects this column.

**Code (same commit):** Recompute persists recommendations; dashboard reads cache; projections cache-first in `loadProjectionData`; layout auth dedup via `getDashboardLayoutContext`. See [PERF_SPRINT_P1.md § Sprint P-2](./archive/sprints/PERF_SPRINT_P1.md#sprint-p-2--pre-launch-refactors).

---

## Sprint P-1 — Performance indexes (2026-06-02)

**Migration:** `20260602120000_sprint_p1_indexes.sql` — **commit `5c24160`**

**Indexes added (confirmed missing in prod Query B audit):**

- `idx_assets_owner_id` on `public.assets (owner_id)`
- `idx_liabilities_owner_id` on `public.liabilities (owner_id)`

**Apply:** Applied in production 2026-06-02. Repo migration for other environments via `npx supabase db push`.

**Code (same commit):** Dashboard `Promise.all`; advisor conflict cache read; recompute debounce; `next/font`; notification server count. See [PERF_SPRINT_P1.md](./archive/sprints/PERF_SPRINT_P1.md).

---

## Sprint C-5 — Privacy Policy + Terms of Service (2026-06-02)

**No schema change.**

- **Commits:** `2e1dff3`, `695a860`
- **Routes:** `/privacy` (WCPA structure), `/terms` (full ToS); post-checkout accept at `/terms/accept`
- **Components:** `components/legal/LegalDocumentLayout.tsx`, `components/layout/LegalFooterLinks.tsx`
- **Content:** `lib/legal/privacy-policy-sections.ts`, `lib/legal/terms-of-service-sections.ts`
- **SEO:** `app/sitemap.ts`, `app/robots.ts` include `/privacy`, `/terms`
- **Manual remaining:** [LAUNCH.md](./LAUNCH.md) — 3 TODO placeholders; counsel sign-off; email aliases

---

## Sprint C-4 — Billing disclosures (2026-06-02)

**No schema change.**

- **Commit:** `462bda9`
- **Copy:** `lib/compliance/billing-disclosures.ts` — preCheckout, activeSubscription, cancellationConfirm, renewalReminderEmail
- **Surfaces:** `app/billing/_billing-client.tsx`, pricing page; cancel via Stripe portal; `invoice.upcoming` webhook renewal reminder
- **Manual remaining:** Stripe Dashboard config + production walkthrough — [BILLING_DISCLOSURES_CHECKLIST.md](./BILLING_DISCLOSURES_CHECKLIST.md)

---

## Sprint C-3 Phase 1b + Phase 3 — Auth + security (2026-06-02)

**No schema change.**

- **Commit:** `56a4407`
- **Routes:** `/auth/callback` (exchangeCodeForSession, welcome email on confirm); `/auth/confirm-email`
- **Signup:** `_signup-form.tsx` redirects to confirm-email (no immediate password sign-in)
- **Middleware:** AAL2 MFA enforcement → `/mfa-challenge`
- **Security:** `next.config.ts` headers (HSTS, CSP); PII removed from Stripe webhook logs; welcome route auth guard
- **Script:** `scripts/security-audit.sh`

---

## Sprint C-3 — RLS security fixes (2026-06-02)

**Migration:** `20260602000000_sprint_c3_rls_fixes.sql` — **commit `236890c`**

**RLS policy changes (no new tables):**

- **businesses:** advisor SELECT fixed — was `auth.uid() IS NOT NULL` (any signed-in user could read all rows); now `advisor_clients` join on `owner_id`
- **assets:** `Advisors can manage client assets` recreated — status `active` and `accepted` (was `active` only)
- **monte_carlo_runs:** owner ALL + advisor SELECT added (RLS on with zero policies — non–service-role access was blocked); join key `user_id`
- **advisor_clients:** `Advisors manage their clients` ALL policy — added `WITH CHECK (advisor_id = auth.uid())`
- **profiles:** `Users can insert own profile` — `WITH CHECK (id = auth.uid())`
- **Reference tables:** authenticated read-only on `federal_estate_tax_parameters`, `advisor_tier_config`, `attorney_tier_config`, `charitable_deduction_limits`, `charitable_vehicle_types`, `qcd_limits`
- **change_log:** service-role-only policy (no authenticated read)

All advisor-scoped joins use `status = ANY(ARRAY['active', 'accepted'])` per `CONNECTED_ADVISOR_CLIENT_STATUSES` in `lib/advisor/clientConnectionStatus.ts`.

**Apply:** `npx supabase db push` or run migration on linked project before relying on consumer RLS paths without admin client.

**Follow-up (Sprint 17):** ✅ UI pass complete — `MonteCarloAssumptionsPanel.tsx` label + `lib/monte-carlo.ts` insights. Column `monte_carlo_runs.success_rate` unchanged (internal/API only).

---

## Sprint 17 — go-live prep (June 2026)

**No schema change.**

- **Compliance code (C-2b through C-5):** ✅ All closed on `main` — see commit log in [NEXT_SESSION.md](./NEXT_SESSION.md)
- **Sprint P-1 closed 2026-06-02:** Performance quick wins (`5c24160`); indexes in prod.
- **Sprint P-2 closed 2026-06-02:** Recommendations cache, projections cache-first, auth dedup (`47a38f3`); migration `20260602130000_sprint_p2_recommendations_cache.sql`.
- **Sprint 17 remaining (non-code):** [LAUNCH.md](./LAUNCH.md); Stripe Dashboard + C-4 walkthrough; counsel sign-off; go-live day Supabase Auth + `PUBLIC_SIGNUP_OPEN=true` + Core §1–3 smoke
- **Docs:** [LAUNCH.md](./archive/LAUNCH_CHECKLIST.md) · [BILLING_DISCLOSURES_CHECKLIST.md](./BILLING_DISCLOSURES_CHECKLIST.md) · [LAUNCH.md](./LAUNCH.md)

## Sprint 16 — C-2b UX language audit (May 2026)

**No schema change.**

- **Sprint 15 closed 2026-05-24:** domain live; Search Console via Cloudflare; waitlist active; smoke §1–3 passed.
- **Sprint 16 closed 2026-05-24:** C-2b complete (`788aa08`); billing/open signups carried to Sprint 17.

## Sprint 14 — manual smoke §1–7 + open bugs (May 2026)

**No schema change.**

- **E2E:** `93aa6f5` — `consumer-core-recompute.spec.ts`, `estate-health-poll.ts`
- **Manual smoke:** `1e092d7` — Core §1–3 + estate §4–7 passed staging 2026-05-23
- **Open before launch:** Admin Portal in consumer sidebar; asset form save below viewport
- **Post-launch:** estate composition read model — materialize `calculate_estate_composition` at recompute (recommendations done in P-2); see [PERF_SPRINT_P1.md](./archive/sprints/PERF_SPRINT_P1.md)

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

## Advisor P1 — disconnect, limits, activation UX (May 2026)

- **No schema change.**
- **Application:** `lib/advisor/restoreConsumerBillingOnDisconnect.ts`, `lib/advisor/advisorClientLimits.ts`
- **Routes:** `POST /api/consumer/disconnect-advisor`, `POST /api/advisor/share-meeting-prep`
- **UI:** `AdvisorEmptyStateCta`, `AdvisorFirstConnectionPlaybook`, `AdvisorConnectedBanner`

## Advisor activation drip (May 2026)

- **Migration:** `20260527160000_advisor_activation_drip.sql` — drip timestamps + unsubscribe on `profiles`
- **Templates:** `lib/emails/advisor-drip-templates.ts`; send via `lib/advisor/sendAdvisorDripStep.ts`
- **Cron:** notifications cron step 8 — day 3 empty-roster nudge, day 7 case study
- **UI:** `AdvisorValuePropBanner` on `/advisor` — dismissible positioning vs PDF-first portals

## Advisor P0 — nullable advisor_id + billing handoff (May 2026)

- **Migration:** `20260527140000_advisor_clients_nullable_advisor_id.sql` — `advisor_clients.advisor_id` nullable for consumer-initiated pre-registration invites (`consumer_requested` + `invite_token`).
- **Application:** `lib/advisor/applyAdvisorConnectionBilling.ts` — Tier 3 + `advisor_managed` + Stripe pause on connect.
- **Routes:** `POST /api/consumer/invite-advisor`, `POST /api/advisor/claim-consumer-invite`, `/advisor/connect/[token]`, `/invite/expired`.

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

## Session 124 Note

- Schema: migration **`20260702120000_attorney_collaboration_workflow.sql`** — **`attorney_clients.matter_stage`**, **`client_status`**, **`request_message`**; tables **`attorney_notes`**, **`attorney_document_requests`** + RLS.
- Application-layer — Attorney portal v2: nav + **`/attorney/requests`**, **`/attorney/settings`**; client detail workflow panels; **`accept-request`** → direct **`active`**; claim-listing + **`request-connect`** create **`consumer_requested`**; consumer doc requests on **`/my-attorney`**.

## Session 123 Note

- Schema: migration **`20260701120000_restore_atg_in_calculate_estate_composition.sql`** — restore **`v_atg`** sum from **`adjusted_taxable_gifts`**; add to **`taxable_estate`**; return **`adjusted_taxable_gifts`** in RPC JSON (reverses Session 121 Step 7B removal).
- Application-layer — ATG: **`components/gifting/AdjustedTaxableGiftsSection.tsx`** on gifting tab; **`lib/gifting/adjustedTaxableGifts.ts`**; **`GET/POST/PATCH/DELETE /api/consumer/adjusted-taxable-gifts`** (`afterHouseholdWrite`, revalidate strategy/estate paths).
- Application-layer — Consumer MC: **`lib/monte-carlo/applyConsumerAssumptionInputs.ts`**; **`_monte-carlo-client.tsx`** assumptions step + accept/revert apply all 7 fields; **`lib/monte-carlo.ts`** portfolio return override + success threshold on insights; **`POST /api/monte-carlo`** passes optional assumption fields.

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
- E2E: `tests/e2e/consumer/consumer-gift-history.spec.ts` (9 cases); consumer project **50** tests. Canonical: `e2e-consumer@mywealthmaps.test` via `npm run seed:e2e`. Drip verify: `npm run verify:drip`. Recompute case needs `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

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

## Session 130 Note

- No new schema migration. Voels demo data ops scripts.
- Application-layer:
  - **`scripts/sync-voels-demo-accounts.ts`** — sync **`avoels@comcast.net`** My Plan → **`avoels@outlook.com`** Voels Household (assets, RE, business, insurance, liabilities, household profile fields); **`npm run sync:voels-demo`**
  - **`scripts/compare-voels-accounts.ts`** — side-by-side totals / asset diffs for the two accounts
  - **`DRY_RUN=1`** supported on sync script

## Session 129 Note

- No new schema migration. Code-only Engine B export alignment.
- Application-layer:
  - **`lib/export/buildEstatePlanPdfTaxPayload.ts`**, **`lib/export/loadEstatePlanPdfTaxPayload.ts`** — Engine B tax fields for estate-plan PDF export API
  - **`app/api/export-estate-plan/route.ts`** — replaces legacy **`calculate_federal_estate_tax`** / **`calculate_state_estate_tax`** RPCs with composition cache + bracket engine
  - **`lib/advisor/loaders.ts`** — removed dead **`estateTax`** dataset slice (**`calculate_state_estate_tax`**); Tax tab already uses **`advisorHorizons.today`**
  - **`lib/trusts/loadTrustWillGuidance.ts`** — fallback uses **`getCachedComposition`** instead of live **`classifyEstateAssets`**
  - **`scripts/verify-engine-b-tax-surfaces.ts`** — composition gross vs export API tax payload alignment check
  - **`tests/unit/roth-analysis.spec.ts`** — **`makeRow()`** includes RMD fields on mock **`YearRow`**; **`npx tsc --noEmit`** clean

## Session 128 Note

- Schema: migration **`20260703120000_attorney_digest_sent_at.sql`** — **`profiles.attorney_digest_sent_at`** (weekly digest send timestamp; 6-day cron cooldown).
- Application-layer — attorney weekly digest email + cron §10:
  - **`lib/emails/attorney-digest-template.ts`**, **`lib/attorney/getAttorneyDigestData.ts`**, **`lib/attorney/sendAttorneyDigest.ts`**, **`POST /api/email/attorney-digest`**
  - Cron §10 in **`app/api/cron/notifications/route.ts`** — Fridays only (`isFriday`); 6-day cooldown on **`attorney_digest_sent_at`**
  - Gaps via **`getMissingDocumentAlerts(documents, dismissals)`** — `legal_documents` (`is_deleted = false`); dismissals use **`document_gap_dismissals.attorney_id`** = profile id (auth uid)
  - Smoke: e2e attorney **`88a891a9-f57d-4b08-8873-293b3b411374`** → `{ success: true }`; **`attorney_digest_sent_at`** stamped

## Session 127 Note

- No new schema migration. Uses existing `households.state_primary`, `households.filing_status`, `households.person1_birth_year`, `trusts.excludes_from_estate`, `trusts.funding_amount`, `state_estate_tax_rules`, and `calculate_gifting_summary` RPC.
- Application-layer:
  - `lib/estate/profileGate.ts` + `requireMinimumViableProfile` — gated consumer pages redirect to profile when minimum fields missing.
  - `TrustDocumentsPanel` (trust-strategy tab): headroom via `computeHeadroomBeforeFederalTax`, federal exemption remaining after lifetime gifts, `~Est. Tax Saved` on excluded trusts using marginal `rate_pct` from `state_estate_tax_rules`.

