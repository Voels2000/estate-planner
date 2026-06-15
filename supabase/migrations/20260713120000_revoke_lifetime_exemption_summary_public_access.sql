-- Close IDOR on lifetime_exemption_summary (SECURITY DEFINER view, no self-filter).
-- App never queries this view via PostgREST; only generate_estate_recommendations (SECURITY DEFINER
-- + assert_household_caller_access) reads it server-side as postgres/service_role.

REVOKE ALL ON TABLE public.lifetime_exemption_summary FROM anon;
REVOKE ALL ON TABLE public.lifetime_exemption_summary FROM authenticated;

GRANT SELECT ON TABLE public.lifetime_exemption_summary TO service_role;
