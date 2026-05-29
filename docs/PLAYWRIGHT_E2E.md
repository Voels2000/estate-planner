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
| `npm run seed:e2e:fast` | Seed without Michael Johnson client |
| `npm run prune:e2e` | Remove Playwright-named rows on consumer household |
| `npm run verify:drip` | Check `email_captures` drip_step_1/2/3 schedule |
| `npm run cleanup:rolobe` | Retire all `@rolobe.resend.app` auth accounts (prompts) |
| `npm run test:e2e:consumer` | consumer-setup + consumer |
| `npm run test:e2e:advisor` | advisor-setup + advisor |
| `npm run test:e2e:attorney` | attorney-setup + attorney |
| `npm run test:e2e:public` | public |
| `npm run test:e2e:complete` | consumer + advisor + attorney + public |
| `npm run test:e2e:nightly` | public (attribution sessionStorage) |
| `npm run test:import:unit` | import-unit |
| `npm run test:import:api` | consumer import API (local base URL) |

## Required env (`.env.test`)

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_BASE_URL` | Target deployment |
| `NEXT_PUBLIC_SUPABASE_URL` | Must match the Supabase project your `PLAYWRIGHT_BASE_URL` app uses (from `seed:e2e` output) |
| `PLAYWRIGHT_CONSUMER_EMAIL` / `PASSWORD` | Estate-tier consumer (`e2e-consumer@mywealthmaps.test`; password defaults to `E2eTest!2026Mwm` from `e2e-test-identities.ts`) |
| `PLAYWRIGHT_ADVISOR_EMAIL` / `PASSWORD` | Advisor portal |
| `PLAYWRIGHT_HOUSEHOLD_ID` | Strategy + recompute + titling tests — from `seed:e2e` |
| `SUPABASE_SERVICE_ROLE_KEY` | `seed:e2e` + setup projects sync Auth password before login; do not use in browser polls |

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

## Verification log

| Date | Target | Command | Result |
|------|--------|---------|--------|
| 2026-05-25 | Staging | `test:e2e:consumer --workers=1` (pre-v2 identities) | **127 passed**, 5 skipped |
| 2026-05-25 | Staging | `test:e2e:advisor --workers=1` | **45 passed** |
| 2026-05-25 | Staging | `test:e2e:public` | **57 passed**, 2 skipped |
| 2026-05-25 | Staging | `seed:e2e` + `e2e-consumer@` + `--workers=1` | **136 passed**, 1 skipped (gift recompute flaky under load; re-run green) |
| 2026-05-27 | Staging | `consumer-profile-spouse-layout` + `consumer-growth-assumptions-api` | **5 passed**, 1 skipped (round-trip needs `PLAYWRIGHT_HOUSEHOLD_ID` in `.env.test`) |
| 2026-05-27 | Local pre-deploy | `consumer-profile-save` partial PATCH (SS + retirement/longevity, run separately) | **2 passed** each (merge API); production re-run post-deploy required |

Use `--workers=1` on staging to avoid Supabase statement timeouts (`57014`) under parallel load.

**Seed fixture:** `npm run seed:e2e` sets `onboarding_invite_advisor_completed_at`, completed health check, and stale `estate_health_scores.computed_at` so dashboard smoke is not blocked by the invite-advisor gate.

**Recompute on Vercel:** `afterHouseholdWrite` uses Next.js `after()` + immediate trigger (no post-response `setTimeout`) so asset POSTs fire `/api/recompute-estate-health` reliably after deploy.

## Spec inventory (42 files)

**Consumer:** `dashboard`, `consumer-core-recompute`, financial/strategy/trust/import specs, `consumer-routes-estate-tier`, `consumer-sidebar-navigation`, `consumer-route-regression`, `consumer-profile-save` (includes **partial PATCH** SS-only and retirement/longevity-only cases — run separately post-deploy), `consumer-profile-spouse-layout` (live headers, spouse toggle, section labels), `consumer-growth-assumptions-api` (PATCH contract + empty-body 400), `consumer-api-writes` (allocation + health-check + generate-base-case), `consumer-ui-asset-save`, `consumer-health-check-ui`, `consumer-family-crud`, `consumer-my-advisor`, `consumer-billing-route`, `consumer-digital-assets`, `consumer-life-events`, `consumer-import-access`, `consumer-strategy-recommendation-ui`, `terms-accept-flow`, `consumer-tier1-gates` (optional).

**Selector note (profile layout):** use `getByRole('textbox', { name: 'Jane', exact: true })` for the person-1 name field — `getByPlaceholder('Jane')` also matches Full Name (`Jane Doe`).

**Public:** `public`, `public-routes`, `public-referral-track`, `auth-signup-attribution`.

**Advisor:** existing specs + `advisor-retirement-rmd-copy`, `advisor-newsletter-kit`.

**Attorney:** `attorney-portal`.

See [CONSUMER_FLOWS.md §7](./CONSUMER_FLOWS.md#7-e2e-map-living-contracts) for smoke-section mapping.

See [E2E_RELEASE_TEST_PLAN.md](./E2E_RELEASE_TEST_PLAN.md) and [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) for manual sign-off steps not fully automated.
