-- Firms and firm membership; denormalized firm_id/firm_role on profiles.

create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id),
  tier text not null default 'starter'
    check (tier in ('starter', 'growth', 'enterprise')),
  seat_count integer not null default 1,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text check (subscription_status in (
    'active', 'trialing', 'past_due', 'canceled', 'paused', 'canceling'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.firm_members (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  firm_role text not null default 'member'
    check (firm_role in ('owner', 'member')),
  invited_by uuid references auth.users (id),
  invited_at timestamptz default now(),
  joined_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, user_id)
);

-- Helper: firm IDs the current user may see other members for (avoids RLS recursion on firm_members).
create or replace function public.firm_ids_for_current_user()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select fm.firm_id
  from public.firm_members fm
  where fm.user_id = auth.uid()
    and fm.status = 'active'
  union
  select f.id
  from public.firms f
  where f.owner_id = auth.uid();
$$;

grant execute on function public.firm_ids_for_current_user() to authenticated;

alter table public.profiles
  add column firm_id uuid references public.firms (id) on delete set null,
  add column firm_role text check (firm_role in ('owner', 'member'));

alter table public.firms enable row level security;

create policy firms_owner_select
  on public.firms for select
  using (owner_id = auth.uid());

create policy firms_owner_update
  on public.firms for update
  using (owner_id = auth.uid());

alter table public.firm_members enable row level security;

create policy firm_members_select
  on public.firm_members for select
  using (
    user_id = auth.uid()
    or firm_id in (select public.firm_ids_for_current_user())
  );

create policy firms_owner_insert
on public.firms for insert
with check (owner_id = auth.uid());

create policy firm_members_self_insert
on public.firm_members for insert
with check (user_id = auth.uid());

create policy firm_members_owner_insert
on public.firm_members for insert
with check (
  firm_id in (select id from public.firms where owner_id = auth.uid())
);

-- profiles: new columns use existing policies (select/update/insert own row only).
