-- Add planning-related columns to profiles (phone, age, risk, dependents, marital status).

alter table public.profiles
  add column if not exists phone text null,
  add column if not exists current_age integer null,
  add column if not exists retirement_age integer null,
  add column if not exists risk_tolerance text null default 'Moderate',
  add column if not exists dependents integer null default 0,
  add column if not exists marital_status text null default 'Single';
