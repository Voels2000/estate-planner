-- Sprint 8: attorney referral attribution
-- Adds referral_code to attorney_listings and extends referral_clicks
-- for attorney click tracking parallel to advisor_directory pattern.
--
-- FK semantics:
--   attorney_listings.id       → referral_clicks.attorney_listing_id
--   attorney_listings.profile_id → referral_clicks.attorney_profile_id (auth.users)
--   advisor path unchanged: listing_id → advisor_directory(id), advisor_id → auth.users

-- ── 1. attorney_listings: add referral_code ──────────────────────────────────
alter table public.attorney_listings
  add column if not exists referral_code text unique;

-- Auto-generate codes for all existing rows that don't have one.
-- Same pattern as advisor_referrals migration.
update public.attorney_listings
set referral_code = lower(substring(md5(random()::text), 1, 8))
where referral_code is null;

create index if not exists attorney_listings_referral_code_idx
  on public.attorney_listings (referral_code);

-- ── 2. referral_clicks: add attorney columns ─────────────────────────────────
alter table public.referral_clicks
  add column if not exists listing_type text
    not null default 'advisor'
    check (listing_type in ('advisor', 'attorney'));

alter table public.referral_clicks
  add column if not exists attorney_listing_id uuid
    references public.attorney_listings(id) on delete set null;

alter table public.referral_clicks
  add column if not exists attorney_profile_id uuid
    references auth.users(id) on delete set null;

create index if not exists referral_clicks_attorney_listing_idx
  on public.referral_clicks (attorney_listing_id, created_at desc);

create index if not exists referral_clicks_listing_type_idx
  on public.referral_clicks (listing_type, created_at desc);

-- ── 3. RLS: attorneys read their own click rows ──────────────────────────────
-- Existing advisor policy: auth.uid() = advisor_id
-- New attorney policy: auth.uid() = attorney_profile_id
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'referral_clicks'
      and policyname = 'Attorneys read own referral clicks'
  ) then
    create policy "Attorneys read own referral clicks"
      on public.referral_clicks for select
      using (auth.uid() = attorney_profile_id);
  end if;
end $$;
