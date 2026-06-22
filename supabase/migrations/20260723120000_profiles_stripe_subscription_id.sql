-- Consumer Stripe subscription id — referenced by checkout webhook, cancel route, and admin sync.
-- Original profiles bootstrap (20250313120000) included this column; some environments never received it.

alter table public.profiles
  add column if not exists stripe_subscription_id text;

comment on column public.profiles.stripe_subscription_id is
  'Stripe Subscription id (sub_...) for direct consumer billing; set by checkout webhook and reconciliation paths.';
