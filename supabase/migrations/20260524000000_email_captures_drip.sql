-- Drip email tracking columns on email_captures

alter table public.email_captures
  add column if not exists drip_step_1_sent_at timestamptz,
  add column if not exists drip_step_2_sent_at timestamptz,
  add column if not exists drip_step_3_sent_at timestamptz,
  add column if not exists unsubscribed_at timestamptz;
