# Database security audits (pre-launch)

Re-runnable SQL lives under `scripts/`. CSV exports are point-in-time baselines for prod (`estate-planner-prod`).

## Table grants + RLS enabled

```bash
npx supabase db query --linked --agent=no -o csv -f scripts/audit-table-grants-rls.sql > docs/audits/table-grants-rls-$(date +%Y-%m-%d).csv
```

**Baseline (2026-05-27):** [table-grants-rls-2026-05-27.csv](./table-grants-rls-2026-05-27.csv) — 119 public tables; all have `authenticated`, `service_role`, and `anon` grants; all have RLS enabled. **No grant fix migration required.**

Answers: “Can PostgREST roles touch this table at all?”

## RLS policies (data isolation)

```bash
npx supabase db query --linked --agent=no -o csv -f scripts/audit-rls-policies.sql > docs/audits/rls-policies-$(date +%Y-%m-%d).csv
npx supabase db query --linked --agent=no -o csv -f scripts/audit-rls-policies-risk.sql > docs/audits/rls-policies-risk-$(date +%Y-%m-%d).csv
```

**Baseline (2026-05-27):**

- [rls-policies-2026-05-27.csv](./rls-policies-2026-05-27.csv) — full policy export
- [rls-policies-risk-2026-05-27.csv](./rls-policies-risk-2026-05-27.csv) — flagged `permissive_true` (expected on ref/tax/config tables) and `signed_in_only` (review before launch — e.g. `domicile_schedule`, `strategy_configs` advisor policies)

Answers: “Which rows can each role see?” Separate from grants; review household-scoped policies and avoid `USING (true)` on PII tables.

**Pre-launch fix (migration `20260527150000_prelaunch_rls_household_scope.sql`):** household-scoped policies on `gst_ledger`, `liquidity_analysis`, `monte_carlo_results`, `domicile_schedule`, `domicile_analysis` (advisor SELECT), `strategy_configs` (drop loose advisor policies). **Prod status (2026-05-27):** applied; `scripts/verify-loose-rls-policies.sql` → zero rows. Post-fix baseline: [rls-policies-post-fix-2026-05-27.csv](./rls-policies-post-fix-2026-05-27.csv). App: deploy `7cab1be` for GST API route.

Re-export after future policy changes:

```bash
npx supabase db query --linked --agent=no -o csv -f scripts/audit-rls-high-risk-policies.sql > docs/audits/rls-policies-post-fix-$(date +%Y-%m-%d).csv
```

## Automated post-migration verify (L3)

After `supabase db push` or applying RLS migrations on staging/production:

```bash
# Full SQL + JWT isolation (requires Session pooler URI)
SUPABASE_DB_URL=postgresql://... npm run verify:rls -- --require-sql

# JWT isolation only (no direct Postgres)
npm run verify:rls
```

**CI:** Local `verify:rls` + post-deploy `--require-sql` only (never GitHub). Future template: `docs/templates/github-workflows/rls-verify.yml`. See [ENVIRONMENT_TESTING.md](./ENVIRONMENT_TESTING.md).

**SQL invariants:** `scripts/verify-rls-invariants.sql` — expect **zero rows** (same loose-policy tables as `verify-loose-rls-policies.sql`).

## New migrations

Use [supabase/MIGRATION_TEMPLATE.sql](../../supabase/MIGRATION_TEMPLATE.sql) — explicit `GRANT` + RLS block in every new table migration.
