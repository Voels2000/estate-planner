-- Limit projection_scenarios base-case storage to one row per household per UTC day.
-- Same-day regenerations should overwrite the existing base-case row via upsert.

alter table if exists public.projection_scenarios
add column if not exists base_case_day date;

update public.projection_scenarios
set base_case_day = (coalesce(calculated_at, created_at, updated_at, now()) at time zone 'UTC')::date
where scenario_type = 'base_case'
  and base_case_day is null;

with ranked as (
  select
    id,
    row_number() over (
      partition by household_id, base_case_day
      order by updated_at desc nulls last, calculated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.projection_scenarios
  where scenario_type = 'base_case'
    and base_case_day is not null
)
delete from public.projection_scenarios p
using ranked r
where p.id = r.id
  and r.rn > 1;

create unique index if not exists projection_scenarios_household_base_case_day_uniq
  on public.projection_scenarios (household_id, base_case_day);
