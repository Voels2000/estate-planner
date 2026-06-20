-- assert-promotion-schema-hardfail.sql
-- Hard-fail when assert-promotion-schema.sql would return rows.
--
--   psql "$PROD_SUPABASE_DB_URL" -f scripts/assert-promotion-schema.sql
--   psql "$PROD_SUPABASE_DB_URL" -f scripts/assert-promotion-schema-hardfail.sql

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT 1
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'privacy_requests'
        AND column_name = 'appeal_due_at'
    )

    UNION ALL

    SELECT 1
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'privacy_requests'
        AND c.conname = 'privacy_requests_status_check'
        AND pg_get_constraintdef(c.oid) LIKE '%appealed%'
    )
  ) v;

  IF n > 0 THEN
    RAISE EXCEPTION 'assert-promotion-schema: % violation(s) — apply privacy appeals migrations on production before promoting #67+', n;
  END IF;
END $$;
