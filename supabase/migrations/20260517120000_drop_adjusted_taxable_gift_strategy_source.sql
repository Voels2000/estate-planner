-- Session 121 / Step 7A: remove adjusted_taxable_gift from strategy_line_items.strategy_source allowlist.
-- Table adjusted_taxable_gifts remains for legacy intake; horizons no longer use ATG add-back (7B).

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.strategy_line_items
    WHERE strategy_source = 'adjusted_taxable_gift'
  ) > 0 THEN
    RAISE EXCEPTION
      'Cannot drop adjusted_taxable_gift from strategy_source check: active rows still exist';
  END IF;
END $$;

ALTER TABLE public.strategy_line_items
  DROP CONSTRAINT IF EXISTS strategy_line_items_strategy_source_check;

ALTER TABLE public.strategy_line_items
  ADD CONSTRAINT strategy_line_items_strategy_source_check
  CHECK (strategy_source IN (
    'cst', 'ilit', 'annual_gifting', 'lifetime_gifting',
    'grat', 'crt', 'clat', 'daf',
    'revocable_trust', 'valuation_discount', 'admin_expense',
    'marital_deduction', 'other',
    'liquidity', 'roth', 'slat'
  ));
