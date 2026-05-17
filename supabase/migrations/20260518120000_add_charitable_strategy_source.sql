-- Session 125: allow strategy_source 'charitable' for direct charitable gift consumer modeling.
-- category 'charitable' and strategy_source 'daf' already exist on strategy_line_items.

ALTER TABLE public.strategy_line_items
  DROP CONSTRAINT IF EXISTS strategy_line_items_strategy_source_check;

ALTER TABLE public.strategy_line_items
  ADD CONSTRAINT strategy_line_items_strategy_source_check
  CHECK (strategy_source IN (
    'cst', 'ilit', 'annual_gifting', 'lifetime_gifting',
    'grat', 'crt', 'clat', 'daf', 'charitable',
    'revocable_trust', 'valuation_discount', 'admin_expense',
    'marital_deduction', 'other',
    'liquidity', 'roth', 'slat'
  ));
