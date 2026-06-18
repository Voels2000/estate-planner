-- Attorney drip unsubscribe — mirrors profiles.advisor_drip_unsubscribed_at.
-- Unsubscribe route writes this column; future sendAttorneyDripStep / cron must filter
-- .is('attorney_drip_unsubscribed_at', null) before sending (see advisor drip pattern).

alter table public.profiles
  add column if not exists attorney_drip_unsubscribed_at timestamptz;

comment on column public.profiles.attorney_drip_unsubscribed_at is
  'Set by GET /api/email/unsubscribe?type=attorney. Attorney drip senders must skip when non-null.';
