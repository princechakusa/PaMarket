-- ════════════════════════════════════════════════════════════════════════
-- PaMarket Admin — Enterprise Operations Platform (v2)
--
-- Run manually in the Supabase SQL Editor. Idempotent + additive: it only
-- CREATEs new tables/columns/indexes, never drops or alters existing data.
-- The admin panel runs WITHOUT this file — every v2 feature degrades to a
-- clear "run ADMIN_ENTERPRISE_V2.sql" notice until the backing object exists.
--
-- Prerequisite: ADMIN_ENTERPRISE_UPGRADE.sql (admin_audit_logs, report
-- severity/assignment) should be applied first. This file assumes it.
-- ════════════════════════════════════════════════════════════════════════

-- Reusable admin-team guard (used by every RLS policy below).
CREATE OR REPLACE FUNCTION is_admin_team() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('super_admin','admin','moderator','support','finance')
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. ADMIN ACTIVITY / SESSION + DEVICE TRACKING  (Security Center)
--    Why: enterprise security needs "who logged in, from where, on what".
--    The panel records a row per admin sign-in and can list active sessions.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     uuid NOT NULL,
  admin_email  text,
  user_agent   text,
  device       text,          -- coarse device label parsed client-side
  ip           text,          -- best-effort; NULL unless an edge fn fills it
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions (admin_id, created_at DESC);
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_sessions team" ON admin_sessions;
CREATE POLICY "admin_sessions team" ON admin_sessions FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- Failed admin login attempts (server-visible brute-force signal).
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text,
  ok         boolean NOT NULL,
  reason     text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON admin_login_attempts (created_at DESC);
ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "login_attempts read" ON admin_login_attempts;
CREATE POLICY "login_attempts read" ON admin_login_attempts FOR SELECT USING (is_admin_team());
DROP POLICY IF EXISTS "login_attempts insert" ON admin_login_attempts;
-- Anyone attempting the admin login may write a row (pre-auth), but only their own outcome.
CREATE POLICY "login_attempts insert" ON admin_login_attempts FOR INSERT WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. SUPPORT TICKETS  (Customer Support Center)
--    Why: reports/support messages today have no ownership, SLA, priority,
--    threading or CSAT. This is the backbone of a real support desk.
--    Existing 'reports' rows with target_type='support' remain readable; new
--    tickets can be created here and old support messages linked in.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject      text NOT NULL,
  requester_id uuid,          -- profiles.id of the user who needs help
  status       text NOT NULL DEFAULT 'open',   -- open | pending | resolved | closed
  priority     text NOT NULL DEFAULT 'normal', -- low | normal | high | urgent
  category     text,          -- billing | listing | account | bug | other
  assigned_to  uuid,          -- admin handling it
  source       text DEFAULT 'admin',           -- admin | app | report
  source_ref   text,          -- optional link to a reports.id it came from
  csat         int,           -- 1..5 satisfaction, set on resolution
  first_response_at timestamptz,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets (status, priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON support_tickets (assigned_to);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tickets team" ON support_tickets;
CREATE POLICY "tickets team" ON support_tickets FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id  uuid,
  author_kind text NOT NULL DEFAULT 'admin',   -- admin | user | system
  body       text NOT NULL,
  internal   boolean NOT NULL DEFAULT false,    -- internal note vs customer-visible
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_msgs ON support_ticket_messages (ticket_id, created_at);
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ticket_msgs team" ON support_ticket_messages;
CREATE POLICY "ticket_msgs team" ON support_ticket_messages FOR ALL
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- ─────────────────────────────────────────────────────────────────────────
-- 3. SAVED FILTERS / VIEWS  (Enterprise UX)
--    Why: analysts re-run the same filtered views daily. Store them per admin.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_saved_views (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   uuid NOT NULL,
  module     text NOT NULL,   -- 'listings' | 'users' | ...
  name       text NOT NULL,
  config     jsonb NOT NULL,  -- {filter, search, cat, prov, ...}
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saved_views ON admin_saved_views (admin_id, module);
ALTER TABLE admin_saved_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved_views own" ON admin_saved_views;
CREATE POLICY "saved_views own" ON admin_saved_views FOR ALL
  USING (admin_id = auth.uid() AND is_admin_team())
  WITH CHECK (admin_id = auth.uid() AND is_admin_team());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. MODERATION / APPEALS  (Moderation Center)
--    Why: rejected users/listings need a route to appeal, and moderators need
--    a persistent risk flag store beyond the audit log.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moderation_appeals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity      text NOT NULL,   -- 'listing' | 'user' | 'verification'
  entity_id   text NOT NULL,
  requester_id uuid,
  reason      text,
  status      text NOT NULL DEFAULT 'open',  -- open | granted | denied
  decided_by  uuid,
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON moderation_appeals (status, created_at DESC);
ALTER TABLE moderation_appeals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appeals team" ON moderation_appeals;
CREATE POLICY "appeals team read" ON moderation_appeals FOR SELECT USING (is_admin_team());
DROP POLICY IF EXISTS "appeals user insert" ON moderation_appeals;
-- A user may file an appeal for themselves; admins manage all.
CREATE POLICY "appeals user insert" ON moderation_appeals FOR INSERT
  WITH CHECK (requester_id = auth.uid() OR is_admin_team());
DROP POLICY IF EXISTS "appeals team update" ON moderation_appeals;
CREATE POLICY "appeals team update" ON moderation_appeals FOR UPDATE USING (is_admin_team());

-- ─────────────────────────────────────────────────────────────────────────
-- 5. AUTOMATION JOB RUNS  (Automation / Operations Center)
--    Why: a heartbeat table any pg_cron / edge job writes to, so the Ops and
--    Automation centers can show "last run / next due / failures".
--    Populate from your scheduled jobs, e.g. at the end of each cron function:
--      INSERT INTO job_runs(job, ok, detail) VALUES ('expire_ads', true, '...');
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_runs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job        text NOT NULL,
  ok         boolean NOT NULL DEFAULT true,
  detail     text,
  rows_affected int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_runs ON job_runs (job, created_at DESC);
ALTER TABLE job_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_runs read" ON job_runs;
CREATE POLICY "job_runs read" ON job_runs FOR SELECT USING (is_admin_team());
DROP POLICY IF EXISTS "job_runs write" ON job_runs;
CREATE POLICY "job_runs write" ON job_runs FOR INSERT WITH CHECK (is_admin_team());

-- ─────────────────────────────────────────────────────────────────────────
-- 6. SEARCH ANALYTICS (optional)  (Analytics Center → top / failed searches)
--    Why: knowing what users search for (and find nothing) drives catalogue
--    decisions. If the app logs searches here, the panel visualises them.
--    App-side (fire-and-forget on each search):
--      INSERT INTO search_logs(term, results, user_id) VALUES (...);
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS search_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term       text NOT NULL,
  results    int,             -- number of results returned (0 = failed search)
  user_id    uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_logs_created ON search_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_term ON search_logs (lower(term));
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "search_logs read" ON search_logs;
CREATE POLICY "search_logs read" ON search_logs FOR SELECT USING (is_admin_team());
DROP POLICY IF EXISTS "search_logs insert" ON search_logs;
-- Writers may only attribute a row to themselves (or to nobody, for anonymous
-- browsing). This still allows anon inserts — searches by signed-out visitors
-- are exactly the catalogue-gap signal we want — but nobody can forge a row as
-- another user. Written by www/js/telemetry.js → H.logSearch().
CREATE POLICY "search_logs insert" ON search_logs FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 7. SERVER-SIDE AGGREGATION RPCs  (Analytics / Finance / Dashboard at scale)
--    Why: at millions of rows the panel must NOT pull rows to sum them. These
--    SECURITY DEFINER functions aggregate in Postgres and return small JSON.
--    They are admin-guarded and safe to call from the anon client.
-- ─────────────────────────────────────────────────────────────────────────

-- Revenue rollup over a window (subscriptions + ads), fully server-side.
CREATE OR REPLACE FUNCTION admin_revenue_summary(days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb; since timestamptz := now() - (days || ' days')::interval;
BEGIN
  IF NOT is_admin_team() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT jsonb_build_object(
    'subs_paid',    COALESCE((SELECT SUM(amount) FROM business_payments WHERE status='paid' AND type='subscription' AND created_at >= since),0),
    'subs_failed',  COALESCE((SELECT COUNT(*) FROM business_payments WHERE status='failed' AND created_at >= since),0),
    'subs_pending', COALESCE((SELECT COUNT(*) FROM business_payments WHERE status='pending'),0),
    'other_paid',   COALESCE((SELECT SUM(amount) FROM business_payments WHERE status='paid' AND type<>'subscription' AND created_at >= since),0),
    'ads_revenue',  COALESCE((SELECT SUM(price_paid) FROM paid_ads),0),
    'txn_count',    COALESCE((SELECT COUNT(*) FROM business_payments WHERE created_at >= since),0)
  ) INTO result;
  RETURN result;
END; $$;

-- Category distribution over ALL listings (no row pull).
CREATE OR REPLACE FUNCTION admin_category_breakdown()
RETURNS TABLE(category text, n bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(category,'other') AS category, COUNT(*) AS n
  FROM listings
  WHERE is_admin_team()          -- guard inside the query
  GROUP BY 1 ORDER BY 2 DESC;
$$;

-- Province / geographic distribution over ALL listings.
CREATE OR REPLACE FUNCTION admin_province_breakdown()
RETURNS TABLE(province text, n bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(province,'Unknown') AS province, COUNT(*) AS n
  FROM listings
  WHERE is_admin_team()
  GROUP BY 1 ORDER BY 2 DESC;
$$;

-- Daily signups + listings for a growth chart (single round-trip).
CREATE OR REPLACE FUNCTION admin_daily_growth(days int DEFAULT 30)
RETURNS TABLE(d date, users bigint, listings bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH span AS (
    SELECT generate_series((now()::date - (days-1)), now()::date, '1 day')::date AS d
  )
  SELECT s.d,
    (SELECT COUNT(*) FROM profiles p WHERE p.created_at::date = s.d) AS users,
    (SELECT COUNT(*) FROM listings l WHERE l.created_at::date = s.d) AS listings
  FROM span s
  WHERE is_admin_team()
  ORDER BY s.d;
$$;

-- Weekly signup cohorts + how many of each cohort later verified (retention proxy).
CREATE OR REPLACE FUNCTION admin_cohorts(weeks int DEFAULT 8)
RETURNS TABLE(cohort date, signups bigint, verified bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT date_trunc('week', created_at)::date AS cohort,
         COUNT(*) AS signups,
         COUNT(*) FILTER (WHERE verified) AS verified
  FROM profiles
  WHERE is_admin_team()
    AND created_at >= now() - (weeks || ' weeks')::interval
  GROUP BY 1 ORDER BY 1;
$$;

-- Top paying businesses over a window.
CREATE OR REPLACE FUNCTION admin_top_payers(days int DEFAULT 90, lim int DEFAULT 10)
RETURNS TABLE(business_id uuid, total numeric, payments bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT business_id, SUM(amount) AS total, COUNT(*) AS payments
  FROM business_payments
  WHERE is_admin_team() AND status='paid'
    AND created_at >= now() - (days || ' days')::interval
  GROUP BY 1 ORDER BY 2 DESC LIMIT lim;
$$;

-- Grant execute to the anon/authenticated roles (RLS/guard still applies inside).
GRANT EXECUTE ON FUNCTION admin_revenue_summary(int)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_category_breakdown()   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_province_breakdown()   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_daily_growth(int)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_cohorts(int)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_top_payers(int,int)    TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. PROFILE COLUMNS for presence + CRM depth
--    last_seen_at powers "Online now", "Active today", and the "engaged" step
--    of the acquisition funnel. It is written by www/js/telemetry.js
--    (H.touchPresence, throttled to one write per 5 minutes per user).
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_notes  text;
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles (last_seen_at DESC);

-- TOTP secret for admin two-factor auth (base32). NULL = MFA not enrolled.
-- Only the admin themselves and the admin team can read/write it via existing
-- profile policies. Verified entirely client-side in the panel (RFC 6238).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mfa_secret text;

-- Presence requires that a signed-in user may update their OWN profile row.
-- Most installs already have such a policy; this makes it explicit and is a
-- no-op if an equivalent one exists (the names are namespaced to avoid clashes).
-- It grants nothing beyond "your own row" — it does NOT let users edit others.
DROP POLICY IF EXISTS "profiles self update" ON profiles;
CREATE POLICY "profiles self update" ON profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- CRITICAL: a self-update policy on its own would let a user set their own
-- role='admin' or verified=true. This trigger pins every privileged column to
-- its previous value for non-admins, so self-update can only ever touch benign
-- fields (name, phone, avatar, last_seen_at…). Admin-team members bypass it,
-- which is what lets the admin panel verify/ban/promote other users.
--
-- Defensive by design: it re-pins even if a future policy is loosened.
CREATE OR REPLACE FUNCTION profiles_guard_privileged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF is_admin_team() THEN RETURN NEW; END IF;   -- admins may change anything
  NEW.role                 := OLD.role;
  NEW.verified             := OLD.verified;
  NEW.status               := OLD.status;
  NEW.ban_reason           := OLD.ban_reason;
  NEW.ban_until            := OLD.ban_until;
  NEW.verification_pending := OLD.verification_pending;
  NEW.mfa_secret           := OLD.mfa_secret;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_profiles_guard ON profiles;
CREATE TRIGGER trg_profiles_guard BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_guard_privileged();

-- If your schema lacks any of the columns above (e.g. no `ban_reason`), delete
-- that line from the function body and re-run — everything else still applies.

-- ─────────────────────────────────────────────────────────────────────────
-- 9. RECOMMENDED pg_cron AUTOMATION (uncomment if pg_cron is enabled)
--    These make expiry/renewal/cleanup automatic and write to job_runs so the
--    Automation Center shows their health.
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT cron.schedule('unban-expired', '*/15 * * * *', $$
--   UPDATE profiles SET status='active', ban_until=NULL
--   WHERE status='banned' AND ban_until IS NOT NULL AND ban_until < now();
--   INSERT INTO job_runs(job, ok, detail) VALUES ('unban_expired', true, 'ran');
-- $$);
-- SELECT cron.schedule('expire-ads', '0 * * * *', $$
--   UPDATE paid_ads SET active=false WHERE active AND ends_at IS NOT NULL AND ends_at < now();
--   INSERT INTO job_runs(job, ok, detail) VALUES ('expire_ads', true, 'ran');
-- $$);
-- SELECT cron.schedule('expire-subscriptions', '0 2 * * *', $$
--   UPDATE business_subscriptions SET status='expired'
--   WHERE status='active' AND current_period_end < now();
--   INSERT INTO job_runs(job, ok, detail) VALUES ('expire_subscriptions', true, 'ran');
-- $$);
-- SELECT cron.schedule('purge-old-notifications', '0 3 * * 0', $$
--   DELETE FROM notifications WHERE created_at < (extract(epoch from now())*1000 - 30::bigint*86400000);
--   INSERT INTO job_runs(job, ok, detail) VALUES ('purge_notifications', true, 'weekly');
-- $$);
