-- B2B2C connection billing audit columns + attorney_managed subscription status.

-- advisor_clients: billing handoff audit (may already exist in prod)
ALTER TABLE public.advisor_clients
  ADD COLUMN IF NOT EXISTS billing_transferred BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS billing_transferred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS previous_consumer_tier INTEGER,
  ADD COLUMN IF NOT EXISTS consumer_subscription_cancel_at TIMESTAMPTZ;

-- attorney_clients: same audit columns for optional attorney handoff
ALTER TABLE public.attorney_clients
  ADD COLUMN IF NOT EXISTS billing_transferred BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS billing_transferred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS previous_consumer_tier INTEGER,
  ADD COLUMN IF NOT EXISTS consumer_subscription_cancel_at TIMESTAMPTZ;

-- profiles.subscription_status: allow attorney_managed (advisor_managed already present)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (
    subscription_status IS NULL
    OR subscription_status IN (
      'none',
      'active',
      'canceled',
      'past_due',
      'trialing',
      'unpaid',
      'canceling',
      'advisor_managed',
      'attorney_managed'
    )
  );
