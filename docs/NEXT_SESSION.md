# NEXT_SESSION.md — session handoff

**Last updated:** 2026-07-01

---

## Start here

**Attorney connection billing (staging):** PRs [#200](https://github.com/Voels2000/estate-planner/pull/200) (free-client offset + gate UI) and [#201](https://github.com/Voels2000/estate-planner/pull/201) (raise-connect parity) **merged to `staging`**. Flag `CONNECTION_BILLING_ENABLED` ON on `estate-planner-staging`.

**Next:** Manual staging re-walk step 4 (raise 2→3, accept 3rd, qty 2 / $150, no checkout). Then claim-flow v2 spec from [CLAIM_FLOW_V2_DISCOVERY_AUDIT.md](./CLAIM_FLOW_V2_DISCOVERY_AUDIT.md).

**Advisor track (parallel):** #197/#198 merge queue · `/advisor/firm` legacy copy still open.

---

## Current state (2026-07-01)

| Area | Status |
|------|--------|
| Attorney free-client offset (#200) | ✅ On `staging` |
| Attorney raise-connect parity (#201) | ✅ On `staging` — shared `ConnectionLimitRaiseForm`, inline raise modal |
| Gate UI four API paths | ✅ 3/4 with UI (#200); `grant-access` API-only (no consumer UI caller) |
| Staging attorney walk | ⬜ Reset + manual proof after deploy |
| Claim-flow v2 discovery | ✅ [CLAIM_FLOW_V2_DISCOVERY_AUDIT.md](./CLAIM_FLOW_V2_DISCOVERY_AUDIT.md) |
| Advisor checkout redirect (#197) | 🔄 PR open |
| Invite-send capacity warning (#198) | 🔄 PR open |
| Prod connection billing flip | 🚫 After staging green |

---

## Paste block (first message in Cursor)

> My Wealth Maps — **attorney connection billing on staging.** #200 + #201 merged. Reset `e2e-attorney@mywealthmaps.test`, walk step 4 (raise at 2/2 → accept 3rd → $150, no checkout).
>
> **Claim v2:** Read [CLAIM_FLOW_V2_DISCOVERY_AUDIT.md](./CLAIM_FLOW_V2_DISCOVERY_AUDIT.md) before spec — signup required today; no billing seed at claim.
>
> **Canonical:** [ATTORNEY_RAISE_CONNECT_PARITY_FIX.md](./ATTORNEY_RAISE_CONNECT_PARITY_FIX.md) · [CONNECTION_BILLING_STICKY_FLOOR_FIX.md](./CONNECTION_BILLING_STICKY_FLOOR_FIX.md)

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
| [CLAIM_FLOW_V2_DISCOVERY_AUDIT.md](./CLAIM_FLOW_V2_DISCOVERY_AUDIT.md) | Claim v2 discovery — signup gate, tokens, billing seam |
| [CONNECTION_BILLING_STICKY_FLOOR_FIX.md](./CONNECTION_BILLING_STICKY_FLOOR_FIX.md) | B2 model + contract tests |
| [DECISION_LOG.md](./DECISION_LOG.md) | Settled decisions |
| [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) | Connection billing architecture |
| [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) | Fixture resets |

---

## Standing rules

- Feature PRs → **`staging`** first; promote `staging` → `main` only when green.
- Do not run staging integration tests against live URL until code is on **`staging`**.
