-- Add 'appealed' status for privacy request appeals (multi-state privacy SOP).

ALTER TABLE public.privacy_requests
  DROP CONSTRAINT IF EXISTS privacy_requests_status_check;

ALTER TABLE public.privacy_requests
  ADD CONSTRAINT privacy_requests_status_check
  CHECK (status IN (
    'pending',
    'in_progress',
    'completed',
    'denied',
    'appealed'
  ));

DROP INDEX IF EXISTS idx_privacy_requests_due_at;

CREATE INDEX idx_privacy_requests_due_at
  ON public.privacy_requests (due_at)
  WHERE status IN ('pending', 'in_progress', 'appealed');

COMMENT ON TABLE public.privacy_requests IS
  'Consumer privacy rights requests (all U.S. residents). 45-day SLA enforced by compliance cron.
   Denied requests may be appealed (status appealed).';
