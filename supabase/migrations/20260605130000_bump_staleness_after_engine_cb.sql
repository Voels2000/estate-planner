-- Post engine C→B deploy: mark existing base cases stale so they regenerate with engine B death-year taxes.
--
-- The projection engine change does not touch households.updated_at.
-- Staleness (lib/projections/staleness.ts) compares latest input change vs projection_scenarios.calculated_at.
-- Bumping updated_at ensures dashboard, my-estate-strategy, and advisor client pages run
-- generateBaseCase in the background on the next visit.

UPDATE households
SET updated_at = NOW()
WHERE base_case_scenario_id IS NOT NULL;
