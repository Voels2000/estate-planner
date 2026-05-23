# NEXT_SESSION.md
# Sprint 14 — Session Start Document
# Updated: May 2026

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — **Sprint 14 beginning.** Sprint 13 fully closed: 67 migrations applied, E2E 51/0/1, all seed scripts committed, acquisition & attribution smoke A–G passed, `INTERNAL_API_KEY` added to Vercel, RMD copy fixed, advisor referral trigger added. **Two real launch blockers caught and fixed in Sprint 13 smoke test.**
>
> **Sprint 14 is feature freeze — fixes only from test failures.**
>
> **Sprint 14 manual smoke §1–7 passed** (2026-05-23). **Fix before launch:** Admin Portal in consumer sidebar; asset add form save button below viewport. Reference: [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) sign-off.

---

## Current sprint — Sprint 14 (Weeks 51–54)

**Goal:** All LAUNCH_CHECKLIST Section 1 gates pass. No new features. Fix failures only.

**Rule:** No new features, no new migrations without explicit sign-off.

**Next (in order):**
- `[x]` **Smoke §2.4 (financial save + recompute)** — automated: `consumer-core-recompute.spec.ts` (staging ~15.5s, May 2026)
- `[x]` **Core sections 1–3** — PASSED 2026-05-23
- `[x]` **Estate planning sections 4–7** — PASSED 2026-05-23
- `[ ]` **Sprint 14 bugs (fix before launch)** — see below
- `[ ]` Optional sections 8–11 (time permitting)
- `[ ]` Drip steps 2–3 on schedule; full end-to-end acquisition path if not already signed off
- `[~]` LAUNCH_CHECKLIST Section 1 — manual smoke §1–7 signed off; two bugs remain

### Bugs from smoke (fix before launch)

- `[ ]` **Admin Portal visible in sidebar for consumer role** — should be hidden (`david@rolobe.resend.app` saw Admin Portal link)
- `[ ]` **Asset add form: save button below viewport without zoom-out** — form height or sticky button fix needed

### Post-launch (not blockers)

- `[ ]` **Dashboard / profile slow renders** — initial dashboard load and post-profile-save render; performance ticket after launch

See [ROADMAP.md](./ROADMAP.md) · [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).

**Environment:** https://estate-planner-gules.vercel.app

### Staging recompute — verified ✅ (May 2026)

`consumer-core-recompute` and gift-history recompute tests **passing** on staging (~15.5s / ~9.7s). Direct `POST /api/recompute-estate-health` returns 200. **§2.4 is automated** — re-run after deploy:

```bash
npx playwright test tests/e2e/consumer/consumer-core-recompute.spec.ts --project=consumer
```

If both recompute tests **timeout** after a deploy, staging recompute is broken again — manual §2.4 would be a **false green** (asset saves, stale scores).

**Check Vercel → staging deployment → Logs** after a test save. Search for:

| Log | Meaning |
|-----|---------|
| `[triggerEstateHealthRecompute] skipped — missing production env` | `RECOMPUTE_SECRET` and/or `NEXT_PUBLIC_APP_URL` not set on that deployment |
| `[triggerEstateHealthRecompute] non-ok response` status **403** | Secret mismatch between save handler and `/api/recompute-estate-health` |
| `[triggerEstateHealthRecompute] fetch failed` | Bad `NEXT_PUBLIC_APP_URL`, cold start, or network from serverless to self |

Saves return **200** either way — `afterHouseholdWrite` is fire-and-forget (`lib/estate/triggerEstateHealthRecompute.ts`).

**Fix:** Align `RECOMPUTE_SECRET` with `.env.local`, confirm `NEXT_PUBLIC_APP_URL` is the staging URL, redeploy, re-run `npx playwright test tests/e2e/consumer/consumer-core-recompute.spec.ts --project=consumer`.

---

## Sprint 13 closed ✅

| Area | Outcome |
|------|---------|
| **Migrations** | 67 applied (local + remote in sync, incl. `20260601000000` advisor referral trigger) |
| **E2E** | 51 passed, 0 failed, 1 skipped (staging) |
| **Seeds** | `seed-test-attorney`, `seed-test-advisor`, `seed-test-consumer-estate` committed + run |
| **Smoke** | Acquisition & attribution sections **A–G passed** on staging |
| **Vercel** | `INTERNAL_API_KEY` confirmed on Production |
| **Blockers fixed** | (1) `rmd-start-age` hardcoded age 73 → birth-year range 72–75; (2) missing `advisor_directory` `referral_code` trigger |

---

## Test account references

| Role | Email | Notes |
|------|-------|-------|
| **Consumer** | `david@rolobe.resend.app` | Estate tier, active subscription |
| **Advisor (Playwright)** | `advisor2@rolobe.resend.app` | `seed-michael-johnson-advisor-demo.ts` |
| **Attorney (test listing)** | `test-attorney@mywealthmaps.test` | `aref`: **6fd027d3** |
| **Advisor (test listing)** | `test-advisor@mywealthmaps.test` | `ref`: **c91dcd1b** |

### Advisor referral (smoke sections A and C)

- `referral_code`: `c91dcd1b`
- URL: `/event/selling-a-business?ref=c91dcd1b`

### Attorney referral (smoke sections B and D)

- `referral_code`: `6fd027d3`
- URL: `/event/selling-a-business?aref=6fd027d3`

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

---

## Key files for Sprint 14

| Path | Notes |
|------|--------|
| `tests/e2e/consumer/consumer-core-recompute.spec.ts` | Smoke §2.4 — asset POST → `computed_at` poll → dashboard |
| `tests/e2e/helpers/estate-health-poll.ts` | Shared `fetchEstateHealthComputedAt` / `pollComputedAtChanged` |
| `docs/E2E_RELEASE_TEST_PLAN.md` | Automate vs manual map |
| `docs/CONSUMER_RELEASE_SMOKE_TEST.md` | Core 1–3, estate 4–7; acquisition A–G ✅ staging |
| `docs/LAUNCH_CHECKLIST.md` | Section 1 gates |
