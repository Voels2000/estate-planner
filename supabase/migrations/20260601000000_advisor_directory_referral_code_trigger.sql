-- Add referral code auto-generation trigger to advisor_directory
-- Mirrors attorney_listings_referral_code_trigger pattern (see seed-test-attorney backfill if attorney trigger absent)

create or replace function public.generate_advisor_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null then
    new.referral_code := lower(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
  end if;
  return new;
end;
$$;

drop trigger if exists advisor_directory_referral_code_trigger on public.advisor_directory;

create trigger advisor_directory_referral_code_trigger
  before insert on public.advisor_directory
  for each row
  execute function public.generate_advisor_referral_code();
