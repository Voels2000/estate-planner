-- =============================================================================
-- My Wealth Maps — Supabase migration template
-- Copy this file to: supabase/migrations/YYYYMMDDHHMMSS_short_description.sql
--
-- Why explicit GRANTs: Supabase is tightening defaults (from Oct 30, 2026) so new
-- tables may not auto-receive PostgREST API roles. Always grant in the same
-- migration that creates the table.
--
-- Why RLS: PostgREST exposes tables to anon/authenticated; RLS is the data
-- isolation layer (household ownership, advisor_client links). GRANT only answers
-- "can this role attempt access"; policies answer "which rows."
--
-- Advisor scope: advisor_clients.client_id = households.owner_id (there is no
-- client_household_id column). Join households when the row has household_id.
--
-- Checklist before merge: docs/UPDATE_CHECKLIST.md → "New table migrations"
-- Re-run audits: scripts/audit-table-grants-rls.sql, scripts/audit-rls-policies.sql
-- =============================================================================

-- ── 1. Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.example_table (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  -- columns…
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS example_table_household_id_idx
  ON public.example_table (household_id);

CREATE INDEX IF NOT EXISTS example_table_owner_id_idx
  ON public.example_table (owner_id);

-- ── 2. Row Level Security ────────────────────────────────────────────────────

ALTER TABLE public.example_table ENABLE ROW LEVEL SECURITY;

-- Consumer: own household rows (prefer join through households when owner_id alone is insufficient)
CREATE POLICY "Consumers manage own example rows"
  ON public.example_table
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.households h
      WHERE h.id = example_table.household_id
        AND h.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.households h
      WHERE h.id = example_table.household_id
        AND h.owner_id = auth.uid()
    )
  );

-- Advisor: connected clients only (household_id on row)
-- CREATE POLICY "Advisors can manage client example rows"
--   ON public.example_table
--   FOR ALL
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1
--       FROM public.advisor_clients ac
--       INNER JOIN public.households h ON h.owner_id = ac.client_id
--       WHERE h.id = example_table.household_id
--         AND ac.advisor_id = auth.uid()
--         AND ac.status = 'active'
--         AND ac.accepted_at IS NOT NULL
--     )
--   );

-- Reference / lookup table pattern (no PII): authenticated read-only, no anon unless public marketing data
-- CREATE POLICY "Authenticated read example lookup"
--   ON public.example_lookup
--   FOR SELECT
--   TO authenticated
--   USING (true);

-- Service role bypass (server routes, cron, webhooks) — optional explicit policy for documentation
-- CREATE POLICY "Service role full access example"
--   ON public.example_table
--   FOR ALL
--   TO service_role
--   USING (true)
--   WITH CHECK (true);

-- NEVER on household data: USING (true) or auth.uid() IS NOT NULL without household/advisor scope
-- NEVER: service-role-named policy granted TO public/authenticated — use TO service_role + USING (true)
-- ALWAYS: mirror USING in WITH CHECK on UPDATE/INSERT policies (omitted WITH CHECK defaults to true)
-- Post-migration gate: scripts/assert-rls-coverage.sql (npm run verify:rls)

-- ── 3. Grants (PostgREST / Data API) ─────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.example_table TO authenticated;
GRANT ALL ON TABLE public.example_table TO service_role;

-- Omit anon unless the table is intentionally public (directories, pre-signup assessment, ref_* lookups).
-- GRANT SELECT ON TABLE public.example_table TO anon;

-- Sequences (if serial/bigserial — prefer uuid default above)
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
