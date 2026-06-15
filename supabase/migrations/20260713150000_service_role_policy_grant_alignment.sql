-- ============================================================
-- Migration: 20260713150000_service_role_policy_grant_alignment
-- Align service-role policy grants with policy names (NAME_ROLE_MISMATCH).
--
-- funnel_events / referral_clicks had FOR ALL USING (auth.role() = 'service_role')
-- granted TO {public} — functionally safe via predicate, fragile if USING is edited.
-- Replace with TO service_role + USING (true) so grant and intent agree.
-- ============================================================

DROP POLICY IF EXISTS "Service role full access funnel_events" ON public.funnel_events;

CREATE POLICY "Service role full access funnel_events"
  ON public.funnel_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access referral_clicks" ON public.referral_clicks;

CREATE POLICY "Service role full access referral_clicks"
  ON public.referral_clicks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
