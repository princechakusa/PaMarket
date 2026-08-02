-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Module 5: Additional Channel Integrations (Push, Email, Instagram)
--
-- Run manually in the Supabase SQL Editor, after Modules 0-4. Additive
-- only.
--
-- Adds the one piece of infrastructure that was genuinely missing before
-- EmailPublisher could ship responsibly: a marketing-email opt-out. No
-- unsubscribe mechanism existed anywhere in this codebase before this —
-- found during Module 5 review, fixed here rather than shipping email
-- broadcast capability without it. Push notifications already have this
-- (notification_preferences.promotions, used by send-push); email did
-- not, so amos-publish-dispatcher's EmailPublisher stays gated off (see
-- the RESEND_API_KEY + this column check in the dispatcher) until both
-- exist.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_email_opt_out boolean NOT NULL DEFAULT false;

-- Unsubscribe token: a stable, unguessable per-user value so the
-- unsubscribe link in an email doesn't require the recipient to log in
-- (the whole point of a one-click unsubscribe). Generated lazily (only
-- when first needed) rather than backfilled for every existing user.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unsubscribe_token uuid;

CREATE OR REPLACE FUNCTION amos_get_or_create_unsubscribe_token(p_user_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token uuid;
BEGIN
  SELECT unsubscribe_token INTO v_token FROM profiles WHERE id = p_user_id;
  IF v_token IS NULL THEN
    v_token := gen_random_uuid();
    UPDATE profiles SET unsubscribe_token = v_token WHERE id = p_user_id;
  END IF;
  RETURN v_token;
END;
$$;
-- Callable by the service role only (edge functions) — never grant to
-- anon/authenticated, since it returns a token that itself grants
-- unsubscribe power for a specific user.
REVOKE ALL ON FUNCTION amos_get_or_create_unsubscribe_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION amos_get_or_create_unsubscribe_token(uuid) FROM anon;
REVOKE ALL ON FUNCTION amos_get_or_create_unsubscribe_token(uuid) FROM authenticated;

-- The reverse lookup, used by the public unsubscribe endpoint: given a
-- token from an email link, opt that user out. SECURITY DEFINER + no
-- grants to anon/authenticated is intentional — the unsubscribe EDGE
-- FUNCTION (service role) is the only caller; the token itself, not a
-- Supabase Auth session, is what authorizes this action, matching how
-- every other "click this link in your email" unsubscribe flow works.
CREATE OR REPLACE FUNCTION amos_unsubscribe_by_token(p_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE profiles SET marketing_email_opt_out = true WHERE unsubscribe_token = p_token;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
REVOKE ALL ON FUNCTION amos_unsubscribe_by_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION amos_unsubscribe_by_token(uuid) FROM anon;
REVOKE ALL ON FUNCTION amos_unsubscribe_by_token(uuid) FROM authenticated;
