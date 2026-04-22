-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: strategy_line_items_upsert_constraint
-- Session 27 / Sprint 85 / Phase 2
-- Adds unique constraint required for upsert onConflict in strategyLedger.ts.
-- Pattern matches strategy_configs_household_strategy_unique from Session 26.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'strategy_line_items_household_source_year_unique'
  ) THEN
    ALTER TABLE public.strategy_line_items
    ADD CONSTRAINT strategy_line_items_household_source_year_unique
    UNIQUE (household_id, strategy_source, projection_year);
  END IF;
END $$;
