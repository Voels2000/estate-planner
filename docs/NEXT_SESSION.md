# NEXT_SESSION.md
# Sprint 17 — Session Start Document
# Updated: 2026-05-24

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — **Sprint 17 beginning.** Sprint 16 closed 2026-05-24: C-2b UX language audit (`788aa08`). **Sprint C-3 Phase 1 closed 2026-06-02:** RLS policy fixes (`236890c`). Waitlist active.
>
> **Sprint 17 goal:** Stripe billing setup → Washington auto-renewal disclosures (C-4) → `PUBLIC_SIGNUP_OPEN=true`.
>
> **Today's task:** TBD — start with [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) manual walkthrough (signup → paid → cancel).

---

## Sprint 17 — remaining

| Item | Notes |
|------|-------|
| **Sprint C-4 billing disclosures** | **Blocks open signups** — RCW 19.316 auto-renewal copy on checkout; FTC click-to-cancel self-serve; Stripe receipts with renewal amount. See [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) |
| **Stripe production billing** | Production keys, checkout + webhook verified |
| **Open signups** | Set `PUBLIC_SIGNUP_OPEN=true` in Vercel Production + redeploy — **after C-4 signed off** |
| **Drip step 2 check** | Check `consumer21@rolobe.resend.app` on **2026-05-26** (day 3 after step 1 capture) |
| **Post-launch performance** | Dashboard initial load slowness — track as perf ticket (not blocking open signups) |
| **Monte Carlo UI string pass** | ✅ `MonteCarloAssumptionsPanel.tsx` "Scenarios Reaching Goal (%)"; `lib/monte-carlo.ts` insight strings; `/monte-carlo` upgrade copy |

### Go-live gate (do not skip)

1. Complete C-4 checklist — manual signup → `/billing` → Stripe Checkout → receipt → self-serve cancel
2. Vercel Production → add `PUBLIC_SIGNUP_OPEN=true` → redeploy
3. Verify: `/signup` shows form · homepage **Get Started** → `/signup` · `/login` works
4. Run Core §1–3 smoke on production ([CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md))

Full runbook: [LAUNCH_CHECKLIST.md § Opening signups — go-live flip](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip).

---

## Sprint 16 closed ✅

| Area | Outcome |
|------|---------|
| **Sprint C-2b UX Language Audit** | ✅ Complete — all `DISCLAIMER_STRINGS` surfaces wired; `audit-ux-language.sh` 0 findings (`788aa08`) |
| **Billing setup** | **Carried to Sprint 17** |
| **Open signups** | **Carried to Sprint 17** — blocked on C-4 billing disclosures |
| **Drip step 2 check** | **Carried to Sprint 17** — due 2026-05-26 |

**Commits:** `788aa08` (C-2b disclaimer surfaces)

---

## Sprint C-3 Phase 1 closed ✅ (2026-06-02)

| Area | Outcome |
|------|---------|
| **RLS security fixes** | ✅ `20260602000000_sprint_c3_rls_fixes.sql` (`236890c`) — businesses, assets, `monte_carlo_runs`, reference tables, `advisor_clients`, profiles |

**Commits:** `236890c`

---

## Sprint 15 closed ✅

| Area | Outcome |
|------|---------|
| **Domain / DNS / SSL** | `mywealthmaps.com` live (2026-05-24) |
| **Vercel Production env vars** | Verified (2026-05-24) |
| **Search Console** | Verified via Cloudflare domain provider; sitemap submitted (2026-05-24) |
| **Resend domain** | `mywealthmaps.com` verified (2026-05-24) |
| **Waitlist mode** | Active on Production (`middleware.ts`, `3ceb125`); Preview enabled (2026-05-24) |
| **Post-cutover smoke §1–3** | Passed on production (2026-05-24) |
| **Sitemap / crawl infra** | Middleware bypass for `/sitemap.xml`, `/robots.txt`, `/_next/`, `/api/` (`73648e5`) |
| **Test account cleanup** | `scripts/cleanup-test-accounts.ts` (`3f732e3`) |
| **Dev workflow** | local → preview → production |

**Commits:** `7afaedb`, `bb9a191`, `3ceb125`, `729d411`, `b97f945`, `3f732e3`, `73648e5`

### Dev deploy workflow (2026-05-24)

1. **Local** — `npm run dev` with `.env.local`
2. **Preview** — push branch → Vercel preview (`estate-planner-gules.vercel.app`); set `WAITLIST_MODE=true` on Preview to match production gating
3. **Production** — merge to `main` → `mywealthmaps.com`; flip `PUBLIC_SIGNUP_OPEN=true` when C-4 + billing ready

---

## Sprint 14 closed ✅

| Area | Outcome |
|------|---------|
| **Manual smoke §1–3** | Passed 2026-05-23 |
| **Manual smoke §4–7** | Passed 2026-05-23 |
| **Manual smoke §8, §11** | Passed 2026-05-23 |
| **§9 advisor recommendation** | Skipped — needs linked advisor |
| **§10 Gifting/Strategies/Trusts** | E2E 19/19 confirmed |
| **§2.4 recompute automated** | consumer-core-recompute.spec.ts (`93aa6f5`) |
| **Admin Portal bug** | Fixed `f4e9160` |
| **Asset modal bug** | Fixed `f4e9160` |
| **E2E** | 41 passed; 12 staging-flaky (19/19 with `--workers=1`) |
| **Commits** | `93aa6f5`, `1e092d7`, `f4e9160` |

### Known staging E2E behaviour (do not lose)

`consumer-strategy-writes` and `dashboard` specs fail under parallel workers on staging — Supabase statement timeouts (`57014`) and `net::ERR_ABORTED`. Always re-run failures with `--workers=1` before treating as regressions. Production DB will not have this contention.

---

## Test account references

| Role | Email | Notes |
|------|-------|-------|
| **Consumer** | `david@rolobe.resend.app` | Estate tier, active subscription, is_superuser: false |
| **Advisor (Playwright)** | `advisor2@rolobe.resend.app` | `seed-michael-johnson-advisor-demo.ts` |
| **Attorney (portal login)** | `test-attorney-portal@rolobe.resend.app` | Password: `TestAttorney123!` · `seed-test-attorney.ts` links `profile_id` for `/attorney` newsletter kit |
| **Attorney (test listing)** | `test-attorney@mywealthmaps.test` | Listing email · `aref`: **6fd027d3** |
| **Advisor (test listing)** | `test-advisor@mywealthmaps.test` | `ref`: **c91dcd1b** |

### Resend production test inboxes (`@rolobe.resend.app`)

Disposable addresses for production waitlist / drip captures. Inbound forwards via `app/api/resend/inbound/route.ts`. Cleanup stray signup accounts: `scripts/cleanup-test-accounts.ts`.

| Email | Notes |
|-------|-------|
| `consumer21@rolobe.resend.app` | **Sprint 17:** drip step 2 check due **2026-05-26** (day 3) |

### Seed scripts (idempotent)

```bash
set -a && source .env.local && source .env.test && set +a
npx tsx scripts/seed-test-advisor.ts
npx tsx scripts/seed-test-attorney.ts
npx tsx scripts/seed-test-consumer-estate.ts
```

### Run E2E (always source env first)

```bash
set -a && source .env.local && source .env.test && set +a
npx playwright test tests/e2e/consumer --project=consumer
# If failures: re-run with --workers=1 before investigating
npx playwright test [failing spec] --project=consumer --workers=1
```

---

## Known limitations (do not lose between sessions)

### Anonymous cross-device attribution

`referral_clicks` has **no `user_id`** — clicks are logged anonymously at event-page visit (`POST /api/referral/track`). Per-user attribution at signup uses `funnel_events` and `profiles.referral_code` / `attorney_referral_code` from sessionStorage.

**Edge case:** Visit with `?ref=` on device A, signup on device B without sessionStorage — weak funnel match. Not a launch blocker.

### Advisor connection status — canonical import

```ts
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
```

Statuses: `active`, `accepted`. Do not hardcode status strings.

### Planning empty-state CTAs (do not regress)

- **`/projections`, `/complete`:** `PLANNING_MISSING_PROJECTION_ACTIONS_TIER2` only
- **`/my-estate-strategy` (tier 3):** `POST /api/consumer/generate-base-case`
- Do **not** merge TIER2 and TIER3 lists — `lib/planning/planningEmptyState.ts`
