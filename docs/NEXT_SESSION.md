# NEXT_SESSION.md — session handoff

**Last updated:** 2026-07-01

---

## Start here

**Advisor connection billing (staging track):** Flag `CONNECTION_BILLING_ENABLED` ON on **`estate-planner-staging`**. Backend sticky-floor (#195) + `/billing` rebuild (#196) **merged to `staging`**. Open PRs: [#197](https://github.com/Voels2000/estate-planner/pull/197) (advisor portal redirects after firm checkout) · [#198](https://github.com/Voels2000/estate-planner/pull/198) (invite-send capacity warning). **Prod flip blocked** until staging green + checkout repoint + `automatic_tax`.

**Pre-flip engineering (consumer):** [PRE_FLIP_REMAINING.md](./PRE_FLIP_REMAINING.md) — PITR propagation + Upstash + B&O block `PUBLIC_SIGNUP_OPEN=true`.

**GTM while waiting:** [LAUNCH_START_HERE.md](./LAUNCH_START_HERE.md) — advisor/attorney outreach unblocked now; consumer pilots gated on MHMD + GRAT/Roth.

---

## Current state (2026-07-01)

| Area | Status |
|------|--------|
| Connection billing B2 sticky-floor (#195) | ✅ On `staging` — migration + sync + raise/reset APIs |
| `/billing` connection UI (#196) | ✅ On `staging` — flag-gated; raise/reset forms + re-band preview |
| Staging live proof (e2e-advisor-empty) | ✅ Sticky floor, gate 402, raise round-trip (manual + API) |
| Advisor checkout redirect (#197) | 🔄 PR open → `/advisor?checkout=success` |
| Invite-send capacity warning (#198) | 🔄 PR open — 402 + `invite_warn`; ack modal on advisor portal |
| `/advisor/firm` Firm Summary | ⚠️ **Still legacy** `$149/advisor` seat copy — separate follow-up PR |
| Prod connection billing flip | 🚫 After staging green + price repoint + `automatic_tax` |
| Tier-restructure prod cutover 0–5 | ✅ Complete |
| Pre-flip verify items 5–8 | ✅ Scripts + #182/#183 on main |
| PITR | 🔄 Propagating — `npm run check:pitr-prod` |
| Upstash Redis (prod) | ⬜ Not set |
| B&O ruling | ⏳ Waiting |
| Flip (`PUBLIC_SIGNUP_OPEN=true`) | 🚫 Blocked on B&O |

---

## Paste block (first message in Cursor)

> My Wealth Maps — **advisor connection billing on staging.** #195 sticky-floor + #196 `/billing` UI **on staging** · live proof on `e2e-advisor-empty@mywealthmaps.test` (floor holds, gate 402, raise works).
>
> **Merge next:** #197 (advisor redirects) · #198 (invite-send warn at capacity).
>
> **Known gap:** `/advisor/firm` still shows legacy per-seat copy — not fixed by #196.
>
> **Before prod flip:** staging green · repoint checkout to connection price · `automatic_tax` · `/advisor/firm` UI (recommended).
>
> **Fixture reset:** `npm run reset:staging-e2e-advisor-empty-billing`
>
> **Canonical:** [CONNECTION_BILLING_STICKY_FLOOR_FIX.md](./CONNECTION_BILLING_STICKY_FLOOR_FIX.md) · [BILLING_PAGE_CONNECTION_REBUILD.md](./BILLING_PAGE_CONNECTION_REBUILD.md) · [DECISION_LOG.md](./DECISION_LOG.md)

---

## Staging walk helpers

| Command | Purpose |
|---------|---------|
| `npm run reset:staging-e2e-advisor-empty-billing` | Reset `e2e-advisor-empty` firm (Stripe + DB) before spine walks |
| `npx tsx scripts/walk-staging-invite-accepts.ts` | List pending invite URLs + walk accepts (#197 branch; merge pending) |

**E2E identities:** `e2e-advisor-empty@mywealthmaps.test` (firm owner, connection billing) · `e2e-consumer-linked@mywealthmaps.test` (invite accept target).

---

## Canonical docs

| Doc | Role |
|-----|------|
| [CONNECTION_BILLING_STICKY_FLOOR_FIX.md](./CONNECTION_BILLING_STICKY_FLOOR_FIX.md) | B2 model, contract tests, staging proof checklist |
| [BILLING_PAGE_CONNECTION_REBUILD.md](./BILLING_PAGE_CONNECTION_REBUILD.md) | `/billing` flag-ON spec (#196 shipped) |
| [DECISION_LOG.md](./DECISION_LOG.md) | Sticky-floor, staging-first, billing UI, invite warn |
| [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) | Connection billing architecture (flag-gated dual path) |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Staging-first policy + PR track |
| [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) | Advisor-empty billing reset |
| [LAUNCH.md](./LAUNCH.md) | Single source of truth / Bucket A–C |
| [PRE_FLIP_REMAINING.md](./PRE_FLIP_REMAINING.md) | Ordered pre-flip step-off list |
| [ROADMAP.md](./ROADMAP.md) | Shipped history |

---

## Standing rules

1. Feature/billing PRs → **`staging` only** (`.cursor/rules/staging-first.mdc`, CI `staging-first-gate`).
2. Flag-off paths must remain byte-identical to legacy behavior.
3. Calculation / tax work → read [CALCULATION_ENGINES.md](./CALCULATION_ENGINES.md) first.
4. Prod writes → never CI; `--confirm` scripts only with `.env.projects.local`.
5. Migrations → per-environment pairing ([DEPLOYMENT.md](./DEPLOYMENT.md)).
