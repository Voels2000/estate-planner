-- Life events logged by users or age-based calendar triggers

create table if not exists public.life_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  event_date date,
  acknowledged boolean not null default false,
  source text not null default 'user',
  created_at timestamptz not null default now()
);

create index if not exists life_events_user_id_idx
  on public.life_events(user_id);

create index if not exists life_events_user_unacknowledged_idx
  on public.life_events(user_id, acknowledged)
  where acknowledged = false;

alter table public.life_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'life_events'
      and policyname = 'Users own their life events'
  ) then
    create policy "Users own their life events"
      on public.life_events
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
