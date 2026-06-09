-- Waitlist invite tracking on email_captures (Admin P1)

ALTER TABLE public.email_captures
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_label text;
