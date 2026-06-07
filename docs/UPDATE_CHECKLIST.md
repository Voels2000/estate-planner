# Documentation Update Checklist

Use this checklist in every PR/commit routine when architecture, data flow, or tax logic changes.

## Doc repository (start here for context)

| Doc | Purpose |
|-----|---------|
| [BUSINESS_READINESS_PLAN.md](./BUSINESS_READINESS_PLAN.md) | Washington business formation, compliance sprint summary, go-live readiness (85%) |
| [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) | Segment, personas, pricing, UX principles |
| [ROADMAP.md](./ROADMAP.md) | Sprint plan and item status |
| [NEXT_SESSION.md](./NEXT_SESSION.md) | Current sprint handoff — paste block, task list, file paths |
| [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) | Go-live checklist — SEO, domain, Resend (update at launch, not each sprint) |
| [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) | Legal/business/ops blockers before `PUBLIC_SIGNUP_OPEN=true` |
| [DECISION_LOG.md](./DECISION_LOG.md) | Settled product/UX decisions — add new entries, do not edit old |
| [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) | Engineering architecture |
| [CALCULATION_ENGINES.md](./CALCULATION_ENGINES.md) | **Canonical calculation registry** — read before any tax/projection/strategy math |
| [SPRINT_UNIFY_STATE_TAX.md](./SPRINT_UNIFY_STATE_TAX.md) | Queued — unify state estate tax to engine B (delete narrative flat-rate engine A) |
| [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) · [CURSOR_PROMPT_TEMPLATE.md](../CURSOR_PROMPT_TEMPLATE.md) | Brand tokens, UI primitives, Cursor prompts (Tailwind v4 `color:` prefix) |
| [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) · [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md) | Consumer journeys and routes |
| [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) · [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md) | Schema authority and session history |
| [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) | **Go-live E2E user reset** — `npm run seed:e2e`, legacy cleanup |
| [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) | **Complete Playwright suite** — commands, env, seeds |
| [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) | **Pre-flip automated gate** — profile + inline prompt commands |
| [SPRINT_IMPORT_ATTORNEY.md](./SPRINT_IMPORT_ATTORNEY.md) | Import expansion + attorney workflow (2026-05-29) |
| [SPRINT_IMPORT_EXPANSION.md](./SPRINT_IMPORT_EXPANSION.md) | Import Phases 1–5 acceptance criteria & reference |
| [SPRINT_INLINE_PROFILE_PROMPTS.md](./SPRINT_INLINE_PROFILE_PROMPTS.md) | Inline profile prompts sprint |
| [.env.test.example](../.env.test.example) | Template after `seed:e2e` |
| [E2E_RELEASE_TEST_PLAN.md](./E2E_RELEASE_TEST_PLAN.md) | Playwright vs manual smoke map |
| [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) | Human release smoke checklist |
| [UX_LANGUAGE_AUDIT_SPRINT.md](./UX_LANGUAGE_AUDIT_SPRINT.md) | Compliance language policy — education vs. advice framing |
| [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) | Sprint C-4 — auto-renewal + cancel disclosures (code complete; manual Stripe verify) |
| [LEGAL_TODO.md](./LEGAL_TODO.md) | Sprint C-5 — pre-go-live legal checklist; [§ Counsel handoff](./LEGAL_TODO.md#counsel-handoff--how-to-send-the-tos) |
| [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) | Sprint P-1 + P-2 — performance quick wins and pre-launch refactors |
| [COMPLIANCE_CALENDAR.md](./COMPLIANCE_CALENDAR.md) | WCPA deletion SOP, C-6/C-7 automated checks, privacy request SOP |

## New table migrations (mandatory — every PR with `supabase/migrations/*.sql`)

Before merge, confirm the migration file includes:

- [ ] `ALTER TABLE … ENABLE ROW LEVEL SECURITY`
- [ ] Policies scoped to **household owner** (`households.owner_id = auth.uid()` or equivalent join) for consumer PII — not `USING (true)` on household data
- [ ] Advisor policies use `advisor_clients` with `status` in `active` + `accepted` (see `lib/advisor/clientConnectionStatus.ts`)
- [ ] `GRANT` to `authenticated` and `service_role` on the new table (copy from [supabase/MIGRATION_TEMPLATE.sql](../supabase/MIGRATION_TEMPLATE.sql))
- [ ] `GRANT` to `anon` **only** if the table is intentionally public (directories, `ref_*`, pre-signup assessment) — read-only `SELECT` where possible
- [ ] Re-run grant audit after deploy if unsure: `npx supabase db query --linked -o csv -f scripts/audit-table-grants-rls.sql`

See [MASTER_ARCHITECTURE.md § Supabase Data API access](./MASTER_ARCHITECTURE.md#supabase-data-api-access-grants--rls) and [docs/audits/README.md](./audits/README.md).

## When to update docs

> **Sprint hygiene rule:** Add "Doc sync pass" as the final task in every sprint.
> Checklists get skipped under deadline pressure; a sprint item does not.
> At minimum, update: ROADMAP.md (sprint status), MASTER_ARCHITECTURE.md (Current vs Target),
> NEXT_SESSION.md (handoff block), and DECISION_LOG.md (any new settled decisions).

- Engine logic changes (`projection-complete`, `roth-analysis`, tax engines, strategy engines) → **read [CALCULATION_ENGINES.md](./CALCULATION_ENGINES.md) first**; run § Regression grep checks before commit
- New API routes or route behavior changes
- Database schema changes (new tables/columns/migrations/RPC signatures)
- Source-of-truth changes (e.g., table swaps, fallback removals)
- Workflow changes (advisor/consumer acceptance, recommendation writes, Monte Carlo sharing)
- Consumer route, profile gate, tab/sub-tab, CTA label, or save/refresh behavior → `docs/CONSUMER_FLOWS.md`
- Consumer-facing copy, disclaimers, or compliance language → `docs/UX_LANGUAGE_AUDIT_SPRINT.md` + run `bash scripts/audit-ux-language.sh`
- Schema-only session notes (no table/RPC shape change) → one line in `docs/SCHEMA_CHANGELOG.md`
- Sprint item completed or new product decision → `docs/ROADMAP.md` and/or `docs/DECISION_LOG.md` (new entry)
- End of UI sprint session → update `docs/NEXT_SESSION.md` (completed tasks, remaining work, discovered file paths)
- Launch / go-live work (robots, Search Console, domain cutover, production email, **Vercel Production env vars**, **waitlist disable**) → update `docs/LAUNCH_CHECKLIST.md` and check items there; mirror status in `ROADMAP.md` if sprint-owned
- Compliance / data deletion (WCPA, webhook schedule, admin deletion UI) → `docs/COMPLIANCE_CALENDAR.md`, `docs/MASTER_ARCHITECTURE.md`, `docs/DATABASE_SCHEMA_REFERENCE.md`
- Test data for staging smoke (Playwright + manual) → `npm run seed:e2e` ([E2E_TEST_RESET.md](./E2E_TEST_RESET.md)); document in [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md)

## Post-deploy Voels verify script (2026-06-06) — shipped

- [x] `scripts/verify-post-deploy-voels.ts` — MC Phase 3 + PDF narrative gate (7 checks)
- [x] ROADMAP · DECISION_LOG · NEXT_SESSION verify script index

## Advisor logo file-upload (2026-06-07) — shipped

- [x] Storage bucket `advisor-branding` + RLS migration `20260630120000`
- [x] `POST/DELETE /api/advisor/profile/logo` — upload/remove → `profiles.firm_logo_url`
- [x] `/advisor/settings` — preview, upload, replace, remove
- [x] ROADMAP · DECISION_LOG · NEXT_SESSION · DATABASE_SCHEMA_REFERENCE · SCHEMA_CHANGELOG synced

## PDF cover logo — firm_logo_url render (2026-06-06) — shipped

- [x] `PDFReportData.firmLogoUrl` from `resolveAdvisorBranding`
- [x] Cover page `<img class="firm-logo">` when http(s) URL present
- [x] ROADMAP · DECISION_LOG · NEXT_SESSION · DATABASE_SCHEMA_REFERENCE synced

## StateTaxPanel multi-state + tax coverage audit (2026-06-06) — shipped

- [x] `MODELED_ESTATE_TAX_STATES` — 13 estate-tax states canonical in `stateEstateTax.ts`
- [x] `StateTaxPanel` + Tax tab — multi-state badges, copy, engine B brackets
- [x] `buildAdvisorStatesToFetch()` — replaces hardcoded 6-state prefetch
- [x] `stateHasNoPortability` — engine B (was WA/MA/OR-only)
- [x] `scripts/verify-state-tax-panel-states.ts` · `scripts/verify-state-tax-coverage.ts`
- [x] ROADMAP · DECISION_LOG · NEXT_SESSION synced

## Base-case regenerate — engine C→B staleness bump (2026-06-06) — shipped

- [x] Migration `20260605130000_bump_staleness_after_engine_cb.sql` — bump `households.updated_at` for all saved base cases
- [x] `scripts/regenerate-base-case-voels.ts` — advisor API regenerate + death-year **2057** state tax verify
- [x] ROADMAP · DECISION_LOG · NEXT_SESSION synced

## Advisor portal — `profiles.firm_name` fallback (2026-06-05) — shipped

- [x] `getAccessContext` — `firm_name: firms.name → profiles.firm_name`
- [x] Advisor layout nav — resolved firm name
- [x] ROADMAP · DECISION_LOG · NEXT_SESSION synced

## Domain 3 — tax term explainers (2026-06-01) — in progress

- [x] `lib/estate/taxTermExplainers.ts` — static, OBBBA formatters, dynamic ctx
- [x] `components/ui/InfoTooltip.tsx`
- [x] `EstateReadinessCard` — score subcategory labels
- [x] `EstateCalloutCard.tsx` — hero 4-tile labels only (not sidebar snapshot)
- [x] `/estate-tax` — summary cards + waterfall row labels (`SummaryCard.labelTooltip`, `taxTermCtx`)
- [x] Advisor `StateTaxPanel` — No portability badge + Exemption header (`taxTermCtx` from `currentYearRow`)
- [x] Projections chart — Base case legend + `DISCLAIMER_STRINGS.projectionsChart`
- [x] Gifting — `annual_exclusion` + `superfunding` on `GiftingDashboard`
- [ ] Hero tile full ctx — `stateExemption` / `isMFJ` props from dashboard-body

## Estate readiness subcategory explainers (2026-06-01) — shipped

- [x] `components/ui/InfoTooltip.tsx` — custom popover primitive (no Radix)
- [x] `lib/estate-health-score.ts` — `SCORE_CATEGORY_EXPLAINERS`, `scoreCategoryExplainer()`
- [x] `components/dashboard/EstateReadinessCard.tsx` — inline `?` per subcategory label
- [x] Master docs synced
- [ ] Post-deploy smoke: consumer past onramp — six `?` icons; copy matches explainers

## PDF beneficiary summary page (2026-06-01) — shipped

- [x] [lib/advisor/beneficiaryHelpers.ts](../lib/advisor/beneficiaryHelpers.ts) — `buildBeneficiaryAccountGroups`
- [x] [exportMappers.ts](../lib/advisor/exportMappers.ts) · [loadAdvisorExportWiring.ts](../lib/advisor/loadAdvisorExportWiring.ts) · [generatePDFReport.ts](../lib/export/generatePDFReport.ts)
- [x] [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) · [DECISION_LOG.md](./DECISION_LOG.md) · [ROADMAP.md](./ROADMAP.md) · [NEXT_SESSION.md](./NEXT_SESSION.md)
- [ ] Post-deploy smoke: Voels export — 6 pages; beneficiary gaps (Teva, 529) on page 3

## Estate MC engine B state tax (2026-06-01) — shipped

- [x] `lib/calculations/estate-monte-carlo.ts` — `calculateStateEstateTax` + `resolveActiveStateTax`; flat rate removed
- [x] `supabase/functions/estate-monte-carlo/index.ts` — inlined engine B; redeploy prod
- [x] `MonteCarloPanel.tsx`, `StrategyTab.tsx`, `stateBrackets` on shell + `page.tsx`
- [x] Zero-Tax Paths label + tooltip (`success_rate` = federal + state both $0)
- [x] [CALCULATION_ENGINES.md](./CALCULATION_ENGINES.md) · [DECISION_LOG.md](./DECISION_LOG.md)
- [x] `scripts/verify-estate-mc-voels-smoke.ts`
- [x] Master docs: MASTER_ARCHITECTURE · ROADMAP · NEXT_SESSION · UPDATE_CHECKLIST
- [x] **Domain 1 closed** — engine B on estate MC display path
- [x] PDF page 3 metric cards — engine B (`generatePDFReport.ts`)
- [x] **2026-06-06:** `exportMappers.ts` `fedTaxExport` → `computeFederalExportTax` (Excel + export panel + PDF)

## State estate tax unification (2026-05-29) — shipped

- [x] [CALCULATION_ENGINES.md](./CALCULATION_ENGINES.md) — canonical engine registry + regression greps
- [x] [SPRINT_UNIFY_STATE_TAX.md](./SPRINT_UNIFY_STATE_TAX.md) — sprint script (Phases 0–8)
- [x] [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) § State Estate Tax Chain
- [x] [DECISION_LOG.md](./DECISION_LOG.md) · [ROADMAP.md](./ROADMAP.md) · [NEXT_SESSION.md](./NEXT_SESSION.md)
- [x] `lib/constants/strategyTypes.ts` — CST string single source of truth
- [ ] Post-deploy smoke: Voels MFJ WA PDF — engine B state tax + bypass trust scenario table

## Onboarding wizard (Sprint OB-1) — shipped `b1c7b49`

- [ ] New migration `20260526000000_onboarding_wizard_fields.sql` applied to production before deploy
- [x] `isWizardComplete` and `isWizardReadyProfile` exported from `profileGate.ts`
- [x] Layout gate exemptions verified (`/billing`, `/settings`, `/profile`, `/onboarding/*` not double-redirected)
- [x] Wizard skips all steps → dashboard shows `SetupPromptCard`
- [x] Wizard completes all steps → dashboard shows conflict alerts (not `SetupPromptCard`)

## Strategy reversal lifecycle (2026-05-31) — shipped (4 commits)

- [x] Migration `20260531120000_strategy_line_items_reversal.sql`
- [x] Reversal API + `ReversalModal` + In My Plan actions + Strategy history
- [x] Gifting plan card, drift warning, `GiftDeleteWarningModal`
- [x] Advisor **Withdrawn by Client** in RecommendationsPanel
- [x] [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md), [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md), smoke §10c

## Strategy sandbox → actuals (2026-05-27) — shipped (3 commits)

- [x] SLAT/ILIT/charitable + modeled chips default `illustrative`; annual gifting stays `probable`
- [x] `StrategySandboxSection` / `StrategyConfirmedSection`; `PATCH` promote by `id`
- [x] Roth **Use in Transfer Strategies →** + `?openPanel=roth`
- [x] [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) Transfer Strategies + handoff §5
- [x] [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) sandbox contract + advisor workflow step 4
- [x] [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) `confidence_level` notes
- [x] [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md) · [DECISION_LOG.md](./DECISION_LOG.md)
- [x] [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) §10c sandbox steps
- [ ] Playwright: promote sandbox → In My Plan (optional post-launch)

## Advisor flywheel (Sprint AF-1) — shipped `a255616`

- [x] `POST /api/consumer/ask-advisor` + `AskAdvisorAboutStrategyButton` on strategy education cards
- [x] Advisor client Overview **Client Strategy Questions** card
- [x] [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) Transfer Strategies row updated

## Setup progress + wizard refactor (Sprint OB-3) — shipped

- [x] `SetupProgressCard` collapses to single line when all 5 sections started and wizard complete (does not disappear)
- [x] Wizard gate does not redirect users who have any asset or income data (`shouldRequireWizardOnboarding` + exempt routes)
- [x] Import upload accessible during onboarding for Tier 1; import history remains Tier 2+ (no data deletion on tier gate)

## Sidebar + onboarding nav (Sprint OB-3b + SU-1) — shipped

- [x] Old `DashboardIntroSection` green checklist removed; `SetupProgressCard` only
- [x] Financial Planning: all items tier 1 in `FEATURE_TIERS`; group exempt from `isLockedUser`
- [x] Security, My Advisor, Manage Subscription: not gated by `isLockedUser`
- [x] My Advisor: contextual onboarding note (`!connection && !wizardComplete && !pendingRequest`)
- [x] Superuser sidebar: `isSuperuser` prop, staff `isLockedUser` bypass, Advisor Portal for admin/superuser (`3c0d28b`)
- [x] Layout household query: removed invalid `date_of_birth_1` select (fixes `hasHousehold` / Financial menu lock for all users with a household row)

## Sidebar active indicator (Sprint NAV-1) — shipped `be92947`

- [x] Financial Planning (and other collapsed groups) auto-expand when a child route is active
- [x] Active item uses `NAV_ACTIVE` (navy + gold left border) via `isNavItemActive()` + `usePathname()`
- [x] `/dashboard` exact match only; sub-routes use path prefix match

## Advisor portal performance — shipped `8c526de`

- [x] `/advisor` roster: `loadRosterNetWorthByOwner` (5 batched queries, not N× composition RPC)
- [x] `/advisor/clients/[clientId]`: parallel staleness + composition + datasets
- [x] State tax/income bracket queries scoped to advisor states + projection years
- [x] Access log + strategy-question mark-read off critical path

## Advisor portal UX-2 — shipped (pass 1 + continuation)

- [x] Migration `20260626120000_advisor_gap_statuses.sql` — apply before deploy
- [x] Brand: navy header, gold tab underlines; advisor sign-out on navy bar
- [x] `advisorDatasetIncludeForTab()` tab-scoped client datasets
- [x] Overview: `PlanStatusCard`, critical-gap banner, `GapStatusSelector`, stable `gap.key`
- [x] Estate: collapsed outside estate when $0; prominent tax callout; no-transfer amber banner
- [x] Strategy: `getCachedAdvisoryMetrics`; 6-card grid + module CTA; warning cap at 2; exemption banner
- [x] Tax tab: Sunset / No Exemption Stress Test label
- [x] Tax tab: horizon-aligned state tax waterfall + State Tax Detail labels (2026-05-26)
- [x] MFJ: `isMFJFilingStatus()` on advisor Strategy / Tax / Domicile + strategy-tab API
- [x] Domicile: `StateTaxPanel` horizon callouts + survivor-timeline note (parity with Tax tab)
- [x] Domicile: critical transition risk red banner (≥ 71)
- [x] [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) — `advisor_gap_statuses`
- [x] [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md) · [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) · [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) · [DECISION_LOG.md](./DECISION_LOG.md)

## Advisor portal UX-3 — Strategy tab restructure (2026-05-26)

- [x] Severity: `lib/advisor/advisoryMetricSeverity.ts`; `AdvisoryMetricCard`; no `!!`
- [x] `StrategyTabContent` — Situation / Opportunities / Recommendations
- [x] `StrategyAlertBanners` — liquidity critical before exemption warning
- [x] `OpportunitiesPanel` + strategy catalog; `RecommendationsPanel` + client questions (Step 3)
- [x] `ADVISOR_BENCHMARKS` feature flag off by default (`lib/featureFlags.ts`)
- [x] Meeting Prep: `meetingPrepBriefFromHorizons`
- [x] Master docs: SCHEMA_CHANGELOG · MASTER_ARCHITECTURE · DECISION_LOG · ROADMAP · NEXT_SESSION

## Advisor portal UX-4 — Inline strategy modeling (2026-05-26)

- [x] Catalog: `annual_gifting` id; 11 strategies; `catalogToPanel.ts` (CST chip `credit_shelter_trust`)
- [x] `InlineStrategyPanel` + row expand; `inlinePanelProps` mirrors full-width SLAT/ILIT + Advanced props
- [x] `initialActivePanel` / `onRecommend` on panels (additive); `ModelStrategyButton` removed
- [x] `isSent` from advisor `strategy_line_items`; full-width panels removed in UX-5
- [x] Master docs: SCHEMA_CHANGELOG · MASTER_ARCHITECTURE · DECISION_LOG · ROADMAP · NEXT_SESSION · PERF_SPRINT_P1

## Advisor portal UX-5 — Strategy tab restructure (2026-05-26)

- [x] Remove full-width SLAT/ILIT + Advanced panels below three-step area; scroll → `#strategy-opportunities`
- [x] Strategy Horizon section below Step 3; `StrategyImpactPanel` in Recommendations & Impact
- [x] Horizon impact uses `outsideCertainProbableTotal + outsideIllustrativeTotal` + `stateTax`
- [x] Master docs: SCHEMA_CHANGELOG · MASTER_ARCHITECTURE · DECISION_LOG · ROADMAP · NEXT_SESSION · PERF_SPRINT_P1

## Security audits — grants + RLS (2026-05-27)

- [x] `scripts/audit-table-grants-rls.sql` + baseline CSV (119 tables, all grants + RLS on)
- [x] `scripts/audit-rls-policies.sql` + risk helper + baseline CSVs
- [x] `supabase/MIGRATION_TEMPLATE.sql` — GRANT + RLS pattern for future tables
- [x] Master docs: MASTER_ARCHITECTURE · UPDATE_CHECKLIST · SCHEMA_CHANGELOG · DECISION_LOG · ROADMAP · NEXT_SESSION · LAUNCH_CHECKLIST · CONSUMER_FLOWS · DATABASE_SCHEMA_REFERENCE · docs/audits/README.md
- [x] Pre-launch RLS fix migration `20260527150000` + `/api/advisor/gst-entry` (`1f41ce1`, `7cab1be`, `35b0738`)
- [x] Prod `db push` + `scripts/verify-loose-rls-policies.sql` (zero rows); post-fix CSV `docs/audits/rls-policies-post-fix-2026-05-27.csv`
- [ ] Manual isolation smoke (two consumers + advisor/client) — [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)

## PROF-1/2 — Profile cleanup (2026-05-27)

- [x] Profile: no growth / inflation / risk inputs; cross-links to Scenarios and Allocation
- [x] Scenarios: inflation + growth save via `PATCH /api/consumer/growth-assumptions`
- [x] Allocation: editable `risk_tolerance` via `PATCH /api/consumer/allocation-targets`
- [x] `ProjectionAssumptions` + Complete footer copy aligned with ENG-2A engine
- [x] Master docs: SCHEMA_CHANGELOG · MASTER_ARCHITECTURE · DECISION_LOG · ROADMAP · NEXT_SESSION · CONSUMER_FLOWS · DATABASE_SCHEMA_REFERENCE

## Import expansion + attorney workflow (2026-05-29) — shipped

- [x] Type normalization — `lib/import/type-normalizer.ts`, review UI
- [x] Multi-sheet import — `lib/import/multiSheet.ts`, Commit All
- [x] Onboarding fork — wizard step 1 + `?onboarding=true`
- [x] Persona templates — `public/templates/template-*.xlsx`
- [x] Real estate import target
- [x] Attorney doc status + gaps + tier model + billing checkout
- [ ] **Deploy:** apply `20260529120000_sprint_import_attorney.sql` + `20260529130000_attorney_drip_columns.sql`
- [ ] **Stripe:** create attorney products; set `STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY` + `STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY`
- [x] Master docs: SCHEMA_CHANGELOG · MASTER_ARCHITECTURE · DECISION_LOG · ROADMAP · NEXT_SESSION · CONSUMER_FLOWS · SPRINT_IMPORT_ATTORNEY

## Attorney monetization (2026-05-29) — shipped

- [x] `POST /api/stripe/attorney-checkout` + webhook `attorney_tier`
- [x] `/attorney/billing` Subscribe + success banner
- [x] `AttorneyUpgradePrompt` — client cap, PDF export, doc dashboard blur
- [x] Client cap 403 — `grant-access`, `accept-request`
- [x] Attorney drip — `sendAttorneyDripStep`, cron steps 2–3, migration `20260529130000_attorney_drip_columns.sql`
- [ ] **Stripe products** — manual creation in Dashboard
- [x] Master docs sync (this pass)

## Projections empty state fix (2026-05-29) — shipped

- [x] `lib/planning/projectionReadiness.ts` + `buildProjectionPlanningFields()`
- [x] Targeted empty state + partial view with `ProfileFieldPrompt` on `/projections`
- [x] `tests/unit/projectionReadiness.spec.ts` (5 cases; import-unit project)
- [x] `PLANNING_MISSING_PROJECTION_ACTIONS_TIER2` adds `/scenarios`
- [x] Master docs sync (this pass)

## Professional Acquisition & Activation (2026-05-29) — shipped

- [x] Migration `20260530_attorney_intake_requests.sql`
- [x] Track 1 — send intake request, `/intake/[token]`, auto-grant, pending list, 5/mo cap
- [x] Track 2 — `ReferralImpactPanel`, referral-impact API, advisor signup notification
- [x] Track 3 — meeting prep PDF route, "Prepare for meeting" button
- [x] Master docs sync (this pass)
- [ ] Apply migration on remote + manual smoke Tracks 1–3 ([NEXT_SESSION.md](./NEXT_SESSION.md))

## Persona-based onboarding (2026-05-29) — shipped

- [x] Migration `20260530_onboarding_persona.sql` — `profiles.onboarding_persona`, `persona_set_at`
- [x] `/onboarding/persona` — 4-card selection, post-profile redirect, sidebar skip → `accumulator`
- [x] `lib/onboarding/personaConfig.ts` — wizard copy, first asset type, import template per persona
- [x] Persona-aware wizard step 1 — headline, manual CTA, recommended template link
- [x] `PersonaInsightCard` — 4 variants, 7-day window, sessionStorage dismiss, above `SetupProgressCard`
- [x] Funnel events — `persona_screen_shown`, `persona_selected`, `persona_skipped`, `persona_insight_*`
- [x] Admin funnel tab — `persona_selected`, `persona_skipped`
- [x] Master docs sync (this pass)

## Queued next (2026-05-29) — not scheduled

- [ ] **Dashboard `canShowPartial` nudge** — low priority; revisit after ~2 weeks traffic ([ROADMAP.md](./ROADMAP.md))
- [ ] **Attorney drip cron verification** — SQL ~3 days after first real attorney ([SPRINT_IMPORT_ATTORNEY.md § Post-ship ops](./SPRINT_IMPORT_ATTORNEY.md#post-ship-ops), [NEXT_SESSION.md](./NEXT_SESSION.md#queued-next-post-ship-ops))

## Inline profile prompts E2E (2026-05-27) — shipped

- [x] `consumer-profile-field-prompt.spec.ts` — Scenarios + SS UI (save, dismiss, deduction, PIA)
- [x] `consumer-profile-save.spec.ts` — third partial PATCH (custom deduction)
- [x] `consumer-profile-spouse-layout.spec.ts` — slim profile negative assertion
- [x] `patchHouseholdById` / `restoreHouseholdDeferredFields` in supabase-fixture
- [x] `npm run test:e2e:go-live-profile` + `test:e2e:partial-patch`
- [x] Master docs: SCHEMA_CHANGELOG · MASTER_ARCHITECTURE · DECISION_LOG · ROADMAP · NEXT_SESSION · CONSUMER_FLOWS · CONSUMER_RELEASE_SMOKE_TEST · E2E_TEST_RESET · PLAYWRIGHT_E2E · E2E_RELEASE_TEST_PLAN · LAUNCH_CHECKLIST · GO_LIVE_E2E

## Inline profile prompts (2026-05-27) — shipped

- [x] `ProfileFieldPrompt` — `components/profile/ProfileFieldPrompt.tsx` (session dismiss, save-hidden, custom deduction follow-on)
- [x] Partial PATCH merge — `mergeProfilePatch`, `loadProfileSavePayloadForUser`, `app/api/consumer/profile/route.ts`
- [x] SS + Scenarios wiring — `_social-security-page-client.tsx`, `_scenarios-client.tsx`, `profileFieldPromptDefs.ts`
- [x] Deduction prompt when `deduction_mode` null/unset only (not explicit `standard`)
- [x] E2E — `consumer-profile-save.spec.ts` partial PATCH (SS + retirement/longevity; run separately post-deploy)
- [x] Master docs: SCHEMA_CHANGELOG · MASTER_ARCHITECTURE · DECISION_LOG · ROADMAP · NEXT_SESSION · CONSUMER_FLOWS · CONSUMER_NAV_MAP · PLAYWRIGHT_E2E · E2E_RELEASE_TEST_PLAN · LAUNCH_CHECKLIST · SPRINT_INLINE_PROFILE_PROMPTS

## Profile layout — two-column people (2026-05-27)

- [x] `_profile-client.tsx` — layout only; no field/state/API changes
- [x] `max-w-2xl`; navy page title; `ProfileSectionHeader` (gold `#C9A84C` left border)
- [x] Household / People / Household Planning sections; live `person1Name` / `person2Name` column headers
- [x] Spouse toggle below person grid; paired fields per column; unified Scenarios + Allocation callout
- [x] Welcome banner, `ProfileRequiredBanner`, wizard cards untouched
- [x] Master docs: SCHEMA_CHANGELOG · MASTER_ARCHITECTURE · DECISION_LOG · ROADMAP · NEXT_SESSION · CONSUMER_FLOWS · CONSUMER_RELEASE_SMOKE_TEST

## Profile layout E2E (2026-05-27)

- [x] `consumer-profile-spouse-layout.spec.ts` — section headers, live person1 header, spouse toggle + live spouse header, `sm:grid-cols-2` (4 tests)
- [x] `consumer-growth-assumptions-api.spec.ts` — PATCH financial/RE/business/inflation; empty-body 400; round-trip when `PLAYWRIGHT_HOUSEHOLD_ID` set
- [x] `fetchHouseholdPlanningFields` in `tests/e2e/helpers/supabase-fixture.ts`
- [x] Selector: `getByRole('textbox', { name: 'Jane', exact: true })` (not `getByPlaceholder('Jane')`)
- [x] Master docs: PLAYWRIGHT_E2E · CONSUMER_FLOWS · E2E_RELEASE_TEST_PLAN · LAUNCH_CHECKLIST · DECISION_LOG · ROADMAP · NEXT_SESSION · MASTER_ARCHITECTURE

## ENG-2 — Growth assumptions (2026-05-27)

- [x] Migrations `20260527130000`–`20260527130300` + staleness bump `20260527130400`
- [x] Redeploy `estate-monte-carlo` edge function before app (hardcoded 7%/12% removed)
- [x] Five commits `5589b89`–`8e90fa4` (bisect per ENG item)
- [x] `scripts/compare-user-estate-data.ts` **not** committed (one-off production QA; deleted)
- [x] Master docs: SCHEMA_CHANGELOG · MASTER_ARCHITECTURE · DECISION_LOG · ROADMAP · NEXT_SESSION · DATABASE_SCHEMA_REFERENCE

## Nav consistency — homepage, billing, utility (2026-05-27)

- [x] Homepage `app/(public)/page.tsx` inherits `PublicNav` + footer; inline nav removed
- [x] `MinimalAuthNav` on `app/billing/layout.tsx`
- [x] `WordmarkOnly` on invite, beneficiary, share, confirm-email, attorney-invite, claim-listing layouts
- [x] `MASTER_ARCHITECTURE.md` Layout and Navigation Reference table
- [x] Master docs: SCHEMA_CHANGELOG · DECISION_LOG · ROADMAP · NEXT_SESSION · CONSUMER_NAV_MAP

## Client Summary PDF brand upgrade (2026-05-27)

- [x] ConsumerEstatePlanPDF: navy/gold header, purpose callout, household profile grid, readiness without letter grade
- [x] Document Status: Not on file / On file; section titles renamed (Estate Plan Readiness, Document Status)
- [x] export-estate-plan: financial profile data for consumer exports
- [x] /print: card descriptions + data ownership note
- [x] Attorney Summary PDF unchanged
- [x] Master docs: SCHEMA_CHANGELOG · MASTER_ARCHITECTURE · DECISION_LOG · ROADMAP · NEXT_SESSION · PERF_SPRINT_P1

## Advisor portal UX-5b — CompositeOverlay remove manual entry (2026-05-26)

- [x] Remove `custom` mode: `customStrategies`, "This Household" button, manual form
- [x] Default mode `recommendations`; modes `recommendations` | `30m` | `100m`
- [x] Empty state references Step 2 inline modeling
- [x] `StrategyHorizonTable`, recommendations API, archetypes, boundary snapshot unchanged
- [x] Master docs: SCHEMA_CHANGELOG · MASTER_ARCHITECTURE · DECISION_LOG · ROADMAP · NEXT_SESSION · PERF_SPRINT_P1

## Advisor portal ENG-1 — Estate/Tax strategy inclusion audit (2026-05-26)

- [x] Audit: composition RPC `source_role` limitation documented; strategyMappers actual set confirmed
- [x] Advisor page builds `advisorEstateComposition` from `advisorHorizons.today` (+ lifetime gifts used)
- [x] Estate tab wired to horizon-derived advisor composition via additive `horizonComposition` prop
- [x] Estate/Tax accepted-strategy indicators added (advisor-only display)
- [x] Tax tab verified horizon-driven in current-law mode; stress-test path unchanged
- [x] Consumer composition path unchanged (`classifyEstateAssets` with `p_source_role='consumer'`)
- [x] Master docs: SCHEMA_CHANGELOG · MASTER_ARCHITECTURE · DECISION_LOG · ROADMAP · NEXT_SESSION · PERF_SPRINT_P1

## Signup trigger — pre-go-live

- [ ] `20260526000001_handle_new_user_trigger.sql` applied to production ([LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md))

## Required updates before merge

- [x] Update `docs/MASTER_ARCHITECTURE.md` (OB-3b / SU-1 / NAV-1 / advisor perf / UX-2 — 2026-05-26)
  - [x] Current vs Target reflects actual code
  - [x] Invariants still true
  - [x] Key file map is accurate
  - [x] Open backlog / migration status table still current (76 migrations through `20260626120000`)
- [x] Update `docs/DATABASE_SCHEMA_REFERENCE.md` (UX-2 — `advisor_gap_statuses`)
  - [x] New/changed tables and key columns
  - [x] Authoritative vs legacy notes
  - [x] Relationship/lineage changes
  - [x] Recent migrations list
- [ ] If consumer journey changed: update `docs/CONSUMER_FLOWS.md` and route row in `docs/CONSUMER_NAV_MAP.md` when URL/tier/gate changed

## Consumer flow changes (detail)

When you touch consumer UX or APIs, update in this order:

1. **Route / tier / gate / feature key** → [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md)
2. **Journey, sub-tabs, CTAs, APIs, refresh** → [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) (matching section)
3. **Schema or RPC** → [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) (+ [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md) if session note only)
4. **Cross-cutting contract** → [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md)
5. **Write path or deploy smoke** → Playwright spec + [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md)

Optional: three-line header on `page.tsx` (route, tier, gate, write APIs).

## Pre-Sprint-14 gate checklist — Sprint 13 closed ✅

- [x] Acquisition & attribution smoke A–G passed (staging)
- [x] **75** migrations in repo — applied and verified (local + remote in sync through C-7)
- [x] E2E complete suite — **259 tests** in 42 files (143 consumer / 45 advisor / 59 public / 2 attorney / 7 import-unit); staging verify 2026-05-25: consumer 127+ pass with `--workers=1` ([PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md))
- [x] Test seed scripts committed and run
- [x] Supabase verification queries documented in smoke test
- [x] `INTERNAL_API_KEY` on Vercel Production
- [x] Sprint 13 launch blockers fixed (RMD copy, advisor referral trigger)

## Sprint 15 focus — closed ✅ 2026-05-24

- [x] Waitlist mode — runtime middleware redirect + docs (`3ceb125`)
- [x] LAUNCH_CHECKLIST Section 2 — domain, DNS, Resend, Search Console (Cloudflare)
- [x] Post-cutover smoke §1–3 on production
- [x] Completion log entry in LAUNCH_CHECKLIST
- [x] Sprint 15 cont. (2026-05-24) — Preview waitlist; sitemap/middleware infra bypass (`73648e5`); test cleanup (`3f732e3`); dev workflow local → preview → production
- [x] **UX Language Audit** — Sprint C-2b complete (automated grep + all `DISCLAIMER_STRINGS` surfaces wired: PDF cover, estate-tax, my-estate-strategy, footer). Manual per-surface checklist QA remains open in [UX_LANGUAGE_AUDIT_SPRINT.md](./UX_LANGUAGE_AUDIT_SPRINT.md). Run `bash scripts/audit-ux-language.sh` before any PR that touches consumer-facing strings.

| [LEGAL_TODO.md](./LEGAL_TODO.md) | Sprint C-5 — pre-go-live legal checklist; [§ Counsel handoff](./LEGAL_TODO.md#counsel-handoff--how-to-send-the-tos) (one redline, one commit) |

## Sprint P-1 focus — closed ✅ 2026-06-02

- [x] Dashboard `Promise.all`, advisor conflict cache read, recompute debounce, next/font, notification server count (`5c24160`)
- [x] Indexes `idx_assets_owner_id`, `idx_liabilities_owner_id` — applied in production
- [x] [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) + [scripts/perf-diagnostic.sql](../scripts/perf-diagnostic.sql)

## Sprint P-2 focus — closed ✅ 2026-06-02

- [x] Recommendations cache on `estate_health_scores` — recompute persists, dashboard reads cache (`47a38f3`)
- [x] Projections cache-first in `loadProjectionData` — serve `outputs_s1_first` when fresh
- [x] Layout auth dedup via `getDashboardLayoutContext` (React `cache()`)
- [x] Migration `20260602130000_sprint_p2_recommendations_cache.sql` — apply in prod before deploy
- [x] [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) § Sprint P-2

## Sprint C-6 focus — closed ✅ 2026-05-25 (prod)

- [x] `lib/compliance/deleteUser.ts`, `deletionGuards.ts`, `scheduleDeletionOnCancel.ts` — `4d9571e`
- [x] Migration `20260625120000_sprint_c6_deletion_compliance.sql` — applied in prod
- [x] Webhook plan-change guards + cron re-verification
- [x] Admin `/admin` → Data & Compliance tab + APIs — `01b997a`
- [x] `scripts/gdpr-delete-user.ts` → `deleteUser`
- [x] [COMPLIANCE_CALENDAR.md](./COMPLIANCE_CALENDAR.md)

## deleteUser WCPA hardening — closed ✅ 2026-05-25

- [x] FK scan — `firms`, `firm_members`, `change_log` + full `FK_TABLES_TO_USER` list — `3cdd9b5`
- [x] Orphan Auth handling, hard/soft delete fallback, post-deletion verification — `aea4bf6`
- [x] `scripts/verify-deletion.ts` — `npm run verify:deletion`
- [x] `scripts/cleanup-test-accounts.ts --rolobe`, `scripts/verify-drip-sequence.ts` — `84388ad`
- [x] Auth table clean — 9 accounts; all `@rolobe.resend.app` retired
- [x] [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md), [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md), [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md), [NEXT_SESSION.md](./NEXT_SESSION.md), [ROADMAP.md](./ROADMAP.md)

## Sprint UX-1 — Life events hub ✅ closed 2026-05-25

- [x] Public `/events` hub — all 24 slugs by category — `6fb73e6`
- [x] In-app `LifeEventBanner` picker — search, relevance, logged-events list
- [x] Public nav + homepage links; sitemap `/events`
- [x] [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md), [NEXT_SESSION.md](./NEXT_SESSION.md), [ROADMAP.md](./ROADMAP.md)

## Sprint C-7 focus — closed ✅ 2026-05-25 (prod)

- [x] `privacy_requests` + compliance-reminders cron — `ddbf079`, `1ce9110`
- [x] `COMPLIANCE_EMAIL=avoels@comcast.net` in Vercel Production
- [x] Consumer `/settings/security` privacy form + confirmation email
- [x] Admin Privacy Requests tab
- [x] Crons verified on `https://www.mywealthmaps.com` (not apex — redirect strips auth)

## Compliance infrastructure (C-6 + C-7) ✅ LIVE

| What | How | Status |
|------|-----|--------|
| 30-day post-cancellation deletion | Stripe → `deletion_schedule` → 2am cron | ✅ Live |
| Plan-change guard | Webhook + cron | ✅ Live |
| Deletion audit trail | `deletion_audit_log` | ✅ Live |
| Admin deletion UI | `/admin` → Data & Compliance | ✅ Live |
| Daily compliance check | 8am cron → `avoels@comcast.net` if issues | ✅ Live |
| WCPA privacy requests | In-app form + 45-day SLA | ✅ Live |
| Email infrastructure | `hello@`, `noreply@`, `privacy@` verified | ✅ Live |
| Migrations | **75** in `supabase/migrations/`; through `20260625170000` | ✅ Clean |

**Monthly (ongoing):** Admin Portal → Data & Compliance — overdue deletions + audit log; rely on daily `COMPLIANCE_EMAIL` alerts when issues exist.

## Sprint F-2 focus — shipped 2026-06-02

- [x] Header detection, sheet picker, inline editor, duplicates, traceability, delete pending — `9b524aa`
- [x] Automated tests — `a344032` (`npm run test:import:unit`, `npm run test:import:api`)
- [ ] Apply `20260602150000_sprint_f2_import_traceability.sql` in prod before deploy (if not applied)
- [ ] Optional manual smoke I.5–I.9 — automated suite covers Phase 9 API scenarios; SQL traceability in API tests with `SUPABASE_SERVICE_ROLE_KEY`

## Sprint F-1 focus — closed ✅ 2026-06-02 (verified production)

- [x] `POST /api/ingest` — CSV/XLSX parse, auto-detect table, field mapping, `ingestion_jobs` store (`d3400b1`)
- [x] Client commit URL fix — `/api/import/commit`
- [x] Tier gate aligned to tier 2 on `/import`
- [x] Sample CSV templates in `public/templates/`
- [x] `ingestion_jobs` schema cleanup — `file_name` / `file_type` canonical columns (`b5bb0b1` + this commit)
- [x] Production smoke: 4 asset rows imported, `status = committed`

## Sprint 17 focus (current — go-live prep, non-code)

| Item | Notes |
|------|-------|
| [ ] **LEGAL_TODO.md** | Counsel handoff: §10/§11/§13 flagged, one consolidated redline; placeholders + redlines in one commit — [§ Counsel handoff](./LEGAL_TODO.md#counsel-handoff--how-to-send-the-tos) |
| [ ] **Stripe Dashboard config** | invoice.upcoming, portal cancel, receipts — [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) |
| [ ] **C-4 manual walkthrough** | Signup → paid → receipt → self-serve cancel on production |
| [ ] **Stripe production billing** | Required before opening signups |
| [ ] **Go-live day** | Supabase Auth ON → verify `/auth/callback` → `PUBLIC_SIGNUP_OPEN=true` → Core §1–3 smoke with fresh email |
| [ ] **Drip step 2 check** | `npm run verify:drip -- --email e2e-drip@mywealthmaps.test` |
| [x] **Sprint P-1 perf quick wins** | `5c24160` — see [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) |
| [x] **Sprint P-2 pre-launch refactors** | `47a38f3` — recommendations cache, projections cache-first, auth dedup |

**Compliance code (C-2b–C-5):** ✅ All closed on `main` — see [NEXT_SESSION.md](./NEXT_SESSION.md) commit log.

## Sprint C-5 focus — closed ✅ 2026-06-02 (code)

- [x] **Privacy Policy** — `/privacy` (`2e1dff3`, `695a860`)
- [x] **Terms of Service** — `/terms`; post-checkout accept at `/terms/accept`
- [x] **Footer + SEO** — `LegalFooterLinks`; sitemap + robots
- [ ] **LEGAL_TODO.md** — placeholders + counsel (manual)

## Sprint C-4 focus — closed ✅ 2026-06-02 (code)

- [x] **Billing disclosures** — `lib/compliance/billing-disclosures.ts`; pre-checkout, cancel, renewal reminders (`462bda9`)
- [ ] **Manual Stripe walkthrough** — [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md)

## Sprint 16 focus — closed ✅ 2026-05-24

- [x] **Sprint C-2b UX Language Audit** — all `DISCLAIMER_STRINGS` surfaces wired (`788aa08`); `audit-ux-language.sh` 0 findings
- [x] **Sprint C-3 RLS + auth/security** — RLS (`236890c`); auth callback, MFA, headers (`56a4407`); push RLS migration to prod if not applied
- [x] Billing + legal pages — C-4 code (`462bda9`); C-5 code (`2e1dff3`, `695a860`); manual verify remains

## Pre-Sprint-15 go-live env vars — closed ✅ 2026-05-24

Verified in **Vercel → Production**:

- [x] `NEXT_PUBLIC_APP_URL` → `https://mywealthmaps.com`
- [x] `RECOMPUTE_SECRET`, `RESEND_API_KEY`, `INTERNAL_API_KEY`, `CRON_SECRET` — all set
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — confirmed
- [x] `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` → **not needed** (Cloudflare Search Console verification)
- [ ] **Open signups:** `PUBLIC_SIGNUP_OPEN=true` → Sprint 17 go-live day (after legal + C-4 manual verify)

Full table: [LAUNCH_CHECKLIST.md § Vercel Production env vars](./LAUNCH_CHECKLIST.md#vercel-production-env-vars-sprint-15-go-live--verified-2026-05-24).

## Sprint — RPC guards + attorney RLS + edge auth ✅ closed 2026-05-29

- [x] `assert_household_caller_access()` — migration `20260629120000_rpc_household_access_guards.sql`
- [x] Attorney RLS fix — migration `20260629130000_attorney_rls_policy_fix.sql`
- [x] Monte Carlo edge JWT auth — `supabase/functions/estate-monte-carlo/index.ts`
- [x] Rate limits — `lib/api/simpleRateLimit.ts`; referral 60/min; telemetry 120/min + auth
- [x] Unit test `simpleRateLimit.spec.ts` — **39/39** in `npm run test:unit`
- [x] **Prod deploy:** `supabase db push` + `supabase functions deploy estate-monte-carlo` — applied 2026-05-29 on `fnzvlmrqwcqwiqueevux`
- [x] **Prod SQL verify:** migrations `20260629120000` + `20260629130000`; `assert_household_caller_access` present; attorney policies use `attorney_listings` join — `scripts/verify-security-sprint-20260629.sql`
- [x] **Prod browser smoke:** [LAUNCH_CHECKLIST § Security hardening post-deploy](./LAUNCH_CHECKLIST.md#security-hardening-post-deploy-browser-smoke-2026-05-29) — 7/7 on prod 2026-05-30 (`npm run test:e2e:security-smoke`)

## Sprint — State exemption dashboard wire ✅ closed 2026-05-30

**Commit:** `0686f52` · **Migration:** `20260630110000_state_estate_tax_rules_no_portability.sql`

- [x] `no_portability` column; WA/MA/OR true; WA 2025+ exemption $3M
- [x] `dashboard/_dashboard-body.tsx` — `state_estate_tax_rules` in existing `Promise.all`
- [x] `EstateTaxSnapshotPanel` — exemption, portability note, state taxable, state tax
- [x] Master docs synced
- [ ] **Prod:** `supabase db push` before deploy

## Sprint — Estate summary dashboard consolidate ✅ closed 2026-05-30

**Commit:** `deb0080`

**Files:** `_dashboard-client.tsx` · `EstateCalloutCard.tsx` · `DashboardIntroSection.tsx`

- [x] Tax exposure hero — red (`estimatedTaxState > 0`) or amber (federal-only)
- [x] Four metric tiles; beige card removed
- [x] Checklist + tax snapshot `sm:grid-cols-2` (stacks mobile)
- [x] Greeting subtitle + state; compact alert pills
- [x] EstateSummarySection (readiness, gaps, titling) unchanged below Financial/Retirement
- [x] Master docs synced

## Sprint — Social Security page polish ✅ closed 2026-05-30

**Client:** `app/(dashboard)/social-security/_ss-client.tsx`

- [x] Hero elected cards (blue/emerald 2px border) + muted FRA reference tiles
- [x] Insight card — `deltaVsFRA`, combined monthly, `person2.survivorBenefit`, breakeven age
- [x] Cumulative SVG chart — elected / FRA / age 62 via `cumulativeByAge`
- [x] Claiming tables — relative bar, FRA badge, elected highlight, breakeven note (P1 blue, P2 emerald)
- [x] Recommendation paragraph removed; spousal section below unchanged
- [x] Master docs synced
- [x] **Prod data verify (Alan, programmatic):** survivor $4,888/mo · crossover elected vs FRA age 84
- [ ] **Post-deploy visual smoke (once):** Alan → `/social-security` — insight survivor card · chart crossover · spousal block unchanged

## Sprint — RMD Calculator page polish ✅ closed 2026-05-30

**Client:** `app/(dashboard)/rmd/_rmd-client.tsx`

- [x] Hero lifetime + peak stats (from full `rows` array)
- [x] Status cards — years-away / Active badges; 2-col single / 4-col married
- [x] Accounts — per-person total; `grid-cols-1 sm:grid-cols-3`; joint/unassigned
- [x] Tax callout — 28% blended (no marginal rate in page props)
- [x] Decade navigator → `goToPage(i)` / `setPeriodOffset`; inflection highlights + legend
- [x] Single-user gates via `household.has_spouse`
- [x] Master docs synced
- [x] **Years-away verify (Alan, programmatic):** Alan **9** yr (2035) · Cathi **16** yr (2042) from `rows.find(r => r.p*_rmd > 0)`
- [ ] **Post-deploy visual smoke (once):** `/rmd` — decade nav · row highlights · years-away badges on status cards

## Sprint — Dashboard cleanup ✅ closed 2026-05-30

**Files:** `_dashboard-client.tsx` · `EstateSummarySection.tsx`

- [x] Remove Common Planning Topics from estate summary collapsible
- [x] Titling conflicts — badges + link to `/titling` only (no detail list)
- [x] Bypass trust alert below tax hero (`parseBypassTrustSavings` from recommendations reason string)
- [x] **`afterMetrics` slot** — alert after four metric tiles, before checklist/tax snapshot grid
- [x] Conflict badges preserved (`conflictReport.critical` / `.warnings`)
- [x] Alan prod verify: **`by $645,463`** parses to bypassTrustSavings = 645463
- [x] Remove duplicate mid-page dismissible conflict banner (intro pills only)
- [x] Readiness score pill on intro row (`estateHealthScore.score`; detailed breakdown stays in estate summary)
- [x] Estate Tax Snapshot — composition waterfall + strategy panel (`/estate-tax`) — `3c9a97a`
- [x] Nav rename: Tax Horizons & Strategy
- [ ] **Post-deploy visual smoke (once):** Alan `/estate-tax` — waterfall + strategy toggles · $0-tax household — waterfall only
- [x] Master docs synced
- [x] Consolidated alert panel on dashboard (`ConsolidatedAlertPanel`) — **superseded 2026-05-29 Sprint B**
- [x] Score-driven dashboard — `EstateReadinessCard` · `PriorityAlertCard` · adaptive greeting · `household_alerts` fetch
- [x] Remove duplicate score from `EstateSummarySection`; ungate score cards on `estateHealthScore`
- [x] Remove titling conflict badges from `EstateSummarySection` (priority alerts cover titling)
- [x] Estate flow horizon tabs — engine: `findClosestOutputRow` + `findAtDeathRow`; asset tiles stay current holdings
- [x] Estate flow consumer view — `horizonOverride` from `buildStrategyHorizons`; stale-fetch guard; prominent total; caption sync
- [ ] **Post-deploy smoke:** Voels — Today ~$9.6M · In 10 Years ~$20.98M · At Longevity ~$97.7M; rapid tab click settles on correct final number

## Sprint — Score rationalization + dashboard UI ✅ closed 2026-05-29

**Sprint A commit:** `843585c` · **Files:** `lib/estate-health-score.ts`, consumer PDF, unlock gate, execution checklist, `docs/SCORE_TAXONOMY.md`

**Sprint B files:** `_dashboard-body.tsx` · `_dashboard-client.tsx` · `EstateReadinessCard.tsx` · `PriorityAlertCard.tsx` · `scoreDisplayHelpers.ts` · `readinessBenchmarks.ts`

- [x] One consumer label — `ESTATE_READINESS_LABEL` everywhere
- [x] Consumer PDF uses `estate_health_scores.score` (not completeness grade)
- [x] Benchmark bar + component pills + priority alert card
- [x] Master docs — **DECISION_LOG**, **MASTER_ARCHITECTURE**, **CONSUMER_FLOWS**, **NEXT_SESSION**, **ROADMAP**, **SCORE_TAXONOMY**, smoke test

## Sprint — Dashboard Financial Summary — no allocation card ✅ closed 2026-05-30

**Files:** `FinancialSummarySection.tsx` · `_dashboard-client.tsx` · `dashboard/_dashboard-body.tsx`

- [x] Remove **`AssetAllocationSummary`** from dashboard Financial Summary collapsible
- [x] **`/allocation`** + **`loadAssetAllocationData`** + **`buildAllocationContext`** in mappers unchanged
- [x] Master docs — **DECISION_LOG**, **CONSUMER_FLOWS**, **MASTER_ARCHITECTURE**, **NEXT_SESSION**

## Sprint — Three-state dashboard progression ✅ closed 2026-05-30

**Commit:** `b71af63` · **Files:** `determinePlanStage.ts` · `_dashboard-body.tsx` · `_dashboard-client.tsx` · `DashboardIntroSection.tsx` · `FinancialSummarySection.tsx`

- [x] `getDashboardState()` — State 1 onramp (`page.tsx`), State 2 financial hero, State 3 full estate layout
- [x] State 2 — net worth hero, amber unlock prompt, `SetupProgressCard`, Financial/Retirement collapsibles
- [x] State 3 — Alan layout unchanged (tax hero, alerts, readiness strip, checklist)
- [x] Master docs synced

---

## Tax Horizons & Strategy — consumer polish ✅ closed 2026-05-30

**Commit:** `56762ad`

- [x] Readiness pill in page header (`healthScore` prop)
- [x] Bypass-trust impact bar — `parseBypassTrustSavings.ts` shared with dashboard
- [x] What-if tab hidden when `projectedCount === 0`
- [x] Remove embedded `EstatePlanningDashboard` (completeness + planning topics)
- [x] `ConsumerEstateFlowView` — grouped asset summary + expand
- [x] Master docs synced
- [ ] **Post-deploy smoke:** `/my-estate-strategy` — pill · bypass bar · grouped assets

## Advisor strategy tab — visual polish ✅ closed 2026-05-30

- [x] `StrategyAlertBanners` — primary liquidity + secondary alerts
- [x] `AdvisoryMetricCard` — optional `severity` (default `neutral`); status labels
- [x] `estimateStrategySavings.ts` — catalog keys (`cst`, `ilit`, `annual_gifting`, …)
- [x] `CompositeOverlay` — hide waterfall when no active recommendations
- [x] `MonteCarloPanel` — empty state before first run
- [x] `MonteCarloPanel` — precomputed Depletion Risk tile (`longevity_depletion_pct` from `mcSummary`)
- [x] **`EstateOutlookChart`** — state exemption threshold line on `/projections` (`stateExemption` prop; `state_estate_tax_rules` fetch on `page.tsx`)
- [x] **`/estate-tax`** — WA threshold probability sentence (`wa_threshold_prob_by_year[0]` from `loadScenarioMonteCarlo`)
- [x] Codebase cleanup — dead components, estate-tax fetch trim, `/my-advisor` multi-row fix
- [x] Constants — `lib/gifting/perRecipientLimit.ts`; PDF `firstTaxYearP10` stored signal
- [x] Perf P-3 — memo charts, scenarios row index, `getFullHouseholdForOwner`
- [x] Master docs synced — Phase 3 MC UI complete + cleanup pass
- [ ] **Post-deploy smoke:** Voels `/estate-tax` · `/my-advisor` · PDF MC narrative line

## Advisor Estate tab — visual polish ✅ closed 2026-05-30

- [x] Liquidity crisis hero — `composition.inside_liquid` (fallback asset `liquidity === 'liquid'`) vs federal+state tax
- [x] Two-column layout — composition + waterfall left; conflict cards right (`showMetrics={false}` on card)
- [x] Documents hero — missing critical `ESTATE_DOC_TYPES` (`exists !== true`)
- [x] Beneficiaries — group by asset name via `asset_id` / single-asset type match
- [x] Estate flow — summary tiles + toggled `EstateFlowDiagram`
- [x] Accounts — six consolidated groups (IRA, 401(k), brokerage, Roth, bank, other)
- [x] Master docs synced
- [ ] **Post-deploy smoke:** Advisor Estate tab — liquidity hero on Alan · waterfall · conflict cards · flow toggle

## Advisor Retirement tab — wire data + polish ✅ closed 2026-05-30

- [x] `page.tsx` — pass `scenarioOutputs` (`YearRow[]` from `@/lib/calculations/projection-complete`)
- [x] `loadSocialSecurityData(supabase, clientId)` — survivor on `person2.survivorBenefit`; breakeven from `person1.scenarios`
- [x] `runRothAnalysis()` — `optimalConversionWindow`, `totalLifetimeTaxSavings`, `totalConversions`
- [x] Loaders — retirement tab enables `scenario: true`, `stateIncome: true`
- [x] Readiness hero · retirement-year snapshot · asset mix · SS + RMD two-col · withdrawal sequencing
- [x] Kept RMD planning banner + Planning Assumptions
- [x] Master docs synced
- [ ] **Post-deploy smoke:** Advisor Retirement tab on Alan — readiness hero · survivor benefit · Roth window · RMD ages (1960+ → 75)

## PDF exemption + action-item dedupe ✅ closed 2026-05-30

- [x] Page 3 `federalExemption` → `currentFederalExemption()` (not raw `estate_exemption_individual`)
- [x] Trust alert title sentence case — `conflict-detector` + PDF `enrichActionItems` canonical title
- [x] PDF tax callout — `appendPlanningGapNote()` · separator; no double period
- [x] `dedupeActionItems()` — sort enriched first; filler-normalized `actionItemDedupeKey()` (20-char stem)
- [ ] **Post-deploy smoke:** Voels MFJ — page 3 ~$28M exemption; trust alert once under Documents

## pdfFilingStatus build fix ✅ closed 2026-06-01

- [x] `lib/export/pdfFilingStatus.ts` — pure `normalizePdfFilingStatus` (no `supabase/server`)
- [x] `MeetingPrepTab` imports from `pdfFilingStatus` — fixes client bundle / `npm run build`

## PDF strategy page dedupe ✅ closed 2026-06-01

- [x] “Strategies worth discussing” uses `enrichedActions` (not raw `data.actionItems`)
- [ ] **Post-deploy smoke:** Voels PDF page 4 — single trust line in gap list

## PDF page 2 SVG chart fix ✅ closed 2026-06-01

- [x] `buildEstateSVGChart()` — inline SVG (no Chart.js / canvas / CDN)
- [x] Print-safe: chart renders in Cmd+P without JavaScript
- [x] Removed canvas, Chart.js CDN script, init script, `.chart-container` CSS
- [ ] **Post-deploy smoke:** Voels `?type=report` — SVG visible in print preview

## PDF page 2 estate snapshot chart ✅ closed 2026-06-01

- [x] `projectionChartRows` on `PDFReportData` — from `params.scenarioOutputs` in `exportMappers.ts`
- [x] Estate growth chart + `detectTaxCliff()` callout (now inline SVG)
- [x] Two-column asset breakdown + health components below chart
- [x] Empty state when base case not run

## Print brief at-death tax ✅ closed 2026-06-01

- [x] `meetingPrepAtDeath` on `loadAdvisorExportWiringForClient` — `totalTaxLiability` from `advisorHorizons.atDeath`
- [x] Brief route: primary tax from `meetingPrepAtDeath`; projection row tax in `else` fallback only
- [ ] **Post-deploy smoke:** Voels — Est. tax exposure matches modal (not $0)

## Print brief stat cards ✅ closed 2026-06-01

- [x] `renderMeetingBriefHtml()` — `findAtDeathRow` for projected estate gross; tax via horizons (see above)
- [x] Removed **"At retirement"** mislabel; dynamic **At death (age X)** on tax + projected cards
- [x] Household select extended (birth years, longevity) for at-death row lookup
- [x] Template `sprint-four-surface-polish-v2` (`X-Brief-Template` header)
- [ ] **Post-deploy smoke:** Voels — v2 header · at-death projected estate · no "At retirement" in HTML

## Four-surface advisor polish ✅ closed 2026-06-01

- [x] `lib/advisor/advisorBriefHelpers.ts` — shared brief enrichment, agenda, branding, PDF asset breakdown
- [x] PDF page 2 — `assetBreakdown` + `healthComponents` via `exportMappers` + composition fallback
- [x] PDF strategies page always renders (empty state when no active strategies)
- [x] Meeting brief print — agenda, enriched alerts, score trend, engagement; `?type=brief` template v2 (stat cards)
- [x] Meeting Prep — enriched modal seed, **Open print brief**, complexity context
- [x] `advisor_notes.note_type` migration + API + Notes tab UI
- [x] Master docs synced
- [ ] **Migration:** apply `20260529120000_advisor_notes_note_type.sql` in Supabase before Notes smoke
- [ ] **Post-deploy smoke:** Voels — PDF page 2 · brief `X-Brief-Template` header · Notes type selector

## PDF export path wiring ✅ closed 2026-05-30

- [x] `lib/advisor/loadAdvisorExportWiring.ts` — shared server loader for export payloads
- [x] `GET /api/advisor/meeting-prep-pdf/[clientId]?type=report` → `generatePDFHTML`
- [x] `?type=brief` — legacy one-page meeting brief preserved
- [x] Header: **Export estate report** + **Meeting brief** (replaces single "Prepare for meeting")
- [x] Meeting Prep tab: **Export estate report (PDF)** link
- [x] Master docs synced
- [ ] **Post-deploy smoke:** Header **Export estate report** + Meeting Prep **Export PDF Report** — same narrative cover

## PDF narrative engine ✅ closed 2026-05-30

- [x] `lib/export/narrativeEngine.ts` — executive summary, tax callout, health trend, action enrichment, gifting bar, theme groups
- [x] `lib/export/fetchNarrativePdfFields.ts` — six async reads in **`Promise.all`**
- [x] Extend `PDFReportData` + `ActionItem` (`title` + `message` from `household_alerts`)
- [x] Wire `page.tsx` → `exportMappers.ts` → `ExportPanel` → `generatePDFHTML`
- [x] Meeting Prep — top 3 open alerts above Export
- [x] Master docs synced
- [ ] **Post-deploy smoke:** Voels → Meeting Prep → Export PDF — cover narrative · tax callout · grouped action items ([LAUNCH_CHECKLIST](./LAUNCH_CHECKLIST.md#pdf-narrative-engine-manual-smoke-2026-05-30))

## Sprint — Roth methodology note ✅ closed 2026-05-30

**Commit:** `6cb942a` · **File:** `_roth-client.tsx`

- [x] Expanded methodology note (calculation steps + model limits)
- [x] Master docs synced

## Sprint — Roth bracket headroom fix ✅ closed 2026-05-30

**Files:** `lib/calculations/roth-analysis.ts` · `_roth-client.tsx` · `tests/unit/roth-analysis.spec.ts`

- [x] **`getBracketHeadroom`** — federal RMD rate; fill to 22% ceiling when RMD marginal ≥ 24%
- [x] **`pickRothConversionDisplayContext()`** — insight + WhatIf use conversion-window rate
- [x] Unit tests — `import-unit` project (`roth-analysis.spec.ts`)
- [x] Master docs synced
- [x] **Commit:** `cae89fc`
- [ ] **Post-deploy smoke:** Alan `/roth` — gap-year emerald rows + correct rate comparison

## Sprint — Roth Conversion polish ✅ closed 2026-05-30

**Commit:** `839bfbb` · **Client:** `app/(dashboard)/roth/_roth-client.tsx`

- [x] Stat cards + insight card (rate comparison, triggers)
- [x] `WhatIfPanel` — slider; break-even `—` when `rateDiff = 0` (superseded by WhatIfPanel fix below)
- [x] Balance projection above grouped table; tab UI removed
- [x] Grouped table by `conversionRationale`; year · age column; sticky headers
- [x] Transfer Strategies CTA above methodology (when conversions > 0)
- [x] Master docs — **CONSUMER_FLOWS.md**, **NEXT_SESSION.md**, **UPDATE_CHECKLIST.md**, **ROADMAP.md**
- [x] **Prod smoke (`e2e-consumer`):** layout, slider, equal-rate break-even, group headers, tabs gone, CTA hidden at $0
- [ ] **Manual smoke:** household with recommended conversions — emerald rows + CTA → `/my-estate-trust-strategy?tab=strategies&openPanel=roth`

## Sprint — Roth WhatIfPanel fix ✅ (2026-05-30)

**File:** `app/(dashboard)/roth/_roth-client.tsx` — **`WhatIfPanel` only**

- [x] Signed **`lifetimeNetBenefit`** + **Lifetime extra cost** label when delay optimal
- [x] **"Delay is better"** replaces break-even dash when current rate ≥ projected RMD rate
- [x] Slider-reactive **`iraBalanceAtRmd`** + conversion delta annotation
- [x] Panel title **"(delay is optimal)"**; local **`fmtPanel`** for negatives
- [x] Master docs synced
- [ ] **Post-deploy smoke:** Alan `/roth` — slider updates all four WhatIf cells ($50K → $12K tax, −$15K extra cost)

## Sprint — Lifetime Snapshot polish ✅ closed 2026-05-30

**Client:** `app/(dashboard)/complete/_complete-client.tsx`

- [x] Hero **Funds outlast lifetime** — full-height green/red card + four stat cards
- [x] Decade timeline navigator — `activePage` only; derived `pageStart` (no separate useState)
- [x] Inflection rows — amber highlight + badges (SS begins, RMD begins, peak net worth)
- [x] Net CF — emerald/red with consistent `+` prefix on positive
- [x] Sparkline **Trend** column after ages
- [x] Legend above expand toggles; sticky Year column on horizontal scroll
- [x] SS/RMD sub-columns auto-hide when all zero on current page (`personColumnCount` colSpan)
- [x] Master docs — **CONSUMER_FLOWS.md**, **NEXT_SESSION.md**, **UPDATE_CHECKLIST.md**, **ROADMAP.md**
- [x] **Post-deploy visual smoke (once):** `/complete` on prod 2026-05-30 — hero · decade jump · SS badges + amber rows · SS hidden page 1 / visible page 2 · **14=14 colSpan alignment** (`e2e-consumer@mywealthmaps.test`)

## Sprint — Prod API route fix ✅ closed 2026-05-30

- [x] Documents slug conflict — `GET /api/documents/household/[household_id]` (was `/api/documents/[household_id]`)
- [x] `lib/supabase/routeAuth.ts`, `GET /api/health`, advisor preset route runtime flags
- [x] [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) added; master docs synced
- [x] Commit `af12ff0`

## Sprint — 6-step onboarding wizard ✅ closed 2026-05-29

**Commit:** `385dd4b` · Expand wizard from 3 → 6 steps

- [x] Steps 1–2 unchanged (assets, income) — **no** Skip for now on required steps
- [x] Steps 3–5 added: liabilities → expenses → insurance — **Skip for now** on 3–5 only
- [x] Step 6 advisor invite — unchanged from prior flow
- [x] `_wizard-client.tsx` — **6-dot** indicator; `saveLiability()`, `saveExpense()`, `saveInsurance()` handlers
- [x] `firstIncompleteStep()` + `stepComplete()` — all **6** steps
- [x] `PREVIEW_BY_STEP` — value-focused copy for all 6 steps
- [x] Step 5 write → **`POST /api/insurance`** (not `/api/consumer/insurance`)
- [x] `guidedOnboardingHref.ts` — core complete = all **5** data sections
- [x] `guided-onboarding-href.spec.ts` — **11** unit tests
- [x] Master docs — wizard section rewritten in **CONSUMER_FLOWS.md**, **NEXT_SESSION.md**, **UPDATE_CHECKLIST.md**
- [ ] **Post-deploy prod smoke (once):** fresh test user on production — **6 step dots** render; walk steps 1–6; confirm each save persists end to end (insurance via `/api/insurance`); Guide resumes correctly after partial progress

## Sprint — Onramp guided path bounce fix ✅ closed 2026-05-29

- [x] `lib/dashboard/guidedOnboardingHref.ts` — `resolveGuidedOnboardingHref()`, `shouldRedirectCompletedWizardToDashboard()`
- [x] `dashboard/page.tsx` — setup-progress-aware `guidedHref`
- [x] `onboarding/wizard/page.tsx` — conditional redirect; profile `from=` param
- [x] `onboarding/persona/page.tsx` — profile `from=` param
- [x] `tests/unit/guided-onboarding-href.spec.ts` — 6 cases in `import-unit`
- [x] Master docs synced

## Sprint — Import format surfacing ✅ closed 2026-05-29

- [x] `_SupportedFormats.tsx` — broker CSV, multi-sheet Excel, single-table CSV
- [x] Upload step reorder — templates above drop zone in `_import-client.tsx`
- [x] `DashboardOnramp` import card copy + format hint line
- [x] Master docs synced (ROADMAP · NEXT_SESSION · DECISION_LOG · MASTER_ARCHITECTURE · CONSUMER_FLOWS · CONSUMER_NAV_MAP · CONSUMER_RELEASE_SMOKE_TEST · SPRINT_IMPORT_ATTORNEY)

## Sprint — Dashboard onramp ✅ closed 2026-05-30

- [x] `lib/dashboard/onrampGate.ts` — `shouldShowOnramp()`, `ONRAMP_SCORE_THRESHOLD = 60`
- [x] `components/dashboard/DashboardOnramp.tsx`
- [x] `app/(dashboard)/dashboard/page.tsx` gate before `DashboardBody`
- [x] Golden-path seed — `ensureMinEstateHealthScore` + recompute 15s timeout
- [x] `scripts/check-golden-path-onramp-gate.ts`
- [x] **Path fix:** `guidedHref` persona-first; `/dashboard` wizard gate exempt
- [ ] **Manual smoke:** fresh user — Import / Guide (persona→wizard) / Self (`/assets`)
- [x] Master docs synced

## Sprint — Cross-role E2E + persona Card fix ✅ closed 2026-05-30

- [x] Cross-household IDOR matrix — `test:e2e:security-isolation` 10/10
- [x] Advisor sync, attorney docs/gaps, persona onboarding specs
- [x] Persona gate → `isWizardReadyProfile` + full household SELECT
- [x] `Card.tsx` — `ComponentPropsWithoutRef<'div'>` + `{...rest}` so `aria-pressed` renders on clickable root
- [x] `onboarding-persona.spec.ts` — card-wrapper click + PATCH wait
- [x] Attorney FK migration `20260630100000` applied prod
- [x] Master docs synced (ROADMAP · NEXT_SESSION · DECISION_LOG · MASTER_ARCHITECTURE · PLAYWRIGHT_E2E · CONSUMER_FLOWS)

## Sprint — Security + CI + dead code cleanup ✅ closed 2026-05-29

- [x] `fix(security)` — internal email gates, household access, signed unsubscribe, webhook auth
- [x] `chore` — remove ~3.5k lines orphaned components + `/advisor/prospect` redirect
- [x] `test(ci)` — GitHub Actions: lint, build, security-audit, UX language, unit tests (39)
- [x] `test(e2e)` — prospect redirect, health score, advisor activation, mobile overflow specs
- [x] Master docs updated

## Sprint — Health Score + Advisor Playbook ✅ closed 2026-05-29

- [x] `HealthScoreBadge`, `EstateHealthScoreBlock`, `MyEstateStrategyHealthScore`
- [x] `scoreContextSentence()`, `scoreContextSentenceForAdvisor()`, `isScoreStale()`
- [x] Advisor empty state, `AdvisorFirstClientPlaybook`, needs-attention panel
- [x] Migration renames: `20260530100000_onboarding_persona.sql`, `20260530110000_attorney_intake_requests.sql`
- [x] Master docs: ROADMAP · LAUNCH_CHECKLIST · MASTER_ARCHITECTURE · DECISION_LOG · NEXT_SESSION · UPDATE_CHECKLIST
- [ ] Manual smoke Tracks 1–2 (18 steps) — [LAUNCH_CHECKLIST](./LAUNCH_CHECKLIST.md#health-score--advisor-playbook-manual-smoke-2026-05-29)

## Verification pass

Use this for **all** merges. For **tax/engine** changes, also run the extra spot-checks in [MASTER_ARCHITECTURE.md → Release verification](./MASTER_ARCHITECTURE.md#release-verification).

- [ ] `npm run build` passes
- [ ] Spot-check affected surfaces (projection/roth/strategy/domicile as applicable)
- [ ] Confirm staleness or backfill guidance is still accurate
- [ ] After deploy: optional [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) (~10 min core)
- [ ] Education links: `EDUCATION_LINK_BASE_URL=https://mywealthmaps.com node scripts/validate-education-links.mjs` (run against production after any education content changes)
- [ ] After import deploy: tier 2+ smoke on `/import` (see [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) I.1–I.4) — **passed production 2026-06-02**
- [ ] After F-2 deploy: `npm run test:import:unit` and `npm run test:import:api` (F-2 migration on test DB)

## Commit hygiene

- [ ] Include doc updates in the same PR/commit as code changes
- [ ] Commit message mentions doc sync (architecture/schema/flows)
