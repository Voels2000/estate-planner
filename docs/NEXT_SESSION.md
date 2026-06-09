# NEXT_SESSION.md
# Session handoff — current focus and paste block
# Last updated: 2026-06-09

---

## How to use this doc

- **Start here** for the current session: active work, go-live blockers, paste block, queued ops.
- **Shipped work history:** [ROADMAP.md](./ROADMAP.md) (status) · [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md) (what changed) · [DECISION_LOG.md](./DECISION_LOG.md) (why).
- **Architecture truth:** [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) · [CALCULATION_ENGINES.md](./CALCULATION_ENGINES.md).

---

## Current focus (2026-06-07)

Engineering sprints through L4 (a11y, mobile E2E, RLS verify, consumer OpenAPI) are **complete**. Remaining work is **go-live prep** (legal, Stripe, smoke) plus low-priority deferred items.

| Area | Status | Canonical doc |
|------|--------|---------------|
| B2B2C billing + seat pricing | ✅ Shipped | [BILLING_B2B2C_POLICY.md](./BILLING_B2B2C_POLICY.md) |
| Release routine (local → preview → prod) | ✅ Documented | [RELEASE_ROUTINE.md](./RELEASE_ROUTINE.md) |
| Environment / CI credential policy | ✅ Documented | [ENVIRONMENT_TESTING.md](./ENVIRONMENT_TESTING.md) |
| Go-live blockers (legal, Stripe, smoke) | ☐ Blocker | [LAUNCH_GATE.md](./LAUNCH_GATE.md) |
| Admin Ops Home + task engine | ✅ Shipped | `/admin` → Ops Home · `ops_tasks` · `cron_health` |
| Advisor Profile Settings UI | `[~]` partial | Logo upload shipped; see [ROADMAP.md](./ROADMAP.md) |

---

## Recent shipped (2026-06-05 → 2026-06-09)

| Item | Command / entry point |
|------|------------------------|
| Admin-A Ops Home + ops_tasks engine | `/admin` → Ops Home · `GET/PATCH /api/admin/ops-tasks` |
| Cron health + alert hardening | `cron_health` table · `lib/cron/recordCronHealth.ts` |
| Privacy admin intake | Data & Compliance → **Add request** · `POST /api/admin/privacy-requests` |
| L1 a11y (eslint-jsx-a11y + axe E2E) | `npm run test:e2e:a11y` |
| L2 mobile review E2E | `npm run test:e2e:mobile` |
| L3 RLS post-migration verify | `npm run verify:rls` · `--require-sql` post-deploy |
| L4 consumer OpenAPI + CI drift guard | `npm run verify:consumer-openapi` |
| Estate verification suite | `npm run verify:estate` |
| Post-deploy Voels gate + daily cron | `npm run verify:post-deploy-voels` · `npm run smoke:mc-voels` |
| Engine B export standardization | `/api/export-estate-plan` · `scripts/verify-engine-b-tax-surfaces.ts` |
| Attorney portal collaboration v2 + weekly digest | `/attorney` · cron §10 Fridays |
| B2B2C connection billing | migration `20260704120000` · [BILLING_B2B2C_POLICY.md](./BILLING_B2B2C_POLICY.md) |
| Admin tax scan · rollover · commit | `/admin` Tax Rules · `npm run verify:tax-coverage` · [MASTER_ARCHITECTURE § Admin tax rules](./MASTER_ARCHITECTURE.md#admin-tax-rules-maintenance-scan--rollover--commit) |

Detail for each item: [ROADMAP.md](./ROADMAP.md) · [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md).

---

## Go-live blockers (non-code)

Do NOT set `PUBLIC_SIGNUP_OPEN=true` until all Gate 1 items in [LAUNCH_GATE.md](./LAUNCH_GATE.md) are checked.

**Post-deploy automated gate:** `npm run test:e2e:go-live-profile` · `npm run test:e2e:cross-role`
· `npm run test:e2e:security-isolation` — [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) · [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md).

---

## Standing rules for Cursor sessions

1. **Calculation / tax work:** Start with **"read docs/CALCULATION_ENGINES.md"** before changing tax, projection, strategy, or horizon math.
2. **Regression grep (after any calc-file touch):** [CALCULATION_ENGINES.md § Regression grep checks](./CALCULATION_ENGINES.md#regression-grep-checks-ongoing-smoke-test).
3. **CST strings:** Import from **`lib/constants/strategyTypes.ts`** — never hardcode `'cst'` / `'credit_shelter_trust'` at DB query sites.
4. **Doc sync pass:** On sprint close, update [ROADMAP.md](./ROADMAP.md), [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md), [DECISION_LOG.md](./DECISION_LOG.md) as needed — see [UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md).

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — **go-live prep.** L1–L4 competitive backlog shipped (2026-06-07). B2B2C billing policy + connection billing migration live. Release routine: `npm run release:local` before PR; `npm run release:post-deploy` after prod deploy.
>
> **Blockers before open signups:** [LAUNCH_GATE.md](./LAUNCH_GATE.md) — Gate 1 must be fully checked.
>
> **Go-live day:** Stripe Phase 2 live catalog → [LAUNCH_CHECKLIST § Opening signups](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip).
>
> **Post-deploy:** `npm run verify:post-deploy-voels` · `npm run test:e2e:go-live-profile` — [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) · [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md).

---

## Queued next (post-ship ops)

### 1. Dashboard `canShowPartial` nudge — low priority

Deferred. Show a subtle setup card on `/dashboard` when the user has financial data but is missing birth year or retirement age for projections. Revisit after ~2 weeks of traffic — `/projections` already has inline prompts.

### 2. Attorney drip steps 2 & 3 — cron verification

Worth a manual DB check once a **real** attorney has registered (not seed-only). See [LAUNCH_CHECKLIST § Attorney drip cron (ops)](./LAUNCH_CHECKLIST.md#attorney-drip-cron-ops).

| Step | When | Column |
|------|------|--------|
| 1 | Immediately on activation | `attorney_drip_step_1_sent_at` non-null |
| 2 | ~3+ days after step 1 sent | `attorney_drip_step_2_sent_at` |
| 3 | ~7+ days after step 1 sent | `attorney_drip_step_3_sent_at` |

Cron: `app/api/cron/notifications/route.ts` § attorney activation drip.

---

## Archived sprint playbooks

Shipped execution scripts moved to [docs/archive/sprints/](./archive/sprints/README.md). Do not use for new work.
