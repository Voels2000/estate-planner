-- Columns used by the advisor client view and scripts/seed-michael-johnson-advisor-demo.ts
-- Safe to apply on environments that already have these columns (IF NOT EXISTS).

alter table public.assets
  add column if not exists owner text default 'person1';

alter table public.assets
  add column if not exists account_type text;

alter table public.assets
  add column if not exists institution text;

alter table public.assets
  add column if not exists is_taxable boolean default true;

alter table public.assets
  add column if not exists asset_type text;

alter table public.real_estate
  add column if not exists situs_state text;
