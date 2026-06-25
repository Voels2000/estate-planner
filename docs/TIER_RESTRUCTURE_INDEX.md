# Tier restructure — planning index

Single map from planning artifacts to **shipped outcomes**. Use this instead of hunting eight separate docs.

**Status (staging):** PRs **1–5** merged and verified (`npm run verify:pr5-staging-gate`). **Code gate closed** — see [LAUNCH.md § Bucket C](./LAUNCH.md#bucket-c--gate-2-flip-sequence-do-not-run-until-bo-ready). **Prod cutover** (migration → verify columns → code → flip) is the live runbook in that same section.

---

## Sequence and scope

| Doc | Role | Outcome |
|-----|------|---------|
| [TIER_RESTRUCTURE_PR_SEQUENCE.md](./TIER_RESTRUCTURE_PR_SEQUENCE.md) | PR ordering + launch gate definition | PRs 1–8 map; gate = PRs 2–5 on staging before consumer flip |
| [INPUT_COMPUTED_BOUNDARY.md](./INPUT_COMPUTED_BOUNDARY.md) | PR 2 / PR 6 shared boundary | `lib/access/inputComputedBoundary.ts` — gates + export denylist |
| [TIER0_DASHBOARD_PR3.md](./TIER0_DASHBOARD_PR3.md) | PR 3 acceptance | Tier 0 dashboard slice; no paid recompute |
| [BILLING_PAGE_COPY_SPEC.md](./BILLING_PAGE_COPY_SPEC.md) | Billing UI copy | `BillingCapabilityMatrix`, trial banner, Plan & Export block |
| [LAUNCH.md § Tier restructure](./LAUNCH.md#tier-restructure-prod-cutover-before-gate-2-flip) | Prod cutover + Gate 2 | Migration `20260724120000_*` → SQL verify → deploy → `PUBLIC_SIGNUP_OPEN` |

---

## Verification commands

| Command | Proves |
|---------|--------|
| `npm run verify:pr5-staging-gate` | Estate checkout + optional `--personas` coherence (tiers 0–3 + app trial) |
| `npm run seed:e2e` | Full cast including persona matrix below |
| `npm run verify:e2e-persona-matrix` | Post-seed DB assert for all matrix rows |
| `npm run verify:tier0-no-recompute` | Tier 0 dashboard does not trigger background recompute |

---

## E2E persona matrix (`scripts/e2e-persona-matrix.ts`)

Each row is the **only** seed coverage for a resolver branch — do not merge or drop without replacing coverage.

| Branch | Identity | Key profile fields |
|--------|----------|-------------------|
| Tier 0 canceled | `e2e-consumer-canceled@…` | `has_ever_subscribed: true`, `subscription_status: canceled` |
| App-managed trial | `e2e-consumer-app-trial@…` | `trial_ends_at` future, `has_ever_subscribed: false` |
| Active tier 1 | `e2e-consumer-tier1@…` | `consumer_tier: 1`, `active` |
| Active tier 2 | `e2e-consumer-tier2@…` | `consumer_tier: 2`, `retirement_monthly` |
| Active tier 3 | `e2e-consumer@…` | `consumer_tier: 3`, `active` |
| Plan & Export purchaser | `e2e-consumer-plan-export@…` | `none` sub + completed `one_time_purchases` |

Advisor-managed path: `e2e-advisor-client@…` (separate bypass — not in consumer matrix).

---

## PR outcomes (consumer tier restructure)

| PR | Shipped | Tests / evidence |
|----|---------|------------------|
| 1 Trial columns | `resolveEffectiveTier`, subscribe→cancel → 0 | `tests/unit/resolveEffectiveTier.spec.ts` |
| 2 Input/computed | Page gates + boundary module | `inputComputedBoundary.ts`, import gate tests |
| 3 Tier 0 dashboard | Dashboard slice | `verify:tier0-no-recompute` |
| 4 Projections split | `/projections` tier 1+ | E2E + unit |
| 5 Retire Stripe trial | `trialDays: 0`, Subscribe CTA | `verify:pr5-staging-gate` |
| 6 Input export | `GET /api/consumer/data-export` | `inputExportPayload.spec.ts` |
| 7 Deliverable | `planExportAccess` purchaser OR | `planExportAppTrialDeliverable.spec.ts` |
| 8 Seeds + docs | Persona matrix + this index | `e2ePersonaMatrix.spec.ts`, `verify:e2e-persona-matrix` |

---

## Decision log entries

- [DECISION_LOG.md § PR 1](./DECISION_LOG.md) — `has_ever_subscribed` write path, resolver order
- [DECISION_LOG.md § PR 5](./DECISION_LOG.md) — retire Stripe consumer trial
- [DECISION_LOG.md § PR 8](./DECISION_LOG.md) — persona matrix must not thin coverage

---

## Not absorbed (still canonical elsewhere)

- [BILLING_B2B2C_POLICY.md](./BILLING_B2B2C_POLICY.md) — advisor/attorney handoff (orthogonal to consumer tier matrix)
- [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) — Playwright env + reset discipline
- [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) — purge + re-seed before gate runs
