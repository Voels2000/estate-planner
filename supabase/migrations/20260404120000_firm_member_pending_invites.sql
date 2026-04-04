-- Allow firm owners to invite advisors by email before a user_id exists;
-- add owner update policy for soft-removing members.

alter table public.firm_members drop constraint if exists firm_members_firm_id_user_id_key;

alter table public.firm_members alter column user_id drop not null;

alter table public.firm_members add column if not exists invited_email text;
alter table public.firm_members add column if not exists invite_token text;

create unique index if not exists firm_members_firm_user_unique
  on public.firm_members (firm_id, user_id)
  where user_id is not null;

create unique index if not exists firm_members_firm_invited_email_unique
  on public.firm_members (firm_id, lower(trim(invited_email)))
  where invited_email is not null and status <> 'removed';

alter table public.firm_members add constraint firm_members_invite_or_user check (
  user_id is not null
  or (invited_email is not null and invite_token is not null)
);

create policy firm_members_owner_update
  on public.firm_members for update
  using (
    firm_id in (select id from public.firms where owner_id = auth.uid())
  )
  with check (
    firm_id in (select id from public.firms where owner_id = auth.uid())
  );
