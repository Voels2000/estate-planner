-- Strategy line items: upsert key aligned with API (household + source + role + year + scenario_name)
-- and allow liquidity / roth / slat strategy_source values used by advisor + consumer UI.

-- source_role may exist in production without a tracked migration
ALTER TABLE public.strategy_line_items
  ADD COLUMN IF NOT EXISTS source_role text NOT NULL DEFAULT 'consumer'
    CHECK (source_role IN ('consumer', 'advisor'));

-- Legacy unique key predates scenario_name + source_role (Session 100 named scenarios)
ALTER TABLE public.strategy_line_items
  DROP CONSTRAINT IF EXISTS strategy_line_items_household_source_year_unique;

-- One active row per upsert bucket; inactive rows retained for audit (soft delete)
DROP INDEX IF EXISTS public.strategy_line_items_upsert_active_idx;

CREATE UNIQUE INDEX strategy_line_items_upsert_active_idx
  ON public.strategy_line_items (
    household_id,
    strategy_source,
    source_role,
    COALESCE(projection_year, -1),
    COALESCE(scenario_name, '')
  )
  WHERE is_active = true;

-- Extend strategy_source allowlist (liquidity / roth panels; slat on advisor recommend API)
ALTER TABLE public.strategy_line_items
  DROP CONSTRAINT IF EXISTS strategy_line_items_strategy_source_check;

ALTER TABLE public.strategy_line_items
  ADD CONSTRAINT strategy_line_items_strategy_source_check
  CHECK (strategy_source IN (
    'cst', 'ilit', 'annual_gifting', 'lifetime_gifting',
    'grat', 'crt', 'clat', 'daf',
    'revocable_trust', 'valuation_discount', 'admin_expense',
    'marital_deduction', 'adjusted_taxable_gift', 'other',
    'liquidity', 'roth', 'slat'
  ));

COMMENT ON INDEX public.strategy_line_items_upsert_active_idx IS
  'Matches POST /api/strategy-line-items upsert lookup: household, strategy_source, source_role, projection_year (null=-1), scenario_name (null=empty).';
