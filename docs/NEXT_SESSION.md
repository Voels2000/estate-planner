# NEXT_SESSION.md
# Session handoff — current focus and paste block
# Last updated: 2026-06-24 (billing capability matrix → staging)

---

## How to use this doc

- **Start here** for the current session: active work, go-live blockers, paste block, queued ops.
- **Shipped work history:** [ROADMAP.md](./ROADMAP.md) (status) · [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md) (what changed) · [DECISION_LOG.md](./DECISION_LOG.md) (why).
- **Architecture truth:** [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) · [CALCULATION_ENGINES.md](./CALCULATION_ENGINES.md).

---

## Current focus (2026-06-24)

**Consumer billing page rebuild** — four-column cumulative capability matrix on `/billing` (PR → `staging`). Signup branded confirm (PR #111) merged at `521e9bdb`.

**Shipped to staging (#111):** Branded Resend signup confirm + prefetch-safe `/auth/confirm` · unit-test `RESEND_API_KEY` hygiene.

**In flight:** Billing matrix UI + trial banner resolver + Plan & Export section below ladder · docs: BILLING_PAGE_COPY_SPEC, MASTER_ARCHITECTURE, DECISION_LOG.

**Next (enforcement):** [TIER_RESTRUCTURE_PR_SEQUENCE.md](./TIER_RESTRUCTURE_PR_SEQUENCE.md) — PR 1 (schema + `resolveEffectiveTier`) → PR 2/3 (gates + Tier 0 dashboard) → PR 4 (projections split) → PR 5 (retire Stripe trial). **Launch gate:** PRs 2–5 required before consumer flip. PR 6 (free inputs export) parallelizable after PR 1.

**Still open (pre-flip):** [LAUNCH.md](./LAUNCH.md) Bucket B — real-card smoke, C-4 walkthrough, counsel/email aliases, B&O ruling (Bucket A). Promotion runbook for staging→main: [PROMOTION_STAGING_TO_MAIN.md](./PROMOTION_STAGING_TO_MAIN.md).

**CI / deploy flow:** `feature/*` → PR → **`staging`** (`verify`: lint + tsc + unit) → PR → **`main`** (`verify` full + `e2e-smoke` + `rls-verify`). Vercel: **`estate-planner-staging`** (branch `staging`) · **`estate-planner`** Production (`main`). See [DEPLOYMENT.md §7](./DEPLOYMENT.md#7-github-actions).

**Staging hardening batch (2026-06-18, PRs #28–#39):** Security fail-closed (#28) · Sentry (#29) · isolation CI (#30) · webhook alerting (#32, #34) · recompute auth (#35) · checkout API guards (#36) · attorney unsubscribe (#37) · notification hygiene (#38) · promotion runbook (#39).

| Area | Status | Canonical doc |
|------|--------|---------------|
| B4 app-logic E2E + stale-score UI | ✅ Shipped | PR #12 · `test:e2e:b4-gate` |
| B5 verify-env live + webhook verifier | ✅ Shipped | PR #15 |
| Security `lifetime_exemption_summary` IDOR | ✅ Shipped | PR #16 · prod applied |
| Launch tracker v4 + LAUNCH sync | ✅ Shipped | [LAUNCH_TRACKER_SYNC.md](./LAUNCH_TRACKER_SYNC.md) |
| deleteUser schema drift hardening | ✅ Shipped | `lib/compliance/deleteUserSchema.ts` |
| E2E advisor-client beneficiaries seed | ✅ Shipped | `verifyE2eAccounts()` count check |
| B2B2C billing + seat pricing | ✅ Shipped | [BILLING_B2B2C_POLICY.md](./BILLING_B2B2C_POLICY.md) |
| Release routine (local → preview → prod) | ✅ Documented | [LAUNCH.md](./LAUNCH.md) |
| Environment / CI credential policy | ✅ Documented + hardened | [ENVIRONMENT_TESTING.md](./ENVIRONMENT_TESTING.md) · PR #27 |
| Pre-launch security fixes (5 blockers) | ✅ Shipped | PR #28 · [DECISION_LOG § Pre-launch security](./DECISION_LOG.md) |
| Staging hardening batch (#29–#39) | ✅ On staging | Recompute (#35) · checkout guards (#36) · attorney unsubscribe (#37) · promotion runbook (#39) · [PROMOTION_STAGING_TO_MAIN.md](./PROMOTION_STAGING_TO_MAIN.md) |
| Sprint E dead-code sweep (#42–#47 merged; #48–#51 pending) | `[~]` On staging | knip `3222746` · [DECISION_LOG § Sprint E](./DECISION_LOG.md) · [UPDATE_CHECKLIST § Sprint E](./UPDATE_CHECKLIST.md) |
| Promote staging → main | ☐ Next | [PROMOTION_STAGING_TO_MAIN.md](./PROMOTION_STAGING_TO_MAIN.md) |
| Go-live blockers (real-card, B&O, C-4, counsel) | ☐ Blocker | [LAUNCH.md](./LAUNCH.md) |
| Admin Ops Home + task engine | ✅ Shipped | `/admin` → Ops Home · `ops_tasks` · `cron_health` |
| Admin P1 (tax config, user detail, waitlist) | ✅ Shipped | `/admin` → Tax Rules · Users · Waitlist |
| Admin-Redesign (sidebar, debug/funnel fixes) | ✅ Shipped | `/admin` sidebar nav · `admin-shell.tsx` |
| WA estate tax SEO (`/learn`) | ✅ Shipped | `/learn/washington-estate-tax` · sitemap 0.8 · advisor PDF link |
| State estate tax content (13 states) | ✅ Shipped | `/learn/[state-tax-slug]` · admin State tax content tab · cron §11 |
| `/learn` discovery & cross-linking | ✅ Shipped | `PublicNav` State tax guides · homepage callout · `/estate-tax` guide link |
| `/assess` dynamic state picker | ✅ Shipped | `useSelectedState` · `StatePickerDropdown` · 13-state callout on intro |
| Pricing surfaces + firm seat billing | ✅ Shipped | `/pricing` advisor/attorney · firm-checkout seat sync · `/billing` seat picker |
| Billing hardening + billing E2E | ✅ Shipped | P0–P2 + polish · `test:e2e:billing` (21 pass / 2 skip prod) · `billing-e2e.ts` |
| Supabase Disk IO + recompute dedupe | ✅ Shipped | `20260709150000`–`20260709180100` · recompute route · **redeploy Vercel** |
| Go-live performance audit | ✅ Done | Consumers / advisors / attorneys — see §5 below |
| Pre-launch DB perf (bundle + MC staleness) | ✅ Shipped | `loadDashboardBundle` · `projection_inputs_hash` · `touchHousehold` on all writes |
| Production E2E smoke (`@production`) | ✅ Shipped | 42 tests · `test:e2e:prod:smoke` · `test:e2e:prod:billing` |
| E2E local DB load (`E2E_SKIP_RECOMPUTE`) | ✅ Shipped | `.env.test` · `triggerEstateHealthRecompute` guard |
| Code audit Sprint A (import + meeting-prep + security split) | ✅ Shipped | See UPDATE_CHECKLIST § Code audit Sprint A |
| Code audit Sprint B (test cleanup) | ✅ Shipped | Merged/removed duplicate specs · advisor selectors · life-events cleanup |
| Code audit Sprint C (safe perf) | ✅ Shipped | Vercel recompute debounce · advisor roster `Promise.all` |
| Code audit Sprint D (dead code) | ✅ Shipped | Unused components/libs/scripts removed · `/advisor/prospect` redirect only |
| Domicile API advisor gate | ✅ Shipped | `assertDomicileSubjectAccess` · `CONNECTED_ADVISOR_CLIENT_STATUSES` |
| Shared roster net worth | ✅ Shipped | `lib/roster/rosterNetWorth.ts` · advisor + attorney · Est. Net Worth tooltip |
| Homepage CI lint (`no-html-link-for-pages`) | ✅ Shipped | `app/(public)/page.tsx` — `/learn` + other internal routes use `<Link>` |
| Legal entity placeholders (`/terms`, `/privacy`) | ✅ Shipped | `lib/legal/company.ts` — My Wealth Maps LLC · Snohomish address · RA Alan Voels |
| Advisor Profile Settings UI | `[~]` partial | Logo upload shipped; see [ROADMAP.md](./ROADMAP.md) |

---

## Recent shipped (2026-06-05 → 2026-06-09)

| Item | Command / entry point |
|------|------------------------|
| Pricing surfaces + firm seat billing | `/pricing` · `firm-checkout` · webhook `seat_count` · `_firm-billing-client.tsx` |
| Billing hardening + E2E | `npm run test:e2e:billing` · `lib/firm/firmRoster.ts` · consumer duplicate-sub guard |
| Billing E2E prod fixes | `billing-e2e.ts` · tier/period checkout body · attorney UI redirect race · firm starter skip on Stripe 500 |
| Disk IO + recompute dedupe | `20260709150000`–`20260709180100` · recompute route · `loadEstatePlanningDashboard` cache |
| Legal entity constants | `lib/legal/company.ts` → `/terms` · `/privacy` · public footer copyright |
| `/assess` dynamic state picker | `lib/learn/useSelectedState.ts` · `StatePickerDropdown` · `mwm_selected_state` localStorage |
| `/learn` discovery & cross-linking | `PublicNav` → `/learn` · homepage state guide card · `/estate-tax` in-app link |
| WA estate tax SEO sprint | `/learn/washington-estate-tax` · `/learn` index · cross-page callouts · sitemap 0.8 |
| Admin-Redesign — sidebar + bug fixes | `/admin` sidebar · Debug tab reads `federal_tax_config` · funnel 30d-only counts |
| Admin P1 — federal tax config editor | `/admin` → Tax Rules → Federal Tax Configuration · `GET/PATCH /api/admin/tax-config` |
| Admin P1 — user detail panel | `/admin` → Users (click row) · sync-stripe · tier override · password reset |
| Admin P1 — waitlist management | `/admin` → Waitlist · `GET/POST /api/admin/waitlist/*` |
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

Do NOT set `PUBLIC_SIGNUP_OPEN=true` until **B&O-READY** per [LAUNCH.md](./LAUNCH.md) (Bucket B complete; Bucket A when ruling lands).

**Post-deploy automated gate:** `npm run test:e2e:prod:smoke` (42 tests, production) · `npm run test:e2e:go-live-profile` (pre-flip profile) · `npm run verify:post-deploy-voels` — [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) · [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md).

**Pre-launch checklist (engineering):** pricing aligned ✓ · Stripe + webhook ✓ · billing P0/P1/P2 ✓ · DB indexes ✓ · dashboard bundle ✓ · MC staleness ✓ · E2E scoped ✓ · Stripe account review ⏳ 2–3 days.

---

## Standing rules for Cursor sessions

1. **Calculation / tax work:** Start with **"read docs/CALCULATION_ENGINES.md"** before changing tax, projection, strategy, or horizon math.
2. **Regression grep (after any calc-file touch):** [CALCULATION_ENGINES.md § Regression grep checks](./CALCULATION_ENGINES.md#regression-grep-checks-ongoing-smoke-test).
3. **CST strings:** Import from **`lib/constants/strategyTypes.ts`** — never hardcode `'cst'` / `'credit_shelter_trust'` at DB query sites.
4. **Doc sync pass:** On sprint close, update [ROADMAP.md](./ROADMAP.md), [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md), [DECISION_LOG.md](./DECISION_LOG.md) as needed — see [UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md).

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — **go-live prep.** Admin sprints + **WA estate tax SEO** + **13-state `/learn`** + **`/learn` discovery** + **`/assess` state picker** + **pricing/billing alignment** are **shipped**. Per-seat advisor checkout on `/pricing` and `/billing`; attorney flat tiers on `/pricing`; consumer checkout is consumer-only. Admin-A (Ops Home), Admin-P1 (tax config, user detail, waitlist), Admin-Redesign (sidebar nav). L1–L4 + B2B2C billing complete. Release routine: `npm run release:local` before PR; `npm run release:post-deploy` after prod deploy.
>
> **Remaining blockers before open signups:** [LAUNCH.md](./LAUNCH.md) **44/55** Bucket B — **P0:** real-card live smoke + WA B&O ruling; **P1:** C-4 walkthrough, counsel ToS §10/§11 + email aliases; **P2:** BCC inbox, drip cron 2/3, optional Vercel housekeeping. Launch tracker: `npm run launch:tracker` → sync via `npm run sync:launch-tracker`.
>
> **Go-live day:** Stripe Phase 2 live catalog → [archived LAUNCH.md § Opening signups](./archive/LAUNCH_CHECKLIST.md#opening-signups--go-live-flip) · then `PUBLIC_SIGNUP_OPEN=true`.
>
> **Post-deploy:** `npm run verify:post-deploy-voels` · `npm run test:e2e:go-live-profile` — [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) · [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md).

---

## Post-deploy spot-checks — State estate tax content (2026-06-10) ✅

Run in sequence after deploy (each catches a different failure mode):

| # | URL / surface | Pass criteria |
|---|---------------|---------------|
| 1 | `/learn/washington-estate-tax` | Dynamic `[state-tax-slug]` route; `$390,000` / `$0` scenario; static page gone |
| 2 | `/learn/oregon-estate-tax` | `$272,000` without planning / `$0` with bypass trust |
| 3 | `/learn/massachusetts-estate-tax` | `Cliff effect warning` callout (`has_cliff_effect = true`) |
| 4 | `/admin` → State tax content | 13 rows; staleness pills; OR edit panel brackets = pretty-printed JSON (not `[object Object]`) |

**Ops done (2026-06-10):** `last_reviewed = CURRENT_DATE` for all states except WA (keeps researched 2026-06-01 baseline) — prevents §11 Monday cron from firing on 12 seeded historical dates.

---

## Queued next (post-ship ops)

### 1. ~~`/learn` index — per-state risk one-liner~~ ✅ shipped (2026-06-10)

`RISK_SUMMARY` in `lib/learn/state-estate-tax-slugs.ts` — rendered on featured WA card + grid cards.

### 2. Dashboard `canShowPartial` nudge — low priority

Deferred. Show a subtle setup card on `/dashboard` when the user has financial data but is missing birth year or retirement age for projections. Revisit after ~2 weeks of traffic — `/projections` already has inline prompts.

### 4. Disk IO — post-deploy monitoring (2026-06-11)

**Shipped today (expected ~60–70% IO reduction combined):**

| Change | Expected impact |
|--------|-----------------|
| `idx_state_estate_tax_rules_state_tax_year` + prior P-1 indexes (`assets`/`liabilities` `owner_id`) | Fewer seq scans on hot lookup columns |
| `calculate_state_estate_tax` optimized (`20260709150000`) | ~40% fewer `state_estate_tax_rules` hits per call |
| `resolve_household_alerts_batch` (`20260709160000` + `conflict-detector.ts`) | Client round trips ~24K → ~4K per audit window |

**Ops now:**

1. **`git push origin main`** — includes `5ad5622` (MC staleness), `523f28f` (dashboard bundle), `8776084` (households PATCH)
2. **Redeploy Vercel Production** — all TS since `e6f8ac9` (P0 + P1 + pre-launch DB perf)
3. Supabase Dashboard → **Infrastructure → Disk IO** — recheck in **24 hours**

**Future optimizations (only if IO still elevated after monitoring):**

1. **Optional 9-index batch** — run Query B in [scripts/perf-diagnostic.sql](../scripts/perf-diagnostic.sql) on production; add missing indexes on `household_id` / `owner_id` / `user_id` for high-traffic tables. Audit flagged **`assets` ~35K seq scans** — investigate `idx_assets_owner_id` usage and additional composite indexes if needed.

### 5. Go-live performance audit (2026-06-11)

Full scan across consumer, advisor, and attorney surfaces. **Shipped today** addresses recompute path + recommendations cache on strategy surfaces. **Remaining items** are prioritized for post-push sprints — no accuracy regressions unless noted.

#### P0 — shipped (2026-06-11)

| Area | Fix |
|------|-----|
| **Attorney** | Server-prefetch `getCachedComposition` on client page; `requireVaultHouseholdAccess` on `/api/estate-composition` |
| **Attorney** | `export-estate-plan` uses vault access + client `owner_id` for assets/beneficiaries |
| **Advisor** | Meeting Prep export via lazy `/api/advisor/client-export-payload`; `exportWiring: false` on strategy/meeting-prep |
| **Advisor** | Tab-gate composition/gifting/MC/staleness; `logAdvisorClientAccess` fire-and-forget |
| **Consumer** | `getCachedComposition` invalidates when `lifetime_gifts_used` mismatches |
| **Consumer** | `loadProjectionData` serves stale `outputs_s1_first`; `/projections` triggers background regen |

#### P1 — shipped (2026-06-11)

| Area | Fix |
|------|-----|
| **Consumer** | `loadScopedEstateTaxReferenceData` on `/estate-tax` (year + state, prior-year fallback) |
| **Consumer** | Trust-strategy: single `strategy_line_items` query + `partitionStrategyLineItems` |
| **Consumer** | `triggerBackgroundBaseCaseAndRecompute` — debounced base case + recompute (dashboard, projections, strategy, advisor) |
| **Consumer** | Dashboard: drop no-op `priorHealthScoreRow`; onramp-only health score fetch |
| **Advisor** | Staleness check skipped on overview tab |
| **Attorney** | Recommendations cache-only + background recompute + user-visible pending banner |

#### Pre-launch DB perf — shipped (2026-06-12)

| Fix | Detail |
|-----|--------|
| **Dashboard bundle** | `lib/dashboard/loadDashboardBundle.ts` — ~22 parallel queries, 60s TTL cache per `household_id`; `invalidateDashboardBundle` in `touchHousehold`; `DashboardBody` passes bundle to child loaders |
| **MC staleness** | `households.projection_inputs_hash` (`20260712120000`); null on write → background regen; amber “updating” UI on projections/estate-tax/advisor Strategy |
| **Household PATCH gap** | `PATCH /api/households/[id]` (`admin_expense_pct`) now calls `touchHousehold` — aligns with Fix 3 + bundle invalidation |

**Deferred (post-launch):** Postgres RPC `load_dashboard_bundle` (Phase 2); materialized advisor staleness versioning.

#### P2 — polish / scale

- [x] Advisor roster: parallelize household + referral fetches after client IDs known (2026-06-12 audit Sprint C)
- [x] Attorney roster: shared `loadRosterNetWorthByOwner` + Est. Net Worth column tooltip (2026-06-12)
- Unbounded `select('*')` on low-row tables (profile, household helpers)

**Diagnostics:** [scripts/perf-diagnostic.sql](../scripts/perf-diagnostic.sql) — run Query A/B/C in Supabase SQL Editor post-launch.

### 3. Attorney drip steps 2 & 3 — cron verification

Worth a manual DB check once a **real** attorney has registered (not seed-only). See [archived LAUNCH.md § Attorney drip cron (ops)](./archive/LAUNCH_CHECKLIST.md#attorney-drip-cron-ops).

| Step | When | Column |
|------|------|--------|
| 1 | Immediately on activation | `attorney_drip_step_1_sent_at` non-null |
| 2 | ~3+ days after step 1 sent | `attorney_drip_step_2_sent_at` |
| 3 | ~7+ days after step 1 sent | `attorney_drip_step_3_sent_at` |

Cron: `app/api/cron/notifications/route.ts` § attorney activation drip.

---

## Post-launch quick wins

### E2E — attorney aref timing fix (10 min)

`tests/e2e/public/auth-signup-attribution.spec.ts`

Attorney test reads sessionStorage before `useEffect` hydrates.

Fix: add `waitForFunction` matching advisor pattern (line ~35):

```ts
await page.waitForFunction(
  (code) => sessionStorage.getItem('mwm_attorney_referral_code') === code,
  aref,
  { timeout: 15_000 },
)
```

Product path is intact (`_referral-tracker.tsx` still writes `mwm_attorney_referral_code` on `?aref=` since Sprint 8) — test-only flake.

---

## Archived sprint playbooks

Shipped execution scripts moved to [docs/archive/sprints/](./archive/sprints/README.md). Do not use for new work.
