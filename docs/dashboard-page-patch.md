# Dashboard onramp — page integration

Reference for wiring the onramp gate on `/dashboard`.

**Actual route file:** `app/(dashboard)/dashboard/page.tsx` (not `app/(dashboard)/page.tsx`).

**Layout context import:** `@/lib/access/getDashboardLayoutContext` (not `@/lib/dashboard/...`).

## Scaffold

```bash
bash scripts/dashboard-onramp-scaffold.sh
```

Creates `lib/dashboard/onrampGate.ts` and `components/dashboard/DashboardOnramp.tsx` if missing.

## Gate (single source of truth)

`lib/dashboard/onrampGate.ts` — `shouldShowOnramp()` returns true when **any** of:

1. `onboarding_wizard_completed_at` is null
2. `estate_health_scores.score` &lt; `ONRAMP_SCORE_THRESHOLD` (60)
3. No assets or income (`checkHouseholdHasData`)

## Page pattern

After `getDashboardLayoutContext()`:

1. Fetch `estate_health_scores.score` for `householdRow.id`
2. Call `checkHouseholdHasData()` (not on layout context — dashboard-only)
3. Early-return `<DashboardOnramp guidedHref={…} />` for consumers when gate is true
   - `resolveGuidedOnboardingHref()` in `lib/dashboard/guidedOnboardingHref.ts`:
     - No persona + wizard incomplete → `/onboarding/persona`
     - Persona set + wizard incomplete → `/onboarding/wizard`
     - Wizard flag set but any section empty → `/onboarding/wizard`
     - All five sections have rows → `/dashboard`
4. `/dashboard` in `wizardGateExemptPrefixes` — layout gate must not auto-redirect to wizard
5. Wizard page redirects to `/dashboard` only when wizard complete **and** all five data sections have rows
6. Otherwise render `DashboardBody` inside Suspense

## Estate summary strip (2026-05-30)

**Commits:** `deb0080` (layout) · `0686f52` (state exemption)

| Layer | Detail |
|-------|--------|
| Server | `dashboard/_dashboard-body.tsx` — composition → `estateCallout`; **`state_estate_tax_rules`** in existing `Promise.all` |
| Client | `_dashboard-client.tsx` — hero + tiles → two-col checklist + **`EstateTaxSnapshotPanel`** |
| Components | `EstateCalloutCard.tsx` — `EstateSummaryHeroAndMetrics`, `EstateTaxSnapshotPanel` |
| Unchanged | `EstateSummarySection` below Financial/Retirement |

**Prod:** `supabase db push` for `no_portability` column before deploy.

## Verify

- New / sparse user → onramp on `/dashboard`
- Golden path (wizard done, score ≥ 60, has data) → full dashboard
- **Manual (fresh user):** Import → `/import` · Guide → persona → wizard · Self → `/assets`
- **Manual (import backfill):** Import data → onramp → Guide → wizard resumes (income step), not dashboard bounce
