# Deployment — two-database steady state

**Effective:** 2026-06-13 (two-DB migration complete). Archived runbook: [docs/archive/TWO_DB_MIGRATION.md](./archive/TWO_DB_MIGRATION.md). **Staging Vercel project (Move 1):** [STAGING_PROJECT_RUNBOOK.md](./STAGING_PROJECT_RUNBOOK.md).

---

## 1. Overview

| Database | Supabase project | Used by |
|----------|------------------|---------|
| **Staging** | `mwm-staging` (`cmzyxpxfyvdvbsykjvsg`) | Local dev (`.env.local`), Vercel **`estate-planner-staging`** (branch `staging`), CI E2E/RLS |
| **Production** | existing prod (`fnzvlmrqwcqwiqueevux`) | Vercel **`estate-planner`** Production (`main`), manual prod smoke |

Code promotes via git → Vercel. **Data never promotes** between projects.

**Pipeline notification routing:** [NOTIFICATION_HYGIENE.md](./NOTIFICATION_HYGIENE.md) — failures notify, successes don't; dashboard toggles for GitHub / Vercel / Sentry (no workflow YAML changes needed today).

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
bash scripts/sync-env-from-projects.sh staging
```

**Never commit** gitignored env files. **`SUPABASE_DB_URL` never goes to Vercel or production GitHub secrets** — staging session pooler URI only, in GitHub for `rls-verify` CI (see §7).

Quote passwords in `.env.test.prod` if they contain `#` or `$` (escape `$` as `\$`).

---

## 4. E2E testing split

| Command | Target | Scope |
|---------|--------|-------|
| `npm run test:e2e:complete` | localhost + staging DB | Full multi-role suite |
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
| `bash scripts/run-cleanup-prod.sh --purge-unprotected` | Production | List-only dry-run; loads `PROD_*` from `.env.projects.local` |
| `bash scripts/run-cleanup-prod.sh --purge-unprotected --yes --force` | Production | **Irreversible** — keep-list enforced; use only if intentional |

Schema parity script (emergency full schema clone): `bash scripts/two-db-schema-parity.sh` (reads `.env.projects.local`). **Ongoing schema updates use `db push` on staging** — see [§9](#9-refreshing--maintaining-staging).

> **Note:** Bash helpers above are candidates for `npm run` wrappers later so docs and runnable commands cannot drift.

---

## 6. Vercel environment scopes

| Variable | Preview | Production |
|----------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Staging (`cmzyxpxfyvdvbsykjvsg`) | Prod (`fnzvlmrqwcqwiqueevux`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging — legacy `eyJ…` or `sb_publishable_…` | Prod — same dual formats accepted by verifier |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging — `eyJ…` or `sb_secret_…` | Prod |
| Stripe keys | Test mode (`sk_test_` / `pk_test_`) — **same sandbox as all 11 `STRIPE_PRICE_*`** | Live mode (`sk_live_` / `pk_live_`) |

After staging Stripe re-key: redeploy `estate-planner-staging`, then `npm run reset:staging-stripe` — [STAGING_PROJECT_RUNBOOK.md](./STAGING_PROJECT_RUNBOOK.md).
| `E2E_CANARY_PASSWORD` | — | Prod canary login for `canary-consumer@mywealthmaps.com` (not in git) |
| `ADMIN_VERIFY_TOKEN` | Optional (Preview smoke) | Gate-2 env audit (`/api/admin/verify-env`) |

Verifier shape rules: `lib/env/manifest.ts` (`SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE` regexes). Dead vars intentionally **out** of manifest until deleted from dashboard (`STRIPE_CUSTOMER_PORTAL_URL`, `RESEND_WEBHOOK_SECRET`) — flagged as REVIEW/unknown when present.

---

## 7. GitHub Actions

| Workflow | Job / check name | Triggers | What it runs |
|----------|------------------|----------|--------------|
| `ci.yml` → **`verify`** | PR → `main`, `staging`; push → `main` | ESLint · **`npx tsc --noEmit`** · unit tests on all PRs; full build + audits on PR → `main` only — **no secrets** |
| `e2e-smoke.yml` → **`e2e-smoke`** | PR → `main` | Localhost + **staging** Supabase (gated: `E2E_SMOKE_IN_CI=true`) |
| `rls-verify.yml` → **`rls-verify`** | PR → `main` | `npm run verify:rls -- --require-sql` — JWT + **`assert-rls-coverage.sql`** (gated: `RLS_VERIFY_IN_CI=true`) |
| `staging-keepalive.yml` | Cron | Ping staging Supabase every 3 days |

**GitHub secrets (staging only):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, **`SUPABASE_DB_URL`** (staging session pooler — `cmzyxpxfyvdvbsykjvsg` only), `PLAYWRIGHT_HOUSEHOLD_ID`, `PLAYWRIGHT_CONSUMER_EMAIL`, `PLAYWRIGHT_CONSUMER_PASSWORD`, `PLAYWRIGHT_ADVISOR_EMAIL`, `PLAYWRIGHT_ADVISOR_PASSWORD`. Never production keys. See [ENVIRONMENT_TESTING.md](./ENVIRONMENT_TESTING.md).

**Branch protection**

| Branch | Ruleset | Required checks |
|--------|---------|-----------------|
| **`main`** | **`main-no-direct-push`** | PR required · **`verify`** + **`e2e-smoke`** + **`rls-verify`** · strict up-to-date · no force-push |
| **`staging`** | **`staging-pr-gate`** | PR required · **`verify`** (lint + tsc + unit) · strict up-to-date · no force-push |

Direct pushes blocked on both. Admin enforcement on `main`. Required approvals **0** (solo). Enabled **2026-06-15** (`main`), **2026-06-17** (`staging`).

### Git branch flow (2026-06-17)

```text
feature/* ──PR (verify: lint+tsc+unit)──► staging ──PR (verify+e2e-smoke+rls-verify)──► main
                                              │                                              │
                                              ▼                                              ▼
                              estate-planner-staging.vercel.app              www.mywealthmaps.com
```

**Promotion checklist:** [PROMOTION_STAGING_TO_MAIN.md](./PROMOTION_STAGING_TO_MAIN.md) — use for staging→`main` PRs that ship migrations or fail-closed auth (#28–#38 batch).

After merging CI changes to `main`, merge **`main` → `staging`** so branch workflows stay in sync — avoids “branch out of date” on the next staging → main PR.

**Vercel cron secrets (2026-06-17):** `CRON_SECRET` and `INTERNAL_API_KEY` are **load-bearing** — auth is fail-closed (missing secret → 500). Set on **both** `estate-planner` (prod) and **`estate-planner-staging`** Production scopes before relying on crons. Manifest: `lib/env/manifest.ts` (`requiredInScopes: ALL_DEPLOYED`).

---

## 8. Release discipline (summary)

| When | Command |
|------|---------|
| Before every PR | `npm run release:local` |
| Before merge (API/auth/billing/math) | `npm run release:preflight -- --workers=1` |
| After production deploy | `npm run release:post-deploy` |
| After production deploy (optional) | `npm run test:e2e:prod:smoke -- --workers=1` |
| **Staging → main promotion** (accumulated batch) | [PROMOTION_STAGING_TO_MAIN.md](./PROMOTION_STAGING_TO_MAIN.md) — prod secrets pre-check, pending migrations, passive log smoke + checkout **block paths** only (defer live Stripe charge to real-card test) |

Full matrix: [ENVIRONMENT_TESTING.md § Release discipline](./ENVIRONMENT_TESTING.md#release-discipline--what-to-run-when).

---

## 9. Refreshing / maintaining staging

Staging (`cmzyxpxfyvdvbsykjvsg`) is disposable test infrastructure — not a copy of prod user data. Two things must stay aligned with production or CI will pass against a database your users do not have:

1. **Schema** — migrations applied through the same repo as prod
2. **Reference data** — admin-managed tax tables and similar lookup rows (not user households)

### When to run this

| Trigger | Action |
|---------|--------|
| New migration in `supabase/migrations/` | `db push` to **both** prod and staging (see below) |
| Fresh staging project or `two-db-schema-parity.sh` rebuild | Full checklist below |
| After `cleanup:purge` on staging | Re-seed E2E cast + refresh `PLAYWRIGHT_HOUSEHOLD_ID` |
| Admin tax rollover on prod | Re-copy reference data to staging (or repeat rollover on staging) |

### 1. Apply migrations (ongoing — prevents schema drift)

**Migration gate (per environment) — mandatory for every `supabase/migrations/*.sql` PR**

Vercel deploy does **not** run migrations. Staging and production are **separate** Supabase projects. A migration and the code that depends on it are a **pair in each environment**: apply the schema change **just before** the deploy that needs it — **in that environment only**. Do not apply production migrations while the code is still staging-only (schema-ahead-of-code breaks the next rename/drop/NOT NULL migration and is the wrong habit even for additive columns).

#### Staging (`staging` branch → Vercel Preview)

| Step | Action |
|------|--------|
| 1 | Apply migration on **staging** (`cmzyxpxfyvdvbsykjvsg`) |
| 2 | Verify (dashboard, `information_schema`, or `supabase migration list` when history is healthy) |
| 3 | Merge PR to `staging` → deploy |

```bash
bash scripts/apply-migration.sh staging supabase/migrations/<timestamp>_name.sql
```

#### Production (`main` branch → Vercel Production)

| Step | Action |
|------|--------|
| 1 | Open **staging → `main`** promotion PR; list **pending production migrations** in the PR body |
| 2 | Apply pending migrations on **production** (`fnzvlmrqwcqwiqueevux`) |
| 3 | **`npm run release:promotion`** — structural schema gate (fail closed) |
| 4 | Merge to `main` |
| 5 | Verify on production |
| 6 | Production deploy (or confirm Vercel auto-deploy completed after step 3) |

```bash
bash scripts/apply-migration.sh production supabase/migrations/<timestamp>_name.sql
```

**Do not skip production** — staging apply alone does nothing on prod. **Do not apply production early** — wait until promotion.

#### Verify nothing was missed

When migration history is healthy:

```bash
npx supabase migration list --project-ref cmzyxpxfyvdvbsykjvsg   # staging
npx supabase migration list --project-ref fnzvlmrqwcqwiqueevux   # production
```

Run against production immediately before and after the prod apply; the diff is your proof.

#### Destructive migrations (drop / rename / NOT NULL)

Additive nullable columns (most PRs): schema-then-code in each env, as above. Destructive changes use **expand → migrate → contract** (often two releases): ship code that no longer depends on the old shape first, then migrate. Same per-environment rule; different order inside the pair.

#### Checklists and follow-ups

- **PR to `staging`:** [UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md) → staging migration boxes
- **PR to `main`:** note pending prod migration in description; clear after apply
- **Structural fix (follow-up):** wire migration apply into deploy pipeline so “missed migration” is not human-dependent — see [DECISION_LOG.md](./DECISION_LOG.md) when scheduled

**History note:** Staging was created via schema clone (`two-db-schema-parity.sh`) without full `supabase_migrations` history — full `db push` may fail until history is repaired. Use `apply-migration.sh` / `psql -f` for additive `IF NOT EXISTS` migrations. When history is healthy:

```bash
npx supabase db push --project-ref cmzyxpxfyvdvbsykjvsg   # staging only, at staging promote time
npx supabase db push --project-ref fnzvlmrqwcqwiqueevux   # production only, at main promote time
```
If a migration changes the Monte Carlo edge function, redeploy on staging too:

```bash
supabase functions deploy estate-monte-carlo --project-ref cmzyxpxfyvdvbsykjvsg
```

Verify RLS after policy migrations: `npm run verify:rls` (uses `.env.local` → staging). Expect **27/27** after `20260713130000`–`20260713150000` (structural `assert-rls-coverage` + full household JWT matrix). Apply those three migrations on prod before deploy that relies on fixed policies.

### 2. Seed reference data from prod

Migrations seed **2026 anchor rows**; production may also have admin rollover years (e.g. 2027 estate/IRMAA). Staging does not inherit this automatically. Copy the full reference set from prod so projections and tax engines match.

**Tables** (truncate staging, then load from prod):

- `federal_tax_brackets`
- `federal_estate_tax_brackets`
- `federal_tax_config`
- `state_income_tax_brackets`
- `state_estate_tax_rules`
- `state_inheritance_tax_rules`
- `irmaa_brackets`

```bash
# Requires PROD_SUPABASE_DB_URL + STAGING_SUPABASE_DB_URL in .env.projects.local
eval "$(bash scripts/load-env-projects.sh)"

DUMP="/tmp/mwm_prod_tax_reference.sql"
pg_dump "$PROD_SUPABASE_DB_URL" --data-only --no-owner --no-privileges \
  -t public.federal_tax_brackets \
  -t public.federal_estate_tax_brackets \
  -t public.federal_tax_config \
  -t public.state_income_tax_brackets \
  -t public.state_estate_tax_rules \
  -t public.state_inheritance_tax_rules \
  -t public.irmaa_brackets \
  -f "$DUMP"

psql "$STAGING_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "
  TRUNCATE TABLE
    federal_tax_brackets,
    federal_estate_tax_brackets,
    federal_tax_config,
    state_income_tax_brackets,
    state_estate_tax_rules,
    state_inheritance_tax_rules,
    irmaa_brackets
  RESTART IDENTITY CASCADE;"

psql "$STAGING_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$DUMP"
```

**Projection horizon:** the engine carry-forwards the latest `tax_year ≤ projection year` — you do not need per-year rows through 2050. Matching prod's reference set is sufficient (verified 2026-06-14 when empty staging caused CI failure on year 2037).

**Verify after copy:**

```bash
bash scripts/sync-env-from-projects.sh staging
npm run verify:tax-coverage   # expects PASS for current calendar year
```

### 3. Re-seed E2E cast and refresh household ID

Synthetic users and households live only on staging. After purge, fresh project, or any re-seed:

```bash
bash scripts/sync-env-from-projects.sh staging   # .env.local → staging
npm run seed:e2e                                 # prints PLAYWRIGHT_HOUSEHOLD_ID
```

Then update **both**:

| Location | Variable |
|----------|----------|
| `.env.test` | `PLAYWRIGHT_HOUSEHOLD_ID` (and `PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID` if printed) |
| GitHub repository secret | `PLAYWRIGHT_HOUSEHOLD_ID` — `gh secret set PLAYWRIGHT_HOUSEHOLD_ID` |

Stale household IDs cause CI auth passes but projection/household tests fail with "household not found". Re-copy after every `seed:e2e`.

### Full staging refresh checklist

Use after creating a new staging project or major rebuild:

1. `bash scripts/two-db-schema-parity.sh` (or `db push` if migrations history is healthy)
2. `npx supabase db push --project-ref cmzyxpxfyvdvbsykjvsg`
3. Reference data copy (§9 step 2 above)
4. `supabase functions deploy estate-monte-carlo --project-ref cmzyxpxfyvdvbsykjvsg`
5. `npm run seed:e2e` → update `.env.test` + GitHub `PLAYWRIGHT_HOUSEHOLD_ID`
6. Smoke: `npm run test:e2e:go-live-profile -- --workers=1` locally, or re-run `e2e-smoke` workflow on a PR
