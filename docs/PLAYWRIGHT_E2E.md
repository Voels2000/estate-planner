# Playwright E2E

## Go-live test identities (v2)

**Reset guide:** [E2E_TEST_RESET.md](./E2E_TEST_RESET.md)

```bash
npm run seed:e2e              # create/reset all @mywealthmaps.test users
npm run prune:e2e             # clear Playwright rows on consumer household
npm run test:e2e:complete -- --workers=1
```

Canonical emails/passwords: [scripts/e2e-test-identities.ts](../scripts/e2e-test-identities.ts)  
Template: [.env.test.example](../.env.test.example)

## Commands

| Script | Projects |
|--------|----------|
| `npm run seed:e2e` | Seed all E2E users + print `.env.test` |
| `npm run seed:e2e:fast` | Seed without linked advisor client household |
| `npm run verify:estate` | Cross-surface estate number matrix (see below) |
| `npm run verify:estate:voels` | Voels preset + goldens + HTTP scrape |
| `npm run verify:estate:e2e` | E2E preset + strategy lifecycle + goldens + HTTP |
| `npm run verify:drip` | Check `email_captures` drip_step_1/2/3 schedule |
| `npm run cleanup:purge:dry-run` | Preview auth users to keep vs delete (go-live) |
| `npm run cleanup:purge` | Delete all unprotected auth users via WCPA `deleteUser` path |
| `npm run cleanup:rolobe` | Retire listed `@rolobe.resend.app` accounts only (legacy) |
| `npm run test:e2e:consumer` | consumer-setup + consumer |
| `npm run test:e2e:go-live-profile` | **Go-live pre-flight:** profile save + spouse layout + inline prompts (`--workers=1`) |
| `npm run test:e2e:mobile` | **Mobile review mode:** LAUNCH_CHECKLIST Track 2 steps 13–19 (`consumer-mobile-review.spec.ts`, `--workers=1`) |
| `npm run test:e2e:partial-patch` | Partial PATCH API smoke only (3 cases) |
| `npm run test:e2e:advisor` | advisor-setup + advisor |
| `npm run test:e2e:attorney` | attorney-setup + attorney |
| `npm run test:e2e:public` | public |
| `npm run test:e2e:security-smoke` | public health/referral/telemetry + consumer RPC pages + advisor Monte Carlo |
| `npm run test:e2e:security-isolation` | consumer-setup + advisor-setup + cross-household IDOR matrix |
| `npm run test:e2e:cross-role` | advisor sync, persona onboarding, attorney documents, cross-household (subset) |
| `npm run test:e2e:complete` | consumer + advisor + attorney + public |
| `npm run test:e2e:nightly` | public (attribution sessionStorage) |
| `npm run test:import:unit` | import-unit (incl. `guided-onboarding-href.spec.ts` — 11 cases) |
| `npm run test:import:api` | consumer import API (local base URL) |

## Required env (`.env.test`)

All `npm run test:e2e*` scripts use `dotenv -o -e .env.test` so **`.env.test` overrides stale shell exports**. If you previously exported `PLAYWRIGHT_*=...@rolobe.resend.app`, remove them:

```bash
unset PLAYWRIGHT_CONSUMER_EMAIL PLAYWRIGHT_ADVISOR_EMAIL PLAYWRIGHT_CONSUMER_TIER1_EMAIL
grep -n 'PLAYWRIGHT_\|rolobe' ~/.zprofile ~/.zshrc 2>/dev/null
```

Setup projects map retired `@rolobe.resend.app` emails to canonical `@mywealthmaps.test` via `resolveE2eEmail()` in `tests/e2e/helpers/e2e-auth.ts`.

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_BASE_URL` | Target deployment — default **`https://www.mywealthmaps.com`**. Preview `*.vercel.app` serves pages but **`/api/*` routes may hang**; use production for API-heavy specs (presets, import, strategy writes). After changing base URL, re-run setup: `rm -rf .auth && npm run test:e2e:complete -- --project=advisor-setup --project=consumer-setup --project=attorney-setup` |
| `PLAYWRIGHT_PUBLIC_API_BASE_URL` | Optional — public API smoke defaults to `https://www.mywealthmaps.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Must match the Supabase project your `PLAYWRIGHT_BASE_URL` app uses (from `seed:e2e` output) |
| `PLAYWRIGHT_CONSUMER_EMAIL` / `PASSWORD` | Estate-tier consumer (`e2e-consumer@mywealthmaps.test`; password defaults to `E2eTest!2026Mwm` from `e2e-test-identities.ts`) |
| `PLAYWRIGHT_ADVISOR_EMAIL` / `PASSWORD` | Advisor portal |
| `PLAYWRIGHT_HOUSEHOLD_ID` | Strategy + recompute + titling tests — from `seed:e2e` |
| `SUPABASE_SERVICE_ROLE_KEY` | `seed:e2e` + setup projects sync Auth password before login; do not use in browser polls |
| `RECOMPUTE_SECRET` | Optional — golden-path seed triggers `/api/recompute-estate-health`; copy from `.env.local` |

## Optional env

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `consumer-core-recompute` poll |
| `PLAYWRIGHT_CONSUMER_TIER1_EMAIL` / `PASSWORD` | Enables `consumer-tier1` project |
| `PLAYWRIGHT_ATTORNEY_EMAIL` / `PASSWORD` | Attorney portal (defaults from identities) |
| `PLAYWRIGHT_ADVISOR_REFERRAL_CODE` | Default `e2eadv01` |
| `PLAYWRIGHT_ATTORNEY_REFERRAL_CODE` | Default `e2eatt01` |

## Legacy seeds (deprecated for new work)

Prefer `npm run seed:e2e`. Old scripts remain for reference:

- `scripts/seed-test-consumer-estate.ts` — tier bump only for existing email
- `scripts/seed-test-attorney.ts` — superseded by `seed-e2e-fixtures`
- `scripts/seed-michael-johnson-advisor-demo.ts` — called by master seed

## Estate verification (numeric reconciliation)

After `seed:e2e` or for Voels demo smoke:

```bash
npm run verify:estate -- --preset voels --check-goldens --http
npm run verify:estate:e2e    # lifecycle + goldens + HTTP on e2e household
```

See [NEXT_SESSION.md](./NEXT_SESSION.md) — Estate verification suite.

## Verification log

| Date | Target | Command | Result |
|------|--------|---------|--------|
| 2026-05-25 | Staging | `test:e2e:consumer --workers=1` (pre-v2 identities) | **127 passed**, 5 skipped |
| 2026-05-25 | Staging | `test:e2e:advisor --workers=1` | **45 passed** |
| 2026-05-25 | Staging | `test:e2e:public` | **57 passed**, 2 skipped |
| 2026-05-25 | Staging | `seed:e2e` + `e2e-consumer@` + `--workers=1` | **136 passed**, 1 skipped (gift recompute flaky under load; re-run green) |
| 2026-05-27 | Staging | `consumer-profile-spouse-layout` + `consumer-growth-assumptions-api` | **5 passed**, 1 skipped (round-trip needs `PLAYWRIGHT_HOUSEHOLD_ID` in `.env.test`) |
| 2026-05-27 | Production | `consumer-profile-save` partial PATCH (SS + retirement/longevity, run separately) | **2 passed** each (merge API) |
| 2026-05-27 | Production | `test:e2e:go-live-profile` (profile + inline prompts) | Run before go-live — see [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) |
| 2026-05-30 | Production | `test:e2e:security-isolation` | **10/10** — IDOR matrix |
| 2026-05-30 | Production | `test:e2e:cross-role` | **12/12** after deploy `12734a3` — persona + attorney + advisor sync |
| 2026-05-30 | Production | `test:e2e:security-smoke` | **7/7** incl. `/api/health` |

Use `--workers=1` on staging to avoid Supabase statement timeouts (`57014`) under parallel load.

**Golden path:** `npm run seed:golden-path` · `npm run test:e2e:golden-path` — verify onramp gate: `npx tsx scripts/check-golden-path-onramp-gate.ts` (score ≥ 60, wizard complete, has data).

**Recompute on Vercel:** `afterHouseholdWrite` uses Next.js `after()` + immediate trigger (no post-response `setTimeout`) so asset POSTs fire `/api/recompute-estate-health` reliably after deploy.

## Spec inventory (42 spec files + setup/helpers; 280 tests total)

**Security / cross-role (2026-05-30):** `tests/e2e/security/cross-household-isolation.spec.ts` — consumer + advisor IDOR matrix (403/404 deny). `tests/e2e/advisor/advisor-consumer-sync.spec.ts` — Johnson asset POST → advisor estate-composition. `tests/e2e/attorney/attorney-documents-gaps.spec.ts` — documents list, gap-dismissals, attorney dashboard link. `tests/e2e/consumer/onboarding-persona.spec.ts` — golden-path persona selection (click `[aria-pressed]` card wrapper; wait for PATCH). Commands: `npm run test:e2e:security-isolation`, `npm run test:e2e:cross-role`.

**Consumer:** `dashboard`, `consumer-core-recompute`, financial/strategy/trust/import specs, `consumer-routes-estate-tier`, `consumer-sidebar-navigation`, `consumer-route-regression`, `consumer-profile-save` (full + **3 partial PATCH** cases), `consumer-profile-spouse-layout` (slim profile negative), **`consumer-profile-field-prompt`** (ProfileFieldPrompt UI on Scenarios + SS), `consumer-growth-assumptions-api` (PATCH contract + empty-body 400), `consumer-api-writes` (allocation + health-check + generate-base-case), `consumer-ui-asset-save`, `consumer-health-check-ui`, `consumer-family-crud`, `consumer-my-advisor`, `consumer-billing-route`, `consumer-digital-assets`, `consumer-life-events`, `consumer-import-access`, `consumer-strategy-recommendation-ui`, `terms-accept-flow`, **`onboarding-persona`**, `consumer-tier1-gates` (optional).

**Go-live:** [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) — `npm run test:e2e:go-live-profile` before flip.

**Selector note (profile layout):** use `getByRole('textbox', { name: 'Jane', exact: true })` for the person-1 name field — `getByPlaceholder('Jane')` also matches Full Name (`Jane Doe`).

**Selector note (persona onboarding):** click the card wrapper `page.locator('[aria-pressed]').filter({ hasText: 'I own a business' })` — not the inner `h2`. Requires `Card` to forward `aria-pressed` to its root `<div>`.

**Public:** `public`, `public-routes`, `public-referral-track`, `auth-signup-attribution`.

**Attorney:** `attorney-portal`, **`attorney-documents-gaps`**.

**Security:** `cross-household-isolation`, `security-sprint-post-deploy` (incl. `/api/health`), `security-sprint-rpc-pages`, `security-sprint-monte-carlo`.

**Advisor:** existing specs + `advisor-retirement-rmd-copy`, `advisor-newsletter-kit`, **`advisor-consumer-sync`**.

See [CONSUMER_FLOWS.md §7](./CONSUMER_FLOWS.md#7-e2e-map-living-contracts) for smoke-section mapping.

See [E2E_RELEASE_TEST_PLAN.md](./E2E_RELEASE_TEST_PLAN.md) and [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) for manual sign-off steps not fully automated.
