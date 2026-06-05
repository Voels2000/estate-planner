-- Step 1: Dedupe — keep newest row per scenario_id
DELETE FROM public.monte_carlo_results a
USING public.monte_carlo_results b
WHERE a.scenario_id = b.scenario_id
  AND a.scenario_id IS NOT NULL
  AND a.created_at < b.created_at;

-- Step 2: New columns
ALTER TABLE public.monte_carlo_results
  ADD COLUMN IF NOT EXISTS percentiles_by_year jsonb,
  ADD COLUMN IF NOT EXISTS assumption_hash text,
  ADD COLUMN IF NOT EXISTS mc_calculated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS engine_version text DEFAULT 'engine-b-v1';

-- Step 3: Unique index on scenario_id (required for PostgREST upsert onConflict)
-- Non-partial: PostgreSQL allows multiple NULL scenario_id rows; one row per non-null id.
CREATE UNIQUE INDEX IF NOT EXISTS monte_carlo_results_scenario_id_key
  ON public.monte_carlo_results (scenario_id);

-- Step 4: Loader index
CREATE INDEX IF NOT EXISTS monte_carlo_results_scenario_id_created_at_idx
  ON public.monte_carlo_results (scenario_id, created_at DESC);

-- Step 5: Column comments
COMMENT ON COLUMN public.monte_carlo_results.percentiles_by_year IS
  'Per-year P10/P25/P50/P75/P90 gross estate + P10/P50/P90 net to heirs.
   Derived from fan_chart_data using engine B tax per percentile per year.
   Shape: { year, age_p1, p10_gross, p25_gross, p50_gross, p75_gross,
            p90_gross, p10_net, p50_net, p90_net }[]';

COMMENT ON COLUMN public.monte_carlo_results.assumption_hash IS
  'SHA-256 of simulation inputs snapshot. Reserved for v2 staleness check.
   Not used for skip logic in v1 — always rerun after generateBaseCase.';

COMMENT ON COLUMN public.monte_carlo_results.engine_version IS
  'MC engine version tag. engine-b-v1 = engine B state tax per path.';
