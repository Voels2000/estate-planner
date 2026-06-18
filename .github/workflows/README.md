# GitHub Actions

## Active workflows

| Workflow | Job / check name | Triggers | Secrets |
|----------|------------------|----------|---------|
| **`ci.yml`** | **`verify`** | PR → `main`, `staging`; push → `main` | None (build uses placeholders) |
| **`rls-verify.yml`** | **`rls-verify`** | PR → `main`; `workflow_dispatch` | Staging Supabase + `SUPABASE_DB_URL` (pooler) |
| **`e2e-smoke.yml`** | **`e2e-smoke`** | PR → `main`; `workflow_dispatch` | Staging Supabase + Playwright users; runs go-live-profile, security-smoke, B4 gate, **cross-household isolation** (20 tests) |
| **`staging-keepalive.yml`** | **`ping`** | Cron (every 3 days) | None |

Repo variables (must be `true` for gated jobs): **`E2E_SMOKE_IN_CI`**, **`RLS_VERIFY_IN_CI`**.

## What **`verify`** runs

| Step | PR → `staging` | PR → `main` / push → `main` |
|------|-----------------|-----------------------------|
| ESLint | ✓ | ✓ |
| `tsc --noEmit` | ✓ | ✓ |
| Unit tests | ✓ | ✓ |
| Production build + audits + OpenAPI | — | ✓ |

Check name stays **`verify`** on all PRs (branch protection unchanged).

## Branch protection

| Branch | Ruleset | Required checks |
|--------|---------|-----------------|
| **`main`** | **`main-no-direct-push`** | **`verify`**, **`e2e-smoke`**, **`rls-verify`** |
| **`staging`** | **`staging-pr-gate`** | **`verify`** (lint + tsc + unit) |

Before **`rls-verify`** can pass with `--require-sql`, add repository secret **`SUPABASE_DB_URL`** (staging session pooler only — `cmzyxpxfyvdvbsykjvsg`). Never production.

## Local substitutes

| Command | When |
|---------|------|
| `npm run release:local` | Before every PR (CI parity: lint, build, unit, OpenAPI) |
| `npm run release:preflight -- --workers=1` | Before merge to `main` (E2E + RLS JWT) |
| `npm run release:post-deploy` | After production deploy |

Full policy: [docs/ENVIRONMENT_TESTING.md](../../docs/ENVIRONMENT_TESTING.md) · [docs/DEPLOYMENT.md §7](../../docs/DEPLOYMENT.md#7-github-actions).
