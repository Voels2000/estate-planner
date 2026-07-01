# NEXT_SESSION.md — session handoff

**Last updated:** 2026-07-01 (#206–#210 merged; step-up in flight)

---

## Start here

**Attorney connection billing:** ✅ **Closed** — step-4 spine proven.

**Claim v2:** #206–#210 merged (identity, magic-link claim, billing seed, login link). **Next:** action-gated step-up (#211), credential verification, rename `/claim-listing`.

---

## Current state (2026-07-01)

| Area | Status |
|------|--------|
| Attorney connection billing | ✅ Closed — step 4 PASS on staging |
| Walk helpers | ✅ `walk:staging-attorney-connection-accepts` + `walk:staging-attorney-step4` (#203) |
| Claim v2 discovery | ✅ [CLAIM_FLOW_V2_DISCOVERY_AUDIT.md](./CLAIM_FLOW_V2_DISCOVERY_AUDIT.md) |
| Claim v2 spec (locked auth) | ✅ [CLAIM_FLOW_V2_COMPLETE_SPEC.md](./CLAIM_FLOW_V2_COMPLETE_SPEC.md) |
| Claim v2 implementation | `[~]` | Step-up #211; credential + rename remain |
| `/claim-listing/` identity-skip | ✅ #206 |
| `/advisor/firm` connection copy | ✅ #207 |
| Claim v2 magic-link entry | ✅ #208–#210 merged |
| Action-gated step-up | `[~]` | PR #211 — `ACTION_GATED_PRIVILEGED_MFA` |
| Prod connection billing flip | 🚫 After staging green |

---

## Handoff (fresh chat)

**Proven on staging:** advisor connection billing, attorney connection billing (step 4 green), Path A.

**In flight:** PR #206 claim-listing identity · #207 advisor/firm copy · #208 magic-link claim entry.

**Specced, next after #208:** explicit billing seed at claim · action-gated MFA step-up · login "email me a link".

**Before launch:** v2 build · pricing surface mechanical fixes · prod cutover checklist · P0 outreach copy.

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
| `npm run reset:staging-e2e-directory-claim` | Unclaimed directory listings for claim walk |
| `npm run walk:staging-directory-claim-magic-link` | Magic-link session → POST claim → billing seed checks |
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
