-- ════════════════════════════════════════════════════════════════════════
-- AMOS Audit Remediation — Rollback
--
-- Reverts every fix in AMOS_AUDIT_REMEDIATION.sql. Safe: all added
-- columns default sensibly and nothing outside the remediated functions
-- reads them. Re-widening the grants back to their pre-fix (weaker) state
-- is deliberately NOT done here — a rollback should never re-introduce a
-- security gap; if this file is run, amos_set_integration_credential and
-- amos_capture_draft_deletion simply stay correctly locked down.
-- ════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS amos_purge_old_trigger_log();
DROP FUNCTION IF EXISTS amos_check_and_record_ai_spend(text, int);
DROP FUNCTION IF EXISTS amos_purge_old_unsubscribe_attempts();
DROP TABLE IF EXISTS amos_unsubscribe_attempts CASCADE;

DROP INDEX IF EXISTS idx_profiles_amos_marketing_rotation;
ALTER TABLE profiles DROP COLUMN IF EXISTS last_amos_marketing_email_at;
DROP FUNCTION IF EXISTS release_stale_amos_schedule_locks();
DROP FUNCTION IF EXISTS claim_due_amos_schedule(integer);

DROP INDEX IF EXISTS idx_amos_seo_page;
DROP INDEX IF EXISTS idx_amos_seo_status;

ALTER TABLE amos_settings DROP COLUMN IF EXISTS ai_budget_cents_limit;
ALTER TABLE amos_settings DROP COLUMN IF EXISTS ai_spend_cents_this_month;

ALTER TABLE amos_schedule DROP COLUMN IF EXISTS max_attempts;
ALTER TABLE amos_schedule DROP COLUMN IF EXISTS locked_at;
