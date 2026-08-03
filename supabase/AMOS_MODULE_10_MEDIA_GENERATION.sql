-- AMOS Module 10 — AI Media Generation (images now, video later).
--
-- Scope of this migration: the schema needed for Module 1 of the media
-- spec (AI image generation) plus the Brand Kit (Module 3 of the spec),
-- since every generated image needs brand config to draw from. Video
-- generation (Module 2 of the spec) is deliberately NOT built yet — it
-- was explicitly deferred until the image pipeline is live and proven,
-- since no single provider bundles voiceover + captions + transitions +
-- music + brand outro into one API call the way image generation is a
-- single request/response. media_assets.asset_type already includes
-- 'video' so this table does not need to change shape when that lands.
--
-- Media Library (spec Module 4) is intentionally NOT a separate set of
-- tables here — media_assets IS the library. Search/tags/categories/
-- reuse/archive are just columns + indexes on one table, not a separate
-- subsystem, since at this stage there is exactly one producer of assets
-- (amos-media-generator) and one consumer (the publishers). Splitting
-- into media_templates / media_library / publishing_media / media_jobs
-- as separate tables would be five tables standing in for what one
-- table + one job-tracking table already cover; that split can happen
-- later if a real second producer/consumer shows up that needs it.
--
-- Idempotent: safe to re-run. Paired rollback: AMOS_MODULE_10_ROLLBACK.sql

-- ── Brand Kit ────────────────────────────────────────────────────────
-- One row per country (matches amos_settings' per-country pattern).
-- Every image generation call reads this row to ground the prompt in
-- real brand colors/logo/typography instead of the model guessing.
CREATE TABLE IF NOT EXISTS amos_brand_kit (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code      text NOT NULL DEFAULT 'ZW',
  logo_url          text,
  logo_dark_url     text,
  logo_light_url    text,
  watermark_url     text,
  color_primary     text NOT NULL DEFAULT '#1A3A8F',  -- PaMarket navy
  color_secondary   text NOT NULL DEFAULT '#D4AF37',  -- PaMarket gold
  color_accent      text,
  typography_heading text NOT NULL DEFAULT 'modern sans-serif, bold',
  typography_body    text NOT NULL DEFAULT 'clean sans-serif, readable',
  design_notes      text,   -- free-text guidance folded into every image prompt
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code)
);
ALTER TABLE amos_brand_kit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_brand_kit team" ON amos_brand_kit;
CREATE POLICY "amos_brand_kit team" ON amos_brand_kit FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

INSERT INTO amos_brand_kit (country_code)
VALUES ('ZW')
ON CONFLICT (country_code) DO NOTHING;

-- ── Media assets (the library) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS amos_media_assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id        uuid REFERENCES amos_content_drafts(id) ON DELETE CASCADE,
  content_item_id uuid REFERENCES amos_content_items(id) ON DELETE CASCADE,
  asset_type      text NOT NULL CHECK (asset_type IN ('image','video')),
  style           text CHECK (style IN (
                    'product_showcase','promotional_banner','hiring_announcement',
                    'marketplace_advertisement','quote_card','infographic',
                    'event_announcement','feature_announcement'
                  )),
  placement       text CHECK (placement IN (
                    'facebook','instagram','linkedin','x','blog_header',
                    'website_banner','story','square','landscape','portrait'
                  )),
  format          text CHECK (format IN ('square','landscape','portrait','story')),
  width           int,
  height          int,
  prompt          text NOT NULL,          -- the exact prompt sent to the provider
  provider        text NOT NULL,          -- e.g. 'openai'
  model           text NOT NULL,          -- e.g. 'gpt-image-1'
  storage_key     text,                   -- R2 object key
  url             text,                   -- public R2 URL, set once uploaded
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','generating','ready','failed')),
  error           text,
  generation_cost_cents int,
  tags            text[],
  archived_at     timestamptz,
  created_by      uuid,                   -- NULL = system-generated
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amos_media_draft ON amos_media_assets (draft_id);
CREATE INDEX IF NOT EXISTS idx_amos_media_item ON amos_media_assets (content_item_id);
CREATE INDEX IF NOT EXISTS idx_amos_media_status ON amos_media_assets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_amos_media_tags ON amos_media_assets USING gin (tags);
ALTER TABLE amos_media_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_media team" ON amos_media_assets;
CREATE POLICY "amos_media team" ON amos_media_assets FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- Link drafts to their primary image without requiring a join through
-- amos_media_assets for the common case (Approval Queue listing every
-- draft's thumbnail). amos_media_assets remains the source of truth for
-- full asset metadata / library browsing; this column is a denormalized
-- pointer to "the one image this draft will publish with", nulled back
-- out by amos_media_assets' own cleanup if that row is ever deleted.
ALTER TABLE amos_content_drafts
  ADD COLUMN IF NOT EXISTS media_asset_id uuid REFERENCES amos_media_assets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_amos_cd_media ON amos_content_drafts (media_asset_id);

-- ── Media generation jobs (job_runs already covers cron/manual
-- heartbeats account-wide; this table exists because media generation
-- is per-asset and async-shaped even for images at higher volumes, and
-- needs its own retry/attempt bookkeeping the way amos_schedule does
-- for publishing.) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amos_media_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL REFERENCES amos_media_assets(id) ON DELETE CASCADE,
  job_type      text NOT NULL CHECK (job_type IN ('generate_image','generate_video')),
  status        text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed')),
  attempts      int NOT NULL DEFAULT 0,
  max_attempts  int NOT NULL DEFAULT 3,
  locked_at     timestamptz,
  last_error    text,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amos_media_jobs_status ON amos_media_jobs (status, created_at);
ALTER TABLE amos_media_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_media_jobs team" ON amos_media_jobs;
CREATE POLICY "amos_media_jobs team" ON amos_media_jobs FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- Atomic claim, same FOR UPDATE SKIP LOCKED pattern as
-- claim_due_amos_schedule (AMOS_AUDIT_REMEDIATION.sql) — prevents two
-- concurrent runner invocations from double-generating the same asset.
CREATE OR REPLACE FUNCTION claim_amos_media_jobs(p_limit integer DEFAULT 5)
RETURNS SETOF amos_media_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM amos_media_jobs
    WHERE status = 'queued'
      AND attempts < max_attempts
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE amos_media_jobs
  SET status = 'running', attempts = attempts + 1, locked_at = now(), started_at = now()
  WHERE id IN (SELECT id FROM claimed)
  RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION claim_amos_media_jobs(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_amos_media_jobs(integer) FROM anon;
REVOKE ALL ON FUNCTION claim_amos_media_jobs(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_amos_media_jobs(integer) TO service_role;
