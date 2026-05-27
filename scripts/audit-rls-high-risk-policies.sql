-- Check actual policy definitions for pre-launch high-risk tables
SELECT
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'gst_ledger',
    'liquidity_analysis',
    'monte_carlo_results',
    'domicile_analysis',
    'strategy_configs'
  )
ORDER BY tablename, policyname;
