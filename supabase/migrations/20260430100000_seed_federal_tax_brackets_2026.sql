-- Federal ordinary income tax brackets — tax year 2026
-- Source: IRS Revenue Procedure 2025-32 (summarized e.g. Tax Foundation 2026 bracket tables).
-- Marginal slices: each bracket's min_amount aligns with the prior bracket's max_amount.
--
-- Fixes: Missing federal income tax brackets for filing status "married_joint" and year 2026
-- when projecting with computeCompleteProjection (dashboard / base-case).

-- Align schema with app code (`projection-complete.ts`, API loaders): canonical column is `tax_year`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'federal_tax_brackets' AND column_name = 'year'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'federal_tax_brackets' AND column_name = 'tax_year'
  ) THEN
    ALTER TABLE public.federal_tax_brackets RENAME COLUMN year TO tax_year;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'federal_tax_brackets' AND column_name = 'tax_year'
  ) THEN
    ALTER TABLE public.federal_tax_brackets ADD COLUMN tax_year integer;
  END IF;
END $$;

-- This table uses UNIQUE(filing_status, bracket_order) (no tax_year in the constraint),
-- so only one bracket ladder exists per filing_status. Remove existing rows before seeding 2026.
DELETE FROM public.federal_tax_brackets
WHERE filing_status IN ('single', 'married_joint');

INSERT INTO public.federal_tax_brackets
  (filing_status, tax_year, bracket_order, min_amount, max_amount, rate_pct)
VALUES
  -- Single filers (ordinary income)
  ('single', 2026, 1, 0,      12400,   10),
  ('single', 2026, 2, 12400,  50400,   12),
  ('single', 2026, 3, 50400,  105700,  22),
  ('single', 2026, 4, 105700, 201775,  24),
  ('single', 2026, 5, 201775, 256225,  32),
  ('single', 2026, 6, 256225, 640600,  35),
  -- Top bracket: DB requires NOT NULL max_amount; use an effectively unlimited ceiling (same as open-ended bracket).
  ('single', 2026, 7, 640600, 999999999999999, 37),

  -- Married filing jointly (ordinary income)
  ('married_joint', 2026, 1, 0,      24800,   10),
  ('married_joint', 2026, 2, 24800,  100800,  12),
  ('married_joint', 2026, 3, 100800, 211400,  22),
  ('married_joint', 2026, 4, 211400, 403550,  24),
  ('married_joint', 2026, 5, 403550, 512450,  32),
  ('married_joint', 2026, 6, 512450, 768700,  35),
  ('married_joint', 2026, 7, 768700, 999999999999999, 37);
