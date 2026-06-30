-- Directory outreach seed + professional claim columns (state-agnostic)

alter table public.advisor_directory
  add column if not exists crd_number text,
  add column if not exists credential_verified_at timestamptz,
  add column if not exists claimed_at timestamptz,
  add column if not exists source text;

create unique index if not exists advisor_directory_crd_uniq
  on public.advisor_directory (crd_number)
  where crd_number is not null;

alter table public.attorney_listings
  add column if not exists claim_token text,
  add column if not exists claim_token_created_at timestamptz,
  add column if not exists credential_verified_at timestamptz,
  add column if not exists claimed_at timestamptz,
  add column if not exists source text;

create unique index if not exists attorney_listings_claim_token_uniq
  on public.attorney_listings (claim_token)
  where claim_token is not null;

comment on column public.advisor_directory.credential_verified_at is
  'WSBA/FINRA confirm timestamp — drives public verified badge (not is_verified).';
comment on column public.attorney_listings.credential_verified_at is
  'WSBA confirm timestamp — drives public verified badge (not is_verified).';
comment on column public.advisor_directory.source is
  'Provenance tag, e.g. outreach_seed — for batch rollback.';
comment on column public.attorney_listings.source is
  'Provenance tag, e.g. outreach_seed — for batch rollback.';
