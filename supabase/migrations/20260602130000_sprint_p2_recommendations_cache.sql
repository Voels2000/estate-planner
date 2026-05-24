-- Sprint P-2: Cache estate recommendations on estate_health_scores
-- Eliminates generate_estate_recommendations RPC from dashboard hot path.
-- Recommendations are regenerated during recompute and read from cache on load.

ALTER TABLE public.estate_health_scores
  ADD COLUMN IF NOT EXISTS recommendations jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.estate_health_scores.recommendations IS
  'Cached output of generate_estate_recommendations RPC. Populated during
   recompute via triggerEstateHealthRecompute. Read on dashboard load
   instead of calling the RPC directly. Sprint P-2.';
