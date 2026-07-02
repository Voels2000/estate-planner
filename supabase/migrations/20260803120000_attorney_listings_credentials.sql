-- Attorney directory credentials[] — parity with advisor_directory.credentials

alter table public.attorney_listings
  add column if not exists credentials text[] not null default '{}';

comment on column public.attorney_listings.credentials is
  'Structured credential tags (JD, ACTEC, LL.M., etc.) — seed import + self-attested claim.';
