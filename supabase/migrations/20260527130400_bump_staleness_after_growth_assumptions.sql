-- Post ENG-2 deploy: mark existing base cases stale so they regenerate with new growth rates.
--
-- The growth_assumptions backfill migration does not touch households.updated_at.
-- Staleness (lib/projections/staleness.ts) compares latest input change vs projection_scenarios.calculated_at.
-- Bumping updated_at ensures dashboard, my-estate-strategy, and advisor client pages run
-- generateBaseCase in the background on the next visit.

UPDATE households
SET updated_at = NOW()
WHERE base_case_scenario_id IS NOT NULL;
