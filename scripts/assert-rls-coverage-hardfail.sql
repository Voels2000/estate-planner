-- assert-rls-coverage-hardfail.sql
-- Run after assert-rls-coverage.sql diagnostic SELECT in psql.
-- Hard-fails on all assert-rls-coverage.sql violations (including NAME_ROLE_MISMATCH).
--
--   psql "$SUPABASE_DB_URL" -f scripts/assert-rls-coverage.sql
--   psql "$SUPABASE_DB_URL" -f scripts/assert-rls-coverage-hardfail.sql

DO $$
DECLARE
  n int;
BEGIN
  WITH
  tenancy_cols(col) AS (
    VALUES ('household_id'), ('user_id'), ('owner_id'), ('advisor_id'), ('attorney_id'), ('client_id')
  ),
  allowlist(table_name) AS (
    VALUES ('state_estate_tax_content'), ('state_estate_tax_rules')
  ),
  scoped AS (
    SELECT DISTINCT c.relname AS table_name, c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    WHERE nsp.nspname = 'public' AND c.relkind = 'r' AND a.attname IN (SELECT col FROM tenancy_cols)
  ),
  pol AS (SELECT * FROM pg_policies WHERE schemaname = 'public')
  SELECT count(*) INTO n FROM (
    SELECT s.table_name FROM scoped s WHERE s.rls_enabled = false
    UNION ALL
    SELECT s.table_name FROM scoped s WHERE NOT EXISTS (SELECT 1 FROM pol p WHERE p.tablename = s.table_name)
    UNION ALL
    SELECT s.table_name
    FROM scoped s JOIN pol p ON p.tablename = s.table_name
    WHERE s.table_name NOT IN (SELECT table_name FROM allowlist)
      AND p.permissive = 'PERMISSIVE'
      AND (coalesce(p.qual, '') ~* '^\(?\s*true\s*\)?$' OR coalesce(p.with_check, '') ~* '^\(?\s*true\s*\)?$')
      AND (p.roles && ARRAY['public', 'anon', 'authenticated']::name[])
    UNION ALL
    SELECT s.table_name
    FROM scoped s JOIN pol p ON p.tablename = s.table_name
    WHERE p.policyname ~* 'service[ _]?role'
      AND p.roles <> ARRAY['service_role']::name[]
  ) blocking;

  IF n > 0 THEN
    RAISE EXCEPTION 'RLS coverage gate FAILED: % blocking violation(s). Run scripts/assert-rls-coverage.sql diagnostic SELECT.', n;
  END IF;
END $$;
