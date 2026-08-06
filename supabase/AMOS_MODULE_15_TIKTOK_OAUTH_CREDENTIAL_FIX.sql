-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Module 15: fix TikTok OAuth callback credential storage
--
-- Run manually in the Supabase SQL Editor, after Module 14.
--
-- Bug: amos-tiktok-oauth-callback (the unauthenticated leg TikTok redirects
-- to after login) calls amos_set_integration_credential to store the
-- token, but that RPC requires is_admin_team() to pass — which checks
-- auth.uid(), always NULL for the callback's service-role connection since
-- TikTok's redirect carries no admin session by design. Every real
-- connection attempt fails with "credential_store_failed".
--
-- Fix: a service-role-only write RPC, same pattern as the existing
-- amos_get_vault_secret read RPC in Module 4 — revoked from anon/
-- authenticated so only the service role (edge functions) can call it.
-- Safe to skip the is_admin_team() check here specifically because the
-- caller (amos-tiktok-oauth-callback) already authenticated the flow via
-- its own single-use, expiring `state` token check before ever reaching
-- this point — there is no unauthenticated path to this RPC.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION amos_set_integration_credential_service(p_provider text, p_secret_name text, p_secret_value text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE
  v_secret_id uuid;
BEGIN
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

REVOKE ALL ON FUNCTION amos_set_integration_credential_service(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION amos_set_integration_credential_service(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION amos_set_integration_credential_service(text, text, text) FROM authenticated;
