-- ════════════════════════════════════════════════════════════════════════
-- AMOS Module 5 — Rollback
--
-- Drops the unsubscribe RPCs and the two added profiles columns. Safe:
-- marketing_email_opt_out and unsubscribe_token are both new, unused by
-- anything outside AMOS's EmailPublisher.
-- ════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS amos_unsubscribe_by_token(uuid);
DROP FUNCTION IF EXISTS amos_get_or_create_unsubscribe_token(uuid);

ALTER TABLE profiles DROP COLUMN IF EXISTS unsubscribe_token;
ALTER TABLE profiles DROP COLUMN IF EXISTS marketing_email_opt_out;
