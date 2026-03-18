-- Trusts (amounts excluded from simplified federal estate calc)
create table if not exists public.trusts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Trust',
  excluded_from_estate numeric not null default 0 check (excluded_from_estate >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.trusts enable row level security;

create policy "Users can view own trusts"
  on public.trusts for select using (auth.uid() = owner_id);
create policy "Users can insert own trusts"
  on public.trusts for insert with check (auth.uid() = owner_id);
create policy "Users can update own trusts"
  on public.trusts for update using (auth.uid() = owner_id);
create policy "Users can delete own trusts"
  on public.trusts for delete using (auth.uid() = owner_id);

create index if not exists trusts_owner_id_created_at_idx
  on public.trusts (owner_id, created_at desc);

-- Unified transfer tax marginal brackets (IRC §2001(c)-style bands)
create table if not exists public.federal_estate_tax_brackets (
  id uuid primary key default gen_random_uuid(),
  min_amount numeric not null check (min_amount >= 0),
  max_amount numeric not null check (max_amount >= min_amount),
  rate_pct numeric not null check (rate_pct >= 0 and rate_pct <= 100),
  created_at timestamptz default now()
);

alter table public.federal_estate_tax_brackets enable row level security;

create policy "Authenticated users read estate tax brackets"
  on public.federal_estate_tax_brackets for select to authenticated using (true);

-- Seed unified rate schedule once (Form 706 Table A marginal bands)
insert into public.federal_estate_tax_brackets (min_amount, max_amount, rate_pct)
select * from (values
  (0::numeric, 10000::numeric, 18::numeric),
  (10000, 20000, 20),
  (20000, 40000, 22),
  (40000, 60000, 24),
  (60000, 80000, 26),
  (80000, 100000, 28),
  (100000, 150000, 30),
  (150000, 250000, 32),
  (250000, 500000, 34),
  (500000, 750000, 37),
  (750000, 1000000, 39),
  (1000000, 999999999999999, 40)
) as t(min_amount, max_amount, rate_pct)
where not exists (select 1 from public.federal_estate_tax_brackets limit 1);
