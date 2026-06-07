-- Advisor firm logo uploads for PDF / meeting brief branding (profiles.firm_logo_url)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'advisor-branding',
  'advisor-branding',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Advisors upload/update/delete only under their own folder: {user_id}/logo.{ext}
drop policy if exists "advisor_branding_insert_own" on storage.objects;
create policy "advisor_branding_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'advisor-branding'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "advisor_branding_update_own" on storage.objects;
create policy "advisor_branding_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'advisor-branding'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'advisor-branding'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "advisor_branding_delete_own" on storage.objects;
create policy "advisor_branding_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'advisor-branding'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "advisor_branding_public_read" on storage.objects;
create policy "advisor_branding_public_read"
on storage.objects for select
to public
using (bucket_id = 'advisor-branding');
