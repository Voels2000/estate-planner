-- Signup defaults: free Tier 1 access (subscription_status = 'none').
-- Estate trial (14 days) is granted only via Stripe checkout → subscription_status = 'trialing'.

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
    v_subscription_status := 'none';
  ELSE
    v_consumer_tier       := null;
    v_subscription_status := null;
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
    null,
    false,
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$function$;

-- Existing signup-time "trialing" rows without a Stripe subscription were not real trials.
-- Remote DBs may lack stripe_subscription_id (20250313120000 not applied) — branch on column presence.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'stripe_subscription_id'
  ) THEN
    UPDATE public.profiles
    SET
      subscription_status = 'none',
      trial_started_at = null
    WHERE role = 'consumer'
      AND subscription_status = 'trialing'
      AND (stripe_subscription_id IS NULL OR stripe_subscription_id = '');
  ELSE
    UPDATE public.profiles
    SET
      subscription_status = 'none',
      trial_started_at = null
    WHERE role = 'consumer'
      AND subscription_status = 'trialing';
  END IF;
END $$;
