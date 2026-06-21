-- privacy_requests: explicit PostgREST grants + ensure consumer RLS policies exist.
-- C7 (20260625170000) created policies but no GRANTs; prod consumer INSERT via user JWT
-- failed with "new row violates row-level security policy".

GRANT SELECT, INSERT ON TABLE public.privacy_requests TO authenticated;
GRANT ALL ON TABLE public.privacy_requests TO service_role;

DROP POLICY IF EXISTS "Users can submit privacy requests" ON public.privacy_requests;
CREATE POLICY "Users can submit privacy requests"
  ON public.privacy_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own privacy requests" ON public.privacy_requests;
CREATE POLICY "Users can read own privacy requests"
  ON public.privacy_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
