# Playwright E2E

**Environment:** CI and daily E2E use **staging Supabase**; production smoke is manual post-deploy. See [ENVIRONMENT_TESTING.md](./ENVIRONMENT_TESTING.md).

## Go-live test identities (v2)

**Reset guide:** [E2E_TEST_RESET.md](./E2E_TEST_RESET.md)

```bash
npm run seed:e2e              # create/reset all @mywealthmaps.test users
npm run prune:e2e             # clear Playwright rows on consumer household
npm run test:e2e:complete -- --workers=1
```

Canonical emails/passwords: [scripts/e2e-test-identities.ts](../scripts/e2e-test-identities.ts)  
Template: [.env.test.example](../.env.test.example)

### Local E2E and recompute load

For day-to-day local E2E, set **`E2E_SKIP_RECOMPUTE=true`** in `.env.test` to avoid triggering the full recompute chain on every asset/strategy write (major staging DB load). Playwright’s local `webServer` loads `.env.test` into the Next server so the flag applies to API writes.

Tests that specifically verify recompute behavior (`consumer-core-recompute`, `consumer-gift-history`, charitable composition polls) skip or need `RECOMPUTE_SECRET` with **`E2E_SKIP_RECOMPUTE=false`** for that run only.

| Scenario | Command | Notes |
|----------|---------|-------|
| Post-fix verify (scoped) | `npx playwright test [files]` | Fast, low DB load; keep `E2E_SKIP_RECOMPUTE=true` |
| Pre-merge billing | `npm run test:e2e:billing` | With `E2E_SKIP_RECOMPUTE=true` |
| Full suite (occasional) | Split consumer/public then advisor/attorney batches | With `E2E_SKIP_RECOMPUTE=true` |
| Post-deploy production | `npm run test:e2e:prod:smoke` | Real env, 42 tests; flag unset on Vercel |

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
| `npm run verify:rls` | SQL invariants + `assert-rls-coverage` structural gate + JWT isolation on all `HOUSEHOLD_SCOPED_TABLES` (27 checks; `--require-sql` needs `SUPABASE_DB_URL`) |
| `npm run test:e2e:security-isolation` | consumer-setup + advisor-setup + advisor-empty-setup + cross-household IDOR matrix + revoked-link lifecycle |
| `npm run test:e2e:authz` | `@authz` subset of security-isolation + route-authz |
| `npm run verify:consumer-openapi` | Consumer API OpenAPI contract matches route handlers (CI) |
| `npm run test:e2e:a11y` | **Accessibility:** axe serious/critical on login, signup, assess, dashboard, profile (`--workers=1`) |
| `npm run test:e2e:partial-patch` | Partial PATCH API smoke only (3 cases) |
| `npm run test:e2e:advisor` | advisor-setup + advisor |
| `npm run test:e2e:attorney` | attorney-setup + attorney |
| `npm run test:e2e:public` | public |
| `npm run test:e2e:security-smoke` | Local: consumer RPC pages + advisor Monte Carlo (staging Supabase) |
| `npm run test:e2e:security-smoke:prod` | Post-deploy: prod public API (`security-sprint-post-deploy`) + RPC + Monte Carlo |
| `npm run test:e2e:cross-role` | advisor sync, persona onboarding, attorney documents, cross-household (subset) |
| `npm run test:e2e:billing` | **Billing smoke:** consumer/advisor/attorney checkout APIs + webhook signature (`--workers=1`) |
| `npm run test:e2e:complete` | consumer + advisor + attorney + public (**395 tests** — full local dev suite) |
| `npm run test:e2e:prod:smoke` | **Production post-deploy:** 42 tests tagged `@production` (`.env.test.prod`, `--workers=1`) |
| `npm run test:e2e:prod:billing` | **Production billing only:** `@production` + `billing` in title (~17 specs + auth setups) |
| `npm run test:e2e:nightly` | public (attribution sessionStorage) |
| `npm run test:import:unit` | import-unit (incl. `guided-onboarding-href.spec.ts` — 11 cases) |
| `npm run test:import:api` | consumer import API (local base URL) |

## E2E workflow (local vs production)

| Command | When | Tests | Environment |
|---------|------|-------|-------------|
| `test:e2e:complete` | During development | 395 | Local (`.env.test`) |
| `test:e2e:billing` | Before merging billing changes | ~25 | Local |
| `test:e2e:prod:smoke` | After every production deploy | **42** | Production (`.env.test.prod`) |
| `test:e2e:prod:billing` | After Stripe config changes | ~17 (+ setups) | Production |

Production smoke uses `@production` tags on live-wiring tests only (auth setups, billing, webhook, RLS isolation, route smokes, terms). See [GO_LIVE_E2E.md § Production smoke](./GO_LIVE_E2E.md#production-smoke-suite-2026-06-12).

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
| `PLAYWRIGHT_STRIPE_WEBHOOK_SECRET` | Optional — production webhook signing secret for signed noop webhook E2E. **Not** the local `stripe listen` secret from `.env.local`. |
| `PLAYWRIGHT_ADVISOR_FIRM_STARTER_PRICE_ID` | Optional — live Stripe price ID for advisor firm starter when code fallbacks differ from Vercel production |
| `PLAYWRIGHT_PUBLIC_API_BASE_URL` | Optional — public API smoke defaults to `https://www.mywealthmaps.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Must match the Supabase project your `PLAYWRIGHT_BASE_URL` app uses (from `seed:e2e` output) |
| `PLAYWRIGHT_CONSUMER_EMAIL` / `PASSWORD` | Estate-tier consumer (`e2e-consumer@mywealthmaps.test`; password defaults to `E2eTest!2026Mwm` from `e2e-test-identities.ts`) |
| `PLAYWRIGHT_ADVISOR_EMAIL` / `PASSWORD` | Advisor portal |
| `PLAYWRIGHT_HOUSEHOLD_ID` | Strategy + recompute + titling tests — from `seed:e2e` |
| `SUPABASE_SERVICE_ROLE_KEY` | `seed:e2e` + setup projects sync Auth password before login; do not use in browser polls |
| `RECOMPUTE_SECRET` | Optional — golden-path seed triggers `/api/recompute-estate-health`; copy from `.env.local` |
| `E2E_SKIP_RECOMPUTE` | Set `true` in `.env.test` for local runs — skips background `/api/recompute-estate-health` from write APIs; unset on Vercel Production |

## Production env (`.env.test.prod`)

Copy [.env.test.prod.example](../.env.test.prod.example) → `.env.test.prod` (never commit). Run `npm run seed:e2e:prod` against production Supabase before first prod smoke.

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_BASE_URL` | `https://www.mywealthmaps.com` |
| `NEXT_PUBLIC_SUPABASE_URL` / keys | **Production** Supabase (not staging) |
| `PLAYWRIGHT_STRIPE_WEBHOOK_SECRET` | Live webhook signing secret |
| `PLAYWRIGHT_ADVISOR_FIRM_STARTER_PRICE_ID` | Live firm starter price ID |

```bash
npm run test:e2e:prod:smoke -- --workers=1
npm run test:e2e:prod:billing -- --workers=1
```

## Optional env

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `consumer-core-recompute` poll |
| `PLAYWRIGHT_CONSUMER_TIER1_EMAIL` / `PASSWORD` | Enables `consumer-tier1` project |
| `PLAYWRIGHT_ATTORNEY_EMAIL` / `PASSWORD` | Attorney portal (defaults from identities) |
| `PLAYWRIGHT_ADVISOR_REFERRAL_CODE` | Default `e2eadv01` |
| `PLAYWRIGHT_ATTORNEY_REFERRAL_CODE` | Default `e2eatt01` |

## Legacy seeds

Use **`npm run seed:e2e`** only. One-off `seed-test-*` / `seed-michael-johnson-*` / `seed-advisor2-*` scripts were removed 2026-06-12 (audit Sprint D).

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
| 2026-06-09 | Production | `test:e2e:complete --workers=1` | **288 passed**, 20 failed, 7 skipped — billing specs need deploy; re-seed advisor client fixture |
| 2026-06-09 | Production | `test:e2e:billing` | **21 passed**, 2 skipped — tier/period consumer body; firm starter skips on Stripe 500; attorney UI redirect race |
| 2026-06-12 | — | `@production` tags + `test:e2e:prod:smoke` | **42 tests** in 12 files — auth, billing, webhook, security, routes, terms |

Use `--workers=1` on staging to avoid Supabase statement timeouts (`57014`) under parallel load.

**Golden path:** `npm run seed:golden-path` · `npm run test:e2e:golden-path` — verify onramp gate: `npx tsx scripts/check-golden-path-onramp-gate.ts` (score ≥ 60, wizard complete, has data).

**Recompute on Vercel:** `afterHouseholdWrite` → `triggerEstateHealthRecompute` uses Next.js `after()` + **3s debounced** `setTimeout` per household (same coalescing as local) so rapid saves do not storm `/api/recompute-estate-health`.

## `@production` tag (42 tests)

Tagged files: `helpers/*.setup.ts` (×4) · `consumer-billing-checkout` · `advisor-firm-billing` · `attorney-billing` · `stripe-webhook` · `cross-household-isolation` · `security-sprint-post-deploy` · `terms-accept-flow` · `public-routes` (`/`, `/pricing`, `/assess`, `/login`, `/signup` only).

```bash
npx playwright test --list --grep @production   # expect 42
```

## Spec inventory (76 spec files + setup/helpers; 395 tests total)

**Security / cross-role (2026-05-30):** `tests/e2e/security/cross-household-isolation.spec.ts` — consumer + advisor IDOR matrix (403/404 deny). `tests/e2e/advisor/advisor-consumer-sync.spec.ts` — Johnson asset POST → advisor estate-composition. `tests/e2e/attorney/attorney-documents-gaps.spec.ts` — documents list, gap-dismissals, attorney dashboard link. `tests/e2e/consumer/onboarding-persona.spec.ts` — golden-path persona selection (click `[aria-pressed]` card wrapper; wait for PATCH). Commands: `npm run test:e2e:security-isolation`, `npm run test:e2e:cross-role`.

**Consumer:** `dashboard`, `consumer-core-recompute`, financial/strategy/trust/import specs, `consumer-routes-estate-tier`, `consumer-sidebar-navigation` (incl. billing nav), `consumer-route-regression`, `consumer-profile-save` (full + **3 partial PATCH** cases), `consumer-profile-spouse-layout` (slim profile negative), **`consumer-profile-field-prompt`** (ProfileFieldPrompt UI on Scenarios + SS), `consumer-growth-assumptions-api` (PATCH contract + empty-body 400), `consumer-api-writes` (allocation + health-check + generate-base-case), `consumer-ui-asset-save`, `consumer-health-check-ui`, `consumer-family-crud`, `consumer-digital-assets` (API only), `consumer-life-events` (with cleanup), `consumer-import-access`, `consumer-strategy-recommendation-ui`, `terms-accept-flow`, **`onboarding-persona`**, `consumer-tier1-gates` (optional).

**Billing E2E (2026-06-09, staging checkout 2026-06-23):** `tests/e2e/consumer/consumer-billing-checkout.spec.ts` · `consumer-tier1-billing-checkout.spec.ts` (real Subscribe → `checkout.stripe.com`) · `advisor/advisor-firm-billing.spec.ts` · `attorney/attorney-billing.spec.ts` · `public/stripe-webhook.spec.ts` · helpers `stripe-webhook.ts` · `billing-e2e.ts` (`firmStarterPriceIdForE2e`). Command: `npm run test:e2e:billing`. **Staging tier-1 checkout:** `PLAYWRIGHT_BASE_URL=https://estate-planner-staging.vercel.app` + `consumer-tier1-setup` / `consumer-tier1` projects. After Stripe re-key on staging: `npm run reset:staging-stripe` before billing E2E. Consumer duplicate-sub POSTs `{ tier, period }` (server resolves prices). Advisor firm starter skips on 500/invalid price. Attorney subscribe UI waits for Stripe redirect or error. Advisor seed: `ensureAdvisorFirmForE2e()`.

**Go-live:** [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) — `npm run test:e2e:go-live-profile` before flip.

**Selector note (profile layout):** use `getByRole('textbox', { name: 'Jane', exact: true })` for the person-1 name field — `getByPlaceholder('Jane')` also matches Full Name (`Jane Doe`).

**Selector note (persona onboarding):** click the card wrapper `page.locator('[aria-pressed]').filter({ hasText: 'I own a business' })` — not the inner `h2`. Requires `Card` to forward `aria-pressed` to its root `<div>`.

**Public:** `public`, `public-routes`, `public-referral-track`, `auth-signup-attribution`.

**Attorney:** `attorney-portal`, **`attorney-documents-gaps`**.

**Security:** `cross-household-isolation`, `security-sprint-post-deploy` (incl. `/api/health`), `security-sprint-rpc-pages`, `security-sprint-monte-carlo`.

**Advisor:** existing specs + `advisor-retirement-rmd-copy`, `advisor-newsletter-kit`, **`advisor-consumer-sync`**.

See [CONSUMER_FLOWS.md §7](./CONSUMER_FLOWS.md#7-e2e-map-living-contracts) for smoke-section mapping.

See [E2E_RELEASE_TEST_PLAN.md](./E2E_RELEASE_TEST_PLAN.md) and [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) for manual sign-off steps not fully automated.
