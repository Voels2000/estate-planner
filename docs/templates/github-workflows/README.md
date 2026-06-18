# GitHub workflow templates (not active)

**Policy:** While production shares one Supabase project, **only** `.github/workflows/ci.yml` runs in GitHub Actions. No repository secrets.

These YAML files are **archived templates** for a future **dedicated staging Supabase** project. Do not copy back to `.github/workflows/` until:

1. Staging Supabase is live, migrated, and seeded (`npm run seed:e2e`).
2. Vercel Preview uses staging keys; Vercel Production uses production keys only.
3. Staging-only secrets are in GitHub (never production keys, never `SUPABASE_DB_URL`).

Then restore desired workflows, set `E2E_SMOKE_IN_CI` / `RLS_VERIFY_IN_CI` to `true`, and add branch protection checks.

| Template | Purpose |
|----------|---------|
| `e2e-smoke.yml` | Playwright go-live-profile + security-smoke + B4 gate + cross-household isolation on localhost + staging DB |
| `rls-verify.yml` | JWT RLS isolation on staging |
| `ux-language-audit.yml` | Path-filtered UX audit (redundant — `ci.yml` already runs this) |
| `cron-notifications.yml` | Manual cron trigger (redundant — Vercel cron handles schedule) |

See [ENVIRONMENT_TESTING.md](../../ENVIRONMENT_TESTING.md).
