# Environment testing — local → preview → production

**Canonical guide** for where code runs, where credentials live, and what to test at each stage.

**Audience:** Solo founder today; structured so a future collaborator can follow the same flow without putting production secrets in GitHub.

**Related:** [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) · [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) · [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) · [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) · [docs/audits/README.md](./audits/README.md)

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

1. **GitHub never gets production Supabase keys** — only a dedicated **staging** project (free tier is fine).
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

## One-time: staging Supabase project

1. Create a **second Supabase project** (e.g. `estate-planner-staging`).
2. Link locally: `npx supabase link --project-ref <staging-ref>`
3. Apply migrations: `npx supabase db push` (same repo as production)
4. Seed E2E fixtures on **staging**:
   ```bash
   # Point .env.local at staging URL + staging service role
   npm run seed:e2e
   ```
5. Copy printed block to:
   - `.env.test` for local Playwright against staging
   - **GitHub Actions secrets** (staging values only)
6. Vercel **Preview** env vars → same staging Supabase URL/keys as GitHub.

**Voels-equivalent data:** Staging uses `@mywealthmaps.test` seeds, not real Voels emails. Run `verify:estate --preset e2e` on staging; run `verify:post-deploy-voels` on **production** after deploy only.

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
│  PREVIEW (Vercel branch deploy)                                │
│  App: *.vercel.app  +  Supabase: STAGING                        │
│  Manual: billing walkthrough (Stripe test), auth callback smoke   │
│  Avoid heavy API E2E against preview URL (POST /api/* can hang) │
└────────────────────────────┬────────────────────────────────────┘
                             │ merge to main
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  CI (GitHub Actions on main / PR)                                │
│  ci.yml: lint, build, verify:consumer-openapi, unit tests       │
│  e2e-smoke.yml (E2E_SMOKE_IN_CI): localhost app + STAGING keys   │
│  rls-verify.yml (RLS_VERIFY_IN_CI): JWT isolation on STAGING    │
│  — no SUPABASE_DB_URL; no production keys                       │
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
| `test:e2e:security-smoke` | ✓ | ✓ e2e-smoke | Manual | After deploy |
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

Workflows keep `REQUIRE_PRIVILEGED_MFA=false` so CI is not blocked by MFA gates.

---

## Local commands cheat sheet

```bash
# Daily dev (staging DB recommended)
npm run dev

# CI-parity checks
npm run lint && npm run build && npm run verify:consumer-openapi

# E2E against staging (set PLAYWRIGHT_BASE_URL in .env.test to staging or localhost)
npm run test:e2e:go-live-profile -- --workers=1

# After merging + production deploy (from machine with prod .env.local)
npm run verify:post-deploy-voels
SUPABASE_DB_URL="$SUPABASE_DB_URL" npm run verify:rls -- --require-sql

# RLS JWT check only (no DB URL needed)
npm run verify:rls
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
