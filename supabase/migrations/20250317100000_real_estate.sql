-- Real estate properties (dashboard). Aligns with app/(dashboard)/real-estate/_real-estate-client.tsx

create table if not exists public.real_estate (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  property_type text not null default 'primary_residence' check (property_type in (
    'primary_residence',
    'rental',
    'vacation',
    'commercial'
  )),
  current_value numeric not null default 0 check (current_value >= 0),
  purchase_price numeric check (purchase_price is null or purchase_price >= 0),
  purchase_year int check (purchase_year is null or purchase_year between 1800 and 2100),
  mortgage_balance numeric not null default 0 check (mortgage_balance >= 0),
  monthly_payment numeric check (monthly_payment is null or monthly_payment >= 0),
  interest_rate numeric check (interest_rate is null or interest_rate >= 0),
  planned_sale_year int check (planned_sale_year is null or planned_sale_year between 1900 and 2100),
  selling_costs_pct numeric default 6 check (selling_costs_pct is null or (selling_costs_pct >= 0 and selling_costs_pct <= 100)),
  is_primary_residence boolean not null default false,
  years_lived_in int check (years_lived_in is null or years_lived_in >= 0),
  owner text not null default 'person1' check (owner in ('person1', 'person2', 'joint')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.real_estate enable row level security;

create policy "Users can view own real_estate"
  on public.real_estate for select
  using (auth.uid() = owner_id);

create policy "Users can insert own real_estate"
  on public.real_estate for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own real_estate"
  on public.real_estate for update
  using (auth.uid() = owner_id);

create policy "Users can delete own real_estate"
  on public.real_estate for delete
  using (auth.uid() = owner_id);

create index if not exists real_estate_owner_id_created_at_idx
  on public.real_estate (owner_id, created_at desc);
