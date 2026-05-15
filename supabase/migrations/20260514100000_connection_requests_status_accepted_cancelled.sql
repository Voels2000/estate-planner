-- Align connection_requests.status with app usage (claim-listing → accepted, consumer cancel → cancelled).

ALTER TABLE public.connection_requests
  DROP CONSTRAINT IF EXISTS connection_requests_status_check;

ALTER TABLE public.connection_requests
  ADD CONSTRAINT connection_requests_status_check
  CHECK (status IN ('pending', 'active', 'revoked', 'accepted', 'cancelled'));
