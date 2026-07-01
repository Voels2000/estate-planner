-- Phase 6: attorney listing-scoped connection billing sticky-floor (B2).
-- Default client_limit = 1 gives every claimed listing one free client.

alter table public.attorney_listings
  add column if not exists client_limit integer default 1,
  add column if not exists billing_floor integer not null default 0,
  add column if not exists reset_count integer not null default 0;

comment on column public.attorney_listings.client_limit is
  'Connection billing ceiling — connect beyond this is gated. Default 1 = one free client.';
comment on column public.attorney_listings.billing_floor is
  'Sticky high-water-mark of connected households. Ratchets UP only when paid sub exists; reset lowers.';
comment on column public.attorney_listings.reset_count is
  'Self-serve limit resets used; cleared only by admin reset.';

-- Backfill client_limit = greatest(1, connected, paid_legacy_tier_cap when subscribed).
update public.attorney_listings al
set client_limit = greatest(
  1,
  coalesce((
    select count(distinct ac.client_id)
    from public.attorney_clients ac
    where ac.attorney_id = al.id
      and ac.status in ('active', 'accepted')
      and ac.client_id is not null
      and btrim(ac.client_id::text) <> ''
  ), 0),
  case
    when coalesce(p.attorney_tier, 0) >= 1
      and p.subscription_status in ('active', 'trialing')
    then case p.attorney_tier
      when 2 then 50
      when 1 then 15
      else 3
    end
    else 0
  end
)
from public.profiles p
where p.id = al.profile_id;

-- Unclaimed listings (no profile): connected count only, floor at 1.
update public.attorney_listings al
set client_limit = greatest(
  1,
  coalesce((
    select count(distinct ac.client_id)
    from public.attorney_clients ac
    where ac.attorney_id = al.id
      and ac.status in ('active', 'accepted')
      and ac.client_id is not null
      and btrim(ac.client_id::text) <> ''
  ), 0)
)
where al.profile_id is null;

-- billing_floor: legacy paid flat-tier subs only (connection billing starts at 0 until checkout).
update public.attorney_listings al
set billing_floor = coalesce((
  select count(distinct ac.client_id)
  from public.attorney_clients ac
  where ac.attorney_id = al.id
    and ac.status in ('active', 'accepted')
    and ac.client_id is not null
    and btrim(ac.client_id::text) <> ''
), 0)
from public.profiles p
where p.id = al.profile_id
  and p.subscription_status in ('active', 'trialing')
  and p.stripe_subscription_id is not null
  and coalesce(p.attorney_tier, 0) >= 1;

update public.attorney_listings
set client_limit = 1
where client_limit is null;
