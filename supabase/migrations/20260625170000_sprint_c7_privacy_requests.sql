-- Sprint C-7: Privacy request intake
-- Tracks all WCPA consumer rights requests with SLA deadlines.

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid,
  email           text NOT NULL,
  request_type    text NOT NULL
                    CHECK (request_type IN (
                      'deletion',
                      'access',
                      'correction',
                      'portability',
                      'opt_out'
                    )),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                      'pending',
                      'in_progress',
                      'completed',
                      'denied'
                    )),
  received_at     timestamptz NOT NULL DEFAULT now(),
  due_at          timestamptz NOT NULL
                    GENERATED ALWAYS AS (received_at + interval '45 days') STORED,
  completed_at    timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages privacy requests"
  ON public.privacy_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can submit privacy requests"
  ON public.privacy_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow RETURNING id/due_at on submit only (no list UI for consumers)
CREATE POLICY "Users can read own privacy requests"
  ON public.privacy_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_privacy_requests_due_at
  ON public.privacy_requests (due_at)
  WHERE status IN ('pending', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_privacy_requests_email
  ON public.privacy_requests (email);

COMMENT ON TABLE public.privacy_requests IS
  'WCPA consumer rights requests. 45-day SLA enforced by compliance cron.
   All five WCPA rights tracked here. Sprint C-7.';
