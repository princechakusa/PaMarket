-- AMOS Module 14 — TikTok Content Posting API (OAuth Login Kit + publish).
--
-- amos_oauth_states holds short-lived, single-use CSRF state tokens for
-- the TikTok OAuth flow (amos-tiktok-oauth edge function). The callback
-- leg of that flow is an unauthenticated browser redirect from TikTok —
-- it has no Supabase session JWT to check, so a state token issued by
-- the authenticated "start" leg and consumed exactly once here is what
-- proves the callback belongs to a real admin-initiated flow rather
-- than an attacker hitting the callback URL directly with a guessed or
-- replayed code.
--
-- Generic across providers (provider column) in case a future OAuth-
-- based integration (X, if ever revisited) needs the same pattern.
--
-- Idempotent: safe to re-run. Paired rollback: AMOS_MODULE_14_ROLLBACK.sql

CREATE TABLE IF NOT EXISTS amos_oauth_states (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    text NOT NULL,
  state       text NOT NULL,
  created_by  uuid,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, state)
);
CREATE INDEX IF NOT EXISTS idx_amos_oauth_states_expiry ON amos_oauth_states (expires_at);
ALTER TABLE amos_oauth_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amos_oauth_states team" ON amos_oauth_states;
CREATE POLICY "amos_oauth_states team" ON amos_oauth_states FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());
-- amos-tiktok-oauth's callback leg runs as service_role (no user JWT
-- available on that leg — see the function's own comments), so it
-- bypasses this RLS policy entirely via the service-role key, same as
-- every other AMOS edge function's writes.

-- Best-effort cleanup of old state rows — mirrors
-- amos_purge_old_trigger_log's pattern, called from amos-research-runner
-- alongside the other periodic purges already wired up there.
CREATE OR REPLACE FUNCTION amos_purge_old_oauth_states()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM amos_oauth_states WHERE expires_at < now() - interval '1 day';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION amos_purge_old_oauth_states() FROM PUBLIC;
REVOKE ALL ON FUNCTION amos_purge_old_oauth_states() FROM anon;
REVOKE ALL ON FUNCTION amos_purge_old_oauth_states() FROM authenticated;
GRANT EXECUTE ON FUNCTION amos_purge_old_oauth_states() TO service_role;

INSERT INTO amos_integrations (provider, status)
VALUES ('tiktok', 'not_connected')
ON CONFLICT (provider) DO NOTHING;
