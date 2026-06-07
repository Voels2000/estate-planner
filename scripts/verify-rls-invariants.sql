-- Post-migration RLS invariants — each row returned is a FAILURE (expect zero rows).
-- Used by: npm run verify:rls (lib/verify/runRlsVerification.ts)

-- 1. Public base tables without RLS enabled
SELECT 'rls_disabled' AS check_id, t.table_name AS detail
FROM information_schema.tables t
JOIN pg_class c
  ON c.relname = t.table_name
  AND c.relnamespace = 'public'::regnamespace
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND NOT c.relrowsecurity

UNION ALL

-- 2. Public base tables missing authenticated grant (PostgREST)
SELECT 'missing_authenticated_grant' AS check_id, t.table_name AS detail
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public'
      AND g.table_name = t.table_name
      AND g.grantee = 'authenticated'
  )

UNION ALL

-- 3. Loose household policies (post 20260527150000_prelaunch_rls_household_scope)
SELECT 'loose_household_policy' AS check_id, tablename || ': ' || policyname AS detail
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'gst_ledger', 'liquidity_analysis', 'monte_carlo_results',
    'domicile_schedule', 'domicile_analysis', 'strategy_configs'
  )
  AND (
    qual LIKE '%(auth.uid() IS NOT NULL)%'
    OR with_check LIKE '%(auth.uid() IS NOT NULL)%'
  )

UNION ALL

-- 4. Household-scoped PII tables must not use permissive USING (true)
SELECT 'permissive_pii_policy' AS check_id, tablename || ': ' || policyname AS detail
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'households', 'assets', 'liabilities', 'businesses', 'real_estate',
    'insurance', 'profiles', 'legal_documents', 'monte_carlo_results',
    'monte_carlo_runs', 'gst_ledger', 'liquidity_analysis',
    'domicile_analysis', 'domicile_schedule', 'strategy_configs',
    'scenario_outputs', 'advisor_strategy_line_items'
  )
  AND (qual = 'true' OR qual LIKE '%(true)%')
  AND cmd IN ('SELECT', 'ALL', 'INSERT', 'UPDATE', 'DELETE')

UNION ALL

-- 5. Household-scoped tables with RLS on but zero policies (blocks all non-service access)
SELECT 'household_table_no_policies' AS check_id, c.relname AS detail
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND c.relname IN (
    'households', 'assets', 'liabilities', 'businesses', 'real_estate',
    'insurance', 'monte_carlo_results', 'monte_carlo_runs'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = c.relname
  )

ORDER BY check_id, detail;
