-- Phase 3 MC signals — threshold probability, first tax year, longevity depletion

ALTER TABLE public.monte_carlo_results
  ADD COLUMN IF NOT EXISTS wa_threshold_prob_by_year jsonb,
  ADD COLUMN IF NOT EXISTS first_tax_year_p10 integer,
  ADD COLUMN IF NOT EXISTS longevity_depletion_pct integer,
  ADD COLUMN IF NOT EXISTS depletion_floor_amount numeric;

COMMENT ON COLUMN public.monte_carlo_results.wa_threshold_prob_by_year IS
  'Per-year estimated % of paths with gross estate above state exemption (from fan P10–P90 ladder). Shape: { year, age_p1, pct_above_threshold }[]. Null when no state exemption.';

COMMENT ON COLUMN public.monte_carlo_results.first_tax_year_p10 IS
  'First calendar year where P10 gross exceeds state exemption_amount from brackets.';

COMMENT ON COLUMN public.monte_carlo_results.longevity_depletion_pct IS
  'Estimated % of paths below depletion_floor_amount at death year (from final fan band).';

COMMENT ON COLUMN public.monte_carlo_results.depletion_floor_amount IS
  'Floor used for longevity_depletion_pct (MC_DEPLETION_FLOOR, typically 500000).';
