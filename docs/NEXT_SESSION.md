# NEXT_SESSION.md
# Sprint 13 — Session Start Document
# Updated: May 2026

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — $2M–$30M estate/financial planning. **Sprint 12 closed. Sprint 13 is current.**
> Sprint 12 shipped: A/B collapse, persona alerts, mobile drawer, full copy audit.
> Next: staging migrations, extended smoke test rows, referral/drip production verification.
> Apply migrations on staging/prod per LAUNCH_CHECKLIST if not already applied.
> Today's task: [FILL IN BELOW].

---

## Current sprint — Sprint 13 (Weeks 47–50)

**Goal:** Stable staging, all migrations verified, smoke test extended. Feature freeze.

**Next:**
- `[ ]` Staging deploy with all migrations verified
- `[x]` Extend CONSUMER_RELEASE_SMOKE_TEST.md (acquisition & attribution A–G)
- `[x]` Test seed scripts — `seed-test-attorney.ts`, `seed-test-consumer-estate.ts`
- `[ ]` Run seed scripts on staging; record test attorney `referral_code` for smoke B/D
- `[ ]` Referral loop proven (advisor + attorney) on production
- `[ ]` Drip smoke test on production
- `[ ]` Sprint 15: verify all Production env vars in LAUNCH_CHECKLIST before domain cutover

See [ROADMAP.md](./ROADMAP.md) and [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).

---

## Sprint 12 completed ✅

| Area | What shipped |
|------|----------------|
| **A/B** | Personalized upgrade copy; score_visible assess; removed `abTests.ts` + `app_config` A/B rows |
| **Persona** | Dashboard business $5M/$10M + multi-state RE alerts |
| **Mobile** | Consumer dashboard drawer nav (`<lg`) |
| **Copy** | DisclaimerBanner; upgrade gates; public event/assess; directories; domicile; scenarios `Scope:`; landing + share |

---

## Sprint 14 test account references

All accounts exist on staging (https://estate-planner-gules.vercel.app) and production Supabase.
Seed scripts are idempotent — re-run if accounts are missing on a new environment.

| Role | Email | Notes |
|------|-------|-------|
| Consumer (Playwright) | `david@rolobe.resend.app` | Estate tier (3), active subscription, `PLAYWRIGHT_HOUSEHOLD_ID` in `.env.test` |
| Advisor (Playwright) | `advisor2@rolobe.resend.app` | Seeded via `scripts/seed-michael-johnson-advisor-demo.ts` |
| Advisor (test listing) | `test-advisor@mywealthmaps.test` | Seeded via `scripts/seed-test-advisor.ts` |
| Attorney (test listing) | `test-attorney@mywealthmaps.test` | Seeded via `scripts/seed-test-attorney.ts` |

### Advisor referral (smoke test sections A and C)

- `referral_code`: `c91dcd1b`
- Smoke test URL: `/event/selling-a-business?ref=c91dcd1b`
- Re-run `seed-test-advisor.ts` to confirm code if needed — script is idempotent

### Attorney referral (smoke test sections B and D)

- `referral_code`: `6fd027d3`
- Smoke test URL: `/event/selling-a-business?aref=6fd027d3`
- Re-run `seed-test-attorney.ts` to confirm code if needed — script is idempotent

### Seed script usage

```bash
# Load both env files first
set -a && source .env.local && source .env.test && set +a

# Advisor listing (idempotent)
npx tsx scripts/seed-test-advisor.ts

# Attorney listing (idempotent)
npx tsx scripts/seed-test-attorney.ts

# Consumer tier (idempotent)
npx tsx scripts/seed-test-consumer-estate.ts
```

---

## Known limitations (do not lose between sessions)

### Anonymous cross-device attribution

`referral_clicks` has **no `user_id`** — clicks are logged anonymously at event-page visit (`POST /api/referral/track`). Per-user attribution at signup uses `funnel_events.event_slug` (`account_created` / `event_page_view`) and `profiles.referral_code` written from sessionStorage.

**Edge case:** A user who visits `/event/selling-a-business?ref=` on device A, then signs up on device B without the same sessionStorage, may have `profiles.referral_code` but no matching funnel row with `event_slug`. `pickConnectionLifeEvent()` then falls back to the latest `referral_clicks.event_slug` for that code (weak signal — may not be that user's click). **Not a launch blocker;** document if product later needs cross-device event slug persistence (e.g. `profiles.referral_event_slug` at signup).

### Advisor connection status — canonical import

Any code that checks whether an advisor–consumer link is **live** must use:

```ts
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
```

Statuses: `active`, `accepted`. Do not hardcode status strings.

### Planning empty-state CTAs (do not regress)

- **`/projections`, `/complete`:** `PLANNING_MISSING_PROJECTION_ACTIONS_TIER2` only — rows come from `computeCompleteProjection` on server render.
- **`/my-estate-strategy` (tier 3):** inline `POST /api/consumer/generate-base-case` for `projection_scenarios` / horizons.
- Do **not** merge TIER2 and TIER3 lists — see comment block in `lib/planning/planningEmptyState.ts`.

---

## Files for Sprint 13

| Path | Notes |
|------|--------|
| `scripts/seed-test-attorney.ts` | Test attorney + `referral_code`; `source .env.local` |
| `scripts/seed-test-consumer-estate.ts` | Playwright consumer → tier 3; needs `.env.test` for email |
| `docs/CONSUMER_RELEASE_SMOKE_TEST.md` | Acquisition & attribution A–G |
| `docs/LAUNCH_CHECKLIST.md` | Section 1 gates; § Production env vars (Sprint 15) |
| `supabase/migrations/` | Verify applied on staging/prod |
