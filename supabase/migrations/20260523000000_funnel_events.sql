-- Sprint 5: custom funnel event tracking (complements Vercel Analytics page views)

create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  properties jsonb not null default '{}',
  referral_code text,
  event_slug text,
  source_url text,
  created_at timestamptz not null default now()
);

alter table public.funnel_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'funnel_events'
      and policyname = 'Users read own funnel events'
  ) then
    create policy "Users read own funnel events"
      on public.funnel_events for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'funnel_events'
      and policyname = 'Service role full access funnel_events'
  ) then
    create policy "Service role full access funnel_events"
      on public.funnel_events for all
      using (auth.role() = 'service_role');
  end if;
end $$;

create index if not exists funnel_events_name_idx
  on public.funnel_events (event_name, created_at desc);
create index if not exists funnel_events_slug_idx
  on public.funnel_events (event_slug, created_at desc);
create index if not exists funnel_events_referral_idx
  on public.funnel_events (referral_code, created_at desc);
create index if not exists funnel_events_user_idx
  on public.funnel_events (user_id, created_at desc);
