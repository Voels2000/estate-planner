-- Migration: strategy_line_items acceptance + advisor tracking fields
-- Session 39 / Sprint 96

ALTER TABLE strategy_line_items
  ADD COLUMN IF NOT EXISTS advisor_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS consumer_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consumer_rejected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS scenario_name text,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS idx_strategy_line_items_advisor
  ON strategy_line_items(advisor_id)
  WHERE advisor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_strategy_line_items_pending
  ON strategy_line_items(household_id, consumer_accepted, consumer_rejected)
  WHERE consumer_accepted = false AND consumer_rejected = false;

COMMENT ON COLUMN strategy_line_items.advisor_id IS
  'Set when source_role=advisor. Links recommendation to the advisor who created it.';

COMMENT ON COLUMN strategy_line_items.consumer_accepted IS
  'True when the consumer has explicitly accepted this advisor recommendation.
   Consumer-facing model only uses rows where this is true OR source_role=consumer.';

COMMENT ON COLUMN strategy_line_items.consumer_rejected IS
  'True when the consumer has explicitly rejected this recommendation.
   Retained for audit purposes - never deleted.';

COMMENT ON COLUMN strategy_line_items.scenario_name IS
  'Optional named scenario grouping (e.g. "Conservative Estate Plan").
   Allows advisors to group related strategy recommendations.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'strategy_line_items'
      AND policyname = 'consumer_accept_strategy_recommendation'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "consumer_accept_strategy_recommendation"
      ON strategy_line_items
      FOR UPDATE
      USING (
        household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
        AND source_role = 'advisor'
      )
      WITH CHECK (
        household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
        AND source_role = 'advisor'
      )
    $policy$;
  END IF;
END $$;
