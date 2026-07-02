-- Outreach send tracking for directory seed rows (first send + reminder cadence).

alter table public.attorney_listings
  add column if not exists outreach_sent_at timestamptz,
  add column if not exists outreach_send_count integer not null default 0,
  add column if not exists outreach_reminder_sent_at timestamptz;

alter table public.advisor_directory
  add column if not exists outreach_sent_at timestamptz,
  add column if not exists outreach_send_count integer not null default 0,
  add column if not exists outreach_reminder_sent_at timestamptz;

comment on column public.attorney_listings.outreach_sent_at is
  'Timestamp of first outreach email send. Null = never sent.';
comment on column public.attorney_listings.outreach_send_count is
  'Total outreach emails sent (initial + reminders).';
comment on column public.attorney_listings.outreach_reminder_sent_at is
  'Timestamp of most recent reminder send, if any. Null = no reminder sent yet.';

comment on column public.advisor_directory.outreach_sent_at is
  'Timestamp of first outreach email send. Null = never sent.';
comment on column public.advisor_directory.outreach_send_count is
  'Total outreach emails sent (initial + reminders).';
comment on column public.advisor_directory.outreach_reminder_sent_at is
  'Timestamp of most recent reminder send, if any. Null = no reminder sent yet.';
