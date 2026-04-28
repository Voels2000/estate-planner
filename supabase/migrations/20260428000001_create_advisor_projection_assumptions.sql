-- Migration: advisor_projection_assumptions + audit table
-- Session 39 / Sprint 96

CREATE TABLE IF NOT EXISTS advisor_projection_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  scenario_name text NOT NULL DEFAULT 'Base Case',
  is_preset boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  return_mean_pct numeric(5,2) CHECK (return_mean_pct BETWEEN 2.0 AND 12.0),
  volatility_pct numeric(5,2) CHECK (volatility_pct BETWEEN 5.0 AND 25.0),
  withdrawal_rate_pct numeric(5,2) CHECK (withdrawal_rate_pct BETWEEN 1.0 AND 8.0),
  success_threshold numeric(5,2) CHECK (success_threshold BETWEEN 50.0 AND 99.0),
  simulation_count integer CHECK (simulation_count BETWEEN 500 AND 10000),
  planning_horizon_yr integer CHECK (planning_horizon_yr BETWEEN 10 AND 50),
  inflation_rate_pct numeric(5,2) CHECK (inflation_rate_pct BETWEEN 1.0 AND 6.0),
  shared_at timestamptz,
  accepted_by_client boolean NOT NULL DEFAULT false,
  accepted_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preset_or_client CHECK (
    (is_preset = true AND client_household_id IS NULL) OR
    (is_preset = false AND client_household_id IS NOT NULL)
  ),
  UNIQUE (advisor_id, client_household_id, scenario_name)
);

CREATE TABLE IF NOT EXISTS projection_assumption_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid REFERENCES advisor_projection_assumptions(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES profiles(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  field_name text NOT NULL,
  old_value text,
  new_value text,
  change_source text CHECK (
    change_source IN ('advisor_ui', 'preset_apply', 'consumer_accept', 'consumer_revert')
  )
);

CREATE OR REPLACE FUNCTION update_advisor_projection_assumptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS advisor_projection_assumptions_updated_at ON advisor_projection_assumptions;
CREATE TRIGGER advisor_projection_assumptions_updated_at
  BEFORE UPDATE ON advisor_projection_assumptions
  FOR EACH ROW EXECUTE FUNCTION update_advisor_projection_assumptions_updated_at();

ALTER TABLE advisor_projection_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projection_assumption_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advisor_own_assumptions" ON advisor_projection_assumptions;
CREATE POLICY "advisor_own_assumptions"
  ON advisor_projection_assumptions
  FOR ALL
  USING (advisor_id = auth.uid());

DROP POLICY IF EXISTS "advisor_client_assumptions_read" ON advisor_projection_assumptions;
CREATE POLICY "advisor_client_assumptions_read"
  ON advisor_projection_assumptions
  FOR SELECT
  USING (
    client_household_id IN (
      SELECT h.id
      FROM households h
      JOIN advisor_clients ac ON ac.client_id = h.owner_id
      WHERE ac.advisor_id = auth.uid() AND ac.status = 'active'
    )
  );

DROP POLICY IF EXISTS "consumer_accepted_assumptions" ON advisor_projection_assumptions;
CREATE POLICY "consumer_accepted_assumptions"
  ON advisor_projection_assumptions
  FOR SELECT
  USING (
    client_household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()
    )
    AND accepted_by_client = true
  );

DROP POLICY IF EXISTS "consumer_accept_assumption" ON advisor_projection_assumptions;
CREATE POLICY "consumer_accept_assumption"
  ON advisor_projection_assumptions
  FOR UPDATE
  USING (
    client_household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    client_household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "audit_insert" ON projection_assumption_audit;
CREATE POLICY "audit_insert"
  ON projection_assumption_audit
  FOR INSERT
  WITH CHECK (changed_by = auth.uid());

DROP POLICY IF EXISTS "audit_select_advisor" ON projection_assumption_audit;
CREATE POLICY "audit_select_advisor"
  ON projection_assumption_audit
  FOR SELECT
  USING (
    assumption_id IN (
      SELECT id FROM advisor_projection_assumptions WHERE advisor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "audit_select_consumer" ON projection_assumption_audit;
CREATE POLICY "audit_select_consumer"
  ON projection_assumption_audit
  FOR SELECT
  USING (
    assumption_id IN (
      SELECT id
      FROM advisor_projection_assumptions
      WHERE client_household_id IN (
        SELECT id FROM households WHERE owner_id = auth.uid()
      )
    )
  );
