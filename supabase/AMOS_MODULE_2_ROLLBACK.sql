-- ════════════════════════════════════════════════════════════════════════
-- AMOS Module 2 — Rollback
--
-- Reverts both AMOS_MODULE_2_CONTENT_GENERATION.sql and
-- AMOS_MODULE_2_QUALITY_LAYER.sql. This was the one module (of nine)
-- without a rollback script — added during the Production Readiness
-- Audit remediation pass (Medium #6).
--
-- Order matters: widened CHECK constraints are reverted to Module 0's
-- original values FIRST (which will fail loudly if any existing row uses
-- a value outside the original set — e.g. a draft with channel='email'
-- — surfacing the conflict instead of silently corrupting data), then
-- the added columns/tables/trigger are dropped.
-- ════════════════════════════════════════════════════════════════════════

-- Revert amos_content_drafts.channel to Module 0's original single value.
-- Will raise a constraint violation if any row has a non-'facebook'
-- channel — expected and correct if Module 5's push/email/instagram
-- drafts still exist; resolve by deleting/reassigning those rows first
-- if a full revert to Module 0's state is truly intended.
ALTER TABLE amos_content_drafts DROP CONSTRAINT IF EXISTS amos_content_drafts_channel_check;
ALTER TABLE amos_content_drafts ADD CONSTRAINT amos_content_drafts_channel_check
  CHECK (channel IN ('facebook'));

-- Revert amos_content_items.category to Module 0's original placeholder
-- enum. Same caveat: fails loudly if any row uses one of the real
-- marketplace categories introduced in the quality layer.
ALTER TABLE amos_content_items DROP CONSTRAINT IF EXISTS amos_content_items_category_check;
ALTER TABLE amos_content_items ADD CONSTRAINT amos_content_items_category_check
  CHECK (category IN ('marketplace','jobs','vehicles','properties','rentals','brand','seasonal'));

DROP TRIGGER IF EXISTS amos_content_drafts_capture_delete ON amos_content_drafts;
DROP FUNCTION IF EXISTS amos_capture_draft_deletion();

DROP TABLE IF EXISTS amos_manual_trigger_log CASCADE;
DROP TABLE IF EXISTS amos_content_feedback CASCADE;

ALTER TABLE amos_content_items DROP COLUMN IF EXISTS campaign_type;
ALTER TABLE amos_content_items DROP COLUMN IF EXISTS target_audience;

ALTER TABLE amos_content_drafts DROP COLUMN IF EXISTS seo_value_score;
ALTER TABLE amos_content_drafts DROP COLUMN IF EXISTS engagement_prediction_score;
ALTER TABLE amos_content_drafts DROP COLUMN IF EXISTS brand_alignment_score;
ALTER TABLE amos_content_drafts DROP COLUMN IF EXISTS relevance_score;
ALTER TABLE amos_content_drafts DROP COLUMN IF EXISTS prompt_version;
