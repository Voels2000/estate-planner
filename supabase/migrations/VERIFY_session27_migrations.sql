-- ── 1. estate_inclusion_status on all 4 tables ────────────────────────────────
SELECT table_name, column_name, column_default, is_nullable
FROM information_schema.columns
WHERE column_name = 'estate_inclusion_status'
  AND table_schema = 'public'
ORDER BY table_name;
-- Expected: 4 rows — assets, businesses, insurance_policies, real_estate

-- ── 2. Discount columns on businesses ────────────────────────────────────────
SELECT column_name, column_default, data_type
FROM information_schema.columns
WHERE table_name  = 'businesses'
  AND column_name IN ('dloc_pct', 'dlom_pct', 'estate_inclusion_status')
  AND table_schema = 'public'
ORDER BY column_name;
-- Expected: 3 rows

-- ── 3. Households new columns ─────────────────────────────────────────────────
SELECT column_name, column_default, data_type
FROM information_schema.columns
WHERE table_name  = 'households'
  AND column_name IN ('admin_expense_pct', 'schema_version')
  AND table_schema = 'public'
ORDER BY column_name;
-- Expected: 2 rows

-- ── 4. Existing households tagged v1 ─────────────────────────────────────────
SELECT schema_version, count(*)
FROM public.households
GROUP BY schema_version;
-- Expected: all existing rows show 'v1'

-- ── 5. adjusted_taxable_gifts table shape ─────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name  = 'adjusted_taxable_gifts'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ── 6. strategy_line_items table shape ───────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name  = 'strategy_line_items'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ── 7. RPC exists — exactly 1 overload ───────────────────────────────────────
SELECT proname, pronargs, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname        = 'calculate_estate_composition'
  AND pronamespace   = 'public'::regnamespace;
-- Expected: exactly 1 row, argument = 'p_household_id uuid'

-- ── 8. RLS policies ───────────────────────────────────────────────────────────
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  IN ('adjusted_taxable_gifts', 'strategy_line_items')
ORDER BY tablename, policyname;
-- Expected: 4 rows total

-- ── 9. Smoke test — Al ────────────────────────────────────────────────────────
SELECT calculate_estate_composition('23c8d2fb-3050-45a2-910b-edcc9ef82587');
-- Expected: gross_estate ~8450000, exemption_available 30000000,
--           estimated_tax 0, outside_structure_total 0

-- ── 10. Smoke test — Steve ────────────────────────────────────────────────────
SELECT calculate_estate_composition('5ea14f56-e880-4992-87bc-0d815a450cdc');
-- Expected: gross_estate ~11190000, exemption_available 30000000,
--           estimated_tax 0

-- ── 11. Regression — original RPC unchanged ───────────────────────────────────
SELECT calculate_federal_estate_tax('23c8d2fb-3050-45a2-910b-edcc9ef82587');
-- Expected: gross_estate ~8450222, total_businesses ~525000, estimated_tax 0
-- THIS NUMBER MUST NOT HAVE CHANGED
