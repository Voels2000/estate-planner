-- Recover staging Supabase after E2E / preflight overload
-- Run in Supabase Dashboard → SQL Editor (one block at a time).
-- Safe: targets only @mywealthmaps.test E2E households, not Voels/demo accounts.
--
-- Before running: stop local npm/playwright/next processes (see scripts/recover-staging-e2e-load.sh)

-- 0) Inspect active load (optional — cancel killers from Dashboard → Database if needed)
SELECT pid, state, wait_event_type, wait_event,
       now() - query_start AS running_for,
       left(query, 120) AS query_preview
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state <> 'idle'
ORDER BY query_start
LIMIT 20;

-- 1) Resolve E2E household ids
SELECT p.email, h.id AS household_id, h.owner_id
FROM profiles p
JOIN households h ON h.owner_id = p.id
WHERE p.email IN (
  'e2e-consumer@mywealthmaps.test',
  'e2e-advisor-client@mywealthmaps.test',
  'e2e-consumer-tier1@mywealthmaps.test',
  'e2e-golden-path@mywealthmaps.test'
)
ORDER BY p.email;

-- 2) Prune Playwright debris on consumer household (adjust UUID if seed output differs)
-- Consumer household from .env.test PLAYWRIGHT_HOUSEHOLD_ID:
-- 232f922c-9b66-40b4-acfb-c5734f0db4b2

DELETE FROM assets
WHERE owner_id = (SELECT id FROM profiles WHERE email = 'e2e-consumer@mywealthmaps.test')
  AND (
    name ILIKE 'Playwright%'
    OR name ILIKE 'Smoke Test%'
    OR name ILIKE 'E2E Brokerage%'
    OR name ILIKE 'E2E Traditional%'
  );

DELETE FROM household_people
WHERE household_id = '232f922c-9b66-40b4-acfb-c5734f0db4b2'
  AND full_name ILIKE 'Playwright%';

DELETE FROM strategy_line_items
WHERE household_id = '232f922c-9b66-40b4-acfb-c5734f0db4b2'
  AND scenario_name IN (
    'Playwright Test Plan', 'Playwright Upsert Test', 'Playwright Scenario A',
    'Playwright Scenario B', 'Playwright Keep', 'Playwright Remove',
    'Playwright Roth Test', 'Playwright Liquidity Test', 'Playwright Family',
    'Playwright Titling'
  );

DELETE FROM strategy_line_items
WHERE household_id = '232f922c-9b66-40b4-acfb-c5734f0db4b2'
  AND strategy_source IN ('daf', 'charitable')
  AND scenario_name = 'base';

-- 3) Clear heavy derived caches for E2E households (re-seed / recompute rebuilds)
DELETE FROM monte_carlo_results
WHERE scenario_id IN (
  SELECT base_case_scenario_id FROM households
  WHERE id IN (
    SELECT h.id FROM households h
    JOIN profiles p ON p.id = h.owner_id
    WHERE p.email LIKE '%@mywealthmaps.test'
  )
);

UPDATE households
SET projection_inputs_hash = NULL, updated_at = now()
WHERE id IN (
  SELECT h.id FROM households h
  JOIN profiles p ON p.id = h.owner_id
  WHERE p.email LIKE '%@mywealthmaps.test'
);

-- 4) Row counts sanity check
SELECT relname AS table_name, n_live_tup AS approx_rows
FROM pg_stat_user_tables
WHERE relname IN (
  'assets', 'strategy_line_items', 'monte_carlo_results',
  'estate_health_scores', 'beneficiary_conflicts', 'household_alerts'
)
ORDER BY n_live_tup DESC;
