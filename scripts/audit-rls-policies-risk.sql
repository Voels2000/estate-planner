-- Pre-launch RLS risk flags (run after audit-rls-policies.sql export)
SELECT tablename, policyname, roles, cmd, qual,
  CASE
    WHEN qual IS NULL AND cmd IN ('INSERT', 'ALL') THEN 'insert_no_using'
    WHEN qual = 'true' OR qual LIKE '%(true)%' THEN 'permissive_true'
    WHEN qual ILIKE '%auth.uid() IS NOT NULL%' AND qual NOT ILIKE '%=%' THEN 'signed_in_only'
    ELSE 'ok'
  END AS risk_flag
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual = 'true'
    OR qual ILIKE '%(true)%'
    OR qual ILIKE '%auth.uid() is not null%'
    OR (qual IS NULL AND cmd NOT IN ('INSERT'))
  )
ORDER BY risk_flag, tablename, policyname;
