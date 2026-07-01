# NEXT_SESSION.md — session handoff

**Last updated:** 2026-07-01 (attorney billing closed; claim v2 spec landed)

---

## Start here

**Attorney connection billing:** ✅ **Closed** — #200–#201 on `staging`; step-4 spine proven (`walk:staging-attorney-step4`). API contract is source of truth.

**Claim-flow v2:** Spec locked — [CLAIM_FLOW_V2_COMPLETE_SPEC.md](./CLAIM_FLOW_V2_COMPLETE_SPEC.md). Load-bearing choice: **magic link creates session at claim; password+MFA step-up on first data action.** Implementation not started.

**Advisor track (parallel):** #197/#198 merge queue · `/advisor/firm` legacy copy still open.

---

## Current state (2026-07-01)

| Area | Status |
|------|--------|
| Attorney connection billing | ✅ Closed — step 4 PASS on staging |
| Walk helpers | ✅ `walk:staging-attorney-connection-accepts` + `walk:staging-attorney-step4` (#203) |
| Claim v2 discovery | ✅ [CLAIM_FLOW_V2_DISCOVERY_AUDIT.md](./CLAIM_FLOW_V2_DISCOVERY_AUDIT.md) |
| Claim v2 spec (locked auth) | ✅ [CLAIM_FLOW_V2_COMPLETE_SPEC.md](./CLAIM_FLOW_V2_COMPLETE_SPEC.md) |
| Claim v2 implementation | `[ ]` | Build plan Part 6 — magic link claim first |
| Advisor checkout redirect (#197) | 🔄 PR open |
| Prod connection billing flip | 🚫 After staging green |

---

## Paste block (first message in Cursor)

> My Wealth Maps — **attorney billing closed** (#200–#203). Spine: `reset:staging-e2e-attorney-connection-billing` → `walk:staging-attorney-connection-accepts` → `walk:staging-attorney-step4`.
>
> **Claim v2:** [CLAIM_FLOW_V2_COMPLETE_SPEC.md](./CLAIM_FLOW_V2_COMPLETE_SPEC.md) — magic link at claim, step-up on first data action, explicit billing seed at claim.

---

## Staging walk helpers

| Command | Purpose |
|---------|---------|
| `npm run reset:staging-e2e-attorney-connection-billing` | Clean attorney billing fixture + seed pending requests |
| `npx tsx scripts/walk-staging-attorney-connection-accepts.ts` | List pending accepts + API walk |
| `npx tsx scripts/inspect-staging-attorney-billing-state.ts` | DB + Stripe snapshot |

**E2E identity:** `e2e-attorney@mywealthmaps.test`

---

## Canonical docs

| Doc | Role |
|-----|------|
| [ATTORNEY_RAISE_CONNECT_PARITY_FIX.md](./ATTORNEY_RAISE_CONNECT_PARITY_FIX.md) | Attorney raise/connect parity spec (shipped #201) |
| [CLAIM_FLOW_V2_COMPLETE_SPEC.md](./CLAIM_FLOW_V2_COMPLETE_SPEC.md) | Claim v2 — locked auth + build plan |
| [CLAIM_FLOW_V2_DISCOVERY_AUDIT.md](./CLAIM_FLOW_V2_DISCOVERY_AUDIT.md) | Claim v2 code audit |
| [CONNECTION_BILLING_STICKY_FLOOR_FIX.md](./CONNECTION_BILLING_STICKY_FLOOR_FIX.md) | B2 model + contract tests |
| [DECISION_LOG.md](./DECISION_LOG.md) | Settled decisions |
| [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) | Connection billing architecture |
| [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) | Fixture resets |

---

## Standing rules

- Feature PRs → **`staging`** first; promote `staging` → `main` only when green.
- Do not run staging integration tests against live URL until code is on **`staging`**.
