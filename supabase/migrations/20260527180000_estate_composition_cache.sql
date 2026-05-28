-- Cache for calculate_estate_composition RPC results.
-- Populated by /api/recompute-estate-health after household writes.

CREATE TABLE IF NOT EXISTS public.estate_composition_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  source_role text NOT NULL DEFAULT 'consumer'
    CHECK (source_role IN ('consumer', 'advisor')),
  composition jsonb NOT NULL DEFAULT '{}'::jsonb,
  lifetime_gifts_used numeric NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, source_role)
);

ALTER TABLE public.estate_composition_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own composition cache"
  ON public.estate_composition_cache FOR SELECT
  TO authenticated
  USING (
    household_id IN (
      SELECT id FROM public.households WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Advisors can read client composition cache"
  ON public.estate_composition_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.households h
      INNER JOIN public.advisor_clients ac ON ac.client_id = h.owner_id
      WHERE h.id = estate_composition_cache.household_id
        AND ac.advisor_id = auth.uid()
        AND ac.status = 'active'
        AND ac.accepted_at IS NOT NULL
    )
  );

GRANT SELECT ON TABLE public.estate_composition_cache TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.estate_composition_cache TO service_role;
