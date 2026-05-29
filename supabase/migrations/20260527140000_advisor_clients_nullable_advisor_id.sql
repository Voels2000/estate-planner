-- Allow consumer-initiated email invites before the advisor registers.
-- advisor_id remains required for advisor→client pending invites.

ALTER TABLE public.advisor_clients
  ALTER COLUMN advisor_id DROP NOT NULL;

COMMENT ON COLUMN public.advisor_clients.advisor_id IS
  'Advisor profile id. NULL for consumer_requested rows awaiting advisor signup via invite_token.';
