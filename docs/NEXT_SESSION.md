# NEXT_SESSION.md
# Sprint 15 — Session Start Document
# Updated: 2026-05-24

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — **Sprint 15 (go-live ops).** Sprint 14 closed. Waitlist mode live: public signup gated to `/waitlist` via `WAITLIST_MODE` + `NEXT_PUBLIC_WAITLIST_MODE` (`bb9a191` runtime proxy redirect).
>
> **Sprint 15 goal:** LAUNCH_CHECKLIST Section 2 — domain, env vars, Search Console. **Disable waitlist** when opening public signup (see LAUNCH_CHECKLIST § Waitlist mode).
>
> **Today's task:** TBD.

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

### Waitlist mode (pre-launch — do not lose)

Public signup is **off** while waitlist env vars are `true`. Visitors hitting `/signup` or **Get started** CTAs land on `/waitlist` (email capture only).

| Env var | Where |
|---------|--------|
| `WAITLIST_MODE=true` | `middleware.ts` runtime redirect; server signup page |
| `NEXT_PUBLIC_WAITLIST_MODE=true` | Client `getSignupHref()` — requires redeploy when changed |

**Bypass:** invite/token URLs still reach signup — `?invite=`, `?invite_token=` + `?firm_id=`, `?connectionToken=`.

**Go-live:** set `PUBLIC_SIGNUP_OPEN=true` in Vercel Production → redeploy → verify `/signup` shows form. Full steps: [LAUNCH_CHECKLIST.md § Waitlist mode](./LAUNCH_CHECKLIST.md#waitlist-mode-pre-launch--disable-at-go-live).

Key files: `lib/waitlist-mode.ts`, `middleware.ts`, `app/(public)/waitlist/`, `app/(auth)/signup/page.tsx`.

---

## Test account references

| Role | Email | Notes |
|------|-------|-------|
| **Consumer** | `david@rolobe.resend.app` | Estate tier, active subscription, is_superuser: false |
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
