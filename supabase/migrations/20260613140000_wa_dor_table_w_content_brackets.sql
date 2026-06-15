-- Align state_estate_tax_content WA brackets with DOR Table W (July 1, 2026+):
-- split $6M–$9M into 19% ($6–7M) and 19.5% ($7–9M); $9M+ base tax $1,490,000.

UPDATE public.state_estate_tax_content
SET
  brackets = '[
    {"min": 0, "max": 1000000, "rate_pct": 10, "base_tax": 0},
    {"min": 1000000, "max": 2000000, "rate_pct": 14, "base_tax": 100000},
    {"min": 2000000, "max": 3000000, "rate_pct": 15, "base_tax": 240000},
    {"min": 3000000, "max": 4000000, "rate_pct": 16, "base_tax": 390000},
    {"min": 4000000, "max": 6000000, "rate_pct": 18, "base_tax": 550000},
    {"min": 6000000, "max": 7000000, "rate_pct": 19, "base_tax": 910000},
    {"min": 7000000, "max": 9000000, "rate_pct": 19.5, "base_tax": 1100000},
    {"min": 9000000, "max": null, "rate_pct": 20, "base_tax": 1490000}
  ]'::jsonb,
  last_reviewed = '2026-06-15',
  review_notes = 'DOR Table W (eff. 2026-07-01): 19.5% band $7M–$9M taxable'
WHERE state_code = 'WA';
