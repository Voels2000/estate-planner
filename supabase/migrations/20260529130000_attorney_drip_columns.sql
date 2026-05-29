-- Attorney onboarding drip tracking on profiles (attorney_drip_step_1_sent_at … _3)
alter table public.profiles
  add column if not exists attorney_drip_step_1_sent_at timestamptz,
  add column if not exists attorney_drip_step_2_sent_at timestamptz,
  add column if not exists attorney_drip_step_3_sent_at timestamptz;

comment on column public.profiles.attorney_drip_step_1_sent_at is
  'Attorney welcome drip — step 1 (immediate on activation)';
comment on column public.profiles.attorney_drip_step_2_sent_at is
  'Attorney welcome drip — step 2 (day 3, intake workflow)';
comment on column public.profiles.attorney_drip_step_3_sent_at is
  'Attorney welcome drip — step 3 (day 7, upgrade prompt)';
