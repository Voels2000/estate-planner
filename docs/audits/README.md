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

## New migrations

Use [supabase/MIGRATION_TEMPLATE.sql](../../supabase/MIGRATION_TEMPLATE.sql) — explicit `GRANT` + RLS block in every new table migration.
