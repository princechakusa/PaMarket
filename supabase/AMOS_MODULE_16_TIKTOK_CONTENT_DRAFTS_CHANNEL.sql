-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Module 16: allow 'tiktok' in amos_content_drafts.channel
--
-- Run manually in the Supabase SQL Editor.
--
-- Bug: amos_content_drafts_channel_check never included 'tiktok', so every
-- content-generator attempt to write a tiktok caption draft violated the
-- CHECK constraint and was rejected by Postgres — silently logged as
-- "TikTok caption: [object Object]" (a raw PostgREST error object, not an
-- Error instance) rather than a readable message, and the tiktok
-- placement never appeared in the Approval Queue.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE amos_content_drafts DROP CONSTRAINT amos_content_drafts_channel_check;
ALTER TABLE amos_content_drafts ADD CONSTRAINT amos_content_drafts_channel_check
  CHECK (channel = ANY (ARRAY['facebook'::text, 'instagram'::text, 'linkedin'::text, 'x'::text, 'tiktok'::text, 'website'::text, 'push'::text, 'email'::text]));
