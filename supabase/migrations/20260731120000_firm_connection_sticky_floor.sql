-- B2 connection billing: client_limit (gate), billing_floor (sticky HWM), reset_count.
-- Deliberately separate from seat_count (roster / legacy paths).

alter table public.firms
  add column if not exists client_limit integer,
  add column if not exists billing_floor integer not null default 0,
  add column if not exists reset_count integer not null default 0;

comment on column public.firms.client_limit is
  'Connection billing ceiling — connect beyond this is gated (limit_raise_required).';
comment on column public.firms.billing_floor is
  'Sticky high-water-mark of connected households. Sync may ratchet UP only; reset lowers.';
comment on column public.firms.reset_count is
  'Self-serve limit resets used; cleared only by admin reset (lifetime until admin).';

-- Staging backfill: active firms get limit/floor from purchased seats vs live connections.
update public.firms f
set
  client_limit = coalesce(nullif(f.seat_count, 0), 1),
  billing_floor = greatest(
    coalesce(nullif(f.seat_count, 0), 1),
    coalesce((
      select count(distinct ac.client_id)
      from public.profiles p
      join public.advisor_clients ac on ac.advisor_id = p.id
      where p.firm_id = f.id
        and ac.status in ('active', 'accepted')
        and ac.client_id is not null
        and btrim(ac.client_id::text) <> ''
    ), 0)
  )
where f.subscription_status in ('active', 'trialing')
  and (f.client_limit is null or f.billing_floor = 0);
