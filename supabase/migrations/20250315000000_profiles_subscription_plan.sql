-- Add subscription_plan (Stripe price ID) to profiles for billing/portal.
alter table public.profiles
  add column if not exists subscription_plan text;
