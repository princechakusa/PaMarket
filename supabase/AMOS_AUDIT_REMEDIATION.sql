-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Production Readiness Audit Remediation
--
-- Run manually in the Supabase SQL Editor, after Modules 0-9. Additive
-- only — no existing column/table is dropped or retyped.
--
-- Fixes, from the Production Readiness Report:
--   C1 — publish dispatcher race condition (atomic claim RPC, mirrors the
--        existing claim_due_scheduled_notifications pattern in
--        202607120001_automation_campaigns_phase1.sql exactly — same
--        FOR UPDATE SKIP LOCKED CTE shape, same SECURITY DEFINER +
--        revoke-from-public/anon/authenticated + grant-to-service_role).
--   H2 — missing index + N+1 pattern on amos_seo_recommendations (index
--        added here; the N+1 query itself is fixed in the edge function).
--   H3 — no retry cap on amos_schedule (max_attempts column + the claim
--        RPC excludes rows at/over the cap, matching automation-runner's
--        attempts < max_attempts check exactly).
--   H4 (partial) — amos_settings gains an ai_budget_usd_cents_used /
--        ai_budget_usd_cents_limit pair so the content generator can
--        actually check spend before calling Anthropic, not just carry
--        an unused budget_monthly_cents field.
--   Also adds: a stale-lock release (a row claimed but never resolved
--        within 15 minutes reverts to pending, same 15-minute constant
--        automation-runner already uses) and the locked_at column the
--        claim RPC needs.
-- ════════════════════════════════════════════════════════════════════════

-- ── C1 + H3: atomic claim + retry cap for amos_schedule ─────────────────
ALTER TABLE amos_schedule ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE amos_schedule ADD COLUMN IF NOT EXISTS max_attempts int NOT NULL DEFAULT 5;

CREATE OR REPLACE FUNCTION claim_due_amos_schedule(p_limit integer DEFAULT 25)
RETURNS SETOF amos_schedule
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT s.id
    FROM amos_schedule s
    WHERE s.status = 'pending'
      AND s.scheduled_for <= now()
      AND s.attempts < s.max_attempts
    ORDER BY s.scheduled_for ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 100))
  ), claimed AS (
    UPDATE amos_schedule s
    SET status = 'publishing',
        locked_at = now(),
        last_attempt_at = now(),
        attempts = s.attempts + 1
    FROM due
    WHERE s.id = due.id
    RETURNING s.*
  )
  SELECT * FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION claim_due_amos_schedule(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_due_amos_schedule(integer) FROM anon;
REVOKE ALL ON FUNCTION claim_due_amos_schedule(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_due_amos_schedule(integer) TO service_role;

-- Stale-lock release: a row claimed (status='publishing', locked_at set)
-- but never resolved within 15 minutes (function crashed, platform
-- killed it mid-run — exactly the C3 failure mode, but for the
-- dispatcher rather than the generator) reverts to pending so it isn't
-- stuck forever. Same 15-minute constant automation-runner already uses
-- for scheduled_notifications.
CREATE OR REPLACE FUNCTION release_stale_amos_schedule_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released integer;
BEGIN
  UPDATE amos_schedule
  SET status = 'pending', locked_at = NULL
  WHERE status = 'publishing'
    AND locked_at IS NOT NULL
    AND locked_at < now() - interval '15 minutes';
  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

REVOKE ALL ON FUNCTION release_stale_amos_schedule_locks() FROM PUBLIC;
REVOKE ALL ON FUNCTION release_stale_amos_schedule_locks() FROM anon;
REVOKE ALL ON FUNCTION release_stale_amos_schedule_locks() FROM authenticated;
GRANT EXECUTE ON FUNCTION release_stale_amos_schedule_locks() TO service_role;

-- ── H2: missing index on amos_seo_recommendations ────────────────────────
-- Covers both real query shapes: the admin UI's `WHERE status='open'
-- ORDER BY impact_estimate, created_at`, and the SEO runner's
-- idempotency check `WHERE page_type=? AND page_ref=? AND
-- recommendation_type=? AND status='open'`.
CREATE INDEX IF NOT EXISTS idx_amos_seo_status ON amos_seo_recommendations (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_amos_seo_page ON amos_seo_recommendations (page_type, page_ref, recommendation_type, status);

-- ── H1: revoke PUBLIC from every AMOS SECURITY DEFINER function ─────────
-- Full audit of every amos_* function's grants (see verification queries
-- at the end of this file) found amos_set_integration_credential was
-- missing its REVOKE ... FROM PUBLIC statement (present on every sibling
-- function), and amos_capture_draft_deletion (a trigger function, never
-- actually reachable via RPC regardless of grants, but tightened for
-- consistency) had the same gap. Re-running REVOKE/GRANT is idempotent.
REVOKE ALL ON FUNCTION amos_set_integration_credential(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION amos_set_integration_credential(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION amos_set_integration_credential(text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION amos_capture_draft_deletion() FROM PUBLIC;
REVOKE ALL ON FUNCTION amos_capture_draft_deletion() FROM anon;
REVOKE ALL ON FUNCTION amos_capture_draft_deletion() FROM authenticated;
-- Trigger functions are invoked by the table event, not a grantable
-- caller — service_role doesn't need an explicit grant either, but
-- REVOKE ALL FROM PUBLIC/anon/authenticated is what actually matters here.

-- Re-assert PUBLIC/anon/authenticated are locked out of every other
-- AMOS SECURITY DEFINER function too, even the ones that were already
-- correct — idempotent, and makes this file the single source of truth
-- for AMOS function grants rather than trusting each module's own file.
REVOKE ALL ON FUNCTION amos_get_vault_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION amos_get_vault_secret(text) FROM anon;
REVOKE ALL ON FUNCTION amos_get_vault_secret(text) FROM authenticated;

REVOKE ALL ON FUNCTION amos_get_or_create_unsubscribe_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION amos_get_or_create_unsubscribe_token(uuid) FROM anon;
REVOKE ALL ON FUNCTION amos_get_or_create_unsubscribe_token(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION amos_unsubscribe_by_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION amos_unsubscribe_by_token(uuid) FROM anon;
REVOKE ALL ON FUNCTION amos_unsubscribe_by_token(uuid) FROM authenticated;

-- ── C2: email recipient rotation ─────────────────────────────────────────
-- The prior query had no ORDER BY, so every campaign hit the same first
-- 50 rows Postgres happened to return, forever. Ordering by
-- "never-emailed-first, then longest-since-last-emailed" and recording
-- each send's timestamp turns this into a genuine rotation — every
-- campaign reaches a different slice of the eligible audience, and no
-- one gets skipped indefinitely.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_amos_marketing_email_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_profiles_amos_marketing_rotation ON profiles (marketing_email_opt_out, verified, last_amos_marketing_email_at NULLS FIRST) WHERE email IS NOT NULL;

-- ── H4: AI budget enforcement ────────────────────────────────────────────
-- amos_settings.budget_monthly_cents already existed (Module 0) but was
-- never read by anything. Adding a usage counter alongside it, plus a
-- cheap RPC the content generator calls before every Anthropic request —
-- a real spend ceiling, not just a schema field. Resets are manual
-- (admin edits amos_settings) rather than an automatic monthly cron, to
-- avoid silently wiping a number an admin might be actively watching;
-- documented in the AI Configuration tab.
ALTER TABLE amos_settings ADD COLUMN IF NOT EXISTS ai_spend_cents_this_month int NOT NULL DEFAULT 0;
ALTER TABLE amos_settings ADD COLUMN IF NOT EXISTS ai_budget_cents_limit int NOT NULL DEFAULT 2000; -- $20/month default ceiling, editable in AI Configuration

CREATE OR REPLACE FUNCTION amos_check_and_record_ai_spend(p_country_code text, p_estimated_cents int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used int;
  v_limit int;
BEGIN
  SELECT ai_spend_cents_this_month, ai_budget_cents_limit INTO v_used, v_limit
  FROM amos_settings WHERE country_code = p_country_code FOR UPDATE;

  IF v_used IS NULL THEN
    RETURN true; -- no settings row for this country — fail open rather than block on a missing row (matches the rate-limiter's fail-open philosophy)
  END IF;

  IF v_used + p_estimated_cents > v_limit THEN
    RETURN false;
  END IF;

  UPDATE amos_settings SET ai_spend_cents_this_month = ai_spend_cents_this_month + p_estimated_cents
  WHERE country_code = p_country_code;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION amos_check_and_record_ai_spend(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION amos_check_and_record_ai_spend(text, int) FROM anon;
REVOKE ALL ON FUNCTION amos_check_and_record_ai_spend(text, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION amos_check_and_record_ai_spend(text, int) TO service_role;

-- ── M3: rate limiting for the public amos-unsubscribe endpoint ──────────
-- The only genuinely public, unauthenticated AMOS endpoint. UUIDv4 tokens
-- (122 bits of entropy) make brute-forcing infeasible, so this isn't a
-- security boundary — it's a resource-exhaustion guard, same fail-open
-- philosophy as checkAmosRateLimit. Keyed by IP, not actor (there's no
-- actor on a public endpoint).
CREATE TABLE IF NOT EXISTS amos_unsubscribe_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip         text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amos_unsub_attempts_ip ON amos_unsubscribe_attempts (ip, created_at DESC);
ALTER TABLE amos_unsubscribe_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_unsub_attempts service" ON amos_unsubscribe_attempts;
CREATE POLICY "amos_unsub_attempts service" ON amos_unsubscribe_attempts FOR ALL
  USING (false) WITH CHECK (false); -- service role only, same pattern as amos_manual_trigger_log

CREATE OR REPLACE FUNCTION amos_purge_old_unsubscribe_attempts() RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM amos_unsubscribe_attempts WHERE created_at < now() - interval '1 day';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION amos_purge_old_unsubscribe_attempts() FROM PUBLIC;
REVOKE ALL ON FUNCTION amos_purge_old_unsubscribe_attempts() FROM anon;
REVOKE ALL ON FUNCTION amos_purge_old_unsubscribe_attempts() FROM authenticated;
GRANT EXECUTE ON FUNCTION amos_purge_old_unsubscribe_attempts() TO service_role;

-- ── Retention cleanup for amos_manual_trigger_log (Medium #4) ────────────
-- This table only ever needs the last ~15 minutes of rows to answer a
-- rate-limit check — everything older is pure dead weight that would
-- otherwise accumulate for the product's entire lifetime. Purges rows
-- older than 1 day (generous margin past the longest rate-limit window
-- any amos-* function uses today, so nothing currently "in window" is
-- ever at risk of being purged mid-check).
CREATE OR REPLACE FUNCTION amos_purge_old_trigger_log() RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM amos_manual_trigger_log WHERE created_at < now() - interval '1 day';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION amos_purge_old_trigger_log() FROM PUBLIC;
REVOKE ALL ON FUNCTION amos_purge_old_trigger_log() FROM anon;
REVOKE ALL ON FUNCTION amos_purge_old_trigger_log() FROM authenticated;
GRANT EXECUTE ON FUNCTION amos_purge_old_trigger_log() TO service_role;

-- ── Verification queries (run by hand after applying) ────────────────────
-- select proname, has_function_privilege('anon', oid, 'EXECUTE') as anon_can_execute,
--        has_function_privilege('authenticated', oid, 'EXECUTE') as authenticated_can_execute
--   from pg_proc where proname like 'amos_%' or proname like 'claim_due_amos%' or proname like 'release_stale_amos%'
--   order by proname;
-- select indexname from pg_indexes where tablename='amos_seo_recommendations';
-- select column_name from information_schema.columns where table_name='amos_schedule' and column_name in ('locked_at','max_attempts');
