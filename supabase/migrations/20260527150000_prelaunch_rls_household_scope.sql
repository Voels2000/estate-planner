-- =============================================================================
-- Pre-launch RLS: household-scoped policies for 6 tables
-- Fixes permissive auth.uid() IS NOT NULL policies (cross-household exposure).
-- Policy names verified against prod pg_policies (2026-05-27).
-- Advisor scope: advisor_clients.client_id = households.owner_id
--   AND status = 'active' AND accepted_at IS NOT NULL
-- =============================================================================

-- ── 1. GST LEDGER ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Advisors can manage gst ledger entries" ON public.gst_ledger;

CREATE POLICY "Users can manage own gst ledger"
  ON public.gst_ledger
  FOR ALL
  TO authenticated
  USING (
    household_id IN (
      SELECT id FROM public.households
      WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT id FROM public.households
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Advisors can manage client gst ledger"
  ON public.gst_ledger
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      INNER JOIN public.households h ON h.owner_id = ac.client_id
      WHERE h.id = gst_ledger.household_id
        AND ac.advisor_id = auth.uid()
        AND ac.status = 'active'
        AND ac.accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      INNER JOIN public.households h ON h.owner_id = ac.client_id
      WHERE h.id = gst_ledger.household_id
        AND ac.advisor_id = auth.uid()
        AND ac.status = 'active'
        AND ac.accepted_at IS NOT NULL
    )
  );

-- ── 2. LIQUIDITY ANALYSIS ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Advisors can manage liquidity analysis" ON public.liquidity_analysis;

CREATE POLICY "Users can manage own liquidity analysis"
  ON public.liquidity_analysis
  FOR ALL
  TO authenticated
  USING (
    household_id IN (
      SELECT id FROM public.households WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT id FROM public.households WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Advisors can manage client liquidity analysis"
  ON public.liquidity_analysis
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      INNER JOIN public.households h ON h.owner_id = ac.client_id
      WHERE h.id = liquidity_analysis.household_id
        AND ac.advisor_id = auth.uid()
        AND ac.status = 'active'
        AND ac.accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      INNER JOIN public.households h ON h.owner_id = ac.client_id
      WHERE h.id = liquidity_analysis.household_id
        AND ac.advisor_id = auth.uid()
        AND ac.status = 'active'
        AND ac.accepted_at IS NOT NULL
    )
  );

-- ── 3. MONTE CARLO RESULTS ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Advisors can manage monte carlo results" ON public.monte_carlo_results;

CREATE POLICY "Users can read own monte carlo results"
  ON public.monte_carlo_results
  FOR SELECT
  TO authenticated
  USING (
    household_id IN (
      SELECT id FROM public.households WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Advisors can read client monte carlo results"
  ON public.monte_carlo_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      INNER JOIN public.households h ON h.owner_id = ac.client_id
      WHERE h.id = monte_carlo_results.household_id
        AND ac.advisor_id = auth.uid()
        AND ac.status = 'active'
        AND ac.accepted_at IS NOT NULL
    )
  );

-- Writes: estate-monte-carlo edge function uses service_role (unchanged)

-- ── 4. DOMICILE SCHEDULE ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "owner can manage domicile schedule" ON public.domicile_schedule;
DROP POLICY IF EXISTS "advisor can view client domicile schedule" ON public.domicile_schedule;

CREATE POLICY "Users can manage own domicile schedule"
  ON public.domicile_schedule
  FOR ALL
  TO authenticated
  USING (
    household_id IN (
      SELECT id FROM public.households WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT id FROM public.households WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Advisors can view client domicile schedule"
  ON public.domicile_schedule
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      INNER JOIN public.households h ON h.owner_id = ac.client_id
      WHERE h.id = domicile_schedule.household_id
        AND ac.advisor_id = auth.uid()
        AND ac.status = 'active'
        AND ac.accepted_at IS NOT NULL
    )
  );

-- ── 5. DOMICILE ANALYSIS — advisor SELECT only (consumer policies unchanged) ─

DROP POLICY IF EXISTS "advisors select client domicile_analysis" ON public.domicile_analysis;

CREATE POLICY "Advisors can view client domicile analysis"
  ON public.domicile_analysis
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT h.owner_id
      FROM public.households h
      INNER JOIN public.advisor_clients ac ON ac.client_id = h.owner_id
      WHERE ac.advisor_id = auth.uid()
        AND ac.status = 'active'
        AND ac.accepted_at IS NOT NULL
    )
  );

-- ── 6. STRATEGY CONFIGS — drop loose advisor policies ────────────────────────

DROP POLICY IF EXISTS "Advisors can read strategy configs for their clients" ON public.strategy_configs;
DROP POLICY IF EXISTS "Advisors can update strategy configs" ON public.strategy_configs;
DROP POLICY IF EXISTS "Advisors can delete strategy configs" ON public.strategy_configs;
DROP POLICY IF EXISTS "Advisors can insert strategy configs" ON public.strategy_configs;
DROP POLICY IF EXISTS "Advisors manage strategy configs" ON public.strategy_configs;

CREATE POLICY "Advisors can manage client strategy configs"
  ON public.strategy_configs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      INNER JOIN public.households h ON h.owner_id = ac.client_id
      WHERE h.id = strategy_configs.household_id
        AND ac.advisor_id = auth.uid()
        AND ac.status = 'active'
        AND ac.accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      INNER JOIN public.households h ON h.owner_id = ac.client_id
      WHERE h.id = strategy_configs.household_id
        AND ac.advisor_id = auth.uid()
        AND ac.status = 'active'
        AND ac.accepted_at IS NOT NULL
    )
  );

-- "Consumers read own strategy configs" — unchanged
