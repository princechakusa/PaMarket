-- S2 (Final Pre-Release Repository Audit): the Supabase Storage
-- "chat-images" bucket was public, and its SELECT policy ("Public read for
-- chat images") targeted role `public` (i.e. anon + authenticated) with no
-- ownership check at all -- bucket_id = 'chat-images' was the entire
-- condition. Anyone who knew or guessed an object path could read it,
-- signed in or not.
--
-- Investigation before this migration (see the accompanying report)
-- established the actual mobile chat-image flow does NOT use this bucket
-- at all -- chat images are uploaded to Cloudflare R2 via the
-- get-r2-upload-url edge function (apps/mobile/lib/uploadToR2.ts,
-- apps/mobile/app/chat/[id].tsx), scoped server-side to chat/{user.id}/.
-- A repo-wide search found zero application-code references to the
-- Supabase "chat-images" bucket anywhere (mobile, admin, website, edge
-- functions), and it is confirmed live to contain zero objects, ever
-- (storage.objects count = 0, no created_at range) -- this bucket predates
-- or was superseded by the R2-based flow and was never actually used.
--
-- Because it is verifiably unused, hardening it carries zero functional
-- risk to the live app. Two changes:
--   1. Flip the bucket to private (blocks the unauthenticated
--      /object/public/ URL shortcut entirely).
--   2. Replace the blanket "any signed-in-or-not reader" SELECT policy
--      with an owner-scoped one, mirroring the exact pattern the existing
--      INSERT/DELETE policies on this same bucket already use
--      (split_part(name, '/', 2) = auth.uid()::text) -- the closest
--      available proxy for "authorized viewer" given the object path only
--      encodes the uploader's own id, not a conversation id.
-- INSERT ("Authenticated users can upload chat images") and DELETE
-- ("Users can delete their own chat images") policies are untouched --
-- both were already correctly owner-scoped.
--
-- Real chat-image protection (the R2/get-r2-upload-url path) is a
-- separate, cross-provider (Cloudflare) system and is explicitly out of
-- scope for this migration -- see the accompanying report for that
-- follow-up item.
--
-- Applied live via mcp__supabase__apply_migration on 2026-09-16 and
-- verified: bucket public=false, SELECT policy is now owner-scoped
-- (authenticated role only), INSERT/DELETE policies unchanged.

update storage.buckets set public = false where id = 'chat-images';

drop policy if exists "Public read for chat images" on storage.objects;
create policy "Owner can read their own chat images" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-images' and split_part(name, '/', 2) = auth.uid()::text);
