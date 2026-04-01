-- ============================================================
-- Migration: 20260401000002_document_download_log
-- Creates an immutable audit log of every document download.
-- Every signed URL generation writes a row here.
-- No updates or deletes are ever permitted on this table.
-- ============================================================

CREATE TABLE IF NOT EXISTS document_download_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID        NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  downloaded_by    UUID        NOT NULL REFERENCES auth.users(id),
  downloader_role  TEXT        NOT NULL,
  downloaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint on role values
ALTER TABLE document_download_log
  ADD CONSTRAINT document_download_log_role_check
  CHECK (downloader_role IN ('consumer', 'attorney', 'advisor'));

-- Index for fast lookup by document
CREATE INDEX IF NOT EXISTS idx_download_log_document_id
  ON document_download_log(document_id);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_download_log_downloaded_by
  ON document_download_log(downloaded_by);
