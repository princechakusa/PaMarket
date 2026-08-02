-- ════════════════════════════════════════════════════════════════════════
-- AMOS — AI Marketing Operating System — Module 0: Foundation
--
-- Run manually in the Supabase SQL Editor. Idempotent + additive: only
-- CREATEs new tables/indexes/policies, never drops or alters existing data.
-- The admin panel runs WITHOUT this file — every AMOS tab degrades to a
-- clear "run AMOS_MODULE_0_FOUNDATION.sql" notice until these objects exist,
-- exactly like every ADMIN_ENTERPRISE_V2.sql module.
--
-- Prerequisite: ADMIN_ENTERPRISE_V2.sql (is_admin_team(), job_runs,
-- admin_audit_logs) must already be applied. This file assumes it and
-- reuses all three rather than duplicating them — AMOS actions are audited
-- via the existing admin_audit_logs table (entity = 'amos_settings' etc.)
-- and scheduled-job heartbeats via the existing job_runs table (job =
-- 'amos_research_runner' etc.), not parallel tables.
--
-- Scope: schema only. No edge functions are deployed by this file, no
-- external API calls are made by anything it creates, no content is
-- generated or published. See docs/AMOS_ARCHITECTURE.md §9 for the full
-- module roadmap this is module 0 of.
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. SETTINGS  (AI Configuration tab)
--    Singleton-per-country row. ai_provider is locked to 'anthropic' and
--    video_provider to 'google_veo' at the application layer (the admin UI
--    disables the alternative options with a "coming later" note) — the
--    column itself is a free-text field so a future provider is a config
--    change, not a migration, per the architecture's provider-agnostic
--    design goal.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amos_settings (
  country_code       text PRIMARY KEY DEFAULT 'ZW',
  approval_required  boolean NOT NULL DEFAULT true,
  daily_batch_enabled boolean NOT NULL DEFAULT false,
  ai_provider         text NOT NULL DEFAULT 'anthropic',
  video_provider       text NOT NULL DEFAULT 'google_veo',
  posting_hours       jsonb NOT NULL DEFAULT '{}'::jsonb,
  budget_monthly_cents bigint NOT NULL DEFAULT 0,
  brand_voice         jsonb NOT NULL DEFAULT '{"tone":["professional","trustworthy","modern","friendly","helpful"],"avoid":["clickbait","misleading claims","copying competitors"]}'::jsonb,
  report_recipients   text[] NOT NULL DEFAULT '{}',
  updated_by          uuid,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE amos_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_settings team" ON amos_settings;
CREATE POLICY "amos_settings team" ON amos_settings FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

INSERT INTO amos_settings (country_code) VALUES ('ZW')
  ON CONFLICT (country_code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. INTEGRATIONS  (System Health / API Manager)
--    One row per external provider. Seeded with exactly one row (Facebook,
--    not connected) — adding a new platform later is "insert one row +
--    add one card in the admin UI", not a schema change.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amos_integrations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            text NOT NULL UNIQUE,
  status              text NOT NULL DEFAULT 'not_connected' CHECK (status IN ('not_connected','connected','error','disabled')),
  credentials_ref     text,              -- Supabase Vault secret name; never a raw key
  last_success_at     timestamptz,
  last_error          text,
  consecutive_failures int NOT NULL DEFAULT 0,
  auto_disabled       boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE amos_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_integrations team" ON amos_integrations;
CREATE POLICY "amos_integrations team" ON amos_integrations FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

INSERT INTO amos_integrations (provider, status) VALUES ('facebook', 'not_connected')
  ON CONFLICT (provider) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. MARKET INTELLIGENCE  (Market Intelligence Dashboard)
--    Generalizes "trends" to every signal type the brief lists: competitor
--    moves, Google/Facebook/Reddit trends, seasonal buying behaviour, ZW
--    public holidays, school terms, salary periods, local news, sporting
--    events, economic trends, and PaMarket's own zero-result-search gaps.
--    Empty until the Market Intelligence module (Module 1) ships.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amos_market_intelligence (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'ZW',
  signal_type  text NOT NULL CHECK (signal_type IN (
                 'competitor','google_trends','facebook_marketplace','reddit',
                 'seasonal','public_holiday','school_term','salary_period',
                 'news','sporting_event','economic_trend','internal_search_gap'
               )),
  topic        text NOT NULL,
  score        numeric,
  rationale    text,
  raw          jsonb,
  collected_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_amos_mi_country_type ON amos_market_intelligence (country_code, signal_type, collected_at DESC);
ALTER TABLE amos_market_intelligence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_mi team" ON amos_market_intelligence;
CREATE POLICY "amos_mi team" ON amos_market_intelligence FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. CONTENT PIPELINE  (Campaign Manager / Approval Queue / Content Calendar)
--    One platform-agnostic idea (amos_content_items) fans out into one row
--    per placement (amos_content_drafts). channel is constrained to
--    'facebook' only for now — per the brief, only Facebook is live at
--    launch; widening the CHECK is the entire code change needed to admit
--    a new platform later.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amos_content_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code         text NOT NULL DEFAULT 'ZW',
  title                text NOT NULL,
  category             text CHECK (category IN ('marketplace','jobs','vehicles','properties','rentals','brand','seasonal')),
  market_intelligence_id uuid REFERENCES amos_market_intelligence(id),
  spotlight_listing_id  uuid,
  spotlight_business_id uuid,
  spotlight_seller_id   uuid,
  status               text NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','drafted','approved','scheduled','published','archived','rejected')),
  created_by           uuid,             -- NULL = system-generated
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amos_ci_status ON amos_content_items (country_code, status, created_at DESC);
ALTER TABLE amos_content_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_ci team" ON amos_content_items;
CREATE POLICY "amos_ci team" ON amos_content_items FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

CREATE TABLE IF NOT EXISTS amos_content_drafts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id       uuid NOT NULL REFERENCES amos_content_items(id) ON DELETE CASCADE,
  channel               text NOT NULL CHECK (channel IN ('facebook')),
  draft_type            text NOT NULL CHECK (draft_type IN ('post','reel_script','story','carousel','video_brief','image_prompt','notification','email','article')),
  body                  text,
  media_prompts         jsonb,
  hashtags              text[],
  cta                   text,
  performance_rationale text,
  ai_provider           text,
  ai_model              text,
  version               int NOT NULL DEFAULT 1,
  status                text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','edited','approved','rejected','published')),
  reviewed_by           uuid,
  reviewed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amos_cd_status ON amos_content_drafts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_amos_cd_item ON amos_content_drafts (content_item_id);
ALTER TABLE amos_content_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_cd team" ON amos_content_drafts;
CREATE POLICY "amos_cd team" ON amos_content_drafts FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

CREATE TABLE IF NOT EXISTS amos_content_revisions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id   uuid NOT NULL REFERENCES amos_content_drafts(id) ON DELETE CASCADE,
  edited_by  uuid,
  before_body text,
  after_body  text,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amos_cr_draft ON amos_content_revisions (draft_id, created_at DESC);
ALTER TABLE amos_content_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_cr team" ON amos_content_revisions;
CREATE POLICY "amos_cr team" ON amos_content_revisions FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- ─────────────────────────────────────────────────────────────────────────
-- 5. SCHEDULING & PUBLISHING  (Content Calendar)
--    Empty until Module 4 (first live channel) ships a publisher function.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amos_schedule (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id      uuid NOT NULL REFERENCES amos_content_drafts(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','publishing','published','failed','cancelled')),
  attempts      int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amos_sched_due ON amos_schedule (status, scheduled_for);
ALTER TABLE amos_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_sched team" ON amos_schedule;
CREATE POLICY "amos_sched team" ON amos_schedule FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

CREATE TABLE IF NOT EXISTS amos_publish_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id   uuid NOT NULL REFERENCES amos_schedule(id) ON DELETE CASCADE,
  channel       text NOT NULL,
  external_post_id text,
  external_url  text,
  published_at  timestamptz NOT NULL DEFAULT now(),
  raw_response  jsonb
);
CREATE INDEX IF NOT EXISTS idx_amos_pl_schedule ON amos_publish_log (schedule_id);
ALTER TABLE amos_publish_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_pl team" ON amos_publish_log;
CREATE POLICY "amos_pl team" ON amos_publish_log FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- ─────────────────────────────────────────────────────────────────────────
-- 6. SEO RECOMMENDATIONS  (future SEO Manager module; no UI in Module 0)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amos_seo_recommendations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code    text NOT NULL DEFAULT 'ZW',
  page_type       text CHECK (page_type IN ('homepage','category','listing','job','vehicle','property','business')),
  page_ref        text,
  recommendation_type text CHECK (recommendation_type IN ('metadata','schema','internal_link','keyword','backlink','technical')),
  current_value   text,
  suggested_value text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','applied','dismissed')),
  impact_estimate text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE amos_seo_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_seo team" ON amos_seo_recommendations;
CREATE POLICY "amos_seo team" ON amos_seo_recommendations FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- ─────────────────────────────────────────────────────────────────────────
-- 7. METRICS & REPORTS  (weekly executive report; no data collector yet)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amos_metrics_daily (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'ZW',
  date         date NOT NULL,
  channel      text NOT NULL,
  metric       text NOT NULL,
  value        numeric NOT NULL,
  source       text NOT NULL DEFAULT 'internal' CHECK (source IN ('api','internal','manual')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, date, channel, metric)
);
CREATE INDEX IF NOT EXISTS idx_amos_metrics_date ON amos_metrics_daily (country_code, date DESC);
ALTER TABLE amos_metrics_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_metrics team" ON amos_metrics_daily;
CREATE POLICY "amos_metrics team" ON amos_metrics_daily FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

CREATE TABLE IF NOT EXISTS amos_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'ZW',
  period_start date NOT NULL,
  period_end   date NOT NULL,
  summary      jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  emailed_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_amos_reports_period ON amos_reports (country_code, period_start DESC);
ALTER TABLE amos_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_reports team" ON amos_reports;
CREATE POLICY "amos_reports team" ON amos_reports FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- ─────────────────────────────────────────────────────────────────────────
-- 8. LEARNING ENGINE  (AI Learning Dashboard)
--    One append-only row per published item once it has enough performance
--    data to be worth learning from. Written by a future Module 6 function,
--    not by anything in Module 0. The shape is fixed now so no later
--    module needs a breaking ALTER TABLE against live rows.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amos_learning_signals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid REFERENCES amos_content_items(id) ON DELETE SET NULL,
  draft_id        uuid REFERENCES amos_content_drafts(id) ON DELETE SET NULL,
  channel         text NOT NULL,
  posted_at       timestamptz,
  posting_hour    smallint,           -- 0-23, local country time; makes "optimal posting time" a GROUP BY
  topic           text,
  category        text,
  keywords        text[],
  media_type      text CHECK (media_type IN ('none','image','video','carousel')),
  cta             text,
  target_audience text,
  reach           numeric,
  ctr             numeric,
  downloads_attributed int,
  conversions     numeric,
  engagement_rate numeric,
  outcome_label   text CHECK (outcome_label IN ('strong','average','weak')), -- set once thresholds exist
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amos_learning_channel_topic ON amos_learning_signals (channel, topic);
CREATE INDEX IF NOT EXISTS idx_amos_learning_outcome ON amos_learning_signals (outcome_label);
ALTER TABLE amos_learning_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_learning team" ON amos_learning_signals;
CREATE POLICY "amos_learning team" ON amos_learning_signals FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- ════════════════════════════════════════════════════════════════════════
-- Deliberately NOT created here:
--   - amos_job_runs   → reuse the existing job_runs table (job='amos_...')
--   - amos_audit_log  → reuse the existing admin_audit_logs table
--                        (entity='amos_settings' | 'amos_content_drafts' | ...)
-- Both already exist from ADMIN_ENTERPRISE_V2.sql and already have the
-- exact shape AMOS needs — a parallel table would just split the Ops
-- Center's and Audit Center's view of the world in two for no benefit.
-- ════════════════════════════════════════════════════════════════════════
