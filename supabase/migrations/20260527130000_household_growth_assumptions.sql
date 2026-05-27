-- Per-asset-class growth assumptions (RE + business); financial rates stay on legacy columns

ALTER TABLE households
ADD COLUMN IF NOT EXISTS growth_assumptions jsonb DEFAULT '{}'::jsonb;

UPDATE households
SET growth_assumptions = jsonb_build_object(
  'real_estate', 4.5,
  'business', 7.0
)
WHERE growth_assumptions = '{}'::jsonb OR growth_assumptions IS NULL;

COMMENT ON COLUMN households.growth_assumptions IS
  'Per-asset-class growth rate overrides. Keys: real_estate, business.
   Financial asset growth uses growth_rate_accumulation / growth_rate_retirement.
   Defaults: real_estate=4.5%, business=7.0%';
