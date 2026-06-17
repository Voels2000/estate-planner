# Environment testing — local → staging → production

**Canonical guide** for where code runs, where credentials live, what to test at each stage, and **what to run before merging or deploying**.

**Audience:** Solo founder today; structured so a future collaborator can follow the same flow without putting production secrets in GitHub.

**Related:** [LAUNCH.md](./LAUNCH.md) · [DEPLOYMENT.md](./DEPLOYMENT.md) (two-DB matrix — canonical for scopes) · [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) · [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) · [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) · [docs/audits/README.md](./audits/README.md)

---

## Credential policy — two-database steady state

**Effective 2026-06-13:** Local dev + Vercel **Preview** → **staging** Supabase (`mwm-staging` / `cmzyxpxfyvdvbsykjvsg`). Vercel **Production** → **prod** Supabase (`fnzvlmrqwcqwiqueevux`). Full matrix: [DEPLOYMENT.md](./DEPLOYMENT.md).

### Production secrets never in GitHub

| Never in GitHub | Why |
|-----------------|-----|
| Production `SUPABASE_DB_URL` | Full Postgres access to live data |
| Production `SUPABASE_SERVICE_ROLE_KEY` / prod `NEXT_PUBLIC_SUPABASE_*` | Live user data |
| Production Stripe / Resend / cron secrets | Ops blast radius |
| `.env.test.prod` contents | Prod canary credentials |
| `E2E_CANARY_PASSWORD` | Prod canary login |

### Staging-only secrets OK in GitHub (now actionable)

After two-DB split, **staging** URL/keys + **`SUPABASE_DB_URL`** (staging session pooler only) + `PLAYWRIGHT_*` are in GitHub repository secrets; E2E/RLS workflows run on every PR to `main`. See [DEPLOYMENT.md §7](./DEPLOYMENT.md#7-github-actions). Set `E2E_SMOKE_IN_CI` / `RLS_VERIFY_IN_CI` = `true` (done 2026-06-14).

**Still never in GitHub:** production keys, **production** `SUPABASE_DB_URL`, prod Stripe, `.env.test.prod`.

### What runs in GitHub today

| Workflow | Secrets |
|----------|---------|
| `ci.yml` → **`verify`** | None — lint + **`tsc --noEmit`** + unit on all PRs; compile placeholders on build (PR → `main` only) |
| `e2e-smoke.yml` → **`e2e-smoke`** | Staging Supabase + `PLAYWRIGHT_*` (gated: `E2E_SMOKE_IN_CI=true`) |
| `rls-verify.yml` → **`rls-verify`** | Staging Supabase + **`SUPABASE_DB_URL`** + consumer login (gated: `RLS_VERIFY_IN_CI=true`) |
| `staging-keepalive.yml` | None — public health ping |

**Allowed in `verify` build:** placeholder `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY` (not real credentials).

### Historical note — solo rule (2026-06-09, superseded for staging)

While production and CI shared **one** Supabase project, **no** repository secrets were stored. That rule remains correct for **production** credentials. Staging-only secrets are now permitted because CI/Preview no longer touch prod data. See [DECISION_LOG.md § GitHub credential rule revision](./DECISION_LOG.md).

---

## Release discipline — what to run when

Vercel deploys **Production from `main`**; **`estate-planner-staging`** deploys from **`staging`**. GitHub auto-runs **`verify`** + **`e2e-smoke`** + **`rls-verify`** on PRs to `main`; PRs to **`staging`** require **`verify`** only (lint + tsc + unit). **You** still run heavier local checks before merge and post-deploy on prod.

### Enforcement — how this is forced

| Layer | Mechanism | What it blocks |
|-------|-----------|----------------|
| **GitHub** | Branch protection on `main`: require PR, require **`verify`** + **`e2e-smoke`** + **`rls-verify`**, include administrators | Broken lint/tsc/build/E2E/RLS reaching `main` |
| **GitHub** | Branch protection on `staging`: ruleset **`staging-pr-gate`** — require PR, require **`verify`** (lint + tsc + unit) | Broken lint/types/unit reaching integration branch |
| **GitHub** | Staging-only secrets in Actions; **no production** secrets | Prod keys cannot reach CI |
| **Vercel** | `estate-planner` Production branch = `main`; `estate-planner-staging` Production branch = `staging` | Only merged code deploys to prod / staging surfaces |
| **Local (you)** | Commands below before merge / after deploy | Auth, RLS, billing, estate math regressions |

**GitHub branch protection setup (one time):**

1. Repo → **Settings** → **Branches** → **Add rule** (or edit) for `main`.
2. Enable **Require a pull request before merging**.
3. Enable **Require status checks to pass** → select **`verify`**, **`e2e-smoke`**, **`rls-verify`** (from workflows **CI**, **e2e-smoke**, **rls-verify**).
4. Enable **Do not allow bypassing the above settings** (or include administrators if you want zero exceptions).

**Verify protection works:** open a PR with a deliberate lint error → `verify` fails → merge blocked.

**What GitHub cannot force:** preflight E2E, post-deploy SQL RLS, prod smoke — those are **local discipline**. Use the table below every merge.

### Commit-type → required checks

Paths are indicative; when in doubt, run the heavier column.

| If your change touches… | Before opening / merging PR | After merge (production deploy) |
|-------------------------|----------------------------|----------------------------------|
| **Docs only** (`docs/`, comments, typos) | CI `verify` on PR (automatic) | Nothing |
| **UI / copy** — no `app/api/`, no `supabase/migrations/`, no `lib/` math | `npm run release:local` | Nothing unless you deploy and want spot-check |
| **API routes** (`app/api/`) | `npm run release:preflight -- --workers=1` | `npm run release:post-deploy` |
| **Auth, middleware, RLS policies** (`middleware.ts`, `supabase/migrations/*`, `lib/supabase/`) | `release:preflight` + `npm run test:e2e:security-isolation -- --workers=1` | **`npm run release:post-deploy`** (required) |
| **Billing / Stripe** (`app/billing/`, `lib/billing/`, `lib/tiers.ts`, webhooks) | `release:preflight` + `npm run test:e2e:billing -- --workers=1` | `release:post-deploy` + `npm run test:e2e:prod:billing -- --workers=1` |
| **Estate / tax / MC math** (`lib/estate/`, `lib/tax/`, projections) | `release:preflight` + `npm run verify:estate:voels` (or `--preset e2e` if E2E data changed) | **`npm run release:post-deploy`** (Voels gate) |
| **Advisor / attorney / cross-role** | `release:preflight` + `npm run test:e2e:cross-role -- --workers=1` | Optional `npm run test:e2e:prod:smoke -- --workers=1` |
| **Profile / onboarding / signup** | `release:preflight` + `npm run test:e2e:go-live-profile -- --workers=1` | `release:post-deploy` if signup defaults or triggers changed |
| **DB migration** (any `supabase/migrations/`) | `release:preflight` + local `npm run verify:rls -- --require-sql` against target DB | **`npm run release:post-deploy`** (required) |
| **Pre-go-live / launch-sensitive** | Full B1 stack: `release:preflight`, `test:e2e:security-isolation`, `test:e2e:cross-role`, `test:e2e:prod:smoke` | `release:post-deploy` |

### Command reference

```bash
# Every PR — CI parity (also runs automatically as verify on GitHub)
npm run release:local

# Before merging sensitive PRs — E2E + RLS JWT on your machine (.env.local + .env.test)
npm run release:preflight -- --workers=1

# Within ~30 min after Vercel Production deploy (when table above says so)
npm run release:post-deploy

# Optional prod browser/API smoke (.env.test.prod)
npm run test:e2e:prod:smoke -- --workers=1
```

**Merge rule of thumb:** `release:local` minimum; **`release:preflight` before any merge that touches `app/api/`, migrations, auth, billing, or estate math.**

**Deploy rule of thumb:** **`release:post-deploy` after every production deploy** that touches auth, RLS, billing, or estate math.

---

## Three layers (do not conflate)

| Layer | What it is | Examples |
|-------|------------|----------|
| **App host** | Next.js deployment | `localhost:3000`, `estate-planner-staging.vercel.app`, `*.vercel.app` (Preview), `mywealthmaps.com` (Production) |
| **Database** | Supabase project | **Staging** (CI + preview), **Production** (live users) |
| **CI** | GitHub Actions | **`verify`** + **`e2e-smoke`** + **`rls-verify`** (staging secrets) + **`staging-keepalive`** |

Preview Vercel deployments and CI both talk to **staging Supabase**. Production Vercel talks to **production Supabase**. Local dev can point at either via `.env.local`.

---

## Credential placement (summary)

**Canonical scope matrix:** [DEPLOYMENT.md §6](./DEPLOYMENT.md#6-vercel-environment-scopes) — do not duplicate here.

| Secret | Local | GitHub | Vercel Preview | Vercel Production |
|--------|-------|--------|----------------|-------------------|
| Staging Supabase keys | `.env.local` (staging) | Staging-only (E2E/RLS CI) | Staging | — |
| Prod Supabase keys | `.env.projects.local` / `.env.test.prod` | **Never** | — | Prod |
| `SUPABASE_DB_URL` | `.env.local` / `.env.projects.local` | **Staging pooler only** (RLS CI) | **Never** | **Never** |
| `PLAYWRIGHT_*` | `.env.test` (staging) / `.env.test.prod` (canary) | Staging-only (E2E CI) | — | — |
| Stripe / Resend / CRON | `.env.local` | **Never** (prod keys) | Test | Live |

**Rules**

1. **Production credentials never in GitHub** — see [Credential policy](#credential-policy--two-database-steady-state).
2. **`SUPABASE_DB_URL` in GitHub is staging session pooler only** — never production; never Vercel. Post-deploy prod SQL RLS checks run locally.
3. **Purge (`cleanup:purge`) targets staging only** — `.env.local` must point at staging. Prod cleanup uses `bash scripts/run-cleanup-prod.sh` only.

---

## Threat model (solo founder — proportionate)

Realistic paths to credential exposure:

| Vector | Mitigation |
|--------|------------|
| GitHub account compromise | **2FA** (authenticator app, not SMS) on GitHub + Vercel |
| Accidental log leakage | No `console.log` of URLs/keys; GitHub masks secrets but custom errors can leak |
| Malicious workflow step | Private repo; pin Actions (`checkout@v4`); minimal workflows |
| Repo made public | Keep private; review before any visibility change |
| Nation-state / GitHub breach | Out of scope — same as any SaaS |

**Not a realistic solo risk:** random attackers probing your CI (private repo, no public fork secrets).

**`SUPABASE_DB_URL` in GitHub** is permitted for **staging session pooler only** (RLS structural coverage in CI). Production `SUPABASE_DB_URL` remains local-only. For solo + tight access: post-deploy prod SQL invariants are still a local command after production deploys.

**You do not need (solo):** read-only Postgres roles for CI, scheduled credential rotation, separate GitHub org, branch-protection theater.

**Do today:** 2FA on GitHub and Vercel with an authenticator app.

---

## Current setup (2026-06-17)

| Piece | Status |
|-------|--------|
| **Staging app** | Vercel **`estate-planner-staging`** → **staging** Supabase (branch `staging`) |
| **Preview app** | Vercel **`estate-planner`** Preview → **staging** Supabase (branch previews) |
| **Production app** | `mywealthmaps.com` → **prod** Supabase |
| **Staging DB** | `mwm-staging` (`cmzyxpxfyvdvbsykjvsg`) — local dev, staging deploy, CI E2E/RLS |
| **Production DB** | `fnzvlmrqwcqwiqueevux` — three protected auth users + canary |
| **CI** | `verify` (lint + tsc + unit; full build on PR → `main`) + `e2e-smoke` + `rls-verify` (`--require-sql`) + `staging-keepalive` — staging secrets only |
| **E2E split** | Full suite on staging (`npm run test:e2e:complete`); prod canary smoke (`npm run test:e2e:prod:smoke`) |

E2E staging cast uses `@mywealthmaps.test`. Prod smoke uses `canary-consumer@mywealthmaps.com`. Run `verify:estate --preset e2e` locally against staging; `verify:post-deploy-voels` on **production** after deploy.

### Git branch flow

```text
feature/* ──PR (verify)──► staging ──PR (verify+e2e-smoke+rls-verify)──► main
```

### GitHub Actions — current

- **`verify`** on every PR to `main` and `staging` (lint + **`tsc --noEmit`** + unit; full build on PR → `main` only)
- **`e2e-smoke`** on every PR to `main` when `E2E_SMOKE_IN_CI=true`
- **`rls-verify`** on every PR to `main` when `RLS_VERIFY_IN_CI=true` — JWT + **`assert-rls-coverage.sql`** via staging `SUPABASE_DB_URL`
- **`staging-keepalive`** every 3 days + manual `workflow_dispatch`
- Branch protection: `main` — **`verify`** + **`e2e-smoke`** + **`rls-verify`**; `staging` — **`verify`** only ([PR #27](https://github.com/Voels2000/estate-planner/pull/27), 2026-06-17)

### GitHub Actions — maintenance (staging)

When re-seeding staging or refreshing the project: update `PLAYWRIGHT_HOUSEHOLD_ID` in GitHub secrets after `npm run seed:e2e`. Copy tax reference data from prod when staging is rebuilt. See [DEPLOYMENT.md §9](./DEPLOYMENT.md#9-refreshing--maintaining-staging).

**Still never add:** production `SUPABASE_DB_URL`, production service role, production Stripe keys.

---

## Flow: local → staging → production

```text
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL (every feature / bugfix)                                  │
│  npm run dev  +  .env.local / .env.test (gitignored)             │
│  npm run release:local  — before every PR                          │
│  npm run release:preflight  — before merge (sensitive paths)       │
└────────────────────────────┬────────────────────────────────────┘
                             │ git push branch → open PR → staging
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGING (estate-planner-staging.vercel.app)                     │
│  GitHub verify: lint + tsc + unit                                │
└────────────────────────────┬────────────────────────────────────┘
                             │ PR staging → main (all checks green)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  CI (GitHub — automatic on PR → main)                           │
│  verify (full) + e2e-smoke + rls-verify (--require-sql)          │
└────────────────────────────┬────────────────────────────────────┘
                             │ Vercel Production deploy
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  PRODUCTION (manual — after deploy when required)              │
│  npm run release:post-deploy                                     │
│  Optional: npm run test:e2e:prod:smoke -- --workers=1            │
└─────────────────────────────────────────────────────────────────┘
```

---

## What runs where (quick reference)

| Check | Local | CI (GitHub) | Staging deploy | Production |
|-------|-------|-------------|----------------|------------|
| `npm run lint` | ✓ | ✓ `verify` | Vercel build | Vercel build |
| `npx tsc --noEmit` | ✓ | ✓ `verify` | — | — |
| Unit tests | ✓ | ✓ `verify` | — | — |
| `verify:consumer-openapi` | ✓ | ✓ PR → `main` | — | — |
| `test:e2e:go-live-profile` | ✓ | — (local preflight) | Optional | prod smoke |
| `test:e2e:security-smoke` | ✓ | — | — | `release:preflight` / prod smoke |
| `test:e2e:security-smoke:prod` | — | — | Manual | Post-deploy prod API |
| `verify:rls` (JWT only) | ✓ preflight | ✓ `rls-verify` PR → `main` | — | — |
| `verify:rls --require-sql` | ✓ **you** (prod) | ✓ **`rls-verify`** (staging DB) | — | **After prod deploy** |
| `verify:post-deploy-voels` | ✓ | — | — | **After prod deploy** |
| `npm run seed:e2e` | Staging setup | — | — | Prod only if intentional |
| Daily cron / Voels self-heal | — | — | — | Vercel prod |

---

## GitHub Actions — `verify` job

The **`verify`** job in `.github/workflows/ci.yml` runs ESLint, **`npx tsc --noEmit`**, and unit tests on every PR to `main` and `staging`. On PR → `main` (and push → `main`), it also runs full build with **compile-only placeholders** so Next.js can import API routes that initialize Stripe/Resend at module load. These are **not secrets** and are **not** deployed to Vercel.

| Variable | CI value | Real values live in |
|----------|----------|---------------------|
| `RESEND_API_KEY` | `re_placeholder_ci_build_only` | Vercel |
| `STRIPE_SECRET_KEY` | `sk_test_placeholder_ci_build_only` | Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | `placeholder-service-role-key` | Vercel + `.env.local` |
| `NEXT_PUBLIC_SUPABASE_*` | placeholder URLs/keys | Vercel + `.env.local` |

E2E/RLS workflows (`.github/workflows/e2e-smoke.yml`, `rls-verify.yml`) use **staging-only** GitHub secrets — including staging **`SUPABASE_DB_URL`** for structural RLS coverage — never production. See [DEPLOYMENT.md §7](./DEPLOYMENT.md#7-github-actions).

---

## Local commands cheat sheet

```bash
# Daily dev
npm run dev

# Before every PR (CI parity)
npm run release:local

# Before merge once go-live discipline is on — see RELEASE_ROUTINE.md
npm run release:preflight

# After production deploy
npm run release:post-deploy
```

Store production `SUPABASE_DB_URL` only in `.env.local` (gitignored). Staging session pooler URI may be stored as GitHub secret **`SUPABASE_DB_URL`** for CI RLS coverage only. Supabase → **Connect** → **Session pooler** → **Copy** the full URI.

**Format pitfalls (common):**

- Must be `SUPABASE_DB_URL=postgresql://...` — a bare URL line without the key name is ignored by dotenv.
- Do not hand-edit `[region]` or wrap the password in brackets; use the dashboard copy as-is.
- Region in the hostname must match your project (e.g. `aws-0-us-west-2`, not a placeholder from docs).
- Never commit production `SUPABASE_DB_URL` or add it to Vercel.
- Staging pooler URI in GitHub: secret name **`SUPABASE_DB_URL`** only — project `cmzyxpxfyvdvbsykjvsg`.

---

## Playwright base URL guidance

| Target | When |
|--------|------|
| `http://127.0.0.1:3000` | Local E2E / future CI e2e-smoke template |
| Staging Vercel URL or localhost | Local E2E against staging Supabase |
| `https://www.mywealthmaps.com` | Rare prod smoke after deploy — use `--workers=1` |

See [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) — preview `*.vercel.app` may hang on `/api/*`; prefer localhost + staging Supabase for API-heavy specs.

---

## When you add collaborators

Revisit:

- **`SUPABASE_DB_URL`** — production stays local-only or team vault (1Password); staging pooler OK in GitHub for CI
- **Second Supabase** — done (2026-06-13); staging-only GitHub secrets permitted for CI E2E
- Require 2FA for all org members on GitHub and Vercel

---

## Decision log

**2026-06-17 — CI hardening + staging branch:** [PR #27](https://github.com/Voels2000/estate-planner/pull/27) — `tsc --noEmit` in `verify`; `rls-verify --require-sql` with staging `SUPABASE_DB_URL`; long-lived **`staging`** branch + `staging-pr-gate` ruleset; `estate-planner-staging` Vercel project.

**2026-06-13 — Two-DB steady state:** Preview + local → staging; Production → prod. Production secrets never in GitHub; staging-only secrets OK for CI E2E/RLS. Matrix: [DEPLOYMENT.md](./DEPLOYMENT.md). Purge is staging-only.

**2026-06-09 — Hard rule (solo, production half still applies):** No **production** keys in GitHub while one project served prod. Revised 2026-06-13 when staging split landed. Local `release:preflight` + `release:post-deploy` remain mandatory.

**2026-06-07 — Pragmatic solo-founder split:** Production service role and `SUPABASE_DB_URL` never in GitHub. See [DECISION_LOG.md](./DECISION_LOG.md).
