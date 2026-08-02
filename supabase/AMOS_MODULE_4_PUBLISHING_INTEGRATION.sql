-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Module 4: Live Social Publishing (Facebook)
--
-- Run manually in the Supabase SQL Editor, after Modules 0-3. Additive
-- only. No amos_* table schema changes — amos_integrations.credentials_ref
-- and .status (Module 0) already have exactly the shape this module needs.
--
-- This file adds ONE thing: a SECURITY DEFINER RPC that lets an edge
-- function (using the service-role key) read a single named Vault secret.
-- Vault's own tables are intentionally not exposed to PostgREST, so
-- supabase-js's .from('vault...') cannot reach them from edge function
-- code — this RPC is the supported, minimal-privilege way to bridge that
-- gap: it returns exactly one secret's decrypted value for exactly the
-- name asked for, nothing else in Vault is readable through it.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION amos_get_vault_secret(secret_name text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, vault AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = secret_name LIMIT 1;
$$;

-- Deliberately NOT granted to anon/authenticated — only the service role
-- (used by edge functions, which bypasses GRANT/REVOKE and RLS entirely)
-- can call this. Revoking from PUBLIC and both client-facing roles closes
-- the one way this function could otherwise become a secret-reading
-- oracle for a logged-in admin's browser session.
REVOKE ALL ON FUNCTION amos_get_vault_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION amos_get_vault_secret(text) FROM anon;
REVOKE ALL ON FUNCTION amos_get_vault_secret(text) FROM authenticated;

-- ── Write-side counterpart: lets an authenticated ADMIN (not just the
--    service role) store a credential from the browser via the API
--    Manager "Connect" button, without ever exposing vault.create_secret/
--    vault.update_secret directly to PostgREST. The admin-team check is
--    enforced INSIDE the function (is_admin_team(), same guard as every
--    RLS policy in this project) since this bypasses RLS by virtue of
--    being SECURITY DEFINER — the check has to happen explicitly here.
CREATE OR REPLACE FUNCTION amos_set_integration_credential(p_provider text, p_secret_name text, p_secret_value text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  IF NOT is_admin_team() THEN
    RAISE EXCEPTION 'Only admin-team members can connect AMOS integrations';
  END IF;

  SELECT id INTO v_secret_id FROM vault.secrets WHERE name = p_secret_name;
  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret(p_secret_value, p_secret_name, 'AMOS integration credential: ' || p_provider);
  ELSE
    PERFORM vault.update_secret(v_secret_id, p_secret_value);
  END IF;

  UPDATE amos_integrations
  SET status = 'connected', credentials_ref = p_secret_name, consecutive_failures = 0, auto_disabled = false, updated_at = now()
  WHERE provider = p_provider;
END;
$$;

-- Grant to authenticated (not anon) — the function's own is_admin_team()
-- check is the real gate; this GRANT just lets a logged-in admin's
-- browser session call it at all. Never grant to anon.
GRANT EXECUTE ON FUNCTION amos_set_integration_credential(text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION amos_set_integration_credential(text, text, text) FROM anon;

-- No other schema changes. Connect Facebook via the admin panel's API
-- Manager "Connect" button (Module 4 UI), or run by hand:
--   select amos_set_integration_credential('facebook', 'facebook_page_token', '<pageId>:<pageAccessToken>');
