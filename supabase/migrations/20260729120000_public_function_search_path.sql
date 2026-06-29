-- Pin search_path on legacy public functions (Supabase Security Advisor: function_search_path_mutable).
-- Idempotent: ALTER ... SET search_path is safe to re-run.
--
-- Skips public.moddatetime() — owned by supabase_admin (moddatetime extension); pooler cannot ALTER.
-- Remaining platform/extension warnings in auth/storage/realtime are Supabase-managed.

ALTER FUNCTION public.calculate_charitable_summary(p_household_id uuid, p_tax_year integer) SET search_path = public;
ALTER FUNCTION public.calculate_irma(p_household_id uuid, p_magi_person1 numeric, p_magi_person2 numeric, p_tax_year integer) SET search_path = public;
ALTER FUNCTION public.check_tier_eligibility(p_household_id uuid) SET search_path = public;
ALTER FUNCTION public.create_notification(p_user_id uuid, p_type notification_type, p_title text, p_body text, p_delivery notification_delivery, p_metadata jsonb, p_cooldown interval) SET search_path = public;
ALTER FUNCTION public.dismiss_household_alert(p_alert_id uuid, p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.generate_advisor_referral_code() SET search_path = public;
ALTER FUNCTION public.generate_attorney_referral_code() SET search_path = public;
ALTER FUNCTION public.generate_business_succession_summary(p_household_id uuid) SET search_path = public;
ALTER FUNCTION public.generate_estate_recommendaions(p_household_id uuid) SET search_path = public;
ALTER FUNCTION public.generate_incapacity_recommendations(p_household_id uuid) SET search_path = public;
ALTER FUNCTION public.get_scenario_s2_outputs(p_scenario_id uuid) SET search_path = public;
ALTER FUNCTION public.get_snapshot_for_share_link(p_token text) SET search_path = public;
ALTER FUNCTION public.increment_share_link_views(p_token text) SET search_path = public;
ALTER FUNCTION public.log_changes() SET search_path = public;
ALTER FUNCTION public.merge_consumer_to_advisor(p_consumer_id uuid, p_advisor_id uuid) SET search_path = public;
ALTER FUNCTION public.resolve_household_alert(p_household_id uuid, p_rule_id text) SET search_path = public;
ALTER FUNCTION public.set_education_progress_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_annual_financials() SET search_path = public;
ALTER FUNCTION public.touch_charitable_donations() SET search_path = public;
ALTER FUNCTION public.update_advisor_directory_updated_at() SET search_path = public;
ALTER FUNCTION public.update_advisor_projection_assumptions_updated_at() SET search_path = public;
ALTER FUNCTION public.update_domicile_analysis_updated_at() SET search_path = public;
ALTER FUNCTION public.update_estate_checklist_updated_at() SET search_path = public;
ALTER FUNCTION public.update_household_people_updated_at() SET search_path = public;
ALTER FUNCTION public.update_state_estate_tax_content_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.upgrade_consumer_tier(p_user_id uuid, p_new_tier integer) SET search_path = public;
ALTER FUNCTION public.upsert_household_alert(p_household_id uuid, p_rule_id text, p_alert_type text, p_severity text, p_title text, p_description text, p_action_href text, p_action_label text, p_context_data jsonb) SET search_path = public;
