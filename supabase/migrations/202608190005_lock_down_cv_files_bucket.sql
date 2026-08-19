-- ============================================================
-- 202608190005_lock_down_cv_files_bucket.sql
--
-- FIX (CV/applicant file security review, verified live 2026-08-19):
-- the `cv-files` Supabase Storage bucket is confirmed live PUBLIC
-- (storage.buckets.public = true) with two duplicate, unauthenticated
-- public-read policies ("Public CV read", "cv_files_select" — both
-- `to public using (bucket_id = 'cv-files')`, no ownership check). Anyone
-- who obtains an object's path can download it with no auth, no expiry,
-- forever. One real object currently sits in this bucket
-- (owner b770372f-3dd8-476a-b3ba-a79322af5f39, confirmed via storage.objects).
--
-- Confirmed by exhaustive grep across apps/mobile and www: NOTHING in the
-- current codebase (mobile or website) references the `cv-files` bucket by
-- name. The mobile app's actual, live CV upload path is entirely different
-- — it uploads via Cloudflare R2 under the `cv/{userId}/` prefix
-- (get-r2-upload-url), which has its own, separate, larger exposure
-- (documented separately — that path returns a permanent public R2 URL for
-- every non-verification prefix, and fixing it requires a mobile change
-- since mobile currently stores/opens that URL directly with no signed-URL
-- fetch step; NOT touched by this migration).
--
-- Because nothing live reads from `cv-files` via a public URL today, making
-- this bucket private is a zero-regression, backend-only fix: no app flow
-- currently depends on public access to it. This migration:
--   1. Flips the bucket to private (public = false).
--   2. Drops the two public-read SELECT policies.
--   3. Adds a single owner-only SELECT policy (same ownership check pattern
--      already used by the existing INSERT/UPDATE/DELETE policies on this
--      bucket — storage.foldername(name)[1] = auth.uid()::text), so the
--      bucket's one real owner can still self-access their own object, and
--      any future legitimate access (e.g. an employer-authorized
--      signed-URL flow) can be built as a service-role Edge Function, which
--      bypasses these RLS policies entirely by design — the standard
--      Supabase private-storage pattern.
--
-- The pre-existing duplicate INSERT/UPDATE/DELETE policy pairs (legacy
-- "Users can ... their own CV" + newer "cv_files_*") are NOT touched here —
-- they are already correctly owner-scoped; deduplicating them is unrelated
-- cleanup, out of scope for this security fix.
-- ============================================================

update storage.buckets set public = false where id = 'cv-files';

drop policy if exists "Public CV read" on storage.objects;
drop policy if exists "cv_files_select" on storage.objects;

create policy "cv_files_owner_select"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'cv-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- Verification (run after applying):
--   select public from storage.buckets where id = 'cv-files';                    -- expect false
--   select policyname, roles, cmd from pg_policies where schemaname='storage' and tablename='objects' and policyname ilike '%cv%';
--   -- expect no policy left with roles={public} and no ownership qual for SELECT
-- ============================================================
