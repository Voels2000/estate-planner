-- Sprint: Import Expansion + Attorney Workflow — document status lifecycle
alter table legal_documents
  add column if not exists doc_status text default 'uploaded'
    check (doc_status in ('draft', 'pending_execution', 'executed', 'recorded', 'superseded', 'uploaded'));

alter table legal_documents
  add column if not exists executed_date date;

alter table legal_documents
  add column if not exists status_notes text;

-- Track attorney-dismissed document gap alerts per household
create table if not exists document_gap_dismissals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  attorney_id uuid not null references auth.users(id) on delete cascade,
  gap_key text not null,
  note text,
  dismissed_at timestamptz not null default now(),
  unique (household_id, attorney_id, gap_key)
);

alter table document_gap_dismissals enable row level security;

drop policy if exists "Attorneys manage own gap dismissals" on document_gap_dismissals;

create policy "Attorneys manage own gap dismissals"
  on document_gap_dismissals for all
  using (attorney_id = auth.uid())
  with check (attorney_id = auth.uid());

-- Attorney subscription tier on profiles
alter table profiles
  add column if not exists attorney_tier int default 0;

comment on column profiles.attorney_tier is '0=free read-only, 1=Starter (15 clients), 2=Growth (50 clients)';
