-- ============================================================
-- Migration: 20260629130000_attorney_rls_policy_fix
-- attorney_clients.attorney_id = attorney_listings.id (not auth.uid())
-- attorney_clients.client_id = households.id (not auth.uid())
-- ============================================================

-- ── attorney_clients ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS attorney_clients_attorney_select ON public.attorney_clients;
DROP POLICY IF EXISTS attorney_clients_attorney_update ON public.attorney_clients;
DROP POLICY IF EXISTS attorney_clients_attorney_insert ON public.attorney_clients;
DROP POLICY IF EXISTS attorney_clients_consumer_select ON public.attorney_clients;
DROP POLICY IF EXISTS attorney_clients_consumer_insert ON public.attorney_clients;
DROP POLICY IF EXISTS attorney_clients_consumer_update ON public.attorney_clients;

CREATE POLICY attorney_clients_consumer_select
  ON public.attorney_clients
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT h.id
      FROM public.households h
      WHERE h.owner_id = auth.uid()
    )
  );

CREATE POLICY attorney_clients_consumer_insert
  ON public.attorney_clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT h.id
      FROM public.households h
      WHERE h.owner_id = auth.uid()
    )
    AND granted_by = auth.uid()
  );

CREATE POLICY attorney_clients_consumer_update
  ON public.attorney_clients
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT h.id
      FROM public.households h
      WHERE h.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT h.id
      FROM public.households h
      WHERE h.owner_id = auth.uid()
    )
  );

CREATE POLICY attorney_clients_attorney_select
  ON public.attorney_clients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.attorney_listings al
      WHERE al.id = attorney_clients.attorney_id
        AND al.profile_id = auth.uid()
    )
  );

CREATE POLICY attorney_clients_attorney_update
  ON public.attorney_clients
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.attorney_listings al
      WHERE al.id = attorney_clients.attorney_id
        AND al.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.attorney_listings al
      WHERE al.id = attorney_clients.attorney_id
        AND al.profile_id = auth.uid()
    )
  );

-- ── legal_documents (attorney policies) ─────────────────────────────────────

DROP POLICY IF EXISTS legal_documents_attorney_select ON public.legal_documents;
DROP POLICY IF EXISTS legal_documents_attorney_insert ON public.legal_documents;

CREATE POLICY legal_documents_attorney_select
  ON public.legal_documents
  FOR SELECT
  TO authenticated
  USING (
    household_id IN (
      SELECT ac.client_id
      FROM public.attorney_clients ac
      INNER JOIN public.attorney_listings al ON al.id = ac.attorney_id
      WHERE al.profile_id = auth.uid()
        AND ac.status IN ('active', 'accepted')
    )
  );

CREATE POLICY legal_documents_attorney_insert
  ON public.legal_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    household_id IN (
      SELECT ac.client_id
      FROM public.attorney_clients ac
      INNER JOIN public.attorney_listings al ON al.id = ac.attorney_id
      WHERE al.profile_id = auth.uid()
        AND ac.status IN ('active', 'accepted')
    )
    AND uploader_role = 'attorney'
    AND uploaded_by = auth.uid()
  );

-- ── document_download_log (attorney select) ───────────────────────────────────

DROP POLICY IF EXISTS download_log_attorney_select ON public.document_download_log;

CREATE POLICY download_log_attorney_select
  ON public.document_download_log
  FOR SELECT
  TO authenticated
  USING (
    document_id IN (
      SELECT ld.id
      FROM public.legal_documents ld
      INNER JOIN public.attorney_clients ac ON ac.client_id = ld.household_id
      INNER JOIN public.attorney_listings al ON al.id = ac.attorney_id
      WHERE al.profile_id = auth.uid()
        AND ac.status IN ('active', 'accepted')
    )
  );
