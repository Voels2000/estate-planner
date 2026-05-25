-- ============================================================
-- Sprint P-1: Performance Diagnostic Queries
-- Run ONE block at a time in Supabase SQL Editor (select only the
-- SELECT/EXPLAIN statement — do not run comment lines).
-- ============================================================

-- QUERY A: Slow query log — top 20 slowest queries by total time
-- Requires pg_stat_statements extension (skip if error).
SELECT
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2)  AS mean_ms,
  calls,
  round(stddev_exec_time::numeric, 2) AS stddev_ms,
  left(query, 120) AS query_preview
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- QUERY B: Index coverage on hot lookup columns
SELECT
  t.relname   AS table_name,
  a.attname   AS column_name,
  ix.relname  AS index_name,
  CASE WHEN ix.relname IS NULL THEN 'MISSING INDEX' ELSE 'indexed' END AS status
FROM pg_class t
JOIN pg_attribute a ON a.attrelid = t.oid
LEFT JOIN pg_index i ON i.indrelid = t.oid
  AND a.attnum = ANY(i.indkey)
LEFT JOIN pg_class ix ON ix.oid = i.indexrelid
WHERE t.relname IN (
  'households', 'estate_health_scores', 'beneficiary_conflicts',
  'notifications', 'income', 'liabilities', 'expenses',
  'assets', 'strategy_line_items', 'advisor_clients',
  'projection_scenarios', 'monte_carlo_runs'
)
AND a.attname IN (
  'owner_id', 'household_id', 'user_id', 'client_id',
  'advisor_id', 'read'
)
AND t.relkind = 'r'
ORDER BY
  CASE WHEN ix.relname IS NULL THEN 0 ELSE 1 END,
  t.relname,
  a.attname;

-- QUERY C: Table sizes — identify largest tables
SELECT
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size,
  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size,
  n_live_tup AS live_rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 15;

-- QUERY D0: Resolve test household id (run before D/E if needed)
SELECT h.id AS household_id, p.email
FROM households h
JOIN profiles p ON p.id = h.owner_id
WHERE p.email = 'e2e-consumer@mywealthmaps.test'
LIMIT 1;

-- QUERY D: EXPLAIN ANALYZE on calculate_estate_composition RPC
-- Uses e2e-consumer@mywealthmaps.test household automatically — no UUID paste required.
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM calculate_estate_composition(
  p_household_id := (
    SELECT h.id
    FROM households h
    JOIN profiles p ON p.id = h.owner_id
    WHERE p.email = 'e2e-consumer@mywealthmaps.test'
    LIMIT 1
  ),
  p_lifetime_gifts_used := 0
);

-- QUERY E: EXPLAIN ANALYZE on generate_estate_recommendations RPC
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM generate_estate_recommendations(
  p_household_id := (
    SELECT h.id
    FROM households h
    JOIN profiles p ON p.id = h.owner_id
    WHERE p.email = 'e2e-consumer@mywealthmaps.test'
    LIMIT 1
  )
);

-- QUERY F: Current indexes on households table specifically
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'households'
  AND schemaname = 'public'
ORDER BY indexname;

-- QUERY G: All indexes on assets and liabilities (verify Query B “MISSING” rows)
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('assets', 'liabilities')
ORDER BY tablename, indexname;
