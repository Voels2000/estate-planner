-- Advisor referral codes and click tracking (advisor_directory is canonical listing table)
--
-- If an older draft targeted advisor_listings, check first:
--   select exists (
--     select from information_schema.tables
--     where table_schema = 'public' and table_name = 'advisor_listings'
--   );
-- If true: drop table if exists public.advisor_listings cascade;
-- Then run this migration.

alter table public.advisor_directory
  add column if not exists referral_code text unique;

update public.advisor_directory
set referral_code = lower(substring(md5(random()::text), 1, 8))
where referral_code is null;

create table if not exists public.referral_clicks (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null,
  advisor_id uuid references auth.users(id) on delete set null,
  listing_id uuid references public.advisor_directory(id) on delete set null,
  event_slug text,
  source_url text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.referral_clicks enable row level security;

create policy "Advisors see their own referral clicks"
  on public.referral_clicks
  for select
  using (auth.uid() = advisor_id);

create policy "Service role full access referral_clicks"
  on public.referral_clicks
  for all
  using (auth.role() = 'service_role');

create index if not exists referral_clicks_advisor_idx
  on public.referral_clicks (advisor_id, created_at desc);

create index if not exists referral_clicks_code_idx
  on public.referral_clicks (referral_code);
