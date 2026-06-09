-- Admin-A: exponential backoff for failed scheduled deletions

ALTER TABLE public.deletion_schedule
  ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

COMMENT ON COLUMN public.deletion_schedule.retry_count IS 'Failed execution attempts; alert after >= 3.';
COMMENT ON COLUMN public.deletion_schedule.next_retry_at IS 'Skip cron until this time (exponential backoff).';
