-- Attorney weekly digest cooldown on profiles (cron §10)
alter table public.profiles
  add column if not exists attorney_digest_sent_at timestamptz;

comment on column public.profiles.attorney_digest_sent_at is
  'Last time the attorney weekly digest email was sent.
   Used for 6-day cooldown check in cron §10.';
