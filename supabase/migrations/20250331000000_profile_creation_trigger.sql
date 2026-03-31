-- Migration: profile creation trigger
-- Ensures every new auth.users row gets a corresponding profiles row immediately.
-- Previously this trigger was commented out in 20250313120000_profiles_subscription.sql
-- and may only exist in the hosted DB. This migration makes it canonical and
-- reproducible across all environments.
--
-- Required fields per locked decisions (Section 6, handoff doc):
--   role:                  canonical values are 'consumer' | 'advisor' | 'admin'
--   consumer_tier:         1 (entry point for all new consumers)
--   subscription_status:   'trialing' for new consumers, 'none' for advisors
--   trial_ends_at:         15 minutes from signup for consumer Tier 1 onboarding window
--   full_name:             pulled from auth.users raw_user_meta_data if provided at signup
--   email:                 pulled from auth.users email

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_consumer_tier int;
  v_subscription_status text;
  v_trial_ends_at timestamptz;
begin
  -- Extract role from signup metadata. Default to 'consumer' if missing or invalid.
  -- 'financial_advisor' is a legacy value — normalize to 'advisor' here as a safety net.
  v_role := coalesce(
    nullif(trim(new.raw_user_meta_data->>'role'), ''),
    'consumer'
  );
  if v_role = 'financial_advisor' then
    v_role := 'advisor';
  end if;
  if v_role not in ('consumer', 'advisor', 'admin') then
    v_role := 'consumer';
  end if;

  -- Tier and trial only apply to consumers
  if v_role = 'consumer' then
    v_consumer_tier      := 1;
    v_subscription_status := 'trialing';
    v_trial_ends_at      := now() + interval '15 minutes';
  else
    v_consumer_tier      := 1;  -- default, unused for advisors
    v_subscription_status := 'none';
    v_trial_ends_at      := null;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    consumer_tier,
    subscription_status,
    trial_ends_at,
    is_admin,
    updated_at
  ) values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), null),
    v_role,
    v_consumer_tier,
    v_subscription_status,
    v_trial_ends_at,
    false,
    now()
  )
  on conflict (id) do nothing;  -- idempotent: never overwrite an existing profile row

  return new;
end;
$$;

-- Drop and recreate trigger to ensure it matches this definition
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
