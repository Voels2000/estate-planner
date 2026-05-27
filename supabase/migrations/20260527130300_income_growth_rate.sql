ALTER TABLE income
ADD COLUMN IF NOT EXISTS annual_growth_rate numeric DEFAULT 0.0;

COMMENT ON COLUMN income.annual_growth_rate IS
  'Annual compound growth for this income source from start_year. 0 = flat (default).';
