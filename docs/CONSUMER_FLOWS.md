# Consumer flows

Journey-oriented reference for how consumers move through the app: **routes → server pages → write APIs → side effects → UI refresh**.

**Companion docs (do not duplicate here):**

| Doc | Use for |
|-----|---------|
| [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md) | Sidebar labels, URLs, tiers, feature keys, portal link visibility |
| [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) | Consumer/advisor handoff, strategy/MC/access channels, migration status |
| [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) | Current tables, RPCs, authoritative columns |
| [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md) | Session-by-session schema/app audit trail |
| [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) | **Human** deploy verification (~10 min core; full ~30 min) |
| [UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md) | **When and how to update** all docs (single maintenance guide) |

**Tier legend:** 1 = Financial, 2 = Retirement, 3 = Estate (`lib/tiers.ts`, `FEATURE_TIERS`).

---

## How writes propagate

Most consumer saves follow the same server-side pattern:

```mermaid
flowchart LR
  UI[Client form / panel] --> API[API route]
  API --> DB[(Supabase tables)]
  API --> AHW[afterHouseholdWrite]
  AHW --> Touch[touchHousehold updated_at]
  AHW --> Recompute[triggerEstateHealthRecompute async]
  Recompute --> EHS[estate_health_scores cache]
  Recompute --> Conflicts[beneficiary_conflicts cache]
  Dashboard[Dashboard / gated pages] --> Read[Read cached scores on next load]
```

- **`lib/consumer/afterHouseholdWrite.ts`** — `touchHousehold` + non-blocking `triggerEstateHealthRecompute`.
- **Estate composition** — `classifyEstateAssets` → Postgres RPC `calculate_estate_composition` (server render or `POST /api/estate-composition`).
- **Horizons** — `buildStrategyHorizons` in `lib/my-estate-strategy/horizonSnapshots.ts` (fed by `strategy_line_items` + base-case projection).
- **Client refresh** — typically `router.refresh()` after save; composition/strategy totals may lag recompute by a few seconds (see e2e polls in `consumer-strategy-writes.spec.ts`). **`/allocation`** (19a): after `PATCH` allocation targets, refresh only — no redundant `GET /api/asset-allocation`.

---

## Flow template

Each feature section below uses this shape:

| Field | Meaning |
|-------|---------|
| **User goal** | What the consumer is trying to accomplish |
| **Tier / gate** | Minimum tier; profile gate yes/no |
| **Server** | `page.tsx` data loading |
| **Client** | Interactive component |
| **Write APIs** | Mutations |
| **Read APIs / RPCs** | Dashboard server prefetch (`loadAssessmentHistory`); assessment widget skips client fetch when hydrated |
| **After save** | Side effects and how UI updates |
| **Key lib** | Shared logic |
| **E2E** | Playwright spec (living contract) |
| **Empty / blocked** | Upgrade banner, profile redirect, empty states |

---

## 0. Public marketing flows

### Planning assessment — `/assess`

| | |
|--|--|
| **User goal** | Self-assess planning readiness across financial, retirement, and estate pillars |
| **Tier / gate** | None (public) |
| **Client** | `app/(public)/assess/page.tsx` |
| **Write APIs** | `assessment_results` insert when logged in; `mwm_pending_assessment` in `localStorage` when logged out |
| **Gating** | Logged-out: overall score + pillar % visible; gap report / next steps require signup or login |
| **After auth** | Pending payload restored and inserted (30-minute window) |

### Life event assessment — `/event/[slug]/assess`

| | |
|--|--|
| **User goal** | Event-specific readiness score (5 questions) |
| **Tier / gate** | None (public) |
| **Client** | `app/(public)/event/[slug]/assess/page.tsx` |
| **Write APIs** | `POST /api/email-capture` when anonymous; `assessment_results` when logged in (`answers._event_slug`) |
| **Content** | `lib/events/content.ts` per slug |

---

## 1. Auth and onboarding

### Login — `/login`

| | |
|--|--|
| **User goal** | Sign in to the dashboard app |
| **Tier / gate** | None |
| **Server** | `app/(auth)/login/page.tsx` |
| **Client** | `app/(auth)/login/_login-form.tsx` |
| **Write APIs** | Supabase Auth (not app REST) |
| **After save** | Redirect to `/dashboard` (or return URL) |
| **E2E** | Covered in smoke test §1 ([CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md)) |

### Profile — `/profile`

| | |
|--|--|
| **User goal** | Household setup: names, birth years, filing status, domicile, SS claiming ages/PIA, tax deduction — **not** planning growth, inflation, or risk (those live on Scenarios and Asset Allocation) |
| **Tier / gate** | Tier 1; **not** profile-gated (this is where users complete the gate) |
| **Server** | `app/(dashboard)/profile/page.tsx` — loads `profiles` + `households`; passes `?required=true&missing=…&from=…` to client |
| **Client** | `app/(dashboard)/profile/_profile-client.tsx`, `profile/_profile-required-banner.tsx` |
| **Layout (2026-05-27)** | Essentials-only form on `/profile`; deferred fields surface via **`ProfileFieldPrompt`** on `/social-security` and `/scenarios` (session dismiss, partial PATCH merge on API). |
| **Minimum complete** | `person1_name`, `person1_birth_year`, `state_primary`, `filing_status` (+ spouse name/birth year if `has_spouse`) |
| **Write APIs** | `PATCH /api/consumer/profile` |
| **After save** | `afterHouseholdWrite`; redirect: if `required=true` and minimum profile complete → `from` param; if MVP complete and wizard not done → `/onboarding/wizard`; if MVP complete and wizard done → `/onboarding/invite-advisor`; else `/dashboard` or `/health-check` |
| **Extended fields (OB-1)** | When `onboarding_wizard_completed_at` is null: `person1_first_name`, `person2_first_name`, `gross_estate_estimate`, `has_minor_children`, `has_business_interests` |
| **Key lib** | `lib/estate/profileGate.ts` (`isMinimumViableProfile`), `lib/profile/buildHouseholdPayload.ts` (pass-through preserves `growth_rate_*`, `inflation_rate`, `risk_tolerance` when not sent) |
| **Cross-links** | Household Planning callout → `/scenarios` (growth + inflation), `/allocation` (risk + target mix) |
| **E2E** | `consumer-profile-save`, `consumer-profile-spouse-layout` (live headers, spouse toggle, section labels; automates smoke §3.1b–3.1c); manual smoke §3 remainder |

**Minimum viable profile** (required for estate planning pages):

| Field | Source |
|-------|--------|
| `state_primary` | Household domicile |
| `filing_status` | Tax filing status |
| Primary DOB | `person1_birth_year` (canonical on `households`; `date_of_birth_1` is legacy type/gate name only — **no DB column**) |

Server redirect when incomplete: `requireMinimumViableProfile` → `/profile?required=true&missing=state_primary,filing_status,…&from=/estate-tax` (`lib/estate/requireMinimumProfile.ts`).

### Persona selection — `/onboarding/persona`

| | |
|--|--|
| **User goal** | Choose the persona that best describes their situation so first-run copy is tailored |
| **Tier / gate** | Tier 1; requires wizard-ready profile (`isWizardReadyProfile`: state, filing, birth year); skipped when `onboarding_persona` is set |
| **Server** | `app/(dashboard)/onboarding/persona/page.tsx` |
| **Client** | `_persona-client.tsx` — 2×2 `<Card hoverable onClick aria-pressed>` grid; Continue → PATCH persona → wizard |
| **Write APIs** | `PATCH /api/consumer/profile` with `{ onboarding_persona }` only |
| **Redirect** | Post-profile save → `/onboarding/persona` (when wizard fields shown and persona NULL) → `/onboarding/wizard` |
| **Fallback** | Sidebar navigation away without selecting → `accumulator` + `persona_skipped` funnel event |
| **Migration** | `20260530_onboarding_persona.sql` — `profiles.onboarding_persona`, `persona_set_at` |

### Onboarding Wizard — `/onboarding/wizard`

| | |
|--|--|
| **User goal** | Build a complete financial picture in order: assets → income → liabilities → expenses → insurance; optionally invite an advisor on the final step |
| **Tier / gate** | Tier 1; requires MVP profile (`isWizardReadyProfile`); server redirect when wizard is marked complete **and** all five data sections have rows (see `shouldRedirectCompletedWizardToDashboard()` in `guidedOnboardingHref.ts`) |
| **Server** | `app/(dashboard)/onboarding/wizard/page.tsx` — loads setup progress; honors `from=` on profile redirect |
| **Client** | `_wizard-client.tsx` — **6-step** flow with **6-dot** step indicator; resume via `firstIncompleteStep()` + per-step `stepComplete()` (all 6 steps); value-focused **`PREVIEW_BY_STEP`** copy for each step; step 1 persona-aware (headline, asset type, template from `personaConfig.ts`) |
| **Steps** | **1** Assets (required, no skip) · **2** Income (required, no skip) · **3** Liabilities (**Skip for now**) · **4** Expenses (**Skip for now**) · **5** Insurance (**Skip for now**) · **6** Invite advisor (unchanged from prior 3-step flow; skip = complete wizard without invite) |
| **Save handlers** | `saveAsset()` → step 1 · `saveIncome()` → step 2 · `saveLiability()` → step 3 · `saveExpense()` → step 4 · `saveInsurance()` → step 5 · step 6 → `POST /api/consumer/onboarding-wizard-complete` and/or invite flow |
| **Write APIs** | `POST /api/consumer/assets` (1) · `POST /api/consumer/income` (2) · `POST /api/consumer/liabilities` (3) · `POST /api/consumer/expenses` (4) · **`POST /api/insurance`** (5 — correct path, not under `/api/consumer/`) · `POST /api/consumer/onboarding-wizard-complete` (6) |
| **Read APIs** | `GET /api/consumer/setup-progress` — section counts drive resume step and dashboard `SetupProgressCard` |
| **Guided entry** | Dashboard onramp **Guide me through it** → `resolveGuidedOnboardingHref()` — persona first if unset, else resume wizard at `firstIncompleteStep()`, else first section missing among all five |
| **Layout gate** | `WizardOnboardingGate` — auto-redirect to wizard when incomplete + wizard-ready + no assets/income; exempt prefixes include **`/dashboard`** (onramp path choice), `/onboarding/wizard`, `/onboarding/persona`, financial planning routes (`wizardGateExemptPrefixes.ts`) |
| **Dashboard** | `SetupProgressCard` — five-section progress from setup-progress API; collapses to one line when all 5 sections started + wizard complete |
| **Migration** | `20260526000000_onboarding_wizard_fields.sql` |
| **Tests** | `tests/unit/guided-onboarding-href.spec.ts` — 11 cases (6-step resume, core complete = all 5 sections) |
| **Post-deploy smoke** | Once on **production** with a **fresh test user**: confirm **6 step dots** render; walk steps 1–6 and verify each save persists (including insurance via `/api/insurance`); onramp **Guide** resumes at correct step after partial progress |

### Invite your advisor — `/onboarding/invite-advisor`

| | |
|--|--|
| **User goal** | Invite an existing advisor or skip; completes post-profile onboarding gate |
| **Tier / gate** | Consumers only; requires MVP profile; blocked when `onboarding_invite_advisor_completed_at` is set |
| **Server** | `app/(dashboard)/onboarding/invite-advisor/page.tsx` |
| **Client** | `_invite-advisor-client.tsx` — email form via `InviteAdvisorByEmailForm`, link to `/find-advisor`, skip |
| **Write APIs** | `POST /api/consumer/invite-advisor` — send invite (sets `consumer_requested` or pre-registration token); `POST /api/consumer/onboarding-invite-advisor` — skip only |
| **Layout gate** | `(dashboard)/layout.tsx` + `InviteAdvisorOnboardingGate` redirect until column set |
| **Migration** | `profiles.onboarding_invite_advisor_completed_at` in `20260530000000_sprint9_10_gates.sql` |

### Business succession — `/business-succession`

| | |
|--|--|
| **User goal** | Document succession plan, key-person dependency, buy-sell status (minimal intake) |
| **Tier / gate** | Tier 3 (`FEATURE_TIERS['business-succession']`); `UpgradeBanner` when below tier |
| **Write APIs** | `PATCH /api/consumer/succession-intake` → `households.succession_*` |
| **Dashboard** | Amber alert when business interests exist and `succession_plan_in_place` is not true |

```mermaid
flowchart TD
  GatePage["Tier-3 planning page\n(estate-tax, horizons, trust-strategy)"]
  GatePage --> Check{Minimum profile?}
  Check -->|no| Profile["/profile?required=true&from=…"]
  Profile --> Save[PATCH /api/consumer/profile]
  Save --> Check2{Complete now?}
  Check2 -->|yes| Return[from URL]
  Check2 -->|no| Stay[Stay on profile]
  Check -->|yes| Render[Render planning UI]
```

**Not profile-gated:** `/dashboard`, `/profile`, tier-1 financial intake (`/assets`, `/income`, …), `/health-check`.

**Profile-gated (tier 3 + minimum profile):**

| Route | Server gate |
|-------|-------------|
| `/estate-tax` | `requireMinimumViableProfile(household, '/estate-tax')` |
| `/my-estate-strategy` | `requireMinimumViableProfile(household, '/my-estate-strategy')` |
| `/my-estate-trust-strategy` | `requireMinimumViableProfile(householdRow, '/my-estate-trust-strategy')` |

Other tier-3 routes (e.g. `/my-family`, `/titling`) use **tier upgrade banners** only, not the minimum-profile redirect.

---

## 2. Financial intake (tier 1–2)

Consumers build the household balance sheet and cash flows before estate surfaces become meaningful.

### Dashboard hub — `/dashboard`

| | |
|--|--|
| **User goal** | Net worth, retirement snapshot, estate readiness, advisor recommendations, setup progress |
| **Tier / gate** | Tier 1; **no** profile gate; shows `DashboardEmptyState` if no household; **`DashboardOnramp`** when wizard incomplete, health score &lt; 60, or no assets/income (`lib/dashboard/onrampGate.ts`) |
| **Server** | `app/(dashboard)/dashboard/page.tsx` — onramp early return or `DashboardBody` via Suspense; loaders in `lib/dashboard/loaders.ts` |
| **Client** | `components/dashboard/DashboardOnramp.tsx` (onramp) · `app/(dashboard)/_dashboard-client.tsx`, `dashboard/_components/*` (full dashboard) |
| **Write APIs** | `PATCH /api/consumer/estate-checklist` (checklist toggles only) |
| **Read APIs / RPCs** | Cached `estate_health_scores` (score + `recommendations` — Sprint P-2), `beneficiary_conflicts`, `classifyEstateAssets`, `strategy_line_items` (advisor pending), `advisor_projection_assumptions` (MC share). **Not on load:** `generate_estate_recommendations` (persisted at recompute; manual refresh in `PlanningGapsSection` only) |
| **After save** | N/A; **other pages’** writes eventually refresh score via recompute |
| **Key lib** | `lib/dashboard/determinePlanStage.ts`, `lib/dashboard/buildEstateExecutionChecklist.ts`, `lib/onboarding/personaConfig.ts`, `components/dashboard/PlanProgressBar.tsx`, `PersonaInsightCard.tsx`, `SetupProgressCard.tsx`, `GET /api/consumer/setup-progress`, `EmptyStateCard.tsx` |
| **E2E** | `tests/e2e/consumer/dashboard.spec.ts` · `golden-path-show-all-tools.spec.ts` (requires score ≥ 60 — `ensureMinEstateHealthScore` in seed) |
| **Key UI sections** | **Onramp:** Import → `/import` · Guide → `resolveGuidedOnboardingHref()` (persona → wizard resume → first of 5 missing sections) · Self → `/assets`; foundation progress bar · **Full dashboard:** `DashboardIntroSection`, `PlanProgressBar`, … |
| **Life event write** | `POST /api/consumer/life-events` → `afterHouseholdWriteForOwner` → estate health recompute |
| **Empty / blocked** | No household → empty state; `grossEstate === 0` → estate callout empty state; no retirement accounts → retirement empty state; no conflicts → banner/chips hidden |

### Financial modules (representative)

| Route | Client | Write API | Notes |
|-------|--------|-----------|--------|
| `/assets` | `_assets-client.tsx` | `/api/consumer/assets` | CRUD |
| `/income` | income client | `/api/consumer/income` | |
| `/expenses` | expenses client | `/api/consumer/expenses` | |
| `/liabilities` | liabilities client | `/api/consumer/liabilities` | |
| `/real-estate` | real estate client | `/api/consumer/real-estate` | |
| `/digital-assets` | `DigitalAssetIntakeForm` | `/api/consumer/digital-assets` | Tier 2; `FEATURE_TIERS['digital-assets']`; `UpgradeBanner` when below tier |
| `/businesses` | `_business-form-client.tsx` | `/api/businesses`, `/api/businesses/[id]` | Legacy top-level routes; `afterHouseholdWriteForOwner` |
| `/insurance`, `/property-casualty` | insurance form clients | `/api/insurance`, `/api/insurance/[id]` | Same pattern as businesses |
| `/rmd` | `rmd/_rmd-client.tsx` | Read-only (client-side projection from assets + household) | Tier 2; RMD start age from `getRmdStartAge(personN_birth_year)` — **75** if born ≥1960, **73** if 1951–1959, **72** if ≤1950 |
| `/roth` | `roth/_roth-client.tsx` | Read-heavy; optional **Use in Transfer Strategies →** writes `illustrative` `roth` line item then navigates to `?tab=strategies&openPanel=roth` | Tier 2 |
| `/import` | `_import-client.tsx` | `POST /api/ingest`, `POST /api/import/commit`, `DELETE /api/import/jobs/[id]` | Tier 1 upload + commit; **real_estate** target; multi-sheet + type normalization; persona templates; onboarding fork — [SPRINT_IMPORT_ATTORNEY.md](./SPRINT_IMPORT_ATTORNEY.md) |

### Bulk import — `/import` (Sprint F-1 + F-2 + expansion 2026-05-29)

| | |
|--|--|
| **User goal** | Import assets, liabilities, income, expenses, or **real estate** from a spreadsheet (single or multi-sheet workbook) |
| **Tier / gate** | Tier 1 upload + commit; import **job history** Tier 2+ only — see `DECISION_LOG.md` |
| **Server** | `app/(dashboard)/import/page.tsx` — `?onboarding=true` for wizard handoff |
| **Client** | `_import-client.tsx` + `_SupportedFormats.tsx` — upload step: supported formats → persona + CSV template downloads → drop zone; multi-sheet tabs + **Commit All**; type normalization badges; onboarding → `/dashboard?setup=imported` |
| **Onboarding** | Wizard step 1: Upload spreadsheet (primary) vs Add manually |
| **Write APIs** | `POST /api/ingest` (multi-sheet); `POST /api/import/commit` (type/property normalization); `DELETE /api/import/jobs/[id]` |
| **Formats** | `.csv`, `.xlsx`, `.xls` only (PDF/DOCX deferred post-launch) |
| **Migrations** | F-1/F-2 as before; **apply** `20260529120000_sprint_import_attorney.sql` for attorney doc columns (separate from import tables) |
| **Tests** | `npm run test:import:unit` (**19**); `npm run test:import:api` — [SPRINT_IMPORT_ATTORNEY.md](./SPRINT_IMPORT_ATTORNEY.md) |

**Dashboard RMD strip:** `lib/dashboard/rmdStatus.ts` — `p1StartYear` / `p2StartYear` = birth year + `getRmdStartAge`; `calcRmdAmount` only when current age ≥ cohort start age.

All normalized consumer CRUD routes call **`afterHouseholdWrite`** on success (see `tests/e2e/consumer/consumer-financial-writes.spec.ts`).

### Planning surfaces — projections, lifetime snapshot, scenarios (Sprint 11)

Three related routes share projection engines but answer different questions. **`PlanningSurfaceNav`** (`lib/planning/planningSurfaces.ts`) links them on every surface.

| Route | Tier | Role | Discoverability |
|-------|------|------|-----------------|
| `/projections` | 1 | Retirement-focused summary cards + chart/table/income tabs | **ScenariosExploreCard** → `/scenarios` below summary cards |
| `/complete` | 2 | Full year-by-year `YearRow` table (expandable column groups) | Nav pills → projections / scenarios |
| `/scenarios` | 1 | Side-by-side what-if (base + B + C); **`ProfileFieldPrompt`** for deferred retirement/longevity/deduction fields (partial PATCH); planning assumptions via `PATCH /api/consumer/growth-assumptions` | Nav pills → projections / lifetime |

| Route | Data load | Empty state CTA |
|-------|-----------|-----------------|
| `/projections` | `loadProjectionData` → readiness check → `ProjectionsClient` | Cache-first when fresh; `checkProjectionReadiness()` drives empty vs partial vs full view. Inline `ProfileFieldPrompt` for missing birth year / retirement age when assets or income exist. TIER2 CTAs: `/profile` + `/scenarios` |
| `/complete` | `loadProjectionData` → `CompleteClient` | Same cache-first path; full compute when stale |
| `/scenarios` | `loadProjectionData` + client variant query strings | Base Case server-prefetched; B/C lazy until user edits (or localStorage overrides on return) |

**Generate base case** (`POST /api/consumer/generate-base-case`) is for tier-3 **`/my-estate-strategy`** horizons (`projection_scenarios`), not for populating `/projections` or `/complete`.

### Retirement modeling — prefetch + route shells (Sprints B–J)

| Route | Tier | Server prefetch | Loading / error |
|-------|------|-----------------|-----------------|
| `/monte-carlo` | 3 | MC loaders (B) | `loading.tsx` + `error.tsx` (H/I) |
| `/allocation` | 2 | `loadAssetAllocationData` (B) | `loading.tsx` + `error.tsx` (H/I) |
| `/scenarios` | 1 | Base Case only; B/C lazy (C) | `loading.tsx` + `error.tsx` (H/I) |
| `/social-security` | 2 | `loadSocialSecurityData`; **`ProfileFieldPrompt`** for SS claiming age + PIA when unset | `loading.tsx` + `error.tsx` (H/I) |
| `/projections` | 1 | `loadProjectionData` + `checkProjectionReadiness`; inline prompts when partial | `loading.tsx` + `error.tsx` (H/I) |
| `/complete` | 2 | `loadProjectionData` | `loading.tsx` + `error.tsx` (J) |
| `/estate-tax` | 2 | composition + household | `loading.tsx` + `error.tsx` (J) |

### Estate & data entry — shells (Sprint O)

| Route | Loading / error |
|-------|-----------------|
| `/assets`, `/titling`, `/my-estate-strategy`, `/advisor` | `loading.tsx` + `error.tsx` (O) |

### Dashboard streaming + assessments (Sprints M, 19a)

| Piece | Pattern |
|-------|---------|
| `/dashboard` body | `DashboardBody` in `<Suspense>` (M) — page shell renders while heavy widgets stream |
| Assessment history | `loadAssessmentHistory` on server; widget skips client fetch when hydrated (19a) |

### Dashboard mobile shell (Sprint 12)

Consumer routes under `app/(dashboard)/` use **`DashboardShell`**: sidebar is fixed on `lg+` desktops; below `lg`, a top bar opens an off-canvas drawer (overlay, closes on navigation). Active page: navy fill + gold left accent (`NAV_ACTIVE`); Financial Planning group auto-expands when any child route is active (NAV-1). Public routes (`(public)/layout`) are unchanged. Complex modeling is desktop-first; a brief note appears in the mobile sidebar footer.

### Dashboard persona alerts (Sprint 12)

On `/dashboard` load, `buildPersonaDashboardAlerts()` derives from existing `loadDashboardCoreInputs` payload (no extra query):

| Alert | Condition | CTA |
|-------|-----------|-----|
| Business $5M / $10M | `computeBusinessOwnershipValue` ≥ threshold | `/business-succession` |
| Multi-state RE | ≥2 distinct non-empty `real_estate.situs_state` | `/real-estate` |

### Health check — `/health-check`

| | |
|--|--|
| **User goal** | Onboarding checklist / estate health questionnaire |
| **Tier / gate** | Linked from dashboard; not profile-gated |
| **Write APIs** | `POST /api/consumer/estate-health-check` (and related) |
| **After save** | Recompute path same as other household writes |

---

## 3. Estate planning surfaces (tier 3)

### Estate Tax Snapshot — `/estate-tax`

| | |
|--|--|
| **User goal** | Federal/state estate tax exposure from current balance sheet |
| **Tier / gate** | Tier 3; **profile gate** |
| **Server** | `app/(dashboard)/estate-tax/page.tsx` — assets, RE, liabilities, trusts, brackets; `classifyEstateAssets` |
| **Client** | `app/(dashboard)/estate-tax/_estate-tax-client.tsx` |
| **Write APIs** | Read-heavy; trust edits may use consumer trust API from other flows |
| **Read APIs / RPCs** | `calculate_estate_composition` via `classifyEstateAssets` |
| **Key lib** | `lib/calculations/estate-tax.ts`, `lib/estate/exemptionLabels.ts` |
| **Compliance** | Inline `DISCLAIMER_STRINGS.estateTax` under Federal Estate Tax card (`_estate-tax-client.tsx`) |
| **Empty / blocked** | `UpgradeBanner` if `tier < 3`; optional `householdContext` (`grossEstate`, `statePrimary`) for personalized copy when estate ≥ $100K |

### Estate Value and Tax Horizons — `/my-estate-strategy`

| | |
|--|--|
| **User goal** | Horizon table: today → longevity; federal/state tax bands; strategy line impact |
| **Tier / gate** | Tier 3; **profile gate**; `UpgradeBanner` + `householdContext` if `tier < 3` |
| **Server** | `app/(dashboard)/my-estate-strategy/page.tsx` — staleness-based base-case regen; `buildStrategyHorizons`, `classifyEstateAssets` |
| **Client** | `app/(dashboard)/my-estate-strategy/_my-estate-strategy-client.tsx`, `EstatePlanningDashboard` |
| **Write APIs** | Strategy changes usually on trust-strategy page; base case via `POST /api/consumer/generate-base-case` when needed |
| **Read APIs / RPCs** | `strategy_line_items`, `projection_scenarios.outputs_s1_first`, `state_estate_tax_rules` |
| **Key lib** | `lib/my-estate-strategy/horizonSnapshots.ts` |
| **UX** | Collapsible **Estate value & tax horizons**: labeled stepper (Actual vs What-if); **hero tax cards** + **comparison table** (not card-per-column); estate conflicts anchor `#estate-conflicts` on embedded completeness section |
| **Compliance** | Inline `DISCLAIMER_STRINGS.estateStrategy` below horizon table; page footer via `DisclaimerBanner` |
| **Empty / blocked** | Amber banner if federal horizon inputs missing (needs base-case projection) |

### Gifting, Strategies & Trusts — `/my-estate-trust-strategy?tab=…`

This page is a **two-level** navigation system: primary tabs (URL-driven) plus client-only sub-navigation inside several tabs.

| | |
|--|--|
| **User goal** | Annual gifting, charitable giving, transfer strategies, trusts & documents in one workspace |
| **Tier / gate** | Tier 3; **profile gate**; `UpgradeBanner` if `tier < 3` |
| **Server** | `app/(dashboard)/my-estate-trust-strategy/page.tsx` — heavy parallel fetch: gifting RPC, line items, trust guidance, horizons, composition |
| **Client** | `app/(dashboard)/my-estate-trust-strategy/_client.tsx` — tab state + `router.replace(?tab=)` (no full route per tab) |
| **Primary tabs** | `gifting` · `charitable` · `strategies` · `trusts` |

```text
/my-estate-trust-strategy?tab={gifting|charitable|strategies|trusts}
  ├── gifting      → GiftingDashboard
  ├── charitable   → CharitableGivingDashboard (+ sub-tabs, client state)
  ├── strategies   → ConsumerStrategyPanel (+ strategy pills, client state)
  └── trusts       → TrustDocumentsPanel + educational planning topics
```

**Legacy redirect:** `/trust-will` → `/my-estate-trust-strategy?tab=trusts`

#### Tab: Annual Gifting (`?tab=gifting`)

| | |
|--|--|
| **Client** | `components/GiftingDashboard.tsx` (dynamic import) |
| **Write APIs** | `POST/PATCH/DELETE /api/consumer/gift-history`; annual program via `POST /api/strategy-line-items` (`strategy_source: annual_gifting`) |
| **Read APIs / RPCs** | `calculate_gifting_summary`, `gift_history` for current tax year |
| **UX (not separate routes)** | Lifetime exemption meter; per-recipient annual cap warnings; **Prior taxable gifts (Form 709)**; MFJ donor selector; **Gifting scenario** collapsible with **Save to my plan →** when no active plan, or **In your estate plan** card (amount, drift warning, Update plan, Return to sandbox, Withdraw) when `annual_gifting` line item is active |
| **Gift delete + plan** | Deleting a gift when plan has `metadata.synced_from_gift_history` → `GiftDeleteWarningModal`: delete only (drift warning) or delete + withdraw plan (`PATCH` `action: 'withdraw'`) |
| **E2E** | `consumer-gift-history.spec.ts`, `consumer-strategy-writes.spec.ts`; manual smoke §10c gifting delete + plan |

#### Tab: Charitable Giving (`?tab=charitable`)

| | |
|--|--|
| **Client** | `components/CharitableGivingDashboard.tsx` |
| **Sub-tabs (client state)** | **Planning topics** · **Deduction Detail** · **Donation History** — not in URL; `useState<'topics' \| 'deductions' \| 'history'>` (default: Planning topics); sub-nav renders after client hydration |
| **Read APIs / RPCs** | `calculate_charitable_summary(p_household_id)` — summary cards, `recommendations[]`, `deduction_detail`, `donation_history`, optional QCD eligibility |
| **Above sub-tabs (always visible)** | Four summary cards (total donated, tax deductible, QCD, capital gains avoided); optional QCD eligibility banner; **Log a Donation** modal; **Save to my plan →** on total donated (`strategy_source: daf`) |
| **Planning topics** | RPC `recommendations[]` when donations exist; if `donation_count === 0`, **`buildPersonalizedCharitableTopics(householdContext)`** from state, filing status, ages, pre-IRA balance (passed from trust-strategy `page.tsx`); client filters TCJA/sunset strings on RPC topics |
| **Deduction Detail** | `deduction_detail`: itemizing vs standard, AGI limits (60% cash / 30% assets), deductible amounts, carryforward |
| **Donation History** | `donation_history[]` table with delete; empty copy “No donations logged yet…” (distinct from planning-topics empty) |
| **Write APIs** | Donation insert/delete via Supabase `charitable_donations` from component (not `/api/consumer/*`); **Save to my plan →** → `POST /api/strategy-line-items` (`strategy_source: daf` or `charitable`, `scenario_name: base`); DAF panel also uses `CharitableStrategyForm` on Transfer Strategies tab |
| **After save** | `afterHouseholdWrite` on line-item route; `router.refresh()`; composition `outside_strategy_total` may lag — e2e polls `POST /api/estate-composition` up to ~20s |
| **E2E** | `consumer-strategy-writes.spec.ts` (DAF / charitable) |

#### Tab: Transfer Strategies (`?tab=strategies`)

| | |
|--|--|
| **Client** | `ConsumerStrategyPanel.tsx`, `StrategySandboxSection`, `StrategyConfirmedSection`, `StrategyHorizonTable`; dashboard `StrategyRecommendationPanel` for advisor rows |
| **Layout (top → bottom)** | **Strategy Sandbox** (all active `illustrative` rows, consumer + advisor, not rejected) → **In My Plan** (`probable`/`certain` + advisor rows with `consumer_accepted`) → strategy pills + modeled panels |
| **Sub-nav (client state)** | Strategy **pills**: GRAT, CRT, CLAT, DAF, Liquidity, Roth Conversion, SLAT, ILIT — selects panel; `?openPanel=roth` (etc.) opens a pill on load |
| **Confidence contract** | New modeled saves default **`illustrative`**. **Add to plan** → `PATCH /api/strategy-line-items` `{ id, action: 'promote' }` (`illustrative` → `probable`). **Reversal:** `{ action: 'return_to_sandbox' }` (probable → illustrative), `{ action: 'withdraw' }` (removes from estate, logs audit), `{ action: 'demote' }` (certain → probable). **Annual gifting** still writes **`probable`** directly. |
| **Write APIs** | `POST`/`PATCH`/`DELETE /api/strategy-line-items`; reversal `PATCH` with `action` + optional `reversal_reason`; accept/decline advisor via `/api/consumer/strategy-recommendation` |
| **In My Plan actions** | Return to sandbox · Withdraw (optional reason, advisor-visible) · Unwind ↩ on `certain`; **Strategy history** collapsible lists withdrawn rows |
| **Read** | Server-prefetched `estateContext`, `strategyImpact`, `advisorHorizons`; client refetch of all active `strategy_line_items` for sandbox/confirmed lists |
| **Chip indicators** | Amber dot = illustrative in sandbox; green = in plan; blue ring = advisor-authored sandbox row |
| **Advisor rows** | Appear in **Strategy Sandbox** until client accepts via dashboard panel or sandbox **Accept**; accept sets `consumer_accepted` (moves to **In My Plan** when accepted; composition still requires `probable`/`certain` for outside-estate reduction) |
| **Education CTA** | **Ask your advisor about this →** — connected advisor: `POST /api/consumer/ask-advisor`; else `/find-advisor` |
| **Key lib** | `lib/consumer/strategyLineItemViews.ts` (`partitionStrategyLineItems`), `lib/strategy/strategyLabels.ts` |
| **E2E** | `consumer-strategy-writes.spec.ts` (API contracts; sandbox UI promote not yet covered) |

#### Tab: Trusts & Documents (`?tab=trusts`)

| | |
|--|--|
| **Client** | `components/consumer/TrustDocumentsPanel.tsx` |
| **Summary strip** | Estimated Taxable Estate, Federal Exemption Remaining, Headroom Before Federal Tax (annotated with lifetime gifts used when applicable) |
| **Write APIs** | `POST/PATCH/DELETE /api/consumer/trusts` |
| **Read** | `loadTrustWillGuidance(supabase, userId, householdId, preloadedComposition?)` — trusts, recommendations, checklist; trust-strategy passes cached composition to avoid duplicate RPC |
| **Educational UI** | Common planning topics (Pour-Over Will, Business Succession Trust, etc.) via `lib/estate/planningTopicPresentation.ts` — framing only, not personalized advice |
| **Key lib** | `lib/trusts/trustPayload.ts`, `lib/trusts/trustEstateTaxEstimate.ts` (`excludes_from_estate`, `~Est. Tax Saved`) |
| **E2E** | `tests/e2e/consumer/consumer-trust-crud.spec.ts` |

**Advisor overlay on this page:**

- `strategy_configs` → in-app `advisor_strategy_recommended` notifications
- Advisor `strategy_line_items` → **Strategy Sandbox** on Transfer Strategies + dashboard `StrategyRecommendationPanel`; accept/reject unchanged
- Horizon federal values require base-case projection; missing context shows amber server banner

---

## 4. Other tier-3 intake (not profile-gated)

These use tier checks in `page.tsx` / sidebar gating but **do not** call `requireMinimumViableProfile` today:

| Route | Focus | Typical writes |
|-------|--------|----------------|
| `/my-family` | Household people | `/api/consumer/household-people` |
| `/titling` | Beneficiaries, entity titling | `/api/consumer/asset-beneficiaries`, `/api/consumer/entity-titling` |
| `/incapacity-planning` | POA / healthcare directives | Page-specific APIs |
| `/domicile-analysis` | State comparison | Server + client calculators |

See [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md) for the full route list.

---

## 5. Advisor ↔ consumer handoff

Full channel reference: [MASTER_ARCHITECTURE.md → Consumer and advisor interaction](./MASTER_ARCHITECTURE.md#consumer-and-advisor-interaction).

| Channel | Consumer surface | API / data |
|---------|------------------|------------|
| **Strategy recommendations** | Dashboard `StrategyRecommendationPanel`; Transfer Strategies sandbox + In My Plan; advisor Step 3 **Withdrawn by Client** when consumer withdraws accepted recommendation | Advisor: `/api/advisor/strategy-recommendation`. Consumer accept: `PATCH /api/consumer/strategy-recommendation`. Promote/reverse own rows: `PATCH /api/strategy-line-items` `{ id, action }`. Withdraw sets `consumer_withdrawn` + `is_active=false` (reason visible to advisor) |
| **Advisor GST ledger (SLAT)** | Advisor client Strategy tab — `SLATILITPanel` “Save to GST ledger” | `POST /api/advisor/gst-entry` (not browser `gst_ledger`); validates `advisor_clients` then service-role insert. RLS: `20260527150000` |
| **Monte Carlo** | `MonteCarloScenarioBanner` on `/dashboard`, `/my-estate-strategy` | `/api/monte-carlo/advisor-assumptions`; table `advisor_projection_assumptions` |
| **Access** | `/my-advisor` (sidebar footer; never `isLockedUser`-gated) | `advisor_clients`, `connection_requests`, `advisor_directory`; `POST /api/consumer/invite-advisor` when no connection; disconnect via `POST /api/consumer/disconnect-advisor` (restores tier + resubscribe email); cancel directory pending via `POST /api/connection-requests/cancel`; dashboard `AdvisorConnectedBanner` when recently connected |
| **Life event → advisor** | `LifeEventBanner` confirmation | `POST /api/consumer/life-events` notifies connected advisor (`create_notification`); cron backup in `/api/cron/notifications` |
| **Plan readiness (advisor view)** | Advisor client Overview tab | `estate_health_scores` via `fetchHealthScore` → `PlanStatusCard` + gap workflow (`advisor_gap_statuses`, `GapStatusSelector`) |
| **Export for attorney** | `/print` (tier 3+) | `ExportPDFButton` `variant=attorney` → `AttorneyEstatePlanPDF` via `/api/export-estate-plan?variant=attorney`; title **Estate Planning Preparation Report**; cover disclaimer + user attribution on page 1 |
| **Advisor event referral** | `/event/[slug]?ref=` | `_referral-tracker.tsx` → `POST /api/referral/track` (`type: 'advisor'`) → `referral_clicks` |
| **Attorney event referral** | `/event/[slug]?aref=` | Same tracker → `type: 'attorney'` → `attorney_listing_id` / `attorney_profile_id` |
| **Advisor newsletter kit** | Advisor portal | `buildAllEventReferralUrls` — 24 `?ref=` links |
| **Attorney newsletter kit** | Attorney portal `/attorney` | `buildAllAttorneyEventReferralUrls` — 24 `?aref=` links |
| **Signup attribution** | `/signup` after `signUp` + `signInWithPassword` (or `/waitlist` email capture when waitlist mode on) | `_signup-form.tsx` → `profiles` + `POST /api/analytics/funnel` (`account_created`); waitlist: `POST /api/email-capture` (`source: 'waitlist'`) |
| **Waitlist (pre-launch)** | `/waitlist`; `/signup` redirected on Production by default | `lib/waitlist-mode.ts`, `middleware.ts`, `getSignupHref()`; flip via `PUBLIC_SIGNUP_OPEN=true` at go-live |
| **Funnel analytics** | All public funnel steps | `captureFunnelEvent()` → `POST /api/analytics/funnel` → `funnel_events`; admin **Funnel** tab — 30-day step counts, tier conversion, slug/referral tables |
| **Email drip** | Event assess email capture | 3-step sequence per event slug (24 custom in `drip-templates.ts`); `POST /api/email-capture` → drip step 1; steps 2–3 cron |
| **SEO** | Public marketing URLs | `app/sitemap.ts` ready; **pre-launch** `app/robots.ts` blocks all crawlers; `proxy.ts` allows `/education`, `/sitemap.xml`, `/robots.txt` without login |
| **Assess results gate** | `/assess` results (logged out) | Scores always visible; gap report + next steps require account (Sprint 12 — `score_visible` only) |
| **Notifications** | In-app | `advisor_strategy_recommended` when new `strategy_configs` appear on trust-strategy load |
| **Ask advisor about strategy** | **Ask your advisor about this →** on strategy education cards | If connected advisor: POST `/api/consumer/ask-advisor` → `create_notification` (type: `consumer_strategy_question`) → advisor sees in portal "Strategy Questions" section → responds via strategy recommendation. If no connected advisor: redirects to `/find-advisor` directory. |

**Computation parity:** `probable`/`certain` consumer lines + consumer-accepted advisor lines feed **actual** horizons and `outside_strategy_total` in `calculate_estate_composition`. `illustrative` rows appear in **projected** horizons only until promoted or written as `probable` (e.g. annual gifting). Advisor client view uses the same `buildStrategyHorizons` sets via `lib/advisor/strategyMappers.ts` (ENG-1).

---

## 6. API quick reference

### Normalized consumer writes (`/api/consumer/*`)

| Route | Domain |
|-------|--------|
| `profile` | Household + profile |
| `assets`, `income`, `expenses`, `liabilities`, `real-estate`, `digital-assets` | Balance sheet / cash flow |
| `gift-history` | Annual gift log |
| `trusts` | Trust CRUD |
| `strategy-recommendation` | Accept advisor strategy line |
| `asset-beneficiaries`, `entity-titling`, `household-people` | Titling / family |
| `allocation-targets` (`target_*_pct`, `risk_tolerance`), `growth-assumptions`, `scenario-snapshots`, `generate-base-case` | `/allocation`, `/scenarios`, projections |
| `estate-health-check` | Health questionnaire |
| `life-events` | Log / list / acknowledge in-app life events |

### Shared / legacy writes

| Route | Used by |
|-------|---------|
| `/api/strategy-line-items` | Gifting (`probable`), charitable/strategies sandbox (`illustrative`), promote (`PATCH` + `id` + `promoteConfidence`), remove (`DELETE` + `id`) |
| `/api/businesses`, `/api/insurance` | Business and life/P&C forms |
| `/api/estate-composition` | Client refresh of composition card; e2e assertions |

### Key read RPCs

| RPC | Used for |
|-----|----------|
| `calculate_estate_composition` | Gross estate, buckets, strategy totals, tax estimates |
| `calculate_gifting_summary` | Annual/lifetime gifting limits |
| `generate_estate_recommendations` | Recompute path + manual client refresh only (not dashboard load — Sprint P-2) |

---

## 7. E2E map (living contracts)

| Spec | Covers |
|------|--------|
| `tests/e2e/consumer/dashboard.spec.ts` | Dashboard load, net worth, disclaimer |
| `tests/e2e/consumer/consumer-core-recompute.spec.ts` | Asset POST → `computed_at` poll → dashboard net worth/readiness (smoke §2) |
| `tests/e2e/consumer/consumer-financial-writes.spec.ts` | Consumer CRUD: assets, income, expenses, RE, liabilities |
| `tests/e2e/consumer/consumer-api-writes.spec.ts` | Allocation targets, health-check, generate-base-case |
| `tests/e2e/consumer/consumer-growth-assumptions-api.spec.ts` | `PATCH /api/consumer/growth-assumptions` (financial, RE, business, inflation) |
| `tests/e2e/consumer/consumer-profile-spouse-layout.spec.ts` | Profile layout: live column headers, spouse toggle, planning section labels; **slim profile** (deferred fields absent) |
| `tests/e2e/consumer/consumer-profile-field-prompt.spec.ts` | **ProfileFieldPrompt** UI: Scenarios + Social Security save/dismiss/deduction; PIA accuracy |
| `tests/e2e/consumer/consumer-strategy-writes.spec.ts` | Strategy line items, charitable, recommendations |
| `tests/e2e/consumer/consumer-trust-crud.spec.ts` | `/api/consumer/trusts` |
| `tests/e2e/consumer/consumer-gift-history.spec.ts` | Gift history API |
| `tests/e2e/consumer/consumer-titling.spec.ts` | Titling API validation (sentinel UUIDs) |
| `tests/e2e/consumer/consumer-titling-real-asset.spec.ts` | Titling POST on real asset (smoke §6) |
| `tests/e2e/consumer/consumer-routes-estate-tier.spec.ts` | Estate-tier routes, no upgrade banner, `/trust-will` redirect |
| `tests/e2e/consumer/consumer-sidebar-navigation.spec.ts` | Sidebar footer, overview nav, no portal links (smoke §1.4) |
| `tests/e2e/consumer/consumer-route-regression.spec.ts` | Full CONSUMER_NAV_MAP route loads |
| `tests/e2e/consumer/consumer-profile-save.spec.ts` | Profile PATCH + UI save + **3 partial PATCH shapes** (smoke §3) |
| `tests/e2e/consumer/consumer-ui-asset-save.spec.ts` | UI add asset on `/assets` (smoke §2 UI) |
| `tests/e2e/consumer/consumer-health-check-ui.spec.ts` | Health check wizard → dashboard (smoke §4) |
| `tests/e2e/consumer/consumer-family-crud.spec.ts` | My Family API CRUD (smoke §5) |
| `tests/e2e/consumer/consumer-my-advisor.spec.ts` | `/my-advisor` connection UI |
| `tests/e2e/consumer/consumer-billing-route.spec.ts` | `/billing` + sidebar link |
| `tests/e2e/consumer/consumer-digital-assets.spec.ts` | Digital assets route + API |
| `tests/e2e/consumer/consumer-life-events.spec.ts` | Life events API |
| `tests/e2e/consumer/consumer-import-access.spec.ts` | Import page for tier 1+ fixture |
| `tests/e2e/consumer/consumer-strategy-recommendation-ui.spec.ts` | Dashboard advisor recommendation panel (smoke §9) |
| `tests/e2e/consumer/terms-accept-flow.spec.ts` | `/terms/accept` + `POST /api/terms/accept` |
| `tests/e2e/consumer/consumer-tier1-gates.spec.ts` | Upgrade banners (optional tier-1 project) |
| `tests/e2e/public/public.spec.ts` | Auth pages, terms API, beneficiary token |
| `tests/e2e/public/public-routes.spec.ts` | Marketing routes, all `/event/[slug]`, assess pages |
| `tests/e2e/public/public-referral-track.spec.ts` | Referral track API (acquisition §A–B) |
| `tests/e2e/public/auth-signup-attribution.spec.ts` | sessionStorage `?ref=` / `?aref=` contract |
| `tests/e2e/advisor/*.spec.ts` | Advisor portal (incl. RMD copy, newsletter kit) |
| `tests/e2e/attorney/attorney-portal.spec.ts` | Attorney dashboard + `?aref=` links |
| `tests/unit/import-parse.spec.ts` | Import header detection, sheets, aliases (`npm run test:import:unit`) |
| `tests/unit/import-type-normalizer.spec.ts` | Type normalization aliases (`npm run test:import:unit`) |
| `tests/e2e/consumer/consumer-import.spec.ts` | Import ingest/commit, duplicates, traceability (`npm run test:import:api`) |

**Run full suite:** `npm run test:e2e:complete` (see [E2E_RELEASE_TEST_PLAN.md](./E2E_RELEASE_TEST_PLAN.md)).

**Go-live pre-flight (profile + inline prompts):** `npm run test:e2e:go-live-profile` — see [GO_LIVE_E2E.md](./GO_LIVE_E2E.md).

Strategy e2e requires `PLAYWRIGHT_HOUSEHOLD_ID` in the environment. Profile API revert test needs `SUPABASE_SERVICE_ROLE_KEY`. Optional: `PLAYWRIGHT_CONSUMER_TIER1_*`, `PLAYWRIGHT_ADVISOR_REFERRAL_CODE`, `PLAYWRIGHT_ATTORNEY_REFERRAL_CODE`.

**Automated vs manual:** E2E specs are living contracts for APIs and key UI loads. **Smoke §2.4 (recompute)** is automated in `consumer-core-recompute.spec.ts` (see [E2E_RELEASE_TEST_PLAN.md](./E2E_RELEASE_TEST_PLAN.md)). Remaining human checks live in [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) — do not skip for production releases.

---

## Document maintenance

When consumer behavior changes, follow **[UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md)** (single source for what to update and verification steps). This file holds journey detail only.

---

*Last structured pass: 2026-05-31 (strategy reversal lifecycle; gifting plan card + delete warning; advisor withdrawn recommendations).*
