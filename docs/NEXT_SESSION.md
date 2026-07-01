# NEXT_SESSION.md — session handoff

**Last updated:** 2026-07-01 (#212–#213 merged; claim v2 staging walks green)

---

## Start here

**Attorney connection billing:** ✅ **Closed** — step-4 spine proven.

**Claim v2:** ✅ **Closed on staging** (#206–#213). Staging walks green (`walk:staging-action-step-up`, `walk:staging-directory-claim-magic-link`). **Next:** promotion PR **`staging` → `main`** → prod deploy → prod env flags (`CONNECTION_BILLING_ENABLED`, `ACTION_GATED_PRIVILEGED_MFA`) when ready for cutover.

---

## Current state (2026-07-01)

| Area | Status |
|------|--------|
| Attorney connection billing | ✅ Closed — step 4 PASS on staging |
| Walk helpers | ✅ attorney connection + directory claim + action step-up walks |
| Claim v2 implementation | ✅ #206–#213 on staging; walks green 2026-07-01 |
| `/respond-request` rename | ✅ #212 (redirect from `/claim-listing`) |
| Action-gated step-up | ✅ #211 + `ACTION_GATED_PRIVILEGED_MFA=true` on staging |
| Credential at first connect | ✅ #212 — WSBA/CRD on accept; sets `credential_verified_at` |
| Prod connection billing flip | 🚫 After promotion + prod deploy — [PRE_FLIP_CHECKLIST.md](./PRE_FLIP_CHECKLIST.md) |

---

## Handoff (fresh chat)

**Proven on staging (2026-07-01):** advisor + attorney connection billing, Path A, directory magic-link claim + billing seed, action step-up + credential at connect.

**Next:** merge promotion PR **`staging` → `main`**; after prod deploy set prod env flags for connection billing / action-gated step-up when cutover-ready.

**Before launch:** prod cutover checklist · P0 outreach copy · real-card smoke.

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
| `npm run walk:staging-action-step-up` | Step-up block + credential gate + accept with bar (#212–#213) |
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
