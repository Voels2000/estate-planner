-- Assessment results table
-- Stores planning readiness assessment scores and answers per user

create table if not exists public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at timestamptz not null default now(),
  overall_score integer not null,
  financial_score integer not null,
  retirement_score integer not null,
  estate_score integer not null,
  financial_pct integer not null,
  retirement_pct integer not null,
  estate_pct integer not null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Index for fast user lookups
create index if not exists assessment_results_user_id_idx
  on public.assessment_results(user_id);

-- RLS
alter table public.assessment_results enable row level security;

-- Users can only read and write their own results
create policy "Users can insert own assessment results"
  on public.assessment_results
  for insert
  with check (auth.uid() = user_id);

create policy "Users can read own assessment results"
  on public.assessment_results
  for select
  using (auth.uid() = user_id);
