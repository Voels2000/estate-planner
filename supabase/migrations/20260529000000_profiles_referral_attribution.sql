-- Sprint 9: persist signup referral attribution on consumer profiles
-- Written once from app/(auth)/signup/_signup-form.tsx after account creation.
-- Values are the ?ref= / ?aref= codes from sessionStorage (not FKs to directory tables).

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists attorney_referral_code text;

comment on column public.profiles.referral_code is
  'Advisor referral code from event page ?ref= at signup (join to advisor_directory.referral_code)';

comment on column public.profiles.attorney_referral_code is
  'Attorney referral code from event page ?aref= at signup (join to attorney_listings.referral_code)';

create index if not exists profiles_referral_code_idx
  on public.profiles (referral_code)
  where referral_code is not null;

create index if not exists profiles_attorney_referral_code_idx
  on public.profiles (attorney_referral_code)
  where attorney_referral_code is not null;
