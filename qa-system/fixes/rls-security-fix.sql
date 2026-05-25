-- ============================================================
-- PaMarket RLS Security Fix
-- Generated: 2026-05-25 — QA Agent 5 detected anon data leaks
--
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Issues fixed:
--   CRITICAL  messages     — 5 rows exposed to anon (BUG: no RLS)
--   HIGH      profiles     — 5 rows exposed to anon (wallet_usd, role leaked)
--   HIGH      applications — 1 row exposed to anon (PII: email, phone, name)
-- ============================================================


-- ── 1. MESSAGES — only conversation participants can read ─────────────────────

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop any overly-permissive anon policy that currently exists
DROP POLICY IF EXISTS "anon_read_messages"          ON messages;
DROP POLICY IF EXISTS "authenticated_only_messages" ON messages;
DROP POLICY IF EXISTS "participants_read_messages"  ON messages;

-- SELECT: only users who are part of the conversation
CREATE POLICY "participants_read_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE buyer_id  = auth.uid()
         OR seller_id = auth.uid()
    )
  );

-- INSERT: sender must be the authenticated user AND be in the conversation
DROP POLICY IF EXISTS "participants_insert_messages" ON messages;
CREATE POLICY "participants_insert_messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT id FROM conversations
      WHERE buyer_id  = auth.uid()
         OR seller_id = auth.uid()
    )
  );


-- ── 2. PROFILES — require authentication; no anon access ─────────────────────
--
-- NOTE: The marketplace needs sellers visible for listing display.
-- Authenticated users can read any profile (needed to show seller info).
-- Anon (not logged in) cannot read any profile data.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_profiles"          ON profiles;
DROP POLICY IF EXISTS "authenticated_read_profiles" ON profiles;
DROP POLICY IF EXISTS "users_read_own_profile"      ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile"    ON profiles;

-- Authenticated users can read any profile (for marketplace seller display)
CREATE POLICY "authenticated_read_profiles" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Users can only update their own profile
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Prevent anon reads explicitly (belt-and-suspenders)
-- (The absence of an anon SELECT policy already blocks anon, but this makes intent clear)


-- ── 3. APPLICATIONS — only employer or applicant can read ─────────────────────
--
-- Applications contain full PII: email, phone, name, CV content.
-- Exposed to anon = GDPR / privacy violation.

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_applications"              ON applications;
DROP POLICY IF EXISTS "authenticated_only_applications"     ON applications;
DROP POLICY IF EXISTS "employer_applicant_read_applications" ON applications;

-- Only the employer or the applicant can see an application
CREATE POLICY "employer_applicant_read_applications" ON applications
  FOR SELECT TO authenticated
  USING (
    employer_id   = auth.uid()
    OR applicant_id = auth.uid()
  );

-- Only the applicant can insert (submit) an application
DROP POLICY IF EXISTS "applicant_insert_applications" ON applications;
CREATE POLICY "applicant_insert_applications" ON applications
  FOR INSERT TO authenticated
  WITH CHECK (applicant_id = auth.uid());

-- Only employer can update status (shortlist/reject)
DROP POLICY IF EXISTS "employer_update_application_status" ON applications;
CREATE POLICY "employer_update_application_status" ON applications
  FOR UPDATE TO authenticated
  USING (employer_id = auth.uid())
  WITH CHECK (employer_id = auth.uid());


-- ── Verification ──────────────────────────────────────────────────────────────
-- After running, verify with these checks in the SQL editor:

-- Should return 0 rows (anon cannot read messages):
-- SELECT count(*) FROM messages;  -- run as anon (use anon key in REST API)

-- Should return 0 rows (anon cannot read profiles):
-- SELECT count(*) FROM profiles;  -- run as anon

-- Should return 0 rows (anon cannot read applications):
-- SELECT count(*) FROM applications;  -- run as anon
