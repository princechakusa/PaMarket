-- ============================================================
-- 202608190006_add_cv_file_path.sql
--
-- CV security/functionality fix, phase 2 (backend for the private cv-files
-- upload flow). profiles.cv_file_url is a plain text field long used for
-- two different things: (a) a candidate pasting an external CV link they
-- host themselves (Google Drive, etc. — never our data, never insecure,
-- untouched by this migration), and (b) formerly, an R2 public URL for an
-- in-app "upload" (actually an image picker — being replaced).
--
-- Per the security review's explicit preference for clarity over silently
-- repurposing an existing public-URL field: this adds a NEW, clearly named
-- column, cv_file_path, that stores the PRIVATE cv-files bucket's internal
-- object path (e.g. "{userId}/{uuid}.pdf") — never a URL, never publicly
-- resolvable on its own, only usable via the new authorized signed-URL
-- endpoint. cv_file_url keeps its existing meaning (external link) and is
-- unaffected.
--
-- No data migration: confirmed live immediately before this migration that
-- profiles.cv_file_url is NULL for every production profile (no real CV
-- data exists to migrate).
-- ============================================================

alter table public.profiles
  add column if not exists cv_file_path text;

comment on column public.profiles.cv_file_path is
  'Internal object path (not a URL) within the private cv-files Supabase Storage bucket, e.g. "{user_id}/{uuid}.pdf". Resolved to a short-lived signed URL only via the get-cv-url Edge Function after an authorization check. Distinct from cv_file_url, which holds an externally-hosted link the candidate pasted themselves and is not our data to protect.';
