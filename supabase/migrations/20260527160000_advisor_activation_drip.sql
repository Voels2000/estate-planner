-- Advisor activation drip tracking on profiles (Resend sequence: day 0, day 3, day 7).

alter table public.profiles
  add column if not exists advisor_drip_step_1_sent_at timestamptz,
  add column if not exists advisor_drip_step_2_sent_at timestamptz,
  add column if not exists advisor_drip_step_3_sent_at timestamptz,
  add column if not exists advisor_drip_unsubscribed_at timestamptz;

comment on column public.profiles.advisor_drip_step_1_sent_at is
  'Advisor activation drip step 1 (welcome) — sent on signup or first advisor portal visit.';
comment on column public.profiles.advisor_drip_step_2_sent_at is
  'Advisor activation drip step 2 (no clients nudge) — cron day 3 if roster empty.';
comment on column public.profiles.advisor_drip_step_3_sent_at is
  'Advisor activation drip step 3 (case study) — cron day 7.';
