-- Policy owner on life & estate insurance (select: person1, person2, trust, other)

alter table public.insurance_policies
  add column if not exists owner text;
