-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Module 2 follow-up: Quality tracking, scoring, categories,
-- learning-data preservation
--
-- Run manually in the Supabase SQL Editor, after Module 0, 1, and 2.
-- Additive only. Does NOT change the approval workflow — scores are
-- visible context for the human reviewer, never a gate.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Quality tracking ────────────────────────────────────────────────
-- ai_provider/ai_model/created_at already exist on amos_content_drafts
-- (Module 0). market_intelligence_id (topic source) already exists on
-- amos_content_items (Module 0). Only prompt_version is new — lets a
-- future prompt-wording change be traced against which drafts used it.
ALTER TABLE amos_content_drafts ADD COLUMN IF NOT EXISTS prompt_version text;

-- ── 2. Content scoring ──────────────────────────────────────────────────
-- Self-reported by the model in the same generation call that writes the
-- draft (no extra API cost/latency). 0-100. Visible in the Approval Queue
-- as context only — never blocks or auto-rejects a draft.
ALTER TABLE amos_content_drafts ADD COLUMN IF NOT EXISTS relevance_score smallint CHECK (relevance_score BETWEEN 0 AND 100);
ALTER TABLE amos_content_drafts ADD COLUMN IF NOT EXISTS brand_alignment_score smallint CHECK (brand_alignment_score BETWEEN 0 AND 100);
ALTER TABLE amos_content_drafts ADD COLUMN IF NOT EXISTS engagement_prediction_score smallint CHECK (engagement_prediction_score BETWEEN 0 AND 100);
ALTER TABLE amos_content_drafts ADD COLUMN IF NOT EXISTS seo_value_score smallint CHECK (seo_value_score BETWEEN 0 AND 100);

-- ── 3. Content categories ────────────────────────────────────────────────
-- Widened to the app's real 12 listing categories (apps/mobile/lib/
-- constants.ts CATEGORIES — load-bearing ids, not renamed here) plus the
-- two non-listing campaign types Module 0 already had. "Business" is
-- deliberately NOT a category value — it maps to 'services' at the
-- content-generation layer, never stored as its own category.
ALTER TABLE amos_content_items DROP CONSTRAINT IF EXISTS amos_content_items_category_check;
ALTER TABLE amos_content_items ADD CONSTRAINT amos_content_items_category_check
  CHECK (category IN (
    'property','vehicles','rooms','electronics','jobs','furniture',
    'fashion','services','agriculture','pets','kids','other',
    'brand','seasonal'
  ));

ALTER TABLE amos_content_items ADD COLUMN IF NOT EXISTS target_audience text;
ALTER TABLE amos_content_items ADD COLUMN IF NOT EXISTS campaign_type text
  CHECK (campaign_type IN ('seasonal','promotional','spotlight','evergreen','urgent') OR campaign_type IS NULL);
-- country_code already exists.

-- ── 4. Learning data preservation ────────────────────────────────────────
-- Publish-time performance already has a home: amos_learning_signals
-- (Module 0), populated once Module 4+ ships publishing. That table can't
-- capture what happens BEFORE publishing though — an approve/edit/reject/
-- delete is itself a training signal ("the human changed this AI output
-- in this way, for this reason") and today nothing structured records it.
--
-- amos_content_feedback is that record: one row written automatically for
-- every approve/edit/reject action (via the admin panel's existing
-- functions, Module 2's approveAmosDraft/rejectAmosDraft/
-- saveAmosDraftEdit — no new UI needed, they already have every field
-- this table needs) and via a BEFORE DELETE trigger so a hard delete can
-- never silently destroy the signal, even if someone deletes a row
-- directly in the SQL editor rather than through the app.
CREATE TABLE IF NOT EXISTS amos_content_feedback (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id            uuid,             -- not a hard FK: must survive the draft's own deletion
  content_item_id     uuid,
  action              text NOT NULL CHECK (action IN ('approved','edited','rejected','deleted')),
  channel             text,
  draft_type          text,
  category             text,
  topic               text,
  ai_provider          text,
  ai_model             text,
  prompt_version       text,
  relevance_score            smallint,
  brand_alignment_score      smallint,
  engagement_prediction_score smallint,
  seo_value_score             smallint,
  before_body         text,
  after_body          text,
  reason              text,
  actor_id            uuid,
  actor_email         text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amos_feedback_action ON amos_content_feedback (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_amos_feedback_category ON amos_content_feedback (category, action);
ALTER TABLE amos_content_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_feedback team" ON amos_content_feedback;
CREATE POLICY "amos_feedback team" ON amos_content_feedback FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- Safety net: captures the full draft into amos_content_feedback the
-- instant before a DELETE actually removes it, regardless of what deleted
-- it (admin panel action, a future cleanup job, or a manual SQL delete).
CREATE OR REPLACE FUNCTION amos_capture_draft_deletion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO amos_content_feedback (
    draft_id, content_item_id, action, channel, draft_type, category, topic,
    ai_provider, ai_model, prompt_version,
    relevance_score, brand_alignment_score, engagement_prediction_score, seo_value_score,
    before_body, after_body, reason
  )
  SELECT
    OLD.id, OLD.content_item_id, 'deleted', OLD.channel, OLD.draft_type,
    ci.category, ci.title,
    OLD.ai_provider, OLD.ai_model, OLD.prompt_version,
    OLD.relevance_score, OLD.brand_alignment_score, OLD.engagement_prediction_score, OLD.seo_value_score,
    OLD.body, NULL, 'row deleted'
  FROM amos_content_items ci WHERE ci.id = OLD.content_item_id;
  -- Content item may already be gone (cascade from content_items delete);
  -- fall back to a feedback row with NULL category/topic rather than
  -- failing the delete outright.
  IF NOT FOUND THEN
    INSERT INTO amos_content_feedback (
      draft_id, content_item_id, action, channel, draft_type,
      ai_provider, ai_model, prompt_version,
      relevance_score, brand_alignment_score, engagement_prediction_score, seo_value_score,
      before_body, reason
    ) VALUES (
      OLD.id, OLD.content_item_id, 'deleted', OLD.channel, OLD.draft_type,
      OLD.ai_provider, OLD.ai_model, OLD.prompt_version,
      OLD.relevance_score, OLD.brand_alignment_score, OLD.engagement_prediction_score, OLD.seo_value_score,
      OLD.body, 'row deleted'
    );
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS amos_content_drafts_capture_delete ON amos_content_drafts;
CREATE TRIGGER amos_content_drafts_capture_delete
  BEFORE DELETE ON amos_content_drafts
  FOR EACH ROW EXECUTE FUNCTION amos_capture_draft_deletion();

-- ── Rate limiting for manual triggers (research runner + content
--    generator) ───────────────────────────────────────────────────────
-- One row per manual invocation attempt (successful or rejected for rate
-- limiting), keyed by actor. The edge functions check this table before
-- doing any work and reject with 429 if the same admin has triggered the
-- same function more than the allowed number of times in the window.
CREATE TABLE IF NOT EXISTS amos_manual_trigger_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fn_name    text NOT NULL,
  actor_id   uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amos_trigger_log_rate ON amos_manual_trigger_log (fn_name, actor_id, created_at DESC);
ALTER TABLE amos_manual_trigger_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_trigger_log service" ON amos_manual_trigger_log;
-- Service-role only (edge functions use the service key) — no admin-team
-- policy needed since the admin panel never reads/writes this table
-- directly, only the functions do via SUPABASE_SERVICE_ROLE_KEY, which
-- bypasses RLS entirely. This blocks it from anon/authenticated roles.
CREATE POLICY "amos_trigger_log service" ON amos_manual_trigger_log FOR ALL
  USING (false) WITH CHECK (false);
