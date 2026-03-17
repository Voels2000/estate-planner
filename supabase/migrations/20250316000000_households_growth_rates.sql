-- Add growth rate assumptions to households (accumulation vs retirement phase)
ALTER TABLE households
  ADD COLUMN IF NOT EXISTS growth_rate_accumulation numeric DEFAULT 7,
  ADD COLUMN IF NOT EXISTS growth_rate_retirement numeric DEFAULT 5;

COMMENT ON COLUMN households.growth_rate_accumulation IS 'Expected annual portfolio growth % during accumulation (pre-retirement).';
COMMENT ON COLUMN households.growth_rate_retirement IS 'Expected annual portfolio growth % during retirement.';
