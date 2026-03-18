-- Extended trust fields for estate tax UI
alter table public.trusts
  add column if not exists trust_type text not null default 'revocable',
  add column if not exists grantor text not null default '',
  add column if not exists trustee text not null default '',
  add column if not exists funding_amount numeric not null default 0 check (funding_amount >= 0),
  add column if not exists state text not null default '',
  add column if not exists is_irrevocable boolean not null default false,
  add column if not exists excludes_from_estate boolean not null default false;

update public.trusts
set
  funding_amount = excluded_from_estate,
  excludes_from_estate = excluded_from_estate > 0
where funding_amount = 0 and excluded_from_estate > 0;
