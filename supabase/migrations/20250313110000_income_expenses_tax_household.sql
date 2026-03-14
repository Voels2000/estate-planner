-- Income, expenses, tax tables, and household person1_birth_year for projection engine.

-- Optional: birth year for primary person (used for age and RMD in projections)
alter table public.households
  add column if not exists person1_birth_year smallint check (person1_birth_year is null or (person1_birth_year >= 1900 and person1_birth_year <= 2100));

-- Income (recurring or year-specific, by owner)
create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null default 0,
  start_year smallint,
  end_year smallint,
  inflation_adjust boolean default true,
  source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.income enable row level security;
create policy "Users can manage own income" on public.income for all using (auth.uid() = owner_id);
create index if not exists income_owner_id_idx on public.income (owner_id);

-- Expenses (recurring or year-specific, by owner)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null default 0,
  start_year smallint,
  end_year smallint,
  inflation_adjust boolean default true,
  category text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.expenses enable row level security;
create policy "Users can manage own expenses" on public.expenses for all using (auth.uid() = owner_id);
create index if not exists expenses_owner_id_idx on public.expenses (owner_id);

-- Federal tax brackets (filing_status, bracket order, min/max taxable income, rate %)
create table if not exists public.federal_tax_brackets (
  id uuid primary key default gen_random_uuid(),
  filing_status text not null,
  bracket_order smallint not null,
  min_amount numeric not null,
  max_amount numeric not null,
  rate_pct numeric not null check (rate_pct >= 0 and rate_pct <= 100),
  created_at timestamptz default now(),
  unique (filing_status, bracket_order)
);

create index if not exists federal_tax_brackets_status_order_idx on public.federal_tax_brackets (filing_status, bracket_order);

alter table public.federal_tax_brackets enable row level security;
create policy "Allow read for authenticated" on public.federal_tax_brackets for select to authenticated using (true);

-- Seed 2025 brackets (married_filing_jointly and single)
insert into public.federal_tax_brackets (filing_status, bracket_order, min_amount, max_amount, rate_pct) values
  ('single', 0, 0, 11600, 10), ('single', 1, 11601, 47150, 12), ('single', 2, 47151, 100525, 22), ('single', 3, 100526, 191950, 24),
  ('single', 4, 191951, 243725, 32), ('single', 5, 243726, 609350, 35), ('single', 6, 609351, 999999999, 37),
  ('married_filing_jointly', 0, 0, 23200, 10), ('married_filing_jointly', 1, 23201, 94300, 12), ('married_filing_jointly', 2, 94301, 201050, 22),
  ('married_filing_jointly', 3, 201051, 383900, 24), ('married_filing_jointly', 4, 383901, 487450, 32), ('married_filing_jointly', 5, 487451, 731200, 35),
  ('married_filing_jointly', 6, 731201, 999999999, 37)
on conflict (filing_status, bracket_order) do nothing;

-- State tax rates (flat rate % by state code)
create table if not exists public.state_tax_rates (
  id uuid primary key default gen_random_uuid(),
  state_code text not null unique,
  rate_pct numeric not null check (rate_pct >= 0 and rate_pct <= 20)
);

alter table public.state_tax_rates enable row level security;
create policy "Allow read for authenticated" on public.state_tax_rates for select to authenticated using (true);

-- Seed a few state rates (examples; adjust as needed)
insert into public.state_tax_rates (state_code, rate_pct) values
  ('CA', 9.3), ('NY', 6.5), ('TX', 0), ('FL', 0), ('WA', 0), ('NJ', 6.37), ('IL', 4.95), ('PA', 3.07), ('OH', 3.75), ('AZ', 2.5)
on conflict (state_code) do nothing;
