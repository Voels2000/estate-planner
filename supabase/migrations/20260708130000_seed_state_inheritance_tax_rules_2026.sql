-- Seed state inheritance tax rules for tax year 2026.
-- Required by admin scan (MODELED_INHERITANCE_TAX_STATES) and estate-tax / domicile surfaces.
-- Rates align with lib/projection/stateRegistry.ts INHERITANCE_RATES (2026 law).
-- Iowa repealed inheritance tax effective Jan 1 2025 — all classes seeded at 0%.

DELETE FROM public.state_inheritance_tax_rules
WHERE tax_year = 2026;

INSERT INTO public.state_inheritance_tax_rules (
  state,
  tax_year,
  beneficiary_class,
  min_amount,
  max_amount,
  rate_pct,
  exemption_amount
)
VALUES
  -- Pennsylvania (spouses exempt; lineal heirs otherwise 4.5%)
  ('PA', 2026, 'spouse',  0, 999999999999999,  0,    0),
  ('PA', 2026, 'child',   0, 999999999999999,  4.5,  0),
  ('PA', 2026, 'sibling', 0, 999999999999999,  12,   0),
  ('PA', 2026, 'other',   0, 999999999999999,  15,   0),

  -- New Jersey (lineal heirs exempt since 2018)
  ('NJ', 2026, 'spouse',  0, 999999999999999,  0,    0),
  ('NJ', 2026, 'child',   0, 999999999999999,  0,    0),
  ('NJ', 2026, 'sibling', 0, 999999999999999,  11,   0),
  ('NJ', 2026, 'other',   0, 999999999999999,  15,   0),

  -- Kentucky (lineal heirs fully exempt)
  ('KY', 2026, 'spouse',  0, 999999999999999,  0,    0),
  ('KY', 2026, 'child',   0, 999999999999999,  0,    0),
  ('KY', 2026, 'sibling', 0, 999999999999999,  4,    0),
  ('KY', 2026, 'other',   0, 999999999999999,  6,    0),

  -- Nebraska
  ('NE', 2026, 'spouse',  0, 999999999999999,  1,    0),
  ('NE', 2026, 'child',   0, 999999999999999,  1,    0),
  ('NE', 2026, 'sibling', 0, 999999999999999,  13,   0),
  ('NE', 2026, 'other',   0, 999999999999999,  18,   0),

  -- Iowa (repealed 2025+)
  ('IA', 2026, 'spouse',  0, 999999999999999,  0,    0),
  ('IA', 2026, 'child',   0, 999999999999999,  0,    0),
  ('IA', 2026, 'sibling', 0, 999999999999999,  0,    0),
  ('IA', 2026, 'other',   0, 999999999999999,  0,    0),

  -- Maryland (also has separate estate tax)
  ('MD', 2026, 'spouse',  0, 999999999999999,  0,    0),
  ('MD', 2026, 'child',   0, 999999999999999,  0,    0),
  ('MD', 2026, 'sibling', 0, 999999999999999,  10,   0),
  ('MD', 2026, 'other',   0, 999999999999999,  10,   0);
