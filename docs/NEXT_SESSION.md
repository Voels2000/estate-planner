# NEXT_SESSION.md
# Sprint 16 — Session Start Document
# Updated: 2026-05-24

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — **Sprint 16 beginning.** Sprint 15 closed 2026-05-24: domain live on `mywealthmaps.com`, DNS cutover complete, Search Console verified via Cloudflare, sitemap submitted, waitlist mode active, post-cutover smoke §1–3 passed on production.
>
> **Sprint 16 goal:** Billing/payment setup + open public signups (`PUBLIC_SIGNUP_OPEN=true`).
>
> **Today's task:** TBD.

---

## Sprint 15 closed ✅

| Area | Outcome |
|------|---------|
| **Domain / DNS / SSL** | `mywealthmaps.com` live (2026-05-24) |
| **Vercel Production env vars** | Verified (2026-05-24) |
| **Search Console** | Verified via Cloudflare domain provider; sitemap submitted (2026-05-24) |
| **Resend domain** | `mywealthmaps.com` verified (2026-05-24) |
| **Waitlist mode** | Active on Production (`middleware.ts`, `3ceb125`) |
| **Post-cutover smoke §1–3** | Passed on production (2026-05-24) |
| **Open signups** | **Pending** — billing setup first; then `PUBLIC_SIGNUP_OPEN=true` + redeploy |

**Commits:** `7afaedb`, `bb9a191`, `3ceb125`, `729d411`

---

## Sprint 16 — remaining

- [ ] **Billing / payment setup** — Stripe production config; consumer checkout path ready before open signups
- [ ] **Open signups** — set `PUBLIC_SIGNUP_OPEN=true` in Vercel Production → redeploy → verify `/signup`, homepage CTA, `/login` ([LAUNCH_CHECKLIST.md § Opening signups — go-live flip](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip))
- [ ] **Drip step 2 check** — `consumer21@rolobe.resend.app` — verify drip step 2 fires on **2026-05-26** (day 3 after step 1 capture)
- [ ] Section 1 remainder — drip prod smoke steps 2–3; attorney referral prod test; full E2E path on production

### Opening signups — go-live flip (when billing ready)

1. Vercel Production → add `PUBLIC_SIGNUP_OPEN=true` → redeploy
2. Verify: `/signup` shows form · homepage **Get Started** → `/signup` · `/login` works
3. Run Core §1–3 smoke on production

To re-enable waitlist: remove `PUBLIC_SIGNUP_OPEN` from Vercel Production and redeploy.

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
| **E2E** | 41 passed; 12 staging-flaky (19/19 with --workers=1) |
| **Commits** | `93aa6f5`, `1e092d7`, `f4e9160` |

### Known staging E2E behaviour (do not lose)

`consumer-strategy-writes` and `dashboard` specs fail under parallel workers on staging — Supabase statement timeouts (`57014`) and `net::ERR_ABORTED`. Always re-run failures with `--workers=1` before treating as regressions. Production DB will not have this contention.

### Post-launch (not blocking)

- Dashboard initial load slowness
- Post-profile-save render slowness

---

## Test account references

| Role | Email | Notes |
|------|-------|-------|
| **Consumer** | `david@rolobe.resend.app` | Estate tier, active subscription, is_superuser: false |
| **Consumer (drip test)** | `consumer21@rolobe.resend.app` | Drip step 2 check due **2026-05-26** (day 3) |
| **Advisor (Playwright)** | `advisor2@rolobe.resend.app` | `seed-michael-johnson-advisor-demo.ts` |
| **Attorney (portal login)** | `test-attorney-portal@rolobe.resend.app` | Password: `TestAttorney123!` · `seed-test-attorney.ts` links `profile_id` for `/attorney` newsletter kit |
| **Attorney (test listing)** | `test-attorney@mywealthmaps.test` | Listing email · `aref`: **6fd027d3** |
| **Advisor (test listing)** | `test-advisor@mywealthmaps.test` | `ref`: **c91dcd1b** |

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
