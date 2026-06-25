# Test-Coverage Audit — Pass 1 Map (re-baselined)

**Baseline:** `staging` + **#120** (PR 6 export) + **#123** (PR 7 deliverable) — tests exist on those branches; merge conflicts resolved and pushed (`e99a127a`, `31e02b27`). Draw the map against this baseline, not “staging @ PR 8 only.”

**Persona ground-truth:** `scripts/e2e-persona-matrix.ts` (`E2E_PERSONA_MATRIX`)

**Coverage labels:** SINGLE · MULTI-SAME-PATH · MULTI-DIFF-PATH · **COVERED-PENDING-MERGE** · **CORRECT-FIDELITY** · **GAP**

**Call-path tags:** `unit-direct` · `unit-wrapper` · `e2e-route` · `e2e-patch` · `script-integration` · `static`

---

## 1. `resolveEffectiveTier` (+ persona matrix)

| Branch / failure mode | Persona | Tests (post–#120/#123 baseline) | Call path | Coverage |
|----------------------|---------|----------------------------------|-----------|----------|
| Inactive / none → 0 | — | `resolveEffectiveTier.spec` | unit-direct | SINGLE |
| Expired `trial_ends_at` → 0 | — | `resolveEffectiveTier.spec` | unit-direct | SINGLE |
| App trial → 3 | `app-managed-trial` | `resolveEffectiveTier.spec` + helpers; `verify-pr5 --personas` | unit + script-integration | MULTI-DIFF-PATH |
| `has_ever_subscribed` → 0 (canceled) | `tier-0-canceled-*` | `resolveEffectiveTier.spec`; `consumer-tier0-gates` (canceled auth) | unit + e2e-route | MULTI-DIFF-PATH |
| `past_due` / `unpaid` → 0 | — | `resolveEffectiveTier.spec` | unit-direct | SINGLE |
| Active paid tiers 1–3 | `active-tier-*` | `resolveEffectiveTier.spec`; `verify-pr5 --personas`; default consumer E2E | unit + script + e2e | MULTI-DIFF-PATH |
| `canceling` → paid tier | — | `resolveEffectiveTier.spec` | unit-direct | SINGLE |
| Stripe `trialing` → paid path | — | `resolveEffectiveTier.spec` | unit-direct | SINGLE |
| `isAdvisorClient` → 3 | — | `resolveEffectiveTier.spec`; `getUserAccessProfile` | unit + unit-wrapper | MULTI-DIFF-PATH |
| `isAdvisor` → 3 | — | — | — | **GAP** |
| `isProfessionallyManaged` → stored/3 | — | — | — | **GAP** |
| `is_superuser` → 3 | — | — | — | **GAP** (low prod risk; admin path) |
| Persona seed contract | all 6 rows | `e2ePersonaMatrix.spec`; `verify:e2e-persona-matrix` | static / script | MULTI-DIFF-PATH |

---

## 2. Deliverable OR-gate (`hasDeliverableDownloadAccess`)

Production wiring: `getUserPlanExportPurchase` → `toPlanExportPurchaseContext` → gate (see `print/page.tsx`, `export-estate-plan/route.ts`).

| Cell / failure mode | Persona | Tests (post–#123 baseline) | Call path | Coverage |
|--------------------|---------|----------------------------|-----------|----------|
| Four-cell matrix + `/print` wiring | all cells | `planExportAppTrialDeliverable.spec` (#123) | unit; loader row → `toPlanExportPurchaseContext` | **COVERED-PENDING-MERGE** |
| App trial → refuse (unit) | `app-managed-trial` | cell 1 in #123 matrix; `requirePaidDownloadAccess.spec` “app trial shape” | unit-direct | MULTI-SAME-PATH — List A tidying only |
| Active tier-3 → allow (unit) | `active-tier-3` | cell 2 #123; `requirePaidDownloadAccess.spec` | unit-direct | MULTI-SAME-PATH |
| Purchaser → allow (faithful) | `plan-export-purchaser-no-sub` | cell 3 #123 (loader row) | unit; production shape | **COVERED-PENDING-MERGE** |
| App trial + purchase OR | — | cell 4 #123 | unit | **COVERED-PENDING-MERGE** |
| App trial → refuse (browser) | `app-managed-trial` | `consumer-deliverable-export` “app-managed trial” (#123); `APP_MANAGED_TRIAL_ACCESS` patch | e2e-patch | **COVERED-PENDING-MERGE** — List B: migrate to seeded persona auth |
| Active tier-3 → allow (browser) | `active-tier-3` | `consumer-deliverable-export` + `DELIVERABLE_ACTIVE_TIER3_ACCESS` (#123) | e2e-patch | **COVERED-PENDING-MERGE** — List B: seeded `e2e-consumer` preferred |
| Purchase → /print unlock (browser) | `plan-export-purchaser-no-sub` | `consumer-deliverable-export` `deferPlanAndExportPurchase` on **tier-3 consumer** | e2e-patch | **COVERED-PENDING-MERGE** — List B: use `consumerPlanExport` persona |
| Legacy unit purchase shape | — | `requirePaidDownloadAccess.spec` hand-built `{ editWindowEndsAt }` | unit-direct | MULTI-SAME-PATH with #123 — **List B: cut or rewire** |
| CTA offer visibility | — | `shouldOfferPlanAndExportPurchase.spec` feeds `canDownloadDeliverable` boolean | unit on helper | **GAP** at production fidelity — **List B: match #123 `printPageDeliverableFlags` pattern** |

---

## 3. Input / computed boundary

| Branch / failure mode | Tests (post–#120 baseline) | Call path | Coverage |
|----------------------|----------------------------|-----------|----------|
| Registry / denylist / page splits | `inputComputedBoundary.spec` | unit-static | SINGLE |
| Tier-0 page gates | `consumer-tier0-gates.spec` | e2e-route | SINGLE |
| Tier-0 dashboard / recompute | `verify-tier0-no-recompute`; `consumer-tier0-dashboard` | script + e2e | MULTI-DIFF-PATH |
| Net worth from inputs | `netWorthSummary.spec` | unit-direct | SINGLE |
| Export serializer = `EXPORT_INPUT_TABLES` only | `inputExportPayload.spec` (#120) | unit-direct | **COVERED-PENDING-MERGE** |
| Export E2E + cross-household isolation | `consumer-data-export.spec`; `export-isolation-fixture` (#120) | e2e-route | **COVERED-PENDING-MERGE** |

---

## 4. `getUserAccess` resilience

| Branch / failure mode | Tests | Call path | Coverage |
|----------------------|-------|-----------|----------|
| Read error → throw, not tier 0 | `getUserAccessProfile.spec` `loadProfileForUserAccess` mock 42703 | unit-mock | **CORRECT-FIDELITY** |
| No row → tier 0 | `getUserAccessProfile.spec` | unit-mock + wrapper | SINGLE |
| Callers must not swallow → tier 0 | grep audit in `getUserAccessProfile.spec` | static | SINGLE |

**42703 note:** Not a fillable GAP. Unit-mock is the right test fidelity; production proof is **migration-before-code** in [LAUNCH.md](./LAUNCH.md) Bucket C — deliberately breaking prod schema for E2E would be higher risk than the gap.

---

## 5. Stripe account guard

| Check | Tests | Coverage |
|-------|-------|----------|
| A: mode mismatch | `stripeAccountGuard.spec`; call-site | MULTI-DIFF-PATH |
| B: shell override | `stripeAccountGuard.spec` | SINGLE |
| C: wrong `account.id` | — | **GAP** |
| C: API error fail-closed | — | **GAP** |
| Call-site ordering / halt | `stripeAccountGuardCallSite.spec` | SINGLE |

---

## 6. Post–merge GAP set (real work only)

After #120 + #123 land, these remain:

| Priority | GAP | Action |
|----------|-----|--------|
| **P0** | Stripe Check C (wrong account + API fail-closed) | Add 2 mocked unit tests in `stripeAccountGuard.spec` |
| **P1** | `isAdvisor` / `isProfessionallyManaged` resolver branches | Add unit cases in `resolveEffectiveTier.spec` |
| **P1** | Deliverable E2E still on patches, not matrix personas | List B: migrate specs to `consumerAppTrial` / `consumerPlanExport` / `e2e-consumer` auth (template = #123) |
| **P1** | `shouldOfferPlanAndExportPurchase.spec` boolean-input pattern | List B: rewire to compute `canDownloadDeliverable` like #123 `/print` wiring |
| **P2** | `requirePaidDownloadAccess.spec` hand-built purchase objects | List B: cut if redundant with #123 matrix, else rewire |
| **P2** | `is_superuser` → 3 | Optional unit case |
| **P3** | Resolver app-trial unit helper overlap | List A tidying only — last priority |

**Evaporated on re-baseline (do not schedule fill work):** export boundary sweep (#120), deliverable four-cell faithful unit matrix (#123), app-trial + tier-3 deliverable E2E at patch fidelity (#123).

---

**Next:** [Pass 2 — List B + List A](./TEST_COVERAGE_AUDIT_PASS2.md)
