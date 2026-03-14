-- Assets table for estate planner dashboard
-- Run this in the Supabase SQL editor if the table does not exist yet.

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'primary_residence',
    'taxable_brokerage',
    'traditional_401k',
    'roth_ira',
    'traditional_ira'
  )),
  name text not null,
  value numeric not null default 0 check (value >= 0),
  details jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: users can only see and insert their own assets
alter table public.assets enable row level security;

create policy "Users can view own assets"
  on public.assets for select
  using (auth.uid() = owner_id);

create policy "Users can insert own assets"
  on public.assets for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own assets"
  on public.assets for update
  using (auth.uid() = owner_id);

create policy "Users can delete own assets"
  on public.assets for delete
  using (auth.uid() = owner_id);

-- Optional: index for listing by owner
create index if not exists assets_owner_id_created_at_idx
  on public.assets (owner_id, created_at desc);
