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
3. Early-return `<DashboardOnramp />` for consumers when gate is true
4. Otherwise render existing `DashboardBody` inside Suspense

## Verify

- New / sparse user → onramp on `/dashboard`
- Golden path (wizard done, score ≥ 60, has data) → full dashboard
