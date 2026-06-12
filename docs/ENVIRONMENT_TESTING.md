# Environment testing — local → preview → production

**Canonical guide** for where code runs, where credentials live, and what to test at each stage.

**Audience:** Solo founder today; structured so a future collaborator can follow the same flow without putting production secrets in GitHub.

**Related:** [LAUNCH.md](./LAUNCH.md) (enforceable local → preview → prod gates) · [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) · [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) · [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) · [LAUNCH.md](./archive/LAUNCH_CHECKLIST.md) · [docs/audits/README.md](./audits/README.md)

---

## Three layers (do not conflate)

| Layer | What it is | Examples |
|-------|------------|----------|
| **App host** | Next.js deployment | `localhost:3000`, `*.vercel.app` (Preview), `mywealthmaps.com` (Production) |
| **Database** | Supabase project | **Staging** (CI + preview), **Production** (live users) |
| **CI** | GitHub Actions | Runs on push/PR to `main` — **staging Supabase only** |

Preview Vercel deployments and CI both talk to **staging Supabase**. Production Vercel talks to **production Supabase**. Local dev can point at either via `.env.local`.

---

## Credential placement (policy)

| Secret | Local (`.env.local`) | GitHub Actions | Vercel Preview | Vercel Production |
|--------|----------------------|----------------|----------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Staging or prod | **Staging only** | Staging | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | **Staging only** | Staging | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | **Staging only** | Staging (optional) | Production |
| `SUPABASE_DB_URL` | ✓ **local only** | **Never** | **Never** | **Never** |
| Production service role | ✓ (for prod smoke) | **Never** | **Never** | ✓ |
| `PLAYWRIGHT_*` / E2E IDs | `.env.test` | **Staging** (from `seed:e2e`) | — | — |
| Stripe / Resend / CRON | ✓ | — | Test keys | Live keys |

**Rules**

1. **GitHub never gets production service role or `SUPABASE_DB_URL`** — CI uses the same Supabase project as preview/E2E today, or a dedicated staging project if you split later.
2. **`SUPABASE_DB_URL` never goes to GitHub or Vercel** — run SQL RLS checks from your machine after prod deploys.
3. **Production service role stays in Vercel Production** (and your local `.env.local` when you run prod smoke manually).

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
| **CI** | `ci.yml` always on; E2E + RLS workflows **off** until `E2E_SMOKE_IN_CI` / `RLS_VERIFY_IN_CI` = `true` |

E2E seeds use `@mywealthmaps.test` fixtures — not real Voels emails. Run `verify:estate --preset e2e` locally; run `verify:post-deploy-voels` on **production** after deploy only.

### GitHub Actions secrets (when enabling E2E at go-live prep)

1. `npm run seed:e2e` with `.env.local` pointed at the Supabase project CI will use
2. Copy printed block to `.env.test` and **GitHub Actions secrets**
3. Vercel **Preview** env vars → same Supabase URL/keys as GitHub (already typical if preview and prod share one project)

### Optional upgrade: second Supabase for CI isolation

When you want GitHub to **never** touch production data:

1. Create a **second Supabase project** (e.g. `estate-planner-staging`, free tier)
2. `npx supabase link --project-ref <staging-ref>` → `npx supabase db push`
3. `npm run seed:e2e` on staging → secrets to GitHub + `.env.test`
4. Vercel Preview → staging keys; Vercel Production → production keys only

Not required for solo go-live if branch protection + local post-deploy checks are in place — but recommended before collaborators or heavy CI traffic.

---

## Flow: local → preview → production

```text
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL (every feature / bugfix)                                  │
│  npm run dev  +  .env.local → staging OR prod (your choice)     │
│  npm run lint / build / test:unit / verify:consumer-openapi       │
│  npm run test:e2e:go-live-profile  (PLAYWRIGHT_BASE_URL in .env.test) │
└────────────────────────────┬────────────────────────────────────┘
                             │ git push branch
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  PREVIEW (Vercel branch deploy — already configured)             │
│  App: estate-planner-gules / PR *.vercel.app                    │
│  Manual: billing walkthrough (Stripe test), auth callback smoke   │
│  Avoid heavy API E2E against preview URL (POST /api/* can hang) │
└────────────────────────────┬────────────────────────────────────┘
                             │ merge to main
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  CI (GitHub Actions on main / PR)                                │
│  ci.yml: lint, build (dummy env — see below), audits, unit tests │
│  e2e-smoke.yml (E2E_SMOKE_IN_CI): localhost app + STAGING keys   │
│  rls-verify.yml (RLS_VERIFY_IN_CI): JWT isolation on STAGING    │
│  — no SUPABASE_DB_URL; no production keys in GitHub secrets      │
└────────────────────────────┬────────────────────────────────────┘
                             │ deploy Production (Vercel)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  PRODUCTION (after deploy — manual, solo)                        │
│  npm run verify:post-deploy-voels                                │
│  SUPABASE_DB_URL=... npm run verify:rls -- --require-sql         │
│    (from .env.local — prod pooler URI, never in GitHub)          │
│  Optional: PLAYWRIGHT_BASE_URL=https://www.mywealthmaps.com      │
│    npm run test:e2e:security-smoke -- --workers=1               │
└─────────────────────────────────────────────────────────────────┘
```

---

## What runs where (quick reference)

| Check | Local | CI (GitHub) | Preview | Production |
|-------|-------|-------------|---------|--------------|
| `npm run lint` / `build` | ✓ | ✓ `ci.yml` | Vercel build | Vercel build |
| `verify:consumer-openapi` | ✓ | ✓ | — | — |
| `test:e2e:go-live-profile` | ✓ staging URL | ✓ localhost + staging | Optional | Optional prod smoke |
| `test:e2e:security-smoke` | ✓ (local RPC + MC) | — | — | `release:preflight` |
| `test:e2e:security-smoke:prod` | — | — | Manual | Post-deploy prod API (7 tests) |
| `verify:rls` (JWT only) | ✓ | ✓ rls-verify | — | — |
| `verify:rls --require-sql` | ✓ **you** | **Never** | — | **After prod deploy** |
| `verify:post-deploy-voels` | ✓ | — | — | **After prod deploy** |
| `npm run seed:e2e` | Staging setup | — | — | Prod only if intentional |
| Daily cron / Voels self-heal | — | — | — | Vercel prod |

---

## GitHub Actions setup (pre-go-live)

Enable **before** `PUBLIC_SIGNUP_OPEN` — all secrets are **staging Supabase** + E2E seed output.

### Variables

| Variable | Purpose |
|----------|---------|
| `E2E_SMOKE_IN_CI` | `true` → run `.github/workflows/e2e-smoke.yml` |
| `RLS_VERIFY_IN_CI` | `true` → run `.github/workflows/rls-verify.yml` (JWT isolation only) |

### Secrets (staging project only)

| Secret | Source |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Staging project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging project |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging service role |
| `PLAYWRIGHT_HOUSEHOLD_ID` | `npm run seed:e2e` on staging |
| `PLAYWRIGHT_CONSUMER_EMAIL` / `PASSWORD` | Optional — defaults `@mywealthmaps.test` |

**Do not add:** `SUPABASE_DB_URL`, production service role, production anon key.

### CI `Production build` step (compile-only placeholders)

The `verify` job in `.github/workflows/ci.yml` sets **dummy** env vars on `npm run build` so Next.js can import API routes that initialize Stripe/Resend at module load. These values are **not secrets** and are **not** used by Vercel.

| Variable | CI value | Vercel Production / Preview |
|----------|----------|----------------------------|
| `RESEND_API_KEY` | `re_placeholder_ci_build_only` | Real key in Vercel dashboard |
| `STRIPE_SECRET_KEY` | `sk_test_placeholder_ci_build_only` | Real key in Vercel dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | `placeholder-service-role-key` | Real key in Vercel dashboard |
| `NEXT_PUBLIC_SUPABASE_*` | placeholder URLs/keys | Real project keys in Vercel |
| `BETA_SIGNUP_TOKEN` | not set (optional) | Set in Production when sharing private beta signup links |

Workflows keep `REQUIRE_PRIVILEGED_MFA=false` so CI is not blocked by MFA gates.

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

Store production `SUPABASE_DB_URL` only in `.env.local` (gitignored). Get it from Supabase → Database → Connection string → **Session pooler**.

---

## Playwright base URL guidance

| Target | When |
|--------|------|
| `http://127.0.0.1:3000` | CI e2e-smoke (webServer starts local app) |
| Staging Vercel URL or localhost | Local E2E against staging Supabase |
| `https://www.mywealthmaps.com` | Rare prod smoke after deploy — use `--workers=1` |

See [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) — preview `*.vercel.app` may hang on `/api/*`; prefer localhost + staging Supabase for API-heavy specs.

---

## When you add collaborators

Revisit:

- Keep **`SUPABASE_DB_URL` local-only** or move to a secure team vault (1Password), not GitHub
- GitHub secrets remain **staging-only**; production access via Vercel team roles
- Require 2FA for all org members
- Optional: read-only Postgres role for SQL audits (not required for solo)

---

## Decision log (2026-06-07)

**Chosen:** Pragmatic solo-founder split — 95% safety, minimal overhead.

- CI + preview → **staging Supabase** (seeded `@mywealthmaps.test`)
- Production service role → **Vercel Production + local only**
- `SUPABASE_DB_URL` → **local post-deploy only** (SQL RLS invariants)
- GitHub RLS workflow → **JWT behavioral checks only** (no `--require-sql` in CI)

See [DECISION_LOG.md](./DECISION_LOG.md) for product decisions; this doc is the ops/testing authority.
