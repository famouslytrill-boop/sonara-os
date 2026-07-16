-- SONARA paid-launch storage foundation.
-- Private by default. Organization files use:
--   <organization_id>/<owner_user_id>/<filename>
-- Avatar files use:
--   <owner_user_id>/<filename>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('business-assets', 'business-assets', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/csv']),
  ('creator-assets', 'creator-assets', false, 104857600, array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/wav', 'video/mp4', 'application/pdf']),
  ('music-stems', 'music-stems', false, 157286400, array['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac']),
  ('release-packages', 'release-packages', false, 157286400, array['application/zip', 'application/pdf', 'audio/mpeg', 'audio/wav']),
  ('support-attachments', 'support-attachments', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']),
  ('exports', 'exports', false, 52428800, array['application/zip', 'application/pdf', 'text/csv', 'application/json'])
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users can read own avatar objects" on storage.objects;
create policy "users can read own avatar objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users can create own avatar objects" on storage.objects;
create policy "users can create own avatar objects"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users can update own avatar objects" on storage.objects;
create policy "users can update own avatar objects"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users can delete own avatar objects" on storage.objects;
create policy "users can delete own avatar objects"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "organization members can read launch assets" on storage.objects;
create policy "organization members can read launch assets"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = any(array[
      'business-assets',
      'creator-assets',
      'music-stems',
      'release-packages',
      'support-attachments',
      'exports'
    ])
    and public.is_org_member(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (storage.foldername(name))[1]::uuid
        else null
      end
    )
  );

drop policy if exists "organization members can create owned launch assets" on storage.objects;
create policy "organization members can create owned launch assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = any(array[
      'business-assets',
      'creator-assets',
      'music-stems',
      'release-packages',
      'support-attachments',
      'exports'
    ])
    and auth.uid()::text = (storage.foldername(name))[2]
    and public.is_org_member(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (storage.foldername(name))[1]::uuid
        else null
      end
    )
  );

drop policy if exists "asset owners can update launch assets" on storage.objects;
create policy "asset owners can update launch assets"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = any(array[
      'business-assets',
      'creator-assets',
      'music-stems',
      'release-packages',
      'support-attachments',
      'exports'
    ])
    and auth.uid()::text = (storage.foldername(name))[2]
  )
  with check (
    bucket_id = any(array[
      'business-assets',
      'creator-assets',
      'music-stems',
      'release-packages',
      'support-attachments',
      'exports'
    ])
    and auth.uid()::text = (storage.foldername(name))[2]
    and public.is_org_member(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (storage.foldername(name))[1]::uuid
        else null
      end
    )
  );

drop policy if exists "asset owners can delete launch assets" on storage.objects;
create policy "asset owners can delete launch assets"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = any(array[
      'business-assets',
      'creator-assets',
      'music-stems',
      'release-packages',
      'support-attachments',
      'exports'
    ])
    and auth.uid()::text = (storage.foldername(name))[2]
    and public.is_org_member(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (storage.foldername(name))[1]::uuid
        else null
      end
    )
  );

comment on policy "organization members can read launch assets" on storage.objects is
  'Private organization assets. First path segment must be an active organization membership.';

comment on policy "organization members can create owned launch assets" on storage.objects is
  'Private organization assets. Second path segment must match the authenticated uploader.';
