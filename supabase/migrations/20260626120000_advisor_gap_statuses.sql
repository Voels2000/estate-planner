-- Advisor-private planning gap workflow (Open / Discussed / Deferred / Resolved)

create table if not exists public.advisor_gap_statuses (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  gap_key text not null,
  status text not null default 'open'
    check (status in ('open', 'discussed', 'deferred', 'resolved')),
  note text,
  updated_at timestamptz not null default now(),
  unique (advisor_id, client_id, gap_key)
);

create index if not exists advisor_gap_statuses_advisor_client_idx
  on public.advisor_gap_statuses (advisor_id, client_id);

alter table public.advisor_gap_statuses enable row level security;

create policy "Advisor can manage own gap statuses"
  on public.advisor_gap_statuses
  for all
  using (advisor_id = auth.uid())
  with check (advisor_id = auth.uid());
