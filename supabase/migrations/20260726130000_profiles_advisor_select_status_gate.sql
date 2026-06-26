-- Profiles advisor SELECT must honor connection status (matches ~60 other advisor policies).
-- Without this, revoke/decline retains advisor_id + client_id and leaks PII via PostgREST.

DROP POLICY IF EXISTS "Advisors can view client profiles" ON public.profiles;

CREATE POLICY "Advisors can view client profiles"
  ON public.profiles
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients
      WHERE advisor_clients.advisor_id = auth.uid()
        AND advisor_clients.client_id = profiles.id
        AND advisor_clients.status IN ('active', 'accepted')
    )
  );
