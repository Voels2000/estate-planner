-- One-time consumer purchases (Plan & Export SKU). Service-role writes via webhook; owners read own rows.

create table public.one_time_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sku text not null,
  stripe_checkout_session_id text not null,
  stripe_payment_intent_id text,
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'completed',
  credit_applied_at timestamptz,
  purchased_at timestamptz not null default now(),
  edit_window_ends_at timestamptz not null,
  warning_14d_sent_at timestamptz,
  warning_3d_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index one_time_purchases_session_uidx
  on public.one_time_purchases (stripe_checkout_session_id);

create index one_time_purchases_user_idx
  on public.one_time_purchases (user_id);

create index one_time_purchases_window_idx
  on public.one_time_purchases (edit_window_ends_at)
  where credit_applied_at is null;

alter table public.one_time_purchases enable row level security;

create policy "owner reads own one_time_purchases"
  on public.one_time_purchases for select
  using (auth.uid() = user_id);
