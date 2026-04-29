create table if not exists public.education_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_slug text not null,
  completed boolean not null default true,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module_slug)
);

alter table public.education_progress enable row level security;

create policy "education_progress_select_own"
on public.education_progress
for select
using (auth.uid() = user_id);

create policy "education_progress_insert_own"
on public.education_progress
for insert
with check (auth.uid() = user_id);

create policy "education_progress_update_own"
on public.education_progress
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_education_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_education_progress_updated_at on public.education_progress;
create trigger trg_education_progress_updated_at
before update on public.education_progress
for each row
execute function public.set_education_progress_updated_at();

