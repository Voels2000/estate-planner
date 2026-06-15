-- Sync WA state_estate_tax_rules with Regime D (ESB 6347, eff. 2026-07-01).
-- Keeps SQL RPC (calculate_estate_composition) aligned with Engine B waRegime.ts.

DELETE FROM public.state_estate_tax_rules
WHERE state = 'WA'
  AND tax_year >= 2025;

INSERT INTO public.state_estate_tax_rules (
  state,
  tax_year,
  min_amount,
  max_amount,
  rate_pct,
  exemption_amount,
  no_portability
)
SELECT
  'WA',
  y.tax_year,
  b.min_amount,
  b.max_amount,
  b.rate_pct,
  3000000,
  true
FROM (
  VALUES (2025), (2026), (2027), (2028), (2029), (2030)
) AS y(tax_year)
CROSS JOIN (
  VALUES
    (0::numeric, 1000000::numeric, 10::numeric),
    (1000000, 2000000, 14),
    (2000000, 3000000, 15),
    (3000000, 4000000, 16),
    (4000000, 6000000, 18),
    (6000000, 7000000, 19),
    (7000000, 9000000, 19.5),
    (9000000, 999999999999999, 20)
) AS b(min_amount, max_amount, rate_pct);
