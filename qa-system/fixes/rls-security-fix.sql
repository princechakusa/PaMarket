-- ============================================================
-- PaMarket RLS Security Fix  (v2 — corrected)
-- Generated: 2026-05-25
--
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Root cause: migrations.sql created permissive "anon read X"
-- policies with USING(true) on messages, conversations,
-- profiles, and applications.
--
-- Issues fixed:
--   CRITICAL  messages       — anon can read all private messages
--   CRITICAL  conversations  — anon can read all conversations
--   HIGH      profiles       — anon reads wallet_usd, role, email
--   HIGH      applications   — anon reads full PII (email, phone, name)
-- ============================================================

-- Force public schema so every unqualified name resolves correctly
SET search_path = public;


-- ── 1. MESSAGES — only conversation members can read/write ────────────────────

-- Remove the permissive policies created by migrations.sql
DROP POLICY IF EXISTS "anon read messages"             ON public.messages;
DROP POLICY IF EXISTS "anon write messages"            ON public.messages;
DROP POLICY IF EXISTS "participants_read_messages"     ON public.messages;
DROP POLICY IF EXISTS "participants_insert_messages"   ON public.messages;
DROP POLICY IF EXISTS "messages: member read"          ON public.messages;
DROP POLICY IF EXISTS "messages: member insert"        ON public.messages;
DROP POLICY IF EXISTS "messages: member update"        ON public.messages;

-- SELECT: only users who are in the conversation's members list
-- (members is a jsonb array of UUID strings, e.g. ["uuid1","uuid2"])
CREATE POLICY "messages: member read" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.members @> jsonb_build_array(auth.uid()::text)
    )
  );

-- INSERT: sender must be authenticated and a member of the conversation
CREATE POLICY "messages: member insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.members @> jsonb_build_array(auth.uid()::text)
    )
  );

-- UPDATE: members can mark messages as read
CREATE POLICY "messages: member update" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.members @> jsonb_build_array(auth.uid()::text)
    )
  );


-- ── 2. CONVERSATIONS — only members can read/write ────────────────────────────

DROP POLICY IF EXISTS "anon read conversations"      ON public.conversations;
DROP POLICY IF EXISTS "anon write conversations"     ON public.conversations;
DROP POLICY IF EXISTS "conversations: member read"   ON public.conversations;
DROP POLICY IF EXISTS "conversations: member insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations: member update" ON public.conversations;

-- SELECT: only participants
CREATE POLICY "conversations: member read" ON public.conversations
  FOR SELECT TO authenticated
  USING (members @> jsonb_build_array(auth.uid()::text));

-- INSERT: user must include themselves in the members list
CREATE POLICY "conversations: member insert" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (members @> jsonb_build_array(auth.uid()::text));

-- UPDATE: only members can update (e.g. updated_at refresh)
CREATE POLICY "conversations: member update" ON public.conversations
  FOR UPDATE TO authenticated
  USING (members @> jsonb_build_array(auth.uid()::text));


-- ── 3. PROFILES — require authentication; no anon access ─────────────────────
--
-- The "profiles: public read" policy used USING(true), exposing:
--   wallet_usd (balance), role (admin flag), email, phone to anyone.
-- Fix: only authenticated users can read profiles.
-- Note: anonymous visitors browsing listings will not see seller details
-- until they sign in — consistent with a marketplace that requires accounts.

DROP POLICY IF EXISTS "profiles: public read"         ON public.profiles;
DROP POLICY IF EXISTS "authenticated_read_profiles"   ON public.profiles;

-- Authenticated users can read any profile (needed to display seller info)
CREATE POLICY "profiles: authenticated read" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Ensure own-insert policy exists (upserted on signup via trigger, but belt-and-suspenders)
DROP POLICY IF EXISTS "profiles: own insert" ON public.profiles;
CREATE POLICY "profiles: own insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
DROP POLICY IF EXISTS "profiles: own update" ON public.profiles;
CREATE POLICY "profiles: own update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ── 4. APPLICATIONS — only employer or applicant can access ──────────────────
--
-- The "anon read applications" policy exposed full PII:
--   applicant_name, applicant_email, applicant_phone, message to anyone.

DROP POLICY IF EXISTS "anon read applications"               ON public.applications;
DROP POLICY IF EXISTS "anon write applications"              ON public.applications;
DROP POLICY IF EXISTS "applications: read"                   ON public.applications;
DROP POLICY IF EXISTS "applications: insert"                 ON public.applications;
DROP POLICY IF EXISTS "applications: employer update"        ON public.applications;
DROP POLICY IF EXISTS "employer_applicant_read_applications" ON public.applications;
DROP POLICY IF EXISTS "applicant_insert_applications"        ON public.applications;
DROP POLICY IF EXISTS "employer_update_application_status"   ON public.applications;

-- SELECT: only the applicant or the employer can see an application
CREATE POLICY "applications: read" ON public.applications
  FOR SELECT TO authenticated
  USING (
    auth.uid() = applicant_id
    OR auth.uid() = employer_id
  );

-- INSERT: only the applicant can submit their own application
CREATE POLICY "applications: insert" ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = applicant_id);

-- UPDATE: only the employer can change the status (shortlist/decline)
CREATE POLICY "applications: employer update" ON public.applications
  FOR UPDATE TO authenticated
  USING (auth.uid() = employer_id)
  WITH CHECK (auth.uid() = employer_id);


-- ── Verification ──────────────────────────────────────────────────────────────
-- After running, verify with these queries (using the anon/public REST API):
--
--   GET /rest/v1/messages          → should return 0 rows (or 401)
--   GET /rest/v1/conversations     → should return 0 rows (or 401)
--   GET /rest/v1/profiles          → should return 0 rows (or 401)
--   GET /rest/v1/applications      → should return 0 rows (or 401)
--
-- You can test directly in the SQL editor by temporarily disabling your
-- JWT (comment out auth.uid() check) or use the Supabase API with the
-- anon key and NO Authorization header.
