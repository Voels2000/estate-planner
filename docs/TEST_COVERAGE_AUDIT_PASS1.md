# Test-Coverage Audit — Pass 1 Map

**Baseline:** `staging` @ PR 8 merged (`8cfe0701`) · persona matrix in `scripts/e2e-persona-matrix.ts`  
**Status:** Review-only — no test changes in this document.  
**Next:** Approve map → Pass 2 (List A + List B) → execution PR(s).

**Legend:** GAP · SINGLE · MULTI-SAME-PATH · MULTI-DIFF-PATH

**Call-path tags:** `unit-direct` · `unit-wrapper` · `e2e-route` · `e2e-patch` · `script-integration` · `static`

---

## 1. `resolveEffectiveTier` (+ persona matrix)

| Branch / failure mode | Persona (`E2E_PERSONA_MATRIX`) | Tests | Call path | Coverage |
|----------------------|----------------------------------|-------|-----------|----------|
| Inactive / none → 0 | — | `resolveEffectiveTier.spec` “inactive consumer with no trial” | unit-direct | SINGLE |
| Expired `trial_ends_at` → 0 | — | `resolveEffectiveTier.spec` “expired app trial” | unit-direct | SINGLE |
| App trial (`trial_ends_at` future, `!has_ever_subscribed`) → 3 | `app-managed-trial` | `resolveEffectiveTier.spec` “app trial window”; `isAppManagedTrialActive`; `resolveConsumerIsTrial` | unit-direct | MULTI-SAME-PATH (3 unit tests, same resolver fn) |
| App trial → 3 (runtime / session) | `app-managed-trial` | `verify-pr5-staging-gate --personas` | script-integration via `buildUserAccessFromProfile` + login | MULTI-DIFF-PATH |
| App trial → 3 (browser) | `app-managed-trial` | — | — | **GAP** (seed exists; no dedicated E2E project/spec yet) |
| `has_ever_subscribed` + no active sub → 0 (incl. canceled) | `tier-0-canceled-has_ever_subscribed` | `resolveEffectiveTier.spec` subscribe-then-cancel; order test; `resolveConsumerIsTrial` | unit-direct | MULTI-SAME-PATH |
| `has_ever_subscribed` → 0 (E2E gates) | `tier-0-canceled-has_ever_subscribed` | `consumer-tier0-gates.spec` (project `consumer-tier0` / canceled auth) | e2e-route | MULTI-DIFF-PATH |
| `past_due` → 0 | — | `resolveEffectiveTier.spec` | unit-direct | SINGLE |
| `unpaid` → 0 | — | `resolveEffectiveTier.spec` | unit-direct | SINGLE |
| Active paid → `consumer_tier` 1 | `active-tier-1` | `resolveEffectiveTier.spec` “active subscription”; `getUserAccessProfile` tier-3 active | unit-direct / unit-wrapper | MULTI-DIFF-PATH |
| Active paid → tier 2 | `active-tier-2` | `resolveEffectiveTier.spec` (tier 2 active); `verify-pr5 --personas` | unit-direct + script-integration | MULTI-DIFF-PATH |
| Active paid → tier 3 | `active-tier-3` | `resolveEffectiveTier.spec`; `verify-pr5 --personas`; default `consumer` E2E cast | unit + script + e2e-default | MULTI-DIFF-PATH |
| `canceling` → paid tier retained | — | `resolveEffectiveTier.spec` | unit-direct | SINGLE |
| Stripe `trialing` → paid path | — | `resolveEffectiveTier.spec`; `resolveConsumerIsTrial` | unit-direct | MULTI-SAME-PATH |
| `is_superuser` → 3 | — | — (implicit in prod) | — | **GAP** |
| `isAdvisor` → 3 | — | — | — | **GAP** |
| `isAdvisorClient` → 3 | — | `resolveEffectiveTier.spec`; `getUserAccessProfile` advisor-client bypass | unit-direct / unit-wrapper | MULTI-DIFF-PATH |
| `isProfessionallyManaged` → stored tier or 3 | — (advisor-client household is managed path) | — | — | **GAP** (no unit case for `isProfessionallyManaged: true`) |
| Persona seed contract (DB columns) | all 6 rows | `e2ePersonaMatrix.spec`; `verify:e2e-persona-matrix` | static / script | MULTI-DIFF-PATH (seed contract, not tier resolve) |

**Pass-1 notes (resolver):** Unit matrix is strong for consumer paths pinned by PR 8. Main GAPs: browser-level app-trial persona, advisor/professionally-managed bypasses, superuser. `MULTI-SAME-PATH` on app-trial unit helpers is a Pass-2 List A candidate only if we keep one canonical unit case.

---

## 2. Deliverable OR-gate (`hasDeliverableDownloadAccess`)

Production wiring: `print/page.tsx` and `export-estate-plan/route.ts` load purchase via `getUserPlanExportPurchase` → `toPlanExportPurchaseContext`.

| Cell / failure mode | Persona | Tests | Call path | Coverage |
|--------------------|---------|-------|-----------|----------|
| Active tier-3 sub → allow | `active-tier-3` | `requirePaidDownloadAccess.spec` “tier 3 active stored profile” | unit-direct on gate | SINGLE |
| Active sub → allow (route) | `active-tier-3` | — (`consumer-deliverable-export` uses tier-1 patch, not tier-3 sub) | — | **GAP** (no E2E “active tier-3 /print ready” on seeded persona) |
| Completed purchase → allow (download) | `plan-export-purchaser-no-sub` | `requirePaidDownloadAccess.spec` “one-time day 91 → download still allowed” | unit-direct; **hand-built** `{ editWindowEndsAt }` | SINGLE — **List B candidate** (not `toPlanExportPurchaseContext`) |
| Purchase → allow (/print UI) | — | `consumer-deliverable-export.spec` “completed Plan & Export unlocks /print” | e2e-patch via `deferPlanAndExportPurchase` on **tier-3 consumer**, not `consumerPlanExport` persona | MULTI-DIFF-PATH — **List B candidate** (patch ≠ production loader) |
| App trial alone → refuse | `app-managed-trial` | `requirePaidDownloadAccess.spec` “app trial shape → false” | unit-direct | SINGLE |
| App trial → refuse (E2E) | `app-managed-trial` | — (E2E uses Stripe `trialing` patch, not app-managed trial columns) | — | **GAP** |
| No sub, no purchase → refuse | `plan-export-purchaser-no-sub` (inverted) | `requirePaidDownloadAccess.spec` “tier 1 no sub”; `consumer-deliverable-export` gated /print | unit + e2e-patch | MULTI-DIFF-PATH |
| Purchase OR active (offer hidden) | — | `shouldOfferPlanAndExportPurchase.spec` passes `canDownloadDeliverable: true/false` **as input** | unit-direct on CTA helper, not gate+wiring | **GAP** for faithful OR-cell — **List B** (pre-computed boolean) |
| Four-cell matrix + loader shape | — | PR **#123** `planExportAppTrialDeliverable.spec` (open, not on staging) | unit with `toPlanExportPurchaseContext` | **GAP on staging** until #123 merges |

**Pass-1 notes (deliverable):** Unit gate logic is covered; faithful **production call-site** coverage for purchaser + app-trial cells is thin on staging. #123 is the intended fix for List B class; until merge, treat purchaser/app-trial deliverable cells as GAP at production fidelity.

---

## 3. Input / computed boundary (`inputComputedBoundary`)

| Branch / failure mode | Tests | Call path | Coverage |
|----------------------|-------|-----------|----------|
| Data-entry `FEATURE_TIERS` keys at tier 0 | `inputComputedBoundary.spec` | unit-static on registry | SINGLE |
| Computed features align with `FEATURE_TIERS` | `inputComputedBoundary.spec` | unit-static | SINGLE |
| Page split documents computed feature | `inputComputedBoundary.spec` | unit-static | SINGLE |
| Export input ∩ computed denylist = ∅ | `inputComputedBoundary.spec` | unit-static | SINGLE |
| Tier-0 shared pages: input visible, computed gated | `consumer-tier0-gates.spec` (/insurance, /real-estate) | e2e-route (canceled persona) | SINGLE |
| Tier-0 modeling routes gated | `consumer-tier0-gates.spec` (/import, /projections, /scenarios) | e2e-route | SINGLE |
| Tier-0 dashboard: no background recompute | `verify-tier0-dashboard-no-recompute.ts`; `consumer-tier0-dashboard.spec` | script + e2e | MULTI-DIFF-PATH |
| Tier-0 net worth from inputs not cache | `netWorthSummary.spec` | unit-direct | SINGLE |
| Per `EXPORT_INPUT_TABLES` row in export body | PR **#120** `inputExportPayload.spec` + E2E (open) | — | **GAP on staging** |
| Export isolation negative (cross-user) | PR **#120** `export-isolation-fixture` (open) | — | **GAP on staging** |
| Projections deterministic-only at tier 1 | `projectionsContentSplit.spec` (if on staging) | unit | verify on branch |

**Pass-1 notes (boundary):** PR 2/3 enforcement is well covered on staging. PR 6 export contract tests are the main staging GAP for “inputs only in export.”

---

## 4. `getUserAccess` resilience

| Branch / failure mode | Tests | Call path | Coverage |
|----------------------|-------|-----------|----------|
| Profile read error → throw (`ProfileAccessError`), not tier 0 | `getUserAccessProfile.spec` `loadProfileForUserAccess` | unit-mock admin | SINGLE |
| No profile row → null → tier 0 | `getUserAccessProfile.spec` | unit-mock + `buildUserAccessFromProfile(null)` | SINGLE |
| Legitimate inactive → tier 0 | `getUserAccessProfile.spec` | unit-wrapper | SINGLE |
| Active tier 3 → correct tier | `getUserAccessProfile.spec` | unit-wrapper | SINGLE |
| Callers must not catch → default tier 0 | `getUserAccessProfile.spec` grep audit | static | SINGLE |
| Missing DB column at runtime (42703) | `loadProfileForUserAccess` mock only | unit-mock | SINGLE — production path untested in E2E |

---

## 5. Stripe account guard (`assertStripeAccountGuard`)

| Check / failure mode | Tests | Call path | Coverage |
|---------------------|-------|-----------|----------|
| A: mode mismatch (`sk_live` on staging) | `stripeAccountGuard.spec`; `stripeAccountGuardCallSite` | unit + call-site | MULTI-DIFF-PATH |
| B: shell override vs env file | `stripeAccountGuard.spec` | unit with temp env file | SINGLE |
| C: account ID mismatch | — | — | **GAP** (no mocked `accounts.retrieve` wrong-id test) |
| C: API error fail-closed | — | — | **GAP** |
| Guard before `stripLeakedProductionSecrets` | `stripeAccountGuardCallSite` seam 1 | call-site ordering | SINGLE |
| Money-path scripts invoke guard | `stripeAccountGuardCallSite` file grep + `assertStagingMoneyPathGuard` | static / integration | SINGLE |

---

## 6. Summary — GAPs to prioritize (staging @ PR 8)

| Priority | GAP | Likely fill |
|----------|-----|-------------|
| P0 | Deliverable cells without `toPlanExportPurchaseContext` / loader wiring | Merge **#123**; E2E on `consumerPlanExport` + `consumerAppTrial` personas |
| P0 | Export `EXPORT_INPUT_TABLES` sweep + isolation | Merge **#120** |
| P1 | App-managed trial E2E (not Stripe `trialing` patch) | New spec using `consumerAppTrial` auth project |
| P1 | Stripe guard Check C (account mismatch + API fail-closed) | Unit tests with mocked Stripe |
| P2 | `isProfessionallyManaged` / `isAdvisor` resolver branches | Unit cases in `resolveEffectiveTier.spec` |
| P2 | Active tier-3 /print deliverable allowed (E2E) | Spec on default `e2e-consumer` without patch |

---

## 7. Pass 2 preview (do not execute until map approved)

**List A candidates (MULTI-SAME-PATH only):** collapse overlapping `resolveEffectiveTier` + `isAppManagedTrialActive` + `resolveConsumerIsTrial` cases if one case per branch remains.

**List B candidates (false confidence):**
- `requirePaidDownloadAccess.spec` purchase tests use hand-built `planExportPurchase` object
- `shouldOfferPlanAndExportPurchase.spec` feeds `canDownloadDeliverable` boolean instead of computing from profile + loader row
- `consumer-deliverable-export.spec` uses `deferProfileAccessRestore` / `deferPlanAndExportPurchase` patches on tier-3 consumer, not seeded matrix personas or production loader
- Stripe Check C untested → guard can regress without CI signal

---

**Approve this map** → Pass 2 produces List A + List B with per-entry cut/fix/keep rationale.
