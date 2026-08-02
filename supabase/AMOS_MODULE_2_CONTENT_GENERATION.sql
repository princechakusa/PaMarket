-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Module 2: Content Generation (schema widening)
--
-- Run manually in the Supabase SQL Editor, after Module 0 and Module 1.
-- Additive only — no data is touched, no columns are removed.
--
-- Module 0's amos_content_drafts.channel CHECK only allowed 'facebook'
-- (the only channel live at launch, per the original brief). Module 2
-- generates drafts for all 7 required placements — Facebook, Instagram,
-- LinkedIn, X, the website/blog, push, and email — so channel needs to
-- admit the non-social-API placements too. draft_type does NOT need
-- widening: 'post' (social posts), 'article' (blog/SEO), 'notification'
-- (push), and 'email' already cover every placement type in Module 0's
-- original schema.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE amos_content_drafts DROP CONSTRAINT IF EXISTS amos_content_drafts_channel_check;
ALTER TABLE amos_content_drafts ADD CONSTRAINT amos_content_drafts_channel_check
  CHECK (channel IN ('facebook','instagram','linkedin','x','website','push','email'));
