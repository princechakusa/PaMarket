-- ════════════════════════════════════════════════════════════════════════
-- AMOS Module 0 — Rollback
--
-- Safe at any point after AMOS_MODULE_0_FOUNDATION.sql: every table below
-- is new and AMOS-only. Nothing pre-existing (job_runs, admin_audit_logs,
-- profiles, is_admin_team, etc.) is touched. Run manually in the Supabase
-- SQL Editor only if you need to fully remove Module 0.
-- ════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS amos_learning_signals CASCADE;
DROP TABLE IF EXISTS amos_reports CASCADE;
DROP TABLE IF EXISTS amos_metrics_daily CASCADE;
DROP TABLE IF EXISTS amos_seo_recommendations CASCADE;
DROP TABLE IF EXISTS amos_publish_log CASCADE;
DROP TABLE IF EXISTS amos_schedule CASCADE;
DROP TABLE IF EXISTS amos_content_revisions CASCADE;
DROP TABLE IF EXISTS amos_content_drafts CASCADE;
DROP TABLE IF EXISTS amos_content_items CASCADE;
DROP TABLE IF EXISTS amos_market_intelligence CASCADE;
DROP TABLE IF EXISTS amos_integrations CASCADE;
DROP TABLE IF EXISTS amos_settings CASCADE;
