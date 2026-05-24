-- ============================================================
-- Migration: 20260602000000_sprint_c3_rls_fixes
-- Sprint C-3 Phase 1 — RLS policy fixes from security audit
--
-- Advisor client link statuses: CONNECTED_ADVISOR_CLIENT_STATUSES =
--   ['active', 'accepted'] (lib/advisor/clientConnectionStatus.ts).
-- All advisor-scoped policies below use both statuses. The live assets
-- policy previously checked 'active' only — fixed here, not copied.
--
-- COMPLIANCE NOTE — monte_carlo_runs.success_rate:
--   Column name is fine to keep. If surfaced in UI, label must follow
--   UX language audit rules (e.g. "Scenarios reached your stated goal" —
--   not "Success Rate" or "Plan success"). See /monte-carlo and
--   lib/monte-carlo.ts insight strings before any display copy changes.
-- ============================================================

-- ── 1. businesses: fix overly permissive advisor SELECT policy ───────────────
-- Was: USING (auth.uid() IS NOT NULL) — any signed-in user could read all rows.

DROP POLICY IF EXISTS "advisor can view client businesses" ON public.businesses;

CREATE POLICY "advisor can view client businesses"
  ON public.businesses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      WHERE ac.advisor_id = auth.uid()
        AND ac.client_id = businesses.owner_id
        AND ac.status = ANY (ARRAY['active', 'accepted'])
    )
  );

-- ── 1b. assets: fix advisor policy — was 'active' only ───────────────────────

DROP POLICY IF EXISTS "Advisors can manage client assets" ON public.assets;

CREATE POLICY "Advisors can manage client assets"
  ON public.assets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      WHERE ac.advisor_id = auth.uid()
        AND ac.client_id = assets.owner_id
        AND ac.status = ANY (ARRAY['active', 'accepted'])
    )
  );

-- ── 2. Reference / config tables: authenticated read-only ────────────────────
-- change_log: service_role only (no authenticated policy — blocks anon/authenticated).

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'federal_estate_tax_parameters',
    'advisor_tier_config',
    'attorney_tier_config',
    'charitable_deduction_limits',
    'charitable_vehicle_types',
    'qcd_limits'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated read" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Authenticated read" ON public.%I FOR SELECT TO authenticated USING (true)',
      t
    );
  END LOOP;
END $$;

-- Explicit service-role policy for change_log (service role bypasses RLS; documents intent).
DROP POLICY IF EXISTS "Service role full access" ON public.change_log;

CREATE POLICY "Service role full access"
  ON public.change_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 3. monte_carlo_runs: owner + advisor (join key: user_id = auth.uid()) ────
-- Columns include user_id (household owner / consumer auth id), simulation inputs,
-- percentile outputs, success_rate (see compliance note above), label, notes,
-- created_at, updated_at.

DROP POLICY IF EXISTS "Users manage own monte carlo runs" ON public.monte_carlo_runs;
DROP POLICY IF EXISTS "Advisors can view client monte carlo runs" ON public.monte_carlo_runs;

CREATE POLICY "Users manage own monte carlo runs"
  ON public.monte_carlo_runs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Advisors can view client monte carlo runs"
  ON public.monte_carlo_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      WHERE ac.advisor_id = auth.uid()
        AND ac.client_id = monte_carlo_runs.user_id
        AND ac.status = ANY (ARRAY['active', 'accepted'])
    )
  );

-- ── 4. advisor_clients: tighten ALL policy WITH CHECK ────────────────────────

DROP POLICY IF EXISTS "Advisors manage their clients" ON public.advisor_clients;

CREATE POLICY "Advisors manage their clients"
  ON public.advisor_clients
  FOR ALL
  USING (advisor_id = auth.uid())
  WITH CHECK (advisor_id = auth.uid());

-- ── 5. profiles: allow self-insert on signup ─────────────────────────────────

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());
