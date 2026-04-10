-- Family roster for estate planning (beneficiary / GST context)

create table if not exists public.household_people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  full_name text not null,
  relationship text not null default 'Other',
  date_of_birth date,
  is_gst_skip boolean not null default false,
  is_beneficiary boolean not null default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists household_people_household_id_idx
  on public.household_people (household_id);

alter table public.household_people enable row level security;

-- PostgreSQL has no "create policy if not exists"; guard via pg_policies for idempotent runs.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'household_people'
      and policyname = 'Users can view household_people for own household'
  ) then
    create policy "Users can view household_people for own household"
      on public.household_people for select
      using (
        exists (
          select 1 from public.households h
          where h.id = household_people.household_id
            and h.owner_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'household_people'
      and policyname = 'Users can insert household_people for own household'
  ) then
    create policy "Users can insert household_people for own household"
      on public.household_people for insert
      with check (
        exists (
          select 1 from public.households h
          where h.id = household_people.household_id
            and h.owner_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'household_people'
      and policyname = 'Users can update household_people for own household'
  ) then
    create policy "Users can update household_people for own household"
      on public.household_people for update
      using (
        exists (
          select 1 from public.households h
          where h.id = household_people.household_id
            and h.owner_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'household_people'
      and policyname = 'Users can delete household_people for own household'
  ) then
    create policy "Users can delete household_people for own household"
      on public.household_people for delete
      using (
        exists (
          select 1 from public.households h
          where h.id = household_people.household_id
            and h.owner_id = auth.uid()
        )
      );
  end if;
end
$$;
