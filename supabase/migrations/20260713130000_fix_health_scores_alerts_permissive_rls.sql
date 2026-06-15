-- ============================================================
-- Migration: 20260713130000_fix_health_scores_alerts_permissive_rls
-- Close cross-tenant leak on estate_health_scores, household_alerts, beneficiary_conflicts.
--
-- Root cause: policies named "service role can *" were granted TO public
-- with USING (true) FOR ALL, so any authenticated JWT could read/write/delete all rows.
-- (May 2026 audit: cmd=ALL on all three — not SELECT-only.)
--
-- Exposure class: integrity + availability, not confidentiality alone — a consumer JWT
-- could have inserted, updated, or deleted another household's alerts, health scores,
-- or beneficiary-conflict cache rows (financial-planning data corruption).
--
-- Timeline (audit record): discovered via verify:rls JWT isolation on staging 2026-06-13;
-- fixed before public launch. Staging held E2E/test identities only — no real customer
-- PII or third-party data in those tables at time of fix. Zero production rows affected;
-- no customer notification required. See DECISION_LOG.md "Pre-launch FOR ALL RLS leak".
--
-- verify:rls behavioral_household_estate_health_scores / household_alerts failed.
--
-- Advisor scope: CONNECTED_ADVISOR_CLIENT_STATUSES = active, accepted
-- (lib/advisor/clientConnectionStatus.ts).
-- ============================================================

-- ── estate_health_scores ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "service role can upsert health scores" ON public.estate_health_scores;

CREATE POLICY "Service role full access estate_health_scores"
  ON public.estate_health_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "advisor can read client health scores" ON public.estate_health_scores;

CREATE POLICY "advisor can read client health scores"
  ON public.estate_health_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.households h
      INNER JOIN public.advisor_clients ac ON ac.client_id = h.owner_id
      WHERE h.id = estate_health_scores.household_id
        AND ac.advisor_id = auth.uid()
        AND ac.status = ANY (ARRAY['active', 'accepted'])
    )
  );

-- ── household_alerts ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "service role can manage alerts" ON public.household_alerts;

CREATE POLICY "Service role full access household_alerts"
  ON public.household_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "advisor can read client alerts" ON public.household_alerts;

CREATE POLICY "advisor can read client alerts"
  ON public.household_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.households h
      INNER JOIN public.advisor_clients ac ON ac.client_id = h.owner_id
      WHERE h.id = household_alerts.household_id
        AND ac.advisor_id = auth.uid()
        AND ac.status = ANY (ARRAY['active', 'accepted'])
    )
  );

DROP POLICY IF EXISTS "advisor_update_household_alerts" ON public.household_alerts;

CREATE POLICY "advisor_update_household_alerts"
  ON public.household_alerts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.households h
      INNER JOIN public.advisor_clients ac ON ac.client_id = h.owner_id
      WHERE h.id = household_alerts.household_id
        AND ac.advisor_id = auth.uid()
        AND ac.status = ANY (ARRAY['active', 'accepted'])
    )
  );

-- ── beneficiary_conflicts ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "service role can manage conflicts" ON public.beneficiary_conflicts;

CREATE POLICY "Service role full access beneficiary_conflicts"
  ON public.beneficiary_conflicts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "advisor can read client conflicts" ON public.beneficiary_conflicts;

CREATE POLICY "advisor can read client conflicts"
  ON public.beneficiary_conflicts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.households h
      INNER JOIN public.advisor_clients ac ON ac.client_id = h.owner_id
      WHERE h.id = beneficiary_conflicts.household_id
        AND ac.advisor_id = auth.uid()
        AND ac.status = ANY (ARRAY['active', 'accepted'])
    )
  );
