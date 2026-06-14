# Deployment — two-database steady state

**Effective:** 2026-06-13 (two-DB migration complete). Archived runbook: [docs/archive/TWO_DB_MIGRATION.md](./archive/TWO_DB_MIGRATION.md).

---

## 1. Overview

| Database | Supabase project | Used by |
|----------|------------------|---------|
| **Staging** | `mwm-staging` (`cmzyxpxfyvdvbsykjvsg`) | Local dev (`.env.local`), Vercel **Preview** |
| **Production** | existing prod (`fnzvlmrqwcqwiqueevux`) | Vercel **Production**, manual prod smoke |

Code promotes via git → Vercel. **Data never promotes** between projects.

---

## 2. Production residents (exactly three auth users)

| Email | Role |
|-------|------|
| `david@gmail.com` | Real client |
| `avoels@comcast.net` | Superuser (MFA, manual-only) |
| `canary-consumer@mywealthmaps.com` | Synthetic consumer canary (E2E smoke) |

Prod cleanup keep-list is enforced in `scripts/cleanup-test-accounts.ts`. **Never run `cleanup:purge` against production.**

---

## 3. Environment files (local)

See [.env.projects.example](../.env.projects.example) for the map.

| File | Purpose |
|------|---------|
| `.env.projects.local` | Vault: `STAGING_*` + `PROD_*` Supabase creds |
| `.env.local` | Active dev (Next.js) — **staging** Supabase + Stripe test + app secrets |
| `.env.test` | Playwright staging suite — `@mywealthmaps.test` cast + household IDs |
| `.env.test.prod` | Prod canary smoke only — `canary-consumer@…` + prod Supabase |

Sync staging Supabase into `.env.local` after vault edits:

```bash
npm run env:sync-staging
```

**Never commit** gitignored env files. **`SUPABASE_DB_URL` never goes to Vercel or GitHub** (local scripts only).

Quote passwords in `.env.test.prod` if they contain `#` or `$` (escape `$` as `\$`).

---

## 4. E2E testing split

| Command | Target | Scope |
|---------|--------|-------|
| `npm run test:e2e:staging` | localhost + staging DB | Full multi-role suite |
| `npm run test:e2e:complete` | Same as staging (alias pattern) | Consumer + advisor + attorney + public |
| `npm run test:e2e:prod:smoke` | `mywealthmaps.com` + prod DB | **19 tests**, `@canary` tag only (consumer + public) |
| `npm run test:e2e:prod:billing` | Production | Consumer billing checkout only |

**Prod canary:** password in Vercel Production `E2E_CANARY_PASSWORD` and locally in `.env.test.prod` (`PLAYWRIGHT_CONSUMER_PASSWORD` or `E2E_CANARY_PASSWORD`). Reset data: `npm run seed:prod-canary -- --confirm` (manual, requires `--confirm`).

**Staging cast:** `npm run seed:e2e` (uses `.env.local` + `.env.test` → staging).

Details: [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) · [E2E_TEST_RESET.md](./E2E_TEST_RESET.md).

---

## 5. Purge / cleanup

| Command | Database | Notes |
|---------|----------|-------|
| `npm run cleanup:purge:dry-run` | Staging (via `.env.local`) | Default dry-run |
| `npm run cleanup:purge` | Staging | Wipe synthetic E2E; then `npm run seed:e2e` |
| `npm run cleanup:prod:dry-run` | Production | List-only; safe |
| `npm run cleanup:prod:execute` | Production | **Irreversible** — requires `--force --yes`; keep-list = 3 rows only |

Schema parity script (one-time / drift): `bash scripts/two-db-schema-parity.sh` (reads `.env.projects.local`).

---

## 6. Vercel environment scopes

| Variable | Preview | Production |
|----------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_*` | **Staging** project | **Prod** project |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging | Prod |
| Stripe keys | Test mode | Live mode |
| `E2E_CANARY_PASSWORD` | — | Prod canary login (not in git) |

---

## 7. GitHub Actions

| Workflow | Purpose |
|----------|---------|
| `ci.yml` → **`verify`** | Lint, build (placeholders), audits, unit tests — **no secrets** |
| `staging-keepalive.yml` | Ping staging Supabase every 3 days (prevents free-tier pause) |

**Optional next step:** restore E2E/RLS workflows from [docs/templates/github-workflows/](./templates/github-workflows/) using **staging-only** GitHub secrets (never production keys). See [ENVIRONMENT_TESTING.md](./ENVIRONMENT_TESTING.md).

Branch protection on `main`: require PR + **`verify`**.

---

## 8. Release discipline (summary)

| When | Command |
|------|---------|
| Before every PR | `npm run release:local` |
| Before merge (API/auth/billing/math) | `npm run release:preflight -- --workers=1` |
| After production deploy | `npm run release:post-deploy` |
| After production deploy (optional) | `npm run test:e2e:prod:smoke -- --workers=1` |

Full matrix: [ENVIRONMENT_TESTING.md § Release discipline](./ENVIRONMENT_TESTING.md#release-discipline--what-to-run-when).
