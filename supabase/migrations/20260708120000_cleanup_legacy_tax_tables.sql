-- Pre-go-live tax data cleanup:
--   1. Remove historical tax years 2023–2025 from canonical bracket tables.
--   2. Drop deprecated flat-rate state_income_tax_rates (engines use state_income_tax_brackets).
--
-- Safe because all projection/advisor loaders select the latest year <= projection year;
-- go-live anchor year is 2026 (see seed migrations 20260430100000, 20260427190300).

-- ── 1. Purge pre-2026 tax years from rollover tables ────────────────────────

DELETE FROM public.federal_tax_brackets
WHERE tax_year IN (2023, 2024, 2025);

DELETE FROM public.state_income_tax_brackets
WHERE tax_year IN (2023, 2024, 2025);

DELETE FROM public.state_estate_tax_rules
WHERE tax_year IN (2023, 2024, 2025);

DELETE FROM public.state_inheritance_tax_rules
WHERE tax_year IN (2023, 2024, 2025);

DELETE FROM public.irmaa_brackets
WHERE tax_year IN (2023, 2024, 2025);

DELETE FROM public.federal_estate_tax_brackets
WHERE tax_year IN (2023, 2024, 2025);

-- Legacy federal estate rows seeded before tax_year existed — stamp to go-live year.
UPDATE public.federal_estate_tax_brackets
SET tax_year = 2026
WHERE tax_year IS NULL;

-- ── 2. Drop deprecated flat-rate state income table ───────────────────────────

DROP TABLE IF EXISTS public.state_income_tax_rates;
