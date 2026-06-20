-- B6: 60-day appeal SLA tracking on privacy_requests.

ALTER TABLE public.privacy_requests
  ADD COLUMN IF NOT EXISTS appeal_due_at timestamptz;

COMMENT ON COLUMN public.privacy_requests.appeal_due_at IS
  'When status is appealed: respond to appeal within 60 days (Privacy Policy §8).';

CREATE INDEX IF NOT EXISTS idx_privacy_requests_appeal_due_at
  ON public.privacy_requests (appeal_due_at)
  WHERE status = 'appealed';

COMMENT ON TABLE public.privacy_requests IS
  'Consumer privacy rights requests (all U.S. residents). 45-day SLA on initial requests;
   60-day SLA on appeals (appeal_due_at).';
