-- Plan & Export refund-policy acknowledgment (per-purchase chargeback evidence).

alter table public.one_time_purchases
  add column if not exists refund_ack_at timestamptz,
  add column if not exists refund_ack_version text;
