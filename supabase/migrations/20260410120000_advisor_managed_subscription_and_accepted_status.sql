-- Allow advisor-invited clients: profiles.subscription_status = advisor_managed
-- and advisor_clients.status = accepted (used by link-pending + my-advisor).

alter table public.profiles
  drop constraint if exists profiles_subscription_status_check;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (
    subscription_status is null
    or subscription_status in (
      'none',
      'active',
      'canceled',
      'past_due',
      'trialing',
      'unpaid',
      'canceling',
      'advisor_managed'
    )
  );

alter table public.advisor_clients
  drop constraint if exists advisor_clients_status_check;

alter table public.advisor_clients
  add constraint advisor_clients_status_check
  check (
    status in (
      'pending',
      'active',
      'accepted',
      'consumer_requested',
      'removed',
      'declined'
    )
  );
