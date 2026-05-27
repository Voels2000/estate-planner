ALTER TABLE insurance_policies
ADD COLUMN IF NOT EXISTS cash_value_growth_rate numeric DEFAULT 0.0;

COMMENT ON COLUMN insurance_policies.cash_value_growth_rate IS
  'Annual growth rate for policy cash value accumulation. 0 = no growth (term/default).';
