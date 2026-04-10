-- Titling: insurance & business policy rows, beneficiary FKs, and category cleanup

delete from public.titling_asset_categories
where value in ('annuities', 'property_casualty');

-- Insurance policy titling (one row per policy; uuid only — FK optional in hosted DB)
create table if not exists public.insurance_policy_titling (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  insurance_policy_id uuid not null,
  title_type text not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (insurance_policy_id)
);

create index if not exists insurance_policy_titling_owner_id_idx
  on public.insurance_policy_titling (owner_id);

alter table public.insurance_policy_titling enable row level security;

create policy "Users can view own insurance_policy_titling"
  on public.insurance_policy_titling for select
  using (auth.uid() = owner_id);

create policy "Users can insert own insurance_policy_titling"
  on public.insurance_policy_titling for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own insurance_policy_titling"
  on public.insurance_policy_titling for update
  using (auth.uid() = owner_id);

create policy "Users can delete own insurance_policy_titling"
  on public.insurance_policy_titling for delete
  using (auth.uid() = owner_id);

-- Business entity titling
create table if not exists public.business_titling (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null,
  title_type text not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (business_id)
);

create index if not exists business_titling_owner_id_idx
  on public.business_titling (owner_id);

alter table public.business_titling enable row level security;

create policy "Users can view own business_titling"
  on public.business_titling for select
  using (auth.uid() = owner_id);

create policy "Users can insert own business_titling"
  on public.business_titling for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own business_titling"
  on public.business_titling for update
  using (auth.uid() = owner_id);

create policy "Users can delete own business_titling"
  on public.business_titling for delete
  using (auth.uid() = owner_id);

-- Beneficiaries can attach to insurance policies or businesses
alter table public.asset_beneficiaries
  add column if not exists insurance_policy_id uuid,
  add column if not exists business_id uuid;

create index if not exists asset_beneficiaries_insurance_policy_id_idx
  on public.asset_beneficiaries (owner_id, insurance_policy_id)
  where insurance_policy_id is not null;

create index if not exists asset_beneficiaries_business_id_idx
  on public.asset_beneficiaries (owner_id, business_id)
  where business_id is not null;
