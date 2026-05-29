# SPRINT — Friction Reduction
# My Wealth Maps
# Status: Shipped · 2026-05-27

**Goal:** Reduce time-to-first-value for new consumers without changing the data model, removing depth, or touching the wizard gate until we have drop-off data.

**Scope:** 4 changes. No Plaid. No new tables. Deployable as a single sprint.

---

## Change 1 — Slim the profile to a minimum required set

### What and why

The profile form currently collects: names, birth years, retirement ages, longevity ages, SS claiming ages, PIA, state, filing status, tax deduction method, and (when `showWizardFields`) wizard-specific household data.

SS claiming ages, PIA, longevity ages, and tax deduction method are not needed to render a meaningful dashboard. They feed `/social-security`, `/roth`, and the projection engine — none of which are the first-session goal. Collecting them upfront adds ~3–5 fields the user doesn't understand yet and has to look up.

**The minimum that unlocks a real dashboard output:**
- Person 1 name + birth year
- Spouse toggle (and Person 2 name + birth year if yes)
- State of domicile
- Filing status

Everything else can prompt inline when the user first navigates to the feature that needs it (SS claiming age prompts on `/social-security`; tax deduction mode prompts on `/scenarios`).

### Implementation

**File:** `app/(dashboard)/profile/_profile-client.tsx`

Move the following fields from required/visible-on-load to conditionally rendered (show only when the relevant feature section is first accessed, or on a "Complete your profile" nudge card):

| Field | Move to |
|-------|---------|
| `retirement_age_1` / `retirement_age_2` | Scenarios page — already feeds projection assumptions |
| `longevity_age_1` / `longevity_age_2` | Scenarios page |
| `ss_claiming_age_1` / `ss_claiming_age_2` | Social Security page — inline prompt on first load |
| `pia_1` / `pia_2` | Social Security page |
| `deduction_mode` / `custom_deduction` | Scenarios page |

**Profile required banner** (`profile/_profile-required-banner.tsx`): update `minimum profile complete` check in `PATCH /api/consumer/profile` to gate only on: `person1_name`, `person1_birth_year`, `state_primary`, `filing_status`.

**Wizard fields (`showWizardFields`):** unchanged — wizard still collects what it needs. This change only affects the non-wizard default view.

**After-save redirect logic** (`app/api/consumer/profile/route.ts`): no change needed — the minimum-complete check already controls the redirect. Updating what counts as "minimum complete" is the only required edit.

**Profile layout:** the People section already uses `sm:grid-cols-2` when `hasSpouse`. Removing the deferred fields will make the form ~40% shorter without any layout restructuring.

**Inline prompts (deferred fields):** on `/social-security` and `/scenarios`, add a `ProfileIncompleteInlinePrompt` component (new, small) that checks for the missing field server-side and renders a single-field inline form with `PATCH /api/consumer/profile`. Re-use the existing `PATCH` endpoint — no new API route.

### What stays the same

- The `PATCH /api/consumer/profile` endpoint — no schema change
- The `afterHouseholdWrite` / recompute chain — unchanged
- Wizard household card — unchanged
- The `ProfileRequiredBanner` pattern — just update its minimum-complete definition

### Acceptance criteria

- [ ] New user can complete profile in under 60 seconds (4–6 fields visible)
- [ ] Dashboard loads after profile save with correct state + filing status populated
- [ ] `/social-security` shows inline prompt for SS claiming age + PIA when not yet set
- [ ] `/scenarios` shows inline prompt for retirement age, longevity, deduction when not yet set
- [ ] Existing users with complete profiles see no change
- [ ] `consumer-profile-save.spec.ts` passes without modification (minimum-complete change only)

---

## Change 2 — Fix the import API tier gate

### What and why

The import pipeline (`/import`) is blocked by an incorrect tier gate. Based on the nav map, `/import` is listed as Tier 2+ (`feature: import`, sidebar under Financial Planning). However, consumers signing up for Tier 1 (Financial) cannot access it. The import pipeline itself (`POST /api/ingest` → review → `POST /api/import/commit`) is the fastest path for the exact users most likely to engage deeply on day one: business owners and executives who have a spreadsheet of assets ready.

Per the architecture docs, Tier 1 consumers can upload during `!onboarding_wizard_completed_at` — the wizard-phase exemption already exists. The fix is to make upload accessible for Tier 1 permanently, not just during wizard.

### Implementation

**File:** `lib/tiers.ts` — update `FEATURE_TIERS`:

```ts
// Before
'import': 2,

// After
'import': 1,
```

**File:** `app/(dashboard)/import/page.tsx` — verify no hardcoded tier check (`tier >= 2`) outside of `hasFeatureAccess`. If present, remove.

**History view** (import job history, separate from upload): keep at Tier 2+ if currently gated that way — history is a power-user feature; upload is the friction point.

**E2E:** `tests/e2e/consumer/consumer-import-access.spec.ts` — update fixture from `tier 2+` to `tier 1+`. Run `consumer-import.spec.ts` against a Tier 1 fixture to confirm ingest/commit still works.

### What stays the same

- Import pipeline logic (`POST /api/ingest`, review UI, `POST /api/import/commit`, `DELETE /api/import/jobs/[id]`) — no changes
- Header detection, multi-sheet picker, duplicate handling, `ingestion_job_id` — no changes
- Templates in `public/templates/` — no changes

### Acceptance criteria

- [ ] Tier 1 consumer can navigate to `/import` without upgrade banner
- [ ] Tier 1 consumer can upload a CSV/XLSX and reach the review step
- [ ] Tier 1 consumer can commit the import — assets appear in `/assets`
- [ ] Dashboard net worth updates after import commit (recompute triggered via `afterHouseholdWrite`)
- [ ] `consumer-import-access.spec.ts` updated and passing for Tier 1

---

## Change 3 — Quick-add modal on the dashboard

### What and why

After profile setup, the dashboard empty state currently routes the user to `/assets` to add their first asset. This is a context switch: the user leaves the dashboard, navigates to a full CRUD page, adds one asset, and comes back. That navigation break is where momentum dies.

The fix: an inline modal on the dashboard that handles "add one asset" without leaving. This is not a replacement for `/assets` — it's a shortcut for the first asset only.

The dashboard already has `SetupProgressCard` (stage 1) with a "next action link." Wire the first-asset CTA to open a modal instead of navigating.

### Implementation

**New component:** `components/dashboard/QuickAddAssetModal.tsx`

- Triggered by: "Add your first asset" CTA in `SetupProgressCard` (stage 1) and/or `PlanProgressBar` next-action link
- Fields: asset name, asset type (dropdown — same options as `/assets` form), estimated value, ownership (Person 1 / Person 2 / Joint)
- On submit: `POST /api/consumer/assets` (existing endpoint, no change)
- On success: `router.refresh()` — dashboard recomputes and net worth appears; modal closes
- On error: inline field error, modal stays open

**File:** `app/(dashboard)/_components/setup-progress-card.tsx` (or equivalent) — change "Add an asset →" href to an `onClick` that sets modal open state.

**State:** `useState` in `_dashboard-client.tsx` — `quickAddOpen: boolean`. Pass setter as prop to `SetupProgressCard` and `PlanProgressBar`.

**Asset type options:** import the same type list used by `/assets` form — do not duplicate the list. If it's currently inline in the assets page, extract to `lib/assets/assetTypes.ts` and import from both.

**What this is not:** a full asset manager. No edit, no delete, no bulk. One field set, one submit. Users who want more go to `/assets` — the modal includes a "Manage all assets →" link in the footer.

**Recompute:** `POST /api/consumer/assets` already calls `afterHouseholdWrite` → `triggerEstateHealthRecompute`. `router.refresh()` after modal close picks up the new computed values. No additional wiring needed.

### What stays the same

- `/assets` page — no changes
- `POST /api/consumer/assets` endpoint — no changes
- `afterHouseholdWrite` / recompute chain — no changes
- `SetupProgressCard` stage logic — no changes to `determinePlanStage()` or `checkHouseholdHasData`

### Acceptance criteria

- [ ] "Add your first asset" CTA on stage-1 dashboard opens modal (does not navigate)
- [ ] Modal submits to `POST /api/consumer/assets` — asset saves correctly
- [ ] Dashboard net worth updates after modal close without full page reload
- [ ] Modal closes on success; shows inline error on failure
- [ ] `/assets` page is unchanged and still accessible via sidebar
- [ ] `dashboard.spec.ts` — add one assertion: CTA click opens modal (no navigation)
- [ ] `consumer-financial-writes.spec.ts` — existing asset POST spec still passes

---

## Change 4 — Validate wizard drop-off before changing gate behavior

### What and why

The suggestion to convert the wizard from a gate to a nudge (dismissible banner) is reasonable but carries risk. If the wizard is completing at a high rate, it may be doing real work — users who complete it have enough profile data to see a populated dashboard, which improves retention. Removing the gate without data could reduce completion and produce more empty-dashboard sessions.

**This change is: instrument first, decide second.**

### Implementation — instrumentation only

**Add a funnel event for wizard abandonment.** In `app/(dashboard)/onboarding/wizard/` — wherever the wizard layout renders, add:

```ts
captureFunnelEvent('wizard_abandoned', { step: currentStep })
```

on: browser back navigation away from the wizard (route change without completion), and on any explicit "Skip" action if one exists.

**Add a funnel event for wizard completion.** Already captured? Check `profiles.onboarding_wizard_completed_at` set — if `captureFunnelEvent('wizard_completed')` is not already firing at that point, add it.

**Admin Funnel tab** (`/admin` → Funnel): the existing funnel analytics infrastructure (`funnel_events` table, `POST /api/analytics/funnel`) already supports custom step names. Add `wizard_abandoned` and `wizard_completed` to the displayed steps so the rate is visible in the admin view.

**Decision gate:** after 2 weeks of data (or ~50 new signups, whichever comes first), review:
- If wizard completion rate > 70% → leave the gate, the wizard is working
- If wizard completion rate < 50% → convert to dismissible nudge banner in next sprint
- If abandonment clusters at a specific step → fix that step rather than removing the gate

### What stays the same

Everything. This change adds two `captureFunnelEvent` calls and one admin Funnel tab row. No behavioral change for users.

### Acceptance criteria

- [ ] `wizard_abandoned` event appears in `funnel_events` when user navigates away mid-wizard
- [ ] `wizard_completed` event appears in `funnel_events` on wizard completion (if not already)
- [ ] Admin Funnel tab shows both events in the step breakdown
- [ ] Wizard gate behavior for consumers is unchanged

---

## Assessment-to-signup restore — smoke test addition

This is not a new feature — the restore flow already exists (`mwm_pending_assessment` in `localStorage` → insert to `assessment_results` after auth). But it is the highest-intent moment in the funnel and worth an explicit smoke test pass before launch.

**Add to `CONSUMER_RELEASE_SMOKE_TEST.md`:**

```
§X — Assessment restore
1. Complete /assess while logged out (answer all questions, receive score)
2. Click "Create account" from the gated gap report
3. Complete signup
4. Confirm: assessment results are restored and displayed (not a blank state)
5. Confirm: the gap report / next steps are visible immediately after auth
```

This requires no code change if the restore is working. If it isn't, it's a bug fix, not a feature.

---

## Implementation order

| Order | Change | Why first |
|-------|--------|-----------|
| 1 | Fix import tier gate | One line in `lib/tiers.ts` + one spec update. Unblocks high-intent users immediately. |
| 2 | Slim profile form | Pure subtraction — remove fields, update minimum-complete check. No new components. |
| 3 | Quick-add modal | New component, but no new API or schema. Depends on profile being slim first (otherwise modal launches before profile is done). |
| 4 | Wizard instrumentation | Add two event calls. Can ship alongside or after the above — no dependencies. |
| — | Assessment restore smoke | Add to smoke test doc now; run at next deploy. |

---

## What this sprint does not touch

- Wizard gate behavior — instrumentation only until data exists
- Plaid — deferred
- Advisor household bootstrap — valid post-launch when advisor referral is a primary channel
- `/api/consumer/profile` schema — no new columns
- Tier 2/3 features — no changes to retirement or estate gates
- `CONSUMER_NAV_MAP.md`, `CONSUMER_FLOWS.md` — update after merge per `UPDATE_CHECKLIST.md`

---

## Docs to update after merge

Per `UPDATE_CHECKLIST.md`:

- [ ] `CONSUMER_NAV_MAP.md` — update import tier from 2 to 1
- [ ] `CONSUMER_FLOWS.md` — add quick-add modal to dashboard flow; add inline profile prompt pattern to profile flow
- [ ] `MASTER_ARCHITECTURE.md` — note slim profile minimum-complete definition change
- [ ] `ROADMAP.md` — add sprint entry, mark items complete
- [ ] `SCHEMA_CHANGELOG.md` — session entry for tier gate change
