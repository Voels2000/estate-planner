ALTER TABLE advisor_projection_assumptions
ADD COLUMN IF NOT EXISTS real_estate_growth_pct numeric,
ADD COLUMN IF NOT EXISTS business_growth_pct numeric;

COMMENT ON COLUMN advisor_projection_assumptions.real_estate_growth_pct IS
  'Advisor override for real estate appreciation rate. Null = use household default.';

COMMENT ON COLUMN advisor_projection_assumptions.business_growth_pct IS
  'Advisor override for business interest growth rate. Null = use household default.';
