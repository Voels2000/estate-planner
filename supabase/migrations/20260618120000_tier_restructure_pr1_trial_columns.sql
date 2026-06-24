-- Tier restructure PR 1: app-managed trial columns + signup defaults.
-- trial_ends_at: 7-day universal trial window (replaces signup use of trial_started_at).
-- has_ever_subscribed: blocks re-entry to app trial after first paid subscription.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS has_ever_subscribed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.trial_ends_at IS
  'App-managed trial end (7d from signup). Effective tier TRIAL_TIER while now < trial_ends_at and not has_ever_subscribed.';
COMMENT ON COLUMN public.profiles.has_ever_subscribed IS
  'Set true on first consumer subscription activation (active/canceling/trialing). Prevents trial re-grant.';

-- Consumers who already had a Stripe subscription are not eligible for a fresh app trial.
UPDATE public.profiles
SET has_ever_subscribed = true
WHERE role = 'consumer'
  AND has_ever_subscribed = false
  AND (
    subscription_status IN ('active', 'canceling', 'trialing', 'canceled', 'past_due', 'unpaid')
    OR (subscription_plan IS NOT NULL AND btrim(subscription_plan) <> '')
    OR (stripe_subscription_id IS NOT NULL AND btrim(stripe_subscription_id) <> '')
  );

-- Free-floor consumers without subscription history: grant app trial window + tier 0 storage.
UPDATE public.profiles
SET
  trial_ends_at = COALESCE(trial_ends_at, now() + interval '7 days'),
  consumer_tier = 0
WHERE role = 'consumer'
  AND has_ever_subscribed = false
  AND COALESCE(subscription_status, 'none') = 'none'
  AND (stripe_subscription_id IS NULL OR btrim(stripe_subscription_id) = '');

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
  v_trial_ends_at timestamptz;
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
    v_consumer_tier       := 0;
    v_subscription_status := 'none';
    v_trial_ends_at       := now() + interval '7 days';
  ELSE
    v_consumer_tier       := null;
    v_subscription_status := null;
    v_trial_ends_at       := null;
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    consumer_tier,
    subscription_status,
    trial_ends_at,
    has_ever_subscribed,
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
    v_trial_ends_at,
    false,
    null,
    false,
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$function$;
