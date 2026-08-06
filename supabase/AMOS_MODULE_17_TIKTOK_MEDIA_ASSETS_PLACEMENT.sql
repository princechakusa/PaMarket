-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Module 17: allow 'tiktok' in amos_media_assets.placement
--
-- Run manually in the Supabase SQL Editor.
--
-- Same bug shape as Module 16 (amos_content_drafts.channel): the
-- placement CHECK constraint on amos_media_assets never included
-- 'tiktok', so attaching a manual video to a TikTok draft (via "Attach My
-- Own") fails with "new row for relation amos_media_assets violates
-- check constraint amos_media_assets_placement_check".
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE amos_media_assets DROP CONSTRAINT amos_media_assets_placement_check;
ALTER TABLE amos_media_assets ADD CONSTRAINT amos_media_assets_placement_check
  CHECK (placement = ANY (ARRAY['facebook'::text, 'instagram'::text, 'linkedin'::text, 'x'::text, 'tiktok'::text, 'blog_header'::text, 'website_banner'::text, 'story'::text, 'square'::text, 'landscape'::text, 'portrait'::text]));
