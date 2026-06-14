# Environment testing — local → preview → production

**Canonical guide** for where code runs, where credentials live, what to test at each stage, and **what to run before merging or deploying**.

**Audience:** Solo founder today; structured so a future collaborator can follow the same flow without putting production secrets in GitHub.

**Related:** [LAUNCH.md](./LAUNCH.md) · [DEPLOYMENT.md](./DEPLOYMENT.md) (two-DB matrix — canonical for scopes) · [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) · [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) · [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) · [docs/audits/README.md](./audits/README.md)

---

## Credential policy — two-database steady state

**Effective 2026-06-13:** Local dev + Vercel **Preview** → **staging** Supabase (`mwm-staging` / `cmzyxpxfyvdvbsykjvsg`). Vercel **Production** → **prod** Supabase (`fnzvlmrqwcqwiqueevux`). Full matrix: [DEPLOYMENT.md](./DEPLOYMENT.md).

### Production secrets never in GitHub

| Never in GitHub | Why |
|-----------------|-----|
| `SUPABASE_DB_URL` | Full Postgres access |
| Production `SUPABASE_SERVICE_ROLE_KEY` / prod `NEXT_PUBLIC_SUPABASE_*` | Live user data |
| Production Stripe / Resend / cron secrets | Ops blast radius |
| `.env.test.prod` contents | Prod canary credentials |
| `E2E_CANARY_PASSWORD` | Prod canary login |

### Staging-only secrets OK in GitHub (now actionable)

After two-DB split, **staging** URL/keys + `PLAYWRIGHT_*` may go in GitHub repository secrets to enable E2E/RLS workflows on PRs. Templates: [docs/templates/github-workflows/](./templates/github-workflows/README.md). Set `E2E_SMOKE_IN_CI` / `RLS_VERIFY_IN_CI` when ready.

**Still never in GitHub:** production keys, `SUPABASE_DB_URL`, prod Stripe, `.env.test.prod`.

### What runs in GitHub today

| Workflow | Secrets |
|----------|---------|
| `ci.yml` → **`verify`** | None — compile placeholders only |
| `staging-keepalive.yml` | None — public health ping |

**Allowed in `verify` build:** placeholder `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY` (not real credentials).

### Historical note — solo rule (2026-06-09, superseded for staging)

While production and CI shared **one** Supabase project, **no** repository secrets were stored. That rule remains correct for **production** credentials. Staging-only secrets are now permitted because CI/Preview no longer touch prod data. See [DECISION_LOG.md § GitHub credential rule revision](./DECISION_LOG.md).

---

## Release discipline — what to run when

Vercel deploys **Production from `main`**. GitHub only auto-runs **`verify`** (no secrets). **You** enforce the rest before merge and after deploy.

### Enforcement — how this is forced

| Layer | Mechanism | What it blocks |
|-------|-----------|----------------|
| **GitHub** | Branch protection on `main`: require PR, require check **`verify`**, include administrators | Broken lint/build/unit reaching `main` |
| **GitHub** | Branch protection: **`verify`** required; **no production** secrets | Prod keys cannot reach CI |
| **GitHub** | E2E/RLS on PRs — **not enabled yet**; staging-only secrets when restored | Optional next step — see [DEPLOYMENT.md §7](./DEPLOYMENT.md#7-github-actions) |
| **Vercel** | Production branch = `main` (default) | Only merged code deploys to `mywealthmaps.com` |
| **Local (you)** | Commands below before merge / after deploy | Auth, RLS, billing, estate math regressions |

**GitHub branch protection setup (one time):**

1. Repo → **Settings** → **Branches** → **Add rule** (or edit) for `main`.
2. Enable **Require a pull request before merging**.
3. Enable **Require status checks to pass** → select **`verify`** only (from workflow **CI**).
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
| **App host** | Next.js deployment | `localhost:3000`, `*.vercel.app` (Preview), `mywealthmaps.com` (Production) |
| **Database** | Supabase project | **Staging** (CI + preview), **Production** (live users) |
| **CI** | GitHub Actions | **`verify`** + **`staging-keepalive`** (no secrets); E2E/RLS on PRs — near-term |

Preview Vercel deployments and CI both talk to **staging Supabase**. Production Vercel talks to **production Supabase**. Local dev can point at either via `.env.local`.

---

## Credential placement (summary)

**Canonical scope matrix:** [DEPLOYMENT.md §6](./DEPLOYMENT.md#6-vercel-environment-scopes) — do not duplicate here.

| Secret | Local | GitHub | Vercel Preview | Vercel Production |
|--------|-------|--------|----------------|-------------------|
| Staging Supabase keys | `.env.local` (staging) | Staging-only OK for future E2E CI | Staging | — |
| Prod Supabase keys | `.env.projects.local` / `.env.test.prod` | **Never** | — | Prod |
| `SUPABASE_DB_URL` | `.env.local` / `.env.projects.local` | **Never** | **Never** | **Never** |
| `PLAYWRIGHT_*` | `.env.test` (staging) / `.env.test.prod` (canary) | Staging-only OK for future E2E CI | — | — |
| Stripe / Resend / CRON | `.env.local` | **Never** (prod keys) | Test | Live |

**Rules**

1. **Production credentials never in GitHub** — see [Credential policy](#credential-policy--two-database-steady-state).
2. **`SUPABASE_DB_URL` never goes to GitHub or Vercel** — SQL RLS checks run locally after prod deploys.
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

**`SUPABASE_DB_URL` in GitHub** is mainly a **future collaborator / team** concern. For solo + tight access: **keep it local-only**; SQL invariants are a 30-second post-deploy command.

**You do not need (solo):** read-only Postgres roles for CI, scheduled credential rotation, separate GitHub org, branch-protection theater.

**Do today:** 2FA on GitHub and Vercel with an authenticator app.

---

## Current setup (2026-06-13)

| Piece | Status |
|-------|--------|
| **Preview app** | Vercel Preview → **staging** Supabase |
| **Production app** | `mywealthmaps.com` → **prod** Supabase |
| **Staging DB** | `mwm-staging` (`cmzyxpxfyvdvbsykjvsg`) — local dev, Preview, future CI E2E |
| **Production DB** | `fnzvlmrqwcqwiqueevux` — three protected auth users + canary |
| **CI** | `verify` + `staging-keepalive` — no production secrets |
| **E2E split** | Full suite on staging (`npm run test:e2e:complete`); prod canary smoke (`npm run test:e2e:prod:smoke`) |

E2E staging cast uses `@mywealthmaps.test`. Prod smoke uses `canary-consumer@mywealthmaps.com`. Run `verify:estate --preset e2e` locally against staging; `verify:post-deploy-voels` on **production** after deploy.

### GitHub Actions — current

- **`verify`** on every PR (automatic, no secrets)
- **`staging-keepalive`** every 3 days + manual `workflow_dispatch`
- **E2E/RLS on PRs:** not enabled — **near-term**; restore templates with staging-only secrets ([DEPLOYMENT.md §7](./DEPLOYMENT.md#7-github-actions))

### GitHub Actions — enabling E2E/RLS on PRs (do-now checklist)

1. Confirm Preview + local → staging (done).
2. Copy workflow templates from `docs/templates/github-workflows/` → `.github/workflows/`.
3. Add **staging-only** URL/keys + `PLAYWRIGHT_HOUSEHOLD_ID` to GitHub Secrets.
4. Set `E2E_SMOKE_IN_CI=true` and `RLS_VERIFY_IN_CI=true`.
5. Add branch protection checks `e2e-smoke` and `rls-verify` in addition to `verify`.

**Still never add:** `SUPABASE_DB_URL`, production service role, production Stripe keys.

---

## Flow: local → preview → production

```text
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL (every feature / bugfix)                                  │
│  npm run dev  +  .env.local / .env.test (gitignored)             │
│  npm run release:local  — before every PR                          │
│  npm run release:preflight  — before merge (sensitive paths)       │
└────────────────────────────┬────────────────────────────────────┘
                             │ git push branch → open PR
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  PREVIEW (Vercel branch deploy)                                  │
│  Optional spot-check: auth callback, billing if touched          │
└────────────────────────────┬────────────────────────────────────┘
                             │ merge to main (verify must be green)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  CI (GitHub — automatic, no secrets)                             │
│  ci.yml → verify only (see .github/workflows/README.md)          │
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

| Check | Local | CI (GitHub) | Preview | Production |
|-------|-------|-------------|---------|--------------|
| `npm run lint` / `build` | ✓ | ✓ `ci.yml` | Vercel build | Vercel build |
| `verify:consumer-openapi` | ✓ | ✓ | — | — |
| `test:e2e:go-live-profile` | ✓ | — (local preflight) | Optional | prod smoke |
| `test:e2e:security-smoke` | ✓ | — | — | `release:preflight` / prod smoke |
| `test:e2e:security-smoke:prod` | — | — | Manual | Post-deploy prod API |
| `verify:rls` (JWT only) | ✓ preflight | — (disabled solo) | — | — |
| `verify:rls --require-sql` | ✓ **you** | **Never** | — | **After prod deploy** |
| `verify:post-deploy-voels` | ✓ | — | — | **After prod deploy** |
| `npm run seed:e2e` | Staging setup | — | — | Prod only if intentional |
| Daily cron / Voels self-heal | — | — | — | Vercel prod |

---

## GitHub Actions — `verify` job only (solo)

The **`verify`** job in `.github/workflows/ci.yml` uses **compile-only placeholders** on `npm run build` so Next.js can import API routes that initialize Stripe/Resend at module load. These are **not secrets** and are **not** deployed to Vercel.

| Variable | CI value | Real values live in |
|----------|----------|---------------------|
| `RESEND_API_KEY` | `re_placeholder_ci_build_only` | Vercel |
| `STRIPE_SECRET_KEY` | `sk_test_placeholder_ci_build_only` | Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | `placeholder-service-role-key` | Vercel + `.env.local` |
| `NEXT_PUBLIC_SUPABASE_*` | placeholder URLs/keys | Vercel + `.env.local` |

For E2E/RLS workflows, restore from [docs/templates/github-workflows/](./templates/github-workflows/README.md) with **staging-only** secrets. See [DEPLOYMENT.md](./DEPLOYMENT.md).

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

Store production `SUPABASE_DB_URL` only in `.env.local` (gitignored). Supabase → **Connect** → **Session pooler** → **Copy** the full URI.

**Format pitfalls (common):**

- Must be `SUPABASE_DB_URL=postgresql://...` — a bare URL line without the key name is ignored by dotenv.
- Do not hand-edit `[region]` or wrap the password in brackets; use the dashboard copy as-is.
- Region in the hostname must match your project (e.g. `aws-0-us-west-2`, not a placeholder from docs).
- Never commit this value or add it to GitHub/Vercel.

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

- **`SUPABASE_DB_URL` local-only** or team vault (1Password) — never GitHub
- **Second Supabase** — done (2026-06-13); staging-only GitHub secrets permitted for CI E2E
- Require 2FA for all org members on GitHub and Vercel

---

## Decision log

**2026-06-13 — Two-DB steady state:** Preview + local → staging; Production → prod. Production secrets never in GitHub; staging-only secrets OK for future CI E2E. Matrix: [DEPLOYMENT.md](./DEPLOYMENT.md). Purge is staging-only.

**2026-06-09 — Hard rule (solo, production half still applies):** No **production** keys in GitHub while one project served prod. Revised 2026-06-13 when staging split landed. Local `release:preflight` + `release:post-deploy` remain mandatory.

**2026-06-07 — Pragmatic solo-founder split:** Production service role and `SUPABASE_DB_URL` never in GitHub. See [DECISION_LOG.md](./DECISION_LOG.md).
