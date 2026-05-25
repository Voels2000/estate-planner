-- Sprint C-6: Data deletion compliance infrastructure
-- Washington WCPA + Privacy Policy 30-day deletion commitment

CREATE TABLE IF NOT EXISTS public.deletion_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  email           text NOT NULL,
  reason          text NOT NULL
                    CHECK (reason IN (
                      'user_request',
                      'subscription_cancelled',
                      'admin_initiated',
                      'account_closed'
                    )),
  initiated_by    text NOT NULL,
  dry_run         boolean NOT NULL DEFAULT false,
  tables_cleared  text[] DEFAULT '{}',
  rows_deleted    jsonb DEFAULT '{}'::jsonb,
  auth_deleted    boolean DEFAULT false,
  success         boolean NOT NULL DEFAULT false,
  error_message   text,
  completed_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deletion_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages deletion audit log"
  ON public.deletion_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.deletion_schedule (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL,
  email              text NOT NULL,
  reason             text NOT NULL
                       CHECK (reason IN (
                         'subscription_cancelled',
                         'user_request',
                         'admin_scheduled'
                       )),
  scheduled_for      timestamptz NOT NULL,
  stripe_customer_id text,
  scheduled_by       text NOT NULL,
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'executed', 'cancelled')),
  executed_at        timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deletion_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages deletion schedule"
  ON public.deletion_schedule
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_deletion_schedule_scheduled_for
  ON public.deletion_schedule (scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_deletion_schedule_user_id
  ON public.deletion_schedule (user_id);

CREATE INDEX IF NOT EXISTS idx_deletion_audit_log_user_id
  ON public.deletion_audit_log (user_id);

CREATE INDEX IF NOT EXISTS idx_deletion_audit_log_completed_at
  ON public.deletion_audit_log (completed_at DESC);

COMMENT ON TABLE public.deletion_audit_log IS
  'Immutable audit trail for all user data deletions. Sprint C-6.';

COMMENT ON TABLE public.deletion_schedule IS
  'Scheduled future deletions. Processed by daily cron. Sprint C-6.';
