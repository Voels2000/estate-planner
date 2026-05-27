-- Run after 20260527150000_prelaunch_rls_household_scope.sql — expect zero rows
SELECT tablename, policyname, qual, with_check
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
ORDER BY tablename, policyname;
