-- ════════════════════════════════════════════════════════════════════════
-- PaMarket Admin Enterprise Upgrade
-- Run manually in the Supabase SQL Editor (safe to re-run; everything is
-- IF NOT EXISTS / idempotent). The admin panel works without this file but
-- the following features stay dormant until it runs:
--   1. Unified admin audit trail (Audit Center, user notes, timelines)
--   2. Report severity / assignment
--   3. Extra admin team roles (moderator / support / finance)
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Unified admin audit trail ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid,
  actor_email  text,
  actor_role   text,
  action       text NOT NULL,
  entity       text,          -- table / area the action touched (e.g. 'profiles')
  entity_id    text,          -- id of the affected row (text: uuid or composite)
  before_state jsonb,
  after_state  jsonb,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aal_created  ON admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aal_entity   ON admin_audit_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_aal_actor    ON admin_audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_aal_action   ON admin_audit_logs (action);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin-team-only access. NOTE: deliberately NOT "USING (true)".
DROP POLICY IF EXISTS "aal admin select" ON admin_audit_logs;
CREATE POLICY "aal admin select" ON admin_audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
                 AND p.role IN ('super_admin','admin','moderator','support','finance')));

DROP POLICY IF EXISTS "aal admin insert" ON admin_audit_logs;
CREATE POLICY "aal admin insert" ON admin_audit_logs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
                      AND p.role IN ('super_admin','admin','moderator','support','finance')));

-- Append-only: no UPDATE/DELETE policies on purpose (audit rows are immutable
-- from the client; clean up only via SQL editor if ever needed).

-- ── 2. Report severity + assignment ──────────────────────────────────────
ALTER TABLE reports ADD COLUMN IF NOT EXISTS severity    text DEFAULT 'medium';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS assigned_to uuid;
CREATE INDEX IF NOT EXISTS idx_reports_sev ON reports (severity) WHERE status = 'open';

-- ── 3. Admin team roles ───────────────────────────────────────────────────
-- profiles.role already exists ('user' / 'admin'). The extra roles are plain
-- text values — no schema change needed. To grant one:
--   UPDATE profiles SET role = 'moderator' WHERE email = 'person@example.com';
-- Valid roles the panel recognises: super_admin, admin, moderator, support, finance.
--
-- IMPORTANT: existing RLS policies that check role = 'admin' still gate writes.
-- Non-admin team roles can sign in and read, but their writes are refused by
-- RLS (the panel surfaces this as "blocked by RLS") until you extend the
-- relevant table policies to include the new roles you actually want to allow.
-- Recommended starter grants (uncomment to apply):
--
-- Moderators may moderate listings:
-- DROP POLICY IF EXISTS "listings moderator update" ON listings;
-- CREATE POLICY "listings moderator update" ON listings FOR UPDATE
--   USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
--                  AND p.role IN ('super_admin','admin','moderator')));
--
-- Support may manage reports and contact requests:
-- DROP POLICY IF EXISTS "reports support update" ON reports;
-- CREATE POLICY "reports support update" ON reports FOR UPDATE
--   USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
--                  AND p.role IN ('super_admin','admin','moderator','support')));

-- ── 4. Verification of the fix from the audit (informational) ────────────
-- If verifications was ever created with the old inline helper SQL, its
-- SELECT policy was "USING (true)" (world-readable ID documents). Check with:
--   SELECT policyname, qual FROM pg_policies WHERE tablename = 'verifications';
-- If you see a bare "true" qual on SELECT, replace it:
-- DROP POLICY IF EXISTS "Admin reads verifications" ON verifications;
-- CREATE POLICY "Admin reads verifications" ON verifications FOR SELECT
--   USING (auth.uid() = user_id
--          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
--                     AND p.role IN ('super_admin','admin','moderator')));
