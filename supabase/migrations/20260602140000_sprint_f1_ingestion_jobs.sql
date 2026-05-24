-- Sprint F-1: ingestion_jobs table for file import tracking
-- Final 14-column schema (production cleanup applied 2026-06-02).
-- Stores parse results between the parse step and commit step.
-- TTL: rows older than 24 hours can be purged (no automated cleanup yet).

CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id    uuid REFERENCES public.households(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'mapped', 'committed', 'failed')),
  file_type       text NOT NULL CHECK (file_type IN ('csv', 'xlsx')),
  file_name       text NOT NULL,
  detected_table  text CHECK (detected_table IN ('assets', 'liabilities', 'income', 'expenses')),
  headers         jsonb NOT NULL DEFAULT '[]'::jsonb,
  rows            jsonb NOT NULL DEFAULT '[]'::jsonb,
  field_map       jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count       integer,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  committed_at    timestamptz
);

ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ingestion jobs"
  ON public.ingestion_jobs
  FOR ALL
  TO public
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_ingestion_jobs_owner_id
  ON public.ingestion_jobs (owner_id);

CREATE INDEX idx_ingestion_jobs_created_at
  ON public.ingestion_jobs (created_at DESC);

COMMENT ON TABLE public.ingestion_jobs IS
  'Temporary store for file import parse results. Sprint F-1.
   Rows are transient — parsed file data lives here between parse and commit steps.
   Safe to purge rows older than 24 hours.';
