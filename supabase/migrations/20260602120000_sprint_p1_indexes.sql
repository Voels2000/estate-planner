-- Sprint P-1: owner_id indexes flagged missing in perf audit (Query B, 2026-06-02)
-- Apply via Supabase SQL Editor or: npx supabase db push
--
-- Query B results (production):
--   assets.owner_id      → MISSING INDEX
--   liabilities.owner_id → MISSING INDEX
-- All other hot columns in the audit were already indexed.
--
-- Note: assets may have assets_owner_id_created_at_idx in some environments;
-- idx_assets_owner_id is idempotent (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_assets_owner_id
  ON public.assets (owner_id);

CREATE INDEX IF NOT EXISTS idx_liabilities_owner_id
  ON public.liabilities (owner_id);
