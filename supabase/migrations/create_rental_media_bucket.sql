-- ============================================================
-- create_rental_media_bucket.sql
--
-- ROOT CAUSE of "vehicle photo upload fails": the rental-media storage
-- bucket does not exist in the live project. It was defined inside
-- rental_hardening.sql (Task 1) but that migration was never fully run,
-- so sb.storage.from('rental-media').upload(...) rejects with
-- "Bucket not found" and no vehicle can get images.
--
-- This standalone, idempotent migration creates the bucket and its
-- storage.objects policies. Safe to run more than once. Run in the
-- Supabase SQL Editor.
-- ============================================================

-- Private bucket, 8 MB max per file, image types only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rental-media',
  'rental-media',
  false,
  8388608,  -- 8 MB
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Authenticated users can upload (listing ownership is enforced by the
-- rental_vehicle_media RLS + the app writing under a {user_id}/ prefix).
drop policy if exists "rental-media: authenticated upload" on storage.objects;
create policy "rental-media: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'rental-media'
    and auth.role() = 'authenticated'
  );

-- Authenticated read. Customer-facing images use long-lived signed URLs,
-- which bypass this policy, so anonymous browsing still works.
drop policy if exists "rental-media: authenticated read" on storage.objects;
create policy "rental-media: authenticated read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'rental-media');

-- Owner (by folder prefix = user_id) can delete their own objects.
drop policy if exists "rental-media: owner delete" on storage.objects;
create policy "rental-media: owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'rental-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── VERIFY (optional) ────────────────────────────────────────────────
-- select id, public, file_size_limit from storage.buckets where id = 'rental-media';
-- ============================================================
