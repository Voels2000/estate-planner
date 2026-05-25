-- ============================================================
-- Sprint F-2: Import traceability + ingestion_jobs improvements
-- ============================================================

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS ingestion_job_id uuid
    REFERENCES public.ingestion_jobs(id) ON DELETE SET NULL;

ALTER TABLE public.liabilities
  ADD COLUMN IF NOT EXISTS ingestion_job_id uuid
    REFERENCES public.ingestion_jobs(id) ON DELETE SET NULL;

ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS ingestion_job_id uuid
    REFERENCES public.ingestion_jobs(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS ingestion_job_id uuid
    REFERENCES public.ingestion_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_ingestion_job_id
  ON public.assets (ingestion_job_id)
  WHERE ingestion_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_liabilities_ingestion_job_id
  ON public.liabilities (ingestion_job_id)
  WHERE ingestion_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_income_ingestion_job_id
  ON public.income (ingestion_job_id)
  WHERE ingestion_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_ingestion_job_id
  ON public.expenses (ingestion_job_id)
  WHERE ingestion_job_id IS NOT NULL;

ALTER TABLE public.ingestion_jobs
  ADD COLUMN IF NOT EXISTS header_row_index integer DEFAULT 0;

ALTER TABLE public.ingestion_jobs
  ADD COLUMN IF NOT EXISTS sheet_name text;

COMMENT ON COLUMN public.assets.ingestion_job_id IS
  'Set when row was created via file import. NULL for manually entered rows. Sprint F-2.';

COMMENT ON COLUMN public.ingestion_jobs.header_row_index IS
  'Zero-based index of the row detected as the header. Sprint F-2.';

COMMENT ON COLUMN public.ingestion_jobs.sheet_name IS
  'Excel sheet name used for this import. NULL for CSV. Sprint F-2.';
