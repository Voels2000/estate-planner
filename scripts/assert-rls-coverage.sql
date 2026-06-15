-- assert-rls-coverage.sql
-- Structural RLS gate: missing policies + over-permissive policies on tenant-scoped tables.
-- Used by: npm run verify:rls (lib/verify/runRlsVerification.ts) — assert zero blocking rows.
--
-- Blocking violations: MISSING_RLS, NO_POLICY, PERMISSIVE_POLICY, NAME_ROLE_MISMATCH
--
-- Scope: any public table with household_id, user_id, owner_id, advisor_id, attorney_id, client_id.
-- Allowlist: reference tables intentionally world-readable (permissive check exempt only).
--
-- For psql hard-fail (DO block): scripts/assert-rls-coverage-hardfail.sql

WITH
allowlist(table_name) AS (
  VALUES
    ('state_estate_tax_content'),
    ('state_estate_tax_rules')
),
tenancy_cols(col) AS (
  VALUES ('household_id'), ('user_id'), ('owner_id'),
         ('advisor_id'), ('attorney_id'), ('client_id')
),
scoped AS (
  SELECT DISTINCT c.relname AS table_name, c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND a.attname IN (SELECT col FROM tenancy_cols)
),
pol AS (
  SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
)
SELECT * FROM (
  SELECT s.table_name, 'MISSING_RLS' AS violation, NULL::name AS policyname, NULL::text AS detail
  FROM scoped s
  WHERE s.rls_enabled = false

  UNION ALL

  SELECT s.table_name, 'NO_POLICY', NULL, NULL
  FROM scoped s
  WHERE NOT EXISTS (SELECT 1 FROM pol p WHERE p.tablename = s.table_name)

  UNION ALL

  SELECT s.table_name, 'PERMISSIVE_POLICY', p.policyname,
         format('cmd=%s roles=%s using=%s check=%s',
                p.cmd, p.roles, coalesce(p.qual, '-'), coalesce(p.with_check, '-'))
  FROM scoped s
  JOIN pol p ON p.tablename = s.table_name
  WHERE s.table_name NOT IN (SELECT table_name FROM allowlist)
    AND p.permissive = 'PERMISSIVE'
    AND (
          coalesce(p.qual, '')       ~* '^\(?\s*true\s*\)?$'
       OR coalesce(p.with_check, '') ~* '^\(?\s*true\s*\)?$'
        )
    AND (p.roles && ARRAY['public', 'anon', 'authenticated']::name[])

  UNION ALL

  SELECT s.table_name, 'NAME_ROLE_MISMATCH', p.policyname,
         format('roles=%s (name implies service_role-only)', p.roles)
  FROM scoped s
  JOIN pol p ON p.tablename = s.table_name
  WHERE p.policyname ~* 'service[ _]?role'
    AND p.roles <> ARRAY['service_role']::name[]
) v
ORDER BY table_name, violation;
