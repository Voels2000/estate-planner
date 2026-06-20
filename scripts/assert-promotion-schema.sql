-- assert-promotion-schema.sql
-- Structural promotion gate: required production schema before staging→main when
-- policy-alignment stack (#67+) is included. Used by npm run verify:promotion-schema.
--
-- Returns one row per violation; zero rows = pass.
-- For psql hard-fail: scripts/assert-promotion-schema-hardfail.sql

-- Privacy appeals (B6 / #67) — migrations 20260720120000 + 20260721120000
SELECT
  'privacy_appeals' AS gate,
  'MISSING_APPEAL_DUE_AT' AS violation,
  'public.privacy_requests.appeal_due_at column absent' AS detail
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'privacy_requests'
    AND column_name = 'appeal_due_at'
)

UNION ALL

SELECT
  'privacy_appeals',
  'MISSING_APPEALED_STATUS',
  'privacy_requests_status_check does not admit status appealed'
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'privacy_requests'
    AND c.conname = 'privacy_requests_status_check'
    AND pg_get_constraintdef(c.oid) LIKE '%appealed%'
);
