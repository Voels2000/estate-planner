-- Migration: 20260526000001_handle_new_user_trigger.sql
-- Canonical handle_new_user() + on_auth_user_created (synced from production 2026-05-25).
-- Supersedes profile-creation trigger bodies in:
--   20250331000000_profile_creation_trigger.sql (used trial_ends_at — wrong column)
--   20260401000006_attorney_role_trigger.sql
--
-- Without this trigger, new auth.users rows get no profiles row and onboarding breaks.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role text;
  v_consumer_tier int;
  v_subscription_status text;
  v_trial_started_at timestamptz;
BEGIN
  v_role := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'role'), ''),
    'consumer'
  );

  IF v_role = 'financial_advisor' THEN
    v_role := 'advisor';
  END IF;

  IF v_role NOT IN ('consumer', 'advisor', 'attorney', 'admin') THEN
    v_role := 'consumer';
  END IF;

  IF v_role = 'consumer' THEN
    v_consumer_tier       := 1;
    v_subscription_status := 'trialing';
    v_trial_started_at    := now();
  ELSE
    v_consumer_tier       := null;
    v_subscription_status := null;
    v_trial_started_at    := null;
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    consumer_tier,
    subscription_status,
    trial_started_at,
    is_admin,
    updated_at
  ) VALUES (
    new.id,
    new.email,
    COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''), null),
    v_role,
    v_consumer_tier,
    v_subscription_status,
    v_trial_started_at,
    false,
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
