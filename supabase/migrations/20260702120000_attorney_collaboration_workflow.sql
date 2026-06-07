-- Attorney portal collaboration: matter workflow, private notes, document requests.

ALTER TABLE public.attorney_clients
  ADD COLUMN IF NOT EXISTS request_message TEXT,
  ADD COLUMN IF NOT EXISTS matter_stage TEXT NOT NULL DEFAULT 'intake',
  ADD COLUMN IF NOT EXISTS client_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.attorney_clients
  DROP CONSTRAINT IF EXISTS attorney_clients_matter_stage_check;

ALTER TABLE public.attorney_clients
  ADD CONSTRAINT attorney_clients_matter_stage_check
  CHECK (matter_stage IN ('intake', 'review', 'drafting', 'execution', 'complete'));

ALTER TABLE public.attorney_clients
  DROP CONSTRAINT IF EXISTS attorney_clients_client_status_check;

ALTER TABLE public.attorney_clients
  ADD CONSTRAINT attorney_clients_client_status_check
  CHECK (client_status IN ('active', 'needs_review', 'on_hold', 'complete'));

CREATE TABLE IF NOT EXISTS public.attorney_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_listing_id UUID NOT NULL REFERENCES public.attorney_listings(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'internal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attorney_notes_note_type_check
    CHECK (note_type IN ('internal', 'meeting', 'follow_up'))
);

CREATE INDEX IF NOT EXISTS attorney_notes_listing_household_idx
  ON public.attorney_notes (attorney_listing_id, household_id);

CREATE TABLE IF NOT EXISTS public.attorney_document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_listing_id UUID NOT NULL REFERENCES public.attorney_listings(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  attorney_client_id UUID REFERENCES public.attorney_clients(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  fulfilled_document_id UUID REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT attorney_document_requests_status_check
    CHECK (status IN ('pending', 'fulfilled', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS attorney_document_requests_household_idx
  ON public.attorney_document_requests (household_id, status);

ALTER TABLE public.attorney_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attorney_document_requests ENABLE ROW LEVEL SECURITY;

-- Attorney notes: listing owner only (firm-private; consumer never reads)
CREATE POLICY attorney_notes_attorney_all
  ON public.attorney_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.attorney_listings al
      WHERE al.id = attorney_notes.attorney_listing_id
        AND al.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attorney_listings al
      WHERE al.id = attorney_notes.attorney_listing_id
        AND al.profile_id = auth.uid()
    )
  );

-- Document requests: attorney CRUD on own listing; consumer read + cancel own household pending
CREATE POLICY attorney_document_requests_attorney_all
  ON public.attorney_document_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.attorney_listings al
      WHERE al.id = attorney_document_requests.attorney_listing_id
        AND al.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attorney_listings al
      WHERE al.id = attorney_document_requests.attorney_listing_id
        AND al.profile_id = auth.uid()
    )
  );

CREATE POLICY attorney_document_requests_consumer_select
  ON public.attorney_document_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = attorney_document_requests.household_id
        AND h.owner_id = auth.uid()
    )
  );

CREATE POLICY attorney_document_requests_consumer_update
  ON public.attorney_document_requests
  FOR UPDATE
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = attorney_document_requests.household_id
        AND h.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = attorney_document_requests.household_id
        AND h.owner_id = auth.uid()
    )
  );
