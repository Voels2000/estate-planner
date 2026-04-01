-- ============================================================
-- Migration: 20260401000000_attorney_access_fields
-- Adds attorney grant/revoke tracking and advisor PDF access
-- permission fields to connection_requests table.
-- ============================================================

-- 1. Add grant tracking columns
ALTER TABLE connection_requests
  ADD COLUMN IF NOT EXISTS granted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS granted_by        UUID REFERENCES auth.users(id);

-- 2. Add revocation tracking columns
ALTER TABLE connection_requests
  ADD COLUMN IF NOT EXISTS revoked_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by        UUID REFERENCES auth.users(id);

-- 3. Add advisor PDF access permission columns
ALTER TABLE connection_requests
  ADD COLUMN IF NOT EXISTS advisor_pdf_access            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS advisor_pdf_access_granted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS advisor_pdf_access_granted_by UUID REFERENCES auth.users(id);

-- 4. Extend the status constraint to include 'revoked'
--    Drop the old constraint first, then recreate it.
ALTER TABLE connection_requests
  DROP CONSTRAINT IF EXISTS connection_requests_status_check;

ALTER TABLE connection_requests
  ADD CONSTRAINT connection_requests_status_check
  CHECK (status IN ('pending', 'active', 'revoked'));

-- 5. Backfill granted_at for any existing active rows
--    so the column is not null for rows that are already live.
UPDATE connection_requests
  SET granted_at = updated_at
  WHERE status = 'active'
    AND granted_at IS NULL;
