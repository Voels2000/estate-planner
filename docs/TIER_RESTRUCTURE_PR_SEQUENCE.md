# Tier Restructure — Follow-on PR Sequence

Pre-launch, no users. Ordering exists for clean PRs, sane staging states, and an
internally-consistent final state before the launch gate flips — **not** to
protect live users. Intermediate leaks on staging are acceptable; the same leaks
at launch are not.

---

## Already shipped

- **Billing page** (presentation layer): `BillingCapabilityMatrix`, trial banner
  (`resolveBillingTrialBanner` — `trial_ends_at` primary, Stripe `trialing`
  fallback), Plan & Export block, `billingCapabilityMatrix.ts` as row source of
  truth. Reads prices from catalog. 333 unit tests pass.
- This is the *display* of the new model. The *enforcement* (gates, effective
  tier, trial columns, projections split, export) is everything below.

---

## Hard ordering constraints (these bite if violated)

1. **App-managed trial must exist before the Stripe trial is retired** (PR 1
   before PR 5). Otherwise new signups get no trial at all and land on Tier 0
   immediately.
2. **Flipping inactive→Tier 0 (PR 1) opens leaks on currently-ungated modeling
   pages.** Gated modules (estate-tax etc.) block correctly, but `/projections`,
   `/scenarios`, and the dashboard's modeling are ungated today and will be
   reachable by Tier 0 users until PR 2 + PR 3 land. Close before launch.
3. **Dashboard runs estate composition + MC + background recompute for all
   consumers.** Until PR 3, a Tier 0 user hitting `/dashboard` triggers paid
   compute they shouldn't see. Pair PR 3 tightly with PR 2.
4. **Billing page → prod / launch flip is blocked on PR 5** (CTA still says
   "Start free trial" on Estate until `trialDays: 0`). Internal-consistency gate,
   not a user-safety one now.

---

## PR 1 — load-bearing decisions (spec before code)

These must be settled **before** PR 1 implementation starts. The rest of the chain inherits them.

### `has_ever_subscribed` write path

`trial_ends_at = now() + 7d` at signup is the obvious half. The subtle half is **when `has_ever_subscribed` flips true** — that flag is what stops a lapsed ex-subscriber from falling back into a fresh trial.

| Event | Action |
|-------|--------|
| Signup | Set `trial_ends_at`; leave `has_ever_subscribed = false` |
| First successful `customer.subscription.created` **or** first `subscription_status` → `active` / `canceling` | Set `has_ever_subscribed = true` (consume-once; idempotent if already true) |

**`resolveEffectiveTier` evaluation order (order matters):**

1. Superuser / advisor / advisor-client / professionally-managed bypasses (unchanged)
2. Active paid subscription → `consumer_tier` from plan (1–3)
3. **`has_ever_subscribed === true` and no active sub** → **Tier 0** (no trial re-grant)
4. App trial window: `now < trial_ends_at && !has_ever_subscribed` → **Tier 3** (`TRIAL_TIER`)
5. Else → **Tier 0**

Wrong order (trial check before `has_ever_subscribed`) lets subscribe-then-cancel users get a second trial.

**PR 1 unit test (not deferred to PR 8):** subscribed → cancelled → `resolveEffectiveTier` returns **0**, not trial Tier 3.

### `resolveEffectiveTier` as single source of truth

The audit found a live divergence: **sidebar reads raw `consumer_tier`** (`app/(dashboard)/layout.tsx`) while **gates read `getUserAccess().tier`** (`lib/get-user-access.ts`). They can disagree — e.g. unlock-estate writes `consumer_tier = 3` without granting access.

PR 1 fixes this by routing **both** through `resolveEffectiveTier()` (and `getUserAccess` becomes a thin wrapper that calls it).

**PR 1 acceptance test (real, not optional):** after merge, grep the codebase and confirm **no access decision** still reads raw `profiles.consumer_tier` or `subscription_status` outside the resolver layer. Allowed exceptions: billing display, admin user detail, Stripe webhook writes, analytics. If even one gate/banner/sidebar path bypasses the resolver, the divergence bug survives in a new form.

Suggested grep targets before merge:

```bash
rg 'consumer_tier|subscription_status' --glob '*.{ts,tsx}' \
  -g '!lib/**/resolveEffectiveTier*' \
  -g '!**/webhook*' \
  -g '!**/admin/**'
```

Every hit in layout, sidebar, `getUserAccess`, `hasFeatureAccess` callers, and API route guards must either call `resolveEffectiveTier` / `getUserAccess` or be on an explicit allowlist in the PR description.

---

## The sequence

### PR 1 — Foundation: schema + effective tier  *(audit PR1)*

**Scope:** Migration adds `trial_ends_at`, `has_ever_subscribed`. Signup trigger sets `trial_ends_at = now()+7d`. New `resolveEffectiveTier()` — see **load-bearing decisions** above for write path, evaluation order, and acceptance grep. Wire `getUserAccess` and dashboard layout sidebar through the resolver (inactive → **0**, not 1). Fix `trial_start` → correct column name. Admin override must allow tier **0**.

**Depends on:** nothing. **Unblocks:** everything.

**PR 1 ships (not PR 8):** `resolveEffectiveTier` unit matrix including subscribe-then-cancel → Tier 0; grep audit documented in PR.

**Note:** Migration before any code writes the columns (PGRST204 lesson). After this lands, the leaks in constraint #2 are live on staging until PR 2/3.

### PR 2 — Gates + `FEATURE_TIERS` reclassification  *(audit PR4, enforcement half)*

**Governing principle: all data entry is free; you pay for what the product does
with it.** Every input a user types is Tier 0. Everything the system *computes*
from those inputs is paid. Data entry is never the wall — the value prop is the
modeling, not the form.

**Scope:** Move all data-entry keys to minTier 0 — `assets`, `liabilities`,
`income`, `expenses`, `profile`, `businesses`, `property-casualty`, **and
`insurance`** (policy list + coverage amounts are inputs). Add `net-worth-view`
and `data-export` at 0. Keep `projections`, `scenarios`, `import` at paid 1, and
all Tier 2/3 analysis keys unchanged. Add `hasFeatureAccess` gates +
`UpgradeBanner` to the now-ungated `/projections` and `/scenarios`. Reconcile the
contradictory import tests (`consumer-tier1-gates` expects a banner on `/import`;
`consumer-import-access` expects none — under the new model Tier 0 sees the
banner, Tier 1 doesn't).

**The one real care item — split inputs from computed fields on shared pages.**
The job is not "unlock these pages," it's "render the input fields at Tier 0,
gate the computed readouts." Several pages display a derived figure inline next
to entry fields; at Tier 0 the entry saves but the computed value is hidden/gated:
- `insurance` — policy entry + amounts free; **coverage-gap analysis** paid (Tier 2)
- `real-estate` — property value entry free; **cash-flow / appreciation analysis** paid (Tier 2)
- `businesses` — business value entry free; **succession analysis** paid (Tier 3)
- any dashboard/page tile showing a *computed* number (composition, gap, projection) is paid even if the inputs beside it are free

**Depends on:** PR 1. **Closes:** constraint #2 for gated modules. No open product
decisions remain — entry is uniformly Tier 0.

**Canonical input/computed boundary:** PR 2 owns the authoritative list (below + shared pages). PR 6 export must import the same boundary — not invent a parallel list. If the two disagree (e.g. whether property "estimated equity" is an input or computed), you get a leak. Same boundary, two consumers.

### PR 3 — Tier 0 dashboard slice  *(audit PR5)*
**Scope:** Dedicated thin net-worth loader (assets/liabilities/property/business
values → sum) that does **not** call `getCachedComposition` or
`triggerBackgroundBaseCaseAndRecompute`. Branch `DashboardBody` so effective tier
0 renders the slice and skips composition, MC, estate callouts, projection
staleness triggers, execution checklist.
**Depends on:** PR 1; pair with PR 2. **Closes:** constraint #3.
**Watch:** the background recompute trigger is the specific landmine — confirm it
cannot fire for tier 0.

### PR 4 — Projections content split  *(audit Section D)*
**Scope:** Strip the Monte Carlo "Estate Outlook" fan and the estate
exemption-threshold overlay from `/projections`. Tier 1 view = deterministic
projection + income-tax scenario/state comparison only. MC fan moves to the
`monte-carlo` (Tier 2) surface; estate overlay is Tier 3 content.
**Depends on:** PR 2. **Closes:** Tier 1 projections leaking Tier 2/3 output.
**Resolved:** the OPEN QUESTION — Tier 1 "state comparison" is the `/scenarios`
income-tax `state_primary` swap, NOT `calculateStateEstateTax`.

### PR 5 — Retire Stripe consumer trial  *(audit PR2)*
**Scope:** `trialDays: 0` for Estate in `PRICE_META` → immediate charge → webhook
`active`. Fix the Estate subscribe CTA copy ("Start free trial" → "Subscribe").
Confirm `consumerCheckoutBlockReason` still blocks active/canceling subs. Repoint
any remaining `isTrial` / checkout-block reads to the app trial.
**Depends on:** PR 1 (constraint #1). **Unblocks:** launch gate (constraint #4).

### PR 6 — Free inputs export API  *(audit PR6)*  — parallelizable

**Scope:** New route serializing the user's own household + assets/liabilities/
income/expenses/insurance/real_estate/businesses, reusing `ingestConfig.ts`
shapes (reverse of import). **Inputs only** — exclude projection rows, MC
summaries, `estate_composition_cache`, health scores, generated PDFs, strategy
line items. Scope by `auth.uid()` / household owner; add the export isolation E2E
(consumer A cannot export consumer B's rows).

**Depends on:** PR 1 for gating/auth. **Parallel with PRs 2–5** for implementation scheduling.

**Boundary coupling:** Gating does not block starting PR 6 after PR 1, but the serializer's "inputs only" rule must follow the **same input vs computed boundary** PR 2 implements (governing principle is already decided; PR 2 wires it). Extract a shared allowlist/denylist module both PR 2 gates and PR 6 export use, or land PR 2's boundary doc/module before merging PR 6. Do not let export invent its own notion of what counts as an input.

### PR 7 — Plan & Export deliverable rules  *(audit PR7)*  — light
**Scope:** Confirm trial users are excluded from the $1,490 PDF download
(`planExportAccess` keys on `active`; trial isn't active — should already hold).
Adjust `shouldOfferPlanAndExportPurchase` only if needed for app-trial users.
**Depends on:** PR 5.

### PR 8 — Tests, seeds, docs  *(audit PR8)*

**Scope:** Seed Tier 0 and app-trial personas alongside `e2e-consumer`. Final reconcile of the import gate tests. `DECISION_LOG` + `LAUNCH.md` entries. Broader E2E coverage for the full restructure.

**Depends on:** all.

**Note:** Core `resolveEffectiveTier` cases (including subscribe-then-cancel → Tier 0) ship in **PR 1**, not here. PR 8 adds integration/E2E and seed personas — does not defer PR 1's unit matrix.

---

## Suggested execution order

`PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → (PR 6 anytime after PR 1) → PR 7 → PR 8`

PR 6 (export) can run in parallel on scheduling — it does not touch gating/trial/dashboard code — but its serializer must share PR 2's input/computed boundary (see PR 6 note).

---

## Launch gate (feeds LAUNCH.md Gate 2)

Do **not** flip the consumer launch gate until PRs **2, 3, 4, 5** are all in.
Those four are what make the shipped billing page *true*: gates enforced, Tier 0
dashboard safe, Tier 1 projections clean, and the Estate CTA consistent with the
one-trial model. PR 6/7/8 should land too but are lower-risk to trail slightly.

---

## Governing principle (applies across PR 2, 3, 6)

**All inputs are free; computed fields are paid.** No open product decisions
remain. Three things to verify as it's wired:

- No "data entry" page renders a *computed* figure (composition, coverage gap,
  projection) at Tier 0 — entry fields save, derived readouts gate.
- The Tier 0 net-worth sum reads from the input tables directly, never via the
  gated `estate_composition_cache` / `getCachedComposition`.
- The free export contains every entered input and zero computed output, keeping
  the $1,490 Plan & Export deliverable intact.

**Single boundary, two consumers:** PR 2 (page gates) and PR 6 (export serializer) must agree on which fields are inputs vs computed. PR 2 is authoritative; PR 6 imports that list.
