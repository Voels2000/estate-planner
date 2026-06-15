-- ============================================================
-- Migration: 20260713140000_rls_coverage_gate_fixes
-- Close remaining structural gate hits from assert-rls-coverage.sql:
--   businesses — WITH CHECK (true) from omitted clause on advisor discount UPDATE
--     (correct USING, Postgres defaulted write-side check wide open)
--   estate_flow_share_links — public SELECT USING (true); replaced with
--     get_share_link_display_meta() SECURITY DEFINER (token-scoped public share)
-- ============================================================

-- ── businesses: mirror USING in WITH CHECK (Postgres defaulted check=true) ───

DROP POLICY IF EXISTS "advisor can update business discounts" ON public.businesses;

CREATE POLICY "advisor can update business discounts"
  ON public.businesses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      WHERE ac.advisor_id = auth.uid()
        AND ac.client_id = businesses.owner_id
        AND ac.status = ANY (ARRAY['active', 'accepted'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      WHERE ac.advisor_id = auth.uid()
        AND ac.client_id = businesses.owner_id
        AND ac.status = ANY (ARRAY['active', 'accepted'])
    )
  );

-- ── estate_flow_share_links: token lookup via SECURITY DEFINER RPC only ─────

DROP POLICY IF EXISTS "public_select_share_link_by_token" ON public.estate_flow_share_links;

CREATE OR REPLACE FUNCTION public.get_share_link_display_meta(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.estate_flow_share_links%ROWTYPE;
  v_household_name text;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_link
  FROM public.estate_flow_share_links
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(h.person1_name, h.name)
  INTO v_household_name
  FROM public.households h
  WHERE h.id = v_link.household_id;

  RETURN jsonb_build_object(
    'household_id', v_link.household_id,
    'expires_at', v_link.expires_at,
    'is_revoked', v_link.is_revoked,
    'created_at', v_link.created_at,
    'household_name', v_household_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_share_link_display_meta(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_share_link_display_meta(text) TO anon, authenticated, service_role;
