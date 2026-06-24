# PR 3 — Tier 0 Dashboard Slice — Build Contract

Depends on PR 1 (effective tier) + PR 2 (gates). Closes constraint #3: today's
dashboard runs estate composition + MC + the background recompute trigger for
*all* consumers, so a Tier 0 user currently triggers paid compute they can't see.

---

## The one architectural rule

**A Tier 0 user is routed to a separate, thin loader. The heavy loader's
side-effectful calls must be physically unreachable from the Tier 0 path — not
guarded by `if (tier === 0)` skips inside `loadDashboardBundle`.**

Why physical separation, not conditionals: the risk isn't a *visible* leak, it's
a *side effect*. `triggerBackgroundBaseCaseAndRecompute` fires as a side effect
during the heavy load. The only way to guarantee it never fires for Tier 0 is to
never enter the function that calls it. A sprinkle of skip-conditions is one
missed branch away from silently enqueueing Monte Carlo jobs for free users.

Branch at the top of the dashboard server component, on `resolveEffectiveTier`,
**before** any `await loadDashboardBundle(...)`. Tier 0 → `loadTier0Dashboard` +
a thin net-worth view. Everyone else (including trial users at effective tier 3)
→ the existing path, unchanged.

---

## What Tier 0 renders

- Net worth (total + simple by-category breakdown — pure sums of input rows)
- Nav/links to all data-entry pages (assets, liabilities, income, expenses,
  real-estate, businesses, insurance — all Tier 0)
- Export access
- Upgrade CTAs for the gated modules (projections, retirement, estate)

Note: a *trial* user resolves to effective tier 3 and gets the full dashboard.
The Tier 0 slice is only for post-trial non-subscribers and lapsed subscribers
(`e2e-consumer-canceled`). That persona is the end-to-end test for this PR.

---

## What the Tier 0 loader must NOT touch (skip-list)

Headline: **`triggerBackgroundBaseCaseAndRecompute` — never fires for Tier 0.**

Also never loaded/called on the Tier 0 path:
- `getCachedComposition` estate fields — gross estate, headroom, federal/state
  estate tax (Tier 3 computed output)
- `loadScenarioMonteCarloWithStaleness` / MC rows + the `projection_inputs_hash`
  staleness gate (which can itself trigger recompute)
- Health score, conflict reports, alert evaluation derived from modeling
- `EstateExecutionChecklist`, estate callouts, assessments
- Projection staleness checks of any kind

---

## The subtle requirement: net-worth parity

The Tier 0 net-worth number **must equal** what the same data produces on the
heavy/composition path. If the thin loader sums differently from the composition
RPC, a user's net worth *changes when they subscribe or when their trial expires*
— a trust-eroding bug in a financial product, and exactly the kind of thing that
looks fine in isolation.

Two acceptable implementations — agent picks based on the RPC's structure:
1. A lean composition variant that returns net-worth aggregates only, skips the
   estate-tax computation, and provably does not touch the staleness/recompute
   path; **or**
2. A dedicated sum over the input tables (the `buildNetWorthSummaryFromDashboardInput`
   / `computeBusinessOwnershipValue` fallback shape).

Implementation: **`lib/dashboard/computeNetWorthFromInputTables.ts`** — FMV +
mortgage-in-liabilities math matching composition rollups.

**Parity test (mandatory):** `tests/unit/tier0Dashboard.spec.ts` — PR 2 fixture
($1M FMV / $200k mortgage / $250k business) → **$1.05M** on both paths.

---

## Cross-check: PR 2 gates must be early returns, not UI overlays

PR 2 put `UpgradeBanner` on `/projections` and `/scenarios`. Confirmed: gates
**short-circuit before** `loadProjectionData` (early return above the loader).

---

## Acceptance gates (review bar)

1. **Trigger never fires for Tier 0.** Spy on `triggerBackgroundBaseCaseAndRecompute`
   + architecture grep on tier-0 loader files.
2. **No computed/estate field renders at Tier 0** (skip-list above).
3. **Net-worth parity test passes** (same total on both paths).
4. **Data entry never gated** — Tier 0 dashboard links to every entry page.
5. **Separate loader** — heavy side effects unreachable from tier-0 code path.
6. **PR 2 gates confirmed as early returns** on `/projections` and `/scenarios`.

---

## Persona / staging

`e2e-consumer-canceled` (effective tier 0). After seed: add a property
($1M / $200k) and a business ($250k), then:
- Dashboard shows net worth **$1.05M** ($800k RE equity + $250k business); **no**
  estate tax / MC / health score / checklist.
- Direct visit to `/projections` and `/scenarios` → banner, **no** recompute fired.
- Entry pages all accept input.

**Gate 1 verify:** `npm run verify:tier0-no-recompute` — snapshots
`estate_health_scores` / `estate_composition_cache` timestamps before and after
`/dashboard` load (6s debounce window). Expect `Tier 0 slice UI detected: true`
after PR 3 is deployed to staging.

See also `docs/INPUT_COMPUTED_BOUNDARY.md` staging spot-check table.
