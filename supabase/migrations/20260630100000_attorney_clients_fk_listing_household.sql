-- ============================================================
-- Migration: 20260630100000_attorney_clients_fk_listing_household
-- Align attorney_clients FKs with Sprint 38 locked decision:
--   attorney_id → attorney_listings.id
--   client_id   → households.id
-- Legacy prod rows may use profiles.id for both columns.
-- ============================================================

-- Backfill client_id: owner auth id → household id
UPDATE public.attorney_clients ac
SET client_id = h.id
FROM public.households h
WHERE ac.client_id = h.owner_id
  AND NOT EXISTS (SELECT 1 FROM public.households h2 WHERE h2.id = ac.client_id);

-- Backfill attorney_id: attorney profile id → listing id
UPDATE public.attorney_clients ac
SET attorney_id = al.id
FROM public.attorney_listings al
WHERE ac.attorney_id = al.profile_id
  AND NOT EXISTS (SELECT 1 FROM public.attorney_listings al2 WHERE al2.id = ac.attorney_id);

ALTER TABLE public.attorney_clients
  DROP CONSTRAINT IF EXISTS attorney_clients_attorney_id_fkey;

ALTER TABLE public.attorney_clients
  DROP CONSTRAINT IF EXISTS attorney_clients_client_id_fkey;

ALTER TABLE public.attorney_clients
  ADD CONSTRAINT attorney_clients_attorney_id_fkey
  FOREIGN KEY (attorney_id) REFERENCES public.attorney_listings(id) ON DELETE CASCADE;

ALTER TABLE public.attorney_clients
  ADD CONSTRAINT attorney_clients_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.households(id) ON DELETE CASCADE;

-- ── households: attorney read access for connected clients ───────────────────

DROP POLICY IF EXISTS households_attorney_select ON public.households;

CREATE POLICY households_attorney_select
  ON public.households
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT ac.client_id
      FROM public.attorney_clients ac
      INNER JOIN public.attorney_listings al ON al.id = ac.attorney_id
      WHERE al.profile_id = auth.uid()
        AND ac.status IN ('active', 'accepted')
    )
  );
