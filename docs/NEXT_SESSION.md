# NEXT_SESSION.md — session handoff

**Last updated:** 2026-07-01 (#206–#211 merged; credential + respond rename on branch)

---

## Start here

**Attorney connection billing:** ✅ **Closed** — step-4 spine proven.

**Claim v2:** #206–#211 merged. **On branch `feat/claim-v2-credential-respond-stepup`:** credential at first connect, `/respond-request` rename, `walk:staging-action-step-up`. **Then:** merge PR → set `ACTION_GATED_PRIVILEGED_MFA=true` on staging → run walks → promotion `staging` → `main` for prod cutover.

---

## Current state (2026-07-01)

| Area | Status |
|------|--------|
| Attorney connection billing | ✅ Closed — step 4 PASS on staging |
| Walk helpers | ✅ `walk:staging-attorney-connection-accepts` + `walk:staging-attorney-step4` (#203) |
| Claim v2 discovery | ✅ [CLAIM_FLOW_V2_DISCOVERY_AUDIT.md](./CLAIM_FLOW_V2_DISCOVERY_AUDIT.md) |
| Claim v2 spec (locked auth) | ✅ [CLAIM_FLOW_V2_COMPLETE_SPEC.md](./CLAIM_FLOW_V2_COMPLETE_SPEC.md) |
| Claim v2 implementation | `[~]` | Credential + respond rename + step-up walk on branch; prod cutover after staging green |
| `/claim-listing/` identity-skip | ✅ #206 → route renamed `/respond-request` (redirect from old path) |
| `/advisor/firm` connection copy | ✅ #207 |
| Claim v2 magic-link entry | ✅ #208–#210 merged |
| Action-gated step-up | ✅ #211 — `ACTION_GATED_PRIVILEGED_MFA` (enable on staging before walk) |
| Credential at first connect | `[~]` | WSBA/CRD on accept-request; sets `credential_verified_at` |
| Prod connection billing flip | 🚫 After staging green — see [PRE_FLIP_CHECKLIST.md](./PRE_FLIP_CHECKLIST.md) |

---

## Handoff (fresh chat)

**Proven on staging:** advisor connection billing, attorney connection billing (step 4 green), Path A, directory magic-link claim + billing seed (#209).

**Next merge:** PR from `feat/claim-v2-credential-respond-stepup` → `staging`. After deploy: `npm run walk:staging-action-step-up` (requires `ACTION_GATED_PRIVILEGED_MFA=true` on Vercel staging).

**Before launch:** enable staging flag · run walks · promotion PR `staging` → `main` · prod cutover checklist · P0 outreach copy.

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
