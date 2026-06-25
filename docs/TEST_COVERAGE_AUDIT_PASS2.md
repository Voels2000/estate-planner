# Test-Coverage Audit — Pass 2 (List B leads)

**Baseline:** Pass 1 re-baselined against staging + **#120** + **#123** ([PASS1](./TEST_COVERAGE_AUDIT_PASS1.md))  
**Status:** Review-only — no test changes until approved.  
**Step zero:** Merge #120 and #123 (conflicts resolved on branches; CI/branch protection may need a green `verify` before merge).

---

## List B — false-confidence tests (fix or cut)

*Higher value. #123 is the template for faithful deliverable wiring — do not re-fix what it already fixes; migrate the rest to match it.*

| ID | Test / file | Issue | Same failure mode as | Action | Rationale |
|----|-------------|-------|----------------------|--------|-----------|
| **B1** | `requirePaidDownloadAccess.spec` — purchase cases using hand-built `{ editWindowEndsAt }` | Gate invoked with object shape production never receives without `toPlanExportPurchaseContext` | `planExportAppTrialDeliverable.spec` cell 3 (#123) | **Cut** (preferred) or rewire through `mockCompletedPlanExportRow` → `toPlanExportPurchaseContext` | #123 covers faithful path; keeping hand-built tests risks green-for-wrong-reason if loader mapping changes |
| **B2** | `shouldOfferPlanAndExportPurchase.spec` — all cases pass `canDownloadDeliverable: true/false` as input | Tests CTA helper in isolation; does not prove billing page computes flag from profile + loader row | `planExportAppTrialDeliverable.spec` `printPageDeliverableFlags` (#123) | **Fix** — replace boolean-input cases with `printPageDeliverableFlags`-style wiring (profile + `mockCompletedPlanExportRow \| null`) | Production `/billing` and `/print` compute `canDownloadDeliverable` from gate + loader; tests must match |
| **B3** | `consumer-deliverable-export.spec` — `deferPlanAndExportPurchase` on default tier-3 consumer | E2E patches purchaser onto wrong persona; not `e2e-consumer-plan-export@…` | #123 cell 3 + seeded `plan-export-purchaser-no-sub` | **Fix** — add `consumer-plan-export` auth project (or login as matrix email); run purchase seed path on that user | Persona matrix is coverage ground-truth; patch-on-tier-3 hides persona drift |
| **B4** | `consumer-deliverable-export.spec` — `APP_MANAGED_TRIAL_ACCESS` patch on tier-3 consumer | Column-faithful patch but not seeded `consumerAppTrial` identity | #123 cell 1 unit + `verify-pr5 --personas` | **Fix** — `consumer-app-trial` Playwright project using `E2E_IDENTITIES.consumerAppTrial`; drop patch where seed provides state | Browser proof should use matrix persona, not ephemeral profile surgery |
| **B5** | `consumer-deliverable-export.spec` — `DELIVERABLE_ACTIVE_TIER3_ACCESS` patch | Patch on tier-3 consumer household vs stable `e2e-consumer@` seed | #123 cell 2 unit | **Fix** (light) — prefer unpatched `e2e-consumer` when seed is tier-3 active; keep patch only if seed drifts | Reduces dual paths; seed is source of truth post PR 8 |
| **B6** | `consumer-deliverable-export.spec` — Stripe `trialing` patch test | Tests legacy Stripe trial path, not app-managed trial (`trial_ends_at`) | #123 app-trial E2E + cell 1 | **Keep** as legacy regression **or Cut** if Stripe trialing fully retired for new signups (PR 5) | Different branch than app-managed trial — not redundant with B4; document as legacy-only |
| **B7** | Stripe Check C — no test that guard rejects wrong account or API failure | Guard built to prevent two-day bug; never proven to fire | `assertStripeAccountIdentity` in `testEnv.ts` | **Fix** — add 2 unit tests (mock `Stripe` constructor or inject retrieve): (1) wrong `account.id` throws; (2) retrieve throws → fail-closed message | Not List B “lying test” — missing guard proof; **P0 fill before cuts** |

### List B execution order (after approval)

1. **B7** — Stripe Check C (fill GAP; no branch loses coverage)
2. **B2** — `shouldOfferPlanAndExportPurchase` rewire to #123 pattern
3. **B3, B4, B5** — E2E persona migration (one commit per persona family)
4. **B1** — cut hand-built purchase unit cases once B2–B4 verified
5. **B6** — decide keep/cut legacy Stripe `trialing` E2E (document in spec)

---

## List A — true duplicates (cut candidates, last priority)

*Only MULTI-SAME-PATH. When in doubt, keep.*

| ID | Tests | Branch | Action | Rationale |
|----|-------|--------|--------|-----------|
| **A1** | `resolveEffectiveTier.spec` “app trial window” + `isAppManagedTrialActive` + `resolveConsumerIsTrial` “app trial user” | App trial → 3 | **Optional collapse** to one canonical resolver case + one `resolveConsumerIsTrial` case | Saves ~2 tests; low value; risk near zero if one case per fn remains |
| **A2** | `requirePaidDownloadAccess` “app trial shape” + #123 cell 1 | App trial deliverable refuse | **Cut** `requirePaidDownloadAccess` case after #123 merges | Same branch, same gate fn, #123 is strictly more faithful |
| **A3** | `requirePaidDownloadAccess` “tier 3 active” + #123 cell 2 | Active sub allow | **Cut** redundant unit case after #123 merges | #123 + E2E tier-3 patch sufficient |

**Do not execute List A until List B fixes land and full suite diff is checked.**

---

## GAP fills (not List A/B — net-new coverage)

| ID | Branch | Action |
|----|--------|--------|
| **G1** | `resolveEffectiveTier` `isAdvisor: true` | Unit case → tier 3 |
| **G2** | `resolveEffectiveTier` `isProfessionallyManaged: true` (stored tier 2 and fallback 3) | Unit cases |
| **G3** | `consumerAppTrial` Playwright auth project | Part of B4 |

---

## Explicit non-actions

| Item | Label | Why |
|------|-------|-----|
| `getUserAccess` 42703 E2E | **CORRECT-FIDELITY** | Unit mock + LAUNCH migration ordering; do not engineer broken-schema E2E |
| Export `EXPORT_INPUT_TABLES` sweep | **COVERED-PENDING-MERGE** (#120) | Do not duplicate in audit execution |
| Deliverable four-cell unit matrix | **COVERED-PENDING-MERGE** (#123) | Template for List B migrations, not re-implementation |
| Persona matrix seed rows | **Done** (PR 8) | Audit verifies wiring, not seed content |

---

## Approval checklist

- [ ] #120 and #123 merged to staging
- [ ] Pass 1 re-baseline accepted
- [ ] List B order accepted (B7 first)
- [ ] List A deferred / accepted as optional tidying
- [ ] Execution PR(s): GAP-fills → List B fixes → List A cuts (separate commits)
