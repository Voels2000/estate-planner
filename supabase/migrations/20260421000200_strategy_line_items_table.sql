-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: strategy_line_items_table
-- Session 27 / Sprint 85
-- Formal ledger for strategy-driven estate reductions.
-- Written by StrategyOverlay when advisor marks a strategy as recommended.
-- Consumed by calculate_estate_composition RPC to shift amounts between
-- inside/outside buckets. Does NOT replace strategy_configs — that table
-- continues to drive the advisor recommendation UI.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.strategy_line_items (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      uuid          NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  scenario_id       text          NOT NULL DEFAULT 'current_law',
  projection_year   int,
  metric_target     text          NOT NULL
    CHECK (metric_target IN ('gross_estate', 'net_estate', 'taxable_estate')),
  category          text          NOT NULL
    CHECK (category IN (
      'liability',
      'valuation_discount',
      'trust_exclusion',
      'gifting',
      'marital',
      'charitable',
      'admin_expense',
      'adjusted_taxable_gift'
    )),
  strategy_source   text          NOT NULL
    CHECK (strategy_source IN (
      'cst', 'ilit', 'annual_gifting', 'lifetime_gifting',
      'grat', 'crt', 'clat', 'daf',
      'revocable_trust', 'valuation_discount', 'admin_expense',
      'marital_deduction', 'adjusted_taxable_gift', 'other'
    )),
  amount            numeric(15,2) NOT NULL CHECK (amount >= 0),
  -- -1 = reduction (deduction), +1 = addition (e.g. ATG added to taxable estate)
  sign              int           NOT NULL DEFAULT -1 CHECK (sign IN (-1, 1)),
  confidence_level  text          NOT NULL DEFAULT 'illustrative'
    CHECK (confidence_level IN ('certain', 'probable', 'illustrative')),
  effective_year    int,
  metadata          jsonb         NOT NULL DEFAULT '{}'::jsonb,
  is_active         boolean       NOT NULL DEFAULT true,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strategy_line_items_household_idx
  ON public.strategy_line_items(household_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS strategy_line_items_household_year_idx
  ON public.strategy_line_items(household_id, projection_year)
  WHERE is_active = true;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.strategy_line_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'strategy_line_items'
      AND policyname = 'Advisors manage strategy line items'
  ) THEN
    CREATE POLICY "Advisors manage strategy line items"
    ON public.strategy_line_items
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM public.advisor_clients ac
        JOIN public.households h ON h.owner_id = ac.client_id
        WHERE h.id          = strategy_line_items.household_id
          AND ac.advisor_id = auth.uid()
          AND ac.status     = 'active'
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'strategy_line_items'
      AND policyname = 'Consumers read own strategy line items'
  ) THEN
    CREATE POLICY "Consumers read own strategy line items"
    ON public.strategy_line_items
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.households h
        WHERE h.id       = strategy_line_items.household_id
          AND h.owner_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'strategy_line_items'
      AND trigger_name       = 'set_strategy_line_items_updated_at'
  ) THEN
    CREATE TRIGGER set_strategy_line_items_updated_at
    BEFORE UPDATE ON public.strategy_line_items
    FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
  END IF;
END $$;
