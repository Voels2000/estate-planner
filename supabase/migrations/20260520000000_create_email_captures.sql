-- Email captures from public assessment and event flows

create table if not exists public.email_captures (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'unknown',
  score integer,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (email, source)
);

alter table public.email_captures enable row level security;

-- Service role (admin client / SQL editor) has full access
create policy "Service role full access"
  on public.email_captures for all
  using (auth.role() = 'service_role');

-- Anonymous and authenticated users may insert via API route (no public read)
create policy "Allow insert via API"
  on public.email_captures
  for insert
  to anon, authenticated
  with check (true);
