-- ============================================================
-- Migration: 20260401000001_attorney_clients_and_legal_documents
-- Part A: Adds grant/revoke/permission tracking to attorney_clients
-- Part B: Creates legal_documents table for the document vault
-- ============================================================

-- ============================================================
-- PART A: attorney_clients additions
-- ============================================================

-- 1. Add grant tracking
ALTER TABLE attorney_clients
  ADD COLUMN IF NOT EXISTS granted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS granted_by        UUID REFERENCES auth.users(id);

-- 2. Add revocation tracking
ALTER TABLE attorney_clients
  ADD COLUMN IF NOT EXISTS revoked_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by        UUID REFERENCES auth.users(id);

-- 3. Add advisor PDF access permission
ALTER TABLE attorney_clients
  ADD COLUMN IF NOT EXISTS advisor_pdf_access              BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS advisor_pdf_access_granted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS advisor_pdf_access_granted_by   UUID REFERENCES auth.users(id);

-- 4. Extend status constraint to include active and revoked
ALTER TABLE attorney_clients
  DROP CONSTRAINT IF EXISTS attorney_clients_status_check;

ALTER TABLE attorney_clients
  ADD CONSTRAINT attorney_clients_status_check
  CHECK (status IN (
    'pending',
    'accepted',
    'active',
    'removed',
    'revoked',
    'consumer_requested'
  ));

-- 5. Backfill granted_at for existing accepted rows
UPDATE attorney_clients
  SET granted_at = updated_at
  WHERE status = 'accepted'
    AND granted_at IS NULL;

-- ============================================================
-- PART B: legal_documents table
-- ============================================================

CREATE TABLE IF NOT EXISTS legal_documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  attorney_id     UUID        REFERENCES auth.users(id),
  uploaded_by     UUID        NOT NULL REFERENCES auth.users(id),
  uploader_role   TEXT        NOT NULL,
  document_type   TEXT        NOT NULL,
  file_name       TEXT        NOT NULL,
  storage_path    TEXT        NOT NULL,
  version         INT         NOT NULL DEFAULT 1,
  is_current      BOOLEAN     NOT NULL DEFAULT TRUE,
  is_deleted      BOOLEAN     NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraints
ALTER TABLE legal_documents
  ADD CONSTRAINT legal_documents_uploader_role_check
  CHECK (uploader_role IN ('consumer', 'attorney'));

ALTER TABLE legal_documents
  ADD CONSTRAINT legal_documents_document_type_check
  CHECK (document_type IN (
    'will',
    'trust',
    'dpoa',
    'medical_poa',
    'advance_directive',
    'living_will',
    'deed',
    'titling',
    'correspondence',
    'other'
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_legal_documents_household_id
  ON legal_documents(household_id);

CREATE INDEX IF NOT EXISTS idx_legal_documents_attorney_id
  ON legal_documents(attorney_id);

CREATE INDEX IF NOT EXISTS idx_legal_documents_current
  ON legal_documents(household_id, is_current, is_deleted);

