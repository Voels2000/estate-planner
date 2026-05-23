# NEXT_SESSION.md
# Sprint 14 — Session Start Document
# Updated: May 2026 (end-of-session snapshot)

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — **Sprint 14 in progress** (feature freeze). Manual smoke **§1–7 passed** 2026-05-23 on staging (`david@rolobe.resend.app`). **§2.4 automated** (`consumer-core-recompute.spec.ts`, commit `93aa6f5`).
>
> **Today's task — fix two bugs before launch (likely small):**
> 1. **Admin Portal visible to consumer** in sidebar — hide for non-admin roles (role check in sidebar).
> 2. **Asset add form save button below viewport** without zoom-out — scrollable form or sticky footer.
>
> After both fixes: re-smoke assets + sidebar as consumer; then LAUNCH_CHECKLIST Section 1 can be fully signed off. Optional §8–11 and drip 2–3 remain open.

---

## Current sprint — Sprint 14 (Weeks 51–54)

**Goal:** All LAUNCH_CHECKLIST Section 1 gates pass. No new features. Fix failures only.

**Rule:** No new features, no new migrations without explicit sign-off.

**Environment:** https://estate-planner-gules.vercel.app

### Completed this session

| Item | Status | Notes |
|------|--------|--------|
| §2.4 recompute automated | ✅ | `consumer-core-recompute.spec.ts` + `estate-health-poll.ts` — `93aa6f5` |
| Core §1–3 manual smoke | ✅ | 2026-05-23 |
| Estate §4–7 manual smoke | ✅ | 2026-05-23 |
| Manual sign-off doc | ✅ | `1e092d7` — CONSUMER_RELEASE_SMOKE_TEST.md |

### Remaining Sprint 14 checklist

| Item | Status |
|------|--------|
| Core §1–3 manual smoke | ✅ |
| Estate §4–7 manual smoke | ✅ |
| §2.4 recompute automated | ✅ |
| Admin Portal consumer visibility fix | ❌ Open |
| Asset form save button fix | ❌ Open |
| Optional §8–11 smoke | ⬜ Not done |
| Drip steps 2–3 | ⬜ Not done |
| LAUNCH_CHECKLIST Section 1 full sign-off | ⬜ Pending bug fixes |

### Fix before launch (next session — priority)

- `[ ]` **Admin Portal in consumer sidebar** — `david@rolobe.resend.app` must not see Admin Portal; likely `role === 'admin'` guard in dashboard sidebar component
- `[ ]` **Asset add form save button** — not reachable without zoom-out; make modal/panel scrollable or save action sticky

**Likely files:** dashboard shell / sidebar nav · assets add/edit form component on `/assets`

### Post-launch (not blocking)

- `[ ]` Dashboard initial load slowness — performance ticket after launch
- `[ ]` Post-profile-save render slowness — performance ticket after launch

### Still open (after bugs)

- `[ ]` Optional CONSUMER_RELEASE_SMOKE_TEST §8–11
- `[ ]` Drip steps 2–3 on schedule (inbox verify)
- `[ ]` LAUNCH_CHECKLIST Section 1 — full checkbox pass once bugs closed

See [ROADMAP.md](./ROADMAP.md) · [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) · [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) (sign-off block).

### Staging recompute — verified ✅

```bash
npx playwright test tests/e2e/consumer/consumer-core-recompute.spec.ts --project=consumer
```

Re-run after deploy if recompute E2E times out (see LAUNCH_CHECKLIST / prior session notes on `[triggerEstateHealthRecompute]` logs).

---

## Sprint 13 closed ✅

| Area | Outcome |
|------|---------|
| **Migrations** | 67 applied (incl. `20260601000000` advisor referral trigger) |
| **E2E** | 51/0/1 baseline; 52+ with `consumer-core-recompute` |
| **Smoke** | Acquisition A–G passed staging |
| **Blockers fixed** | RMD event copy 72–75; advisor `referral_code` trigger |

---

## Test account references

| Role | Email | Notes |
|------|-------|-------|
| **Consumer** | `david@rolobe.resend.app` | Estate tier — manual smoke account |
| **Advisor (Playwright)** | `advisor2@rolobe.resend.app` | |
| **Attorney (test listing)** | `test-attorney@mywealthmaps.test` | `aref`: **6fd027d3** |
| **Advisor (test listing)** | `test-advisor@mywealthmaps.test` | `ref`: **c91dcd1b** |

### Seed scripts (idempotent)

```bash
set -a && source .env.local && source .env.test && set +a
npx tsx scripts/seed-test-advisor.ts
npx tsx scripts/seed-test-attorney.ts
npx tsx scripts/seed-test-consumer-estate.ts
```

---

## Known limitations (do not lose between sessions)

### Anonymous cross-device attribution

`referral_clicks` has no `user_id`. Cross-device signup may miss funnel `event_slug` match — not a launch blocker.

### Advisor connection status

```ts
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
```

### Planning empty-state CTAs

Do **not** merge TIER2 and TIER3 lists — `lib/planning/planningEmptyState.ts`

---

## Key files

| Path | Notes |
|------|--------|
| `tests/e2e/consumer/consumer-core-recompute.spec.ts` | Smoke §2.4 |
| `tests/e2e/helpers/estate-health-poll.ts` | Shared poll helper |
| `docs/E2E_RELEASE_TEST_PLAN.md` | Automate vs manual |
| `docs/CONSUMER_RELEASE_SMOKE_TEST.md` | Sign-off + checklist |
