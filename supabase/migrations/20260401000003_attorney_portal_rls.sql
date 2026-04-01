-- ============================================================
-- Migration: 20260401000003_attorney_portal_rls
-- RLS policies for the attorney portal and document vault.
-- Follows existing attorney_clients policy naming pattern.
-- households.owner_id is the link to auth.users.
-- ============================================================

-- ============================================================
-- LEGAL_DOCUMENTS policies
-- ============================================================

CREATE POLICY legal_documents_consumer_select
  ON legal_documents FOR SELECT
  USING (
    household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY legal_documents_consumer_insert
  ON legal_documents FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()
    )
    AND uploader_role = 'consumer'
    AND uploaded_by = auth.uid()
  );

CREATE POLICY legal_documents_consumer_update
  ON legal_documents FOR UPDATE
  USING (
    household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY legal_documents_attorney_select
  ON legal_documents FOR SELECT
  USING (
    household_id IN (
      SELECT ac.client_id
      FROM attorney_clients ac
      WHERE ac.attorney_id = auth.uid()
        AND ac.status IN ('active', 'accepted')
    )
  );

CREATE POLICY legal_documents_attorney_insert
  ON legal_documents FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT ac.client_id
      FROM attorney_clients ac
      WHERE ac.attorney_id = auth.uid()
        AND ac.status IN ('active', 'accepted')
    )
    AND uploader_role = 'attorney'
    AND uploaded_by = auth.uid()
  );

-- ============================================================
-- DOCUMENT_DOWNLOAD_LOG policies
-- ============================================================

CREATE POLICY download_log_consumer_select
  ON document_download_log FOR SELECT
  USING (
    document_id IN (
      SELECT ld.id
      FROM legal_documents ld
      JOIN households h ON h.id = ld.household_id
      WHERE h.owner_id = auth.uid()
    )
  );

CREATE POLICY download_log_attorney_select
  ON document_download_log FOR SELECT
  USING (
    document_id IN (
      SELECT ld.id
      FROM legal_documents ld
      JOIN attorney_clients ac ON ac.client_id = ld.household_id
      WHERE ac.attorney_id = auth.uid()
        AND ac.status IN ('active', 'accepted')
    )
  );

CREATE POLICY download_log_insert
  ON document_download_log FOR INSERT
  WITH CHECK (downloaded_by = auth.uid());

-- ============================================================
-- ATTORNEY_LISTINGS policies
-- ============================================================

CREATE POLICY attorney_listings_consumer_select
  ON attorney_listings FOR SELECT
  USING (is_active = TRUE AND is_verified = TRUE);

CREATE POLICY attorney_listings_advisor_select
  ON attorney_listings FOR SELECT
  USING (
    submitted_by = auth.uid()
    OR (is_active = TRUE AND is_verified = TRUE)
  );
