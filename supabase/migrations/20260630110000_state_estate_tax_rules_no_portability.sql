-- Dashboard tax snapshot: expose state portability flag alongside exemption_amount.
ALTER TABLE state_estate_tax_rules
  ADD COLUMN IF NOT EXISTS no_portability boolean NOT NULL DEFAULT false;

UPDATE state_estate_tax_rules
SET no_portability = true
WHERE state IN ('WA', 'MA', 'OR');

-- WA estate tax exemption increased to $3M (2025+); keep historical years intact.
UPDATE state_estate_tax_rules
SET exemption_amount = 3000000
WHERE state = 'WA'
  AND tax_year >= 2025
  AND exemption_amount < 3000000;
