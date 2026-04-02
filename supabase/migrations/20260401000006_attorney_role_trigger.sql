-- Migration: extend handle_new_user() trigger to support role='attorney'
-- Attorneys are directory-listed professionals, not subscribers.
-- They have no consumer_tier, no subscription_status, no trial_ends_at.
-- Locked decision: attorney role added as canonical value alongside
-- consumer | advisor | admin.

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
  -- 'financial_advisor' is a legacy value — normalize to 'advisor' as a safety net.
  v_role := coalesce(
    nullif(trim(new.raw_user_meta_data->>'role'), ''),
    'consumer'
  );

  if v_role = 'financial_advisor' then
    v_role := 'advisor';
  end if;

  -- Accept attorney as a canonical role alongside existing values
  if v_role not in ('consumer', 'advisor', 'attorney', 'admin') then
    v_role := 'consumer';
  end if;

  -- Tier and trial only apply to consumers.
  -- Advisors get subscription_status='none', no tier, no trial.
  -- Attorneys get nothing — they are not subscribers.
  if v_role = 'consumer' then
    v_consumer_tier       := 1;
    v_subscription_status := 'trialing';
    v_trial_ends_at       := now() + interval '15 minutes';
  elsif v_role = 'advisor' then
    v_consumer_tier       := null;
    v_subscription_status := 'none';
    v_trial_ends_at       := null;
  else
    -- attorney and admin
    v_consumer_tier       := null;
    v_subscription_status := null;
    v_trial_ends_at       := null;
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
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Trigger definition unchanged — recreate to ensure it matches
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
