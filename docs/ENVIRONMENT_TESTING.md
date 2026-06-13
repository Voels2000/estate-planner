# Environment testing — local → preview → production

**Canonical guide** for where code runs, where credentials live, what to test at each stage, and **what to run before merging or deploying**.

**Audience:** Solo founder today; structured so a future collaborator can follow the same flow without putting production secrets in GitHub.

**Related:** [LAUNCH.md](./LAUNCH.md) (enforceable local → preview → prod gates) · [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) · [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) · [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) · [docs/audits/README.md](./audits/README.md)

---

## Hard rule — no secrets in GitHub

**While production and local/CI share one Supabase project, GitHub Actions must not store any sensitive credentials.**

| Never in GitHub (current solo setup) | Why |
|--------------------------------------|-----|
| `SUPABASE_DB_URL` | Full Postgres access |
| `SUPABASE_SERVICE_ROLE_KEY` (any real key) | Bypasses RLS; same project as production today |
| `NEXT_PUBLIC_SUPABASE_*` (real project keys) | Points CI at live data |
| `PLAYWRIGHT_*` / E2E household IDs | Implies service-role-backed test data on shared DB |
| Stripe / Resend / `CRON_SECRET` / `RECOMPUTE_SECRET` / `INTERNAL_API_KEY` | Production or ops blast radius |
| `.env.local`, `.env.test`, `.env.test.prod` contents | Never commit or paste into Actions |

**Allowed in GitHub today:** compile-only placeholders inside `.github/workflows/ci.yml` for `npm run build` (not real secrets). The **`verify`** job needs **zero** repository secrets.

**Workflows removed from `.github/workflows/`** (solo policy). Templates for a future staging Supabase: [docs/templates/github-workflows/](./templates/github-workflows/README.md). Do not set `E2E_SMOKE_IN_CI` or `RLS_VERIFY_IN_CI`.

### Only exception — second Supabase project (staging-only)

After **all** of the following:

1. Create a **dedicated staging** Supabase project (separate from production data).
2. `npx supabase db push` / migrations applied on staging only.
3. `npm run seed:e2e` against staging; Vercel **Preview** uses staging keys; Vercel **Production** uses production keys only.

…then restore templates from `docs/templates/github-workflows/`, add **staging-only** URL/keys + `PLAYWRIGHT_*` to GitHub Secrets, set `E2E_SMOKE_IN_CI` / `RLS_VERIFY_IN_CI` to `true`, and add branch protection checks. **Production keys and `SUPABASE_DB_URL` still never go to GitHub.**

Until that split exists, all E2E and RLS checks run **on your machine** via `npm run release:preflight` and `npm run release:post-deploy`.

---

## Release discipline — what to run when

Vercel deploys **Production from `main`**. GitHub only auto-runs **`verify`** (no secrets). **You** enforce the rest before merge and after deploy.

### Enforcement — how this is forced

| Layer | Mechanism | What it blocks |
|-------|-----------|----------------|
| **GitHub** | Branch protection on `main`: require PR, require check **`verify`**, include administrators | Broken lint/build/unit reaching `main` |
| **GitHub** | **No** `E2E_SMOKE_IN_CI` / `RLS_VERIFY_IN_CI`; **no** Actions secrets | CI cannot exfiltrate or use live DB keys |
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
| **CI** | GitHub Actions | **`verify` only** — no secrets; E2E/RLS workflows disabled solo |

Preview Vercel deployments and CI both talk to **staging Supabase**. Production Vercel talks to **production Supabase**. Local dev can point at either via `.env.local`.

---

## Credential placement (policy)

| Secret | Local (`.env.local`) | GitHub Actions | Vercel Preview | Vercel Production |
|--------|----------------------|----------------|----------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | **Never** (solo) / staging-only after 2nd project | Staging or shared | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | **Never** (solo) / staging-only after 2nd project | Staging or shared | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | **Never** (solo) / staging-only after 2nd project | Optional | Production |
| `SUPABASE_DB_URL` | ✓ **local only** | **Never** | **Never** | **Never** |
| `PLAYWRIGHT_*` / E2E IDs | `.env.test` / `.env.test.prod` | **Never** (solo) / staging-only after 2nd project | — | — |
| Stripe / Resend / CRON | ✓ | **Never** | Test keys | Live keys |

**Rules**

1. **Solo (one Supabase project): GitHub stores no real credentials** — see [Hard rule](#hard-rule--no-secrets-in-github).
2. **`SUPABASE_DB_URL` never goes to GitHub or Vercel** — run SQL RLS checks from your machine after prod deploys.
3. **Production service role stays in Vercel Production** and local `.env.local` / `.env.test.prod` for manual prod smoke only.

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

## Current setup (today)

You already have:

| Piece | Status |
|-------|--------|
| **Preview app** | Vercel Preview — e.g. `estate-planner-gules.vercel.app` and per-PR `*.vercel.app` URLs |
| **Production app** | `mywealthmaps.com` on Vercel Production (`main` deploys) |
| **Supabase** | Likely **one project** (`fnzvlmrqwcqwiqueevux`) shared across local, preview, and production env vars |
| **CI** | `ci.yml` **`verify` only** — no other workflows; no secrets in GitHub |

E2E seeds use `@mywealthmaps.test` fixtures — not real Voels emails. Run `verify:estate --preset e2e` locally; run `verify:post-deploy-voels` on **production** after deploy only.

### GitHub Actions — solo (current)

**Do not** add repository secrets or enable `E2E_SMOKE_IN_CI` / `RLS_VERIFY_IN_CI`. Run `npm run release:preflight` locally instead.

### GitHub Actions — after second Supabase only (future)

1. Create dedicated staging project; `npm run seed:e2e` on staging only.
2. Copy workflow templates from `docs/templates/github-workflows/` → `.github/workflows/`.
3. Copy **staging-only** URL/keys + `PLAYWRIGHT_HOUSEHOLD_ID` to GitHub Secrets.
4. Set variables `E2E_SMOKE_IN_CI=true` and `RLS_VERIFY_IN_CI=true`.
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

For E2E/RLS workflows after a **second Supabase** exists, restore from [docs/templates/github-workflows/](./templates/github-workflows/README.md).

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
- **Second Supabase** before any GitHub secrets or enabling `E2E_SMOKE_IN_CI`
- Require 2FA for all org members on GitHub and Vercel

---

## Decision log

**2026-06-09 — Hard rule (solo):** No sensitive keys in GitHub while one Supabase project serves production. Local `release:preflight` + `release:post-deploy` substitute for CI E2E/RLS. Branch protection: **`verify` only**.

**2026-06-07 — Pragmatic solo-founder split:** Production service role and `SUPABASE_DB_URL` never in GitHub. See [DECISION_LOG.md](./DECISION_LOG.md).
