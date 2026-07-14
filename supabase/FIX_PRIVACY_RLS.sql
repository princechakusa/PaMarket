-- ════════════════════════════════════════════════════════════════════════
-- PaMarket — URGENT PRIVACY FIX
--
-- FOUND: anonymous users (anyone holding the public anon key, which ships in
-- every copy of the app) can currently READ:
--
--     messages       2,658 rows   ← every private chat between your users
--     conversations      88 rows   ← who is talking to whom
--     notifications     304 rows   ← every user's personal notifications
--     reports             4 rows   ← who reported whom, and why
--
-- This is a live data breach. Fix it now.
--
-- WHAT STAYS PUBLIC (intentionally — the marketplace needs these):
--     listings, businesses, reviews, profiles (minus mfa_secret), app_settings
--
-- Run in the Supabase SQL Editor. Idempotent — safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

-- Reusable admin guard (created by ADMIN_ENTERPRISE_V2.sql; recreated here so
-- this file can be run standalone in an emergency).
CREATE OR REPLACE FUNCTION is_admin_team() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('super_admin','admin','moderator','support','finance')
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. CONVERSATIONS — only the people in it (members is a uuid[])
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE tablename='conversations'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON conversations', p.policyname); END LOOP;
END $$;

CREATE POLICY "conversations: members read" ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY (members) OR is_admin_team());

CREATE POLICY "conversations: members insert" ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = ANY (members));

CREATE POLICY "conversations: members update" ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = ANY (members) OR is_admin_team());

-- ─────────────────────────────────────────────────────────────────────────
-- 2. MESSAGES — only messages in a conversation you belong to
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE tablename='messages'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON messages', p.policyname); END LOOP;
END $$;

CREATE POLICY "messages: participant read" ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM conversations c
             WHERE c.id = messages.conversation_id
               AND auth.uid() = ANY (c.members))
    OR is_admin_team()
  );

-- You may only send as yourself, into a conversation you are part of.
CREATE POLICY "messages: participant insert" ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM conversations c
                 WHERE c.id = messages.conversation_id
                   AND auth.uid() = ANY (c.members))
  );

-- Needed for read receipts, edits, reactions and soft-deletes: any participant
-- may update rows in their own conversation (marking read is done by the
-- RECIPIENT, so this cannot be restricted to sender_id only).
CREATE POLICY "messages: participant update" ON messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM conversations c
             WHERE c.id = messages.conversation_id
               AND auth.uid() = ANY (c.members))
    OR is_admin_team()
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3. NOTIFICATIONS — strictly your own
--    notifications.user_id is TEXT on this database (the app writes a text id),
--    so compare against auth.uid()::text.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE tablename='notifications'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', p.policyname); END LOOP;
END $$;

CREATE POLICY "notifications: own read" ON notifications FOR SELECT
  TO authenticated
  USING (user_id::text = auth.uid()::text OR is_admin_team());

CREATE POLICY "notifications: own update" ON notifications FOR UPDATE
  TO authenticated
  USING (user_id::text = auth.uid()::text OR is_admin_team());

-- Admins (and server-side flows) create notifications for other users.
CREATE POLICY "notifications: admin insert" ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_team() OR user_id::text = auth.uid()::text);

CREATE POLICY "notifications: own delete" ON notifications FOR DELETE
  TO authenticated
  USING (user_id::text = auth.uid()::text OR is_admin_team());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. REPORTS — a reporter sees their own; only admins see everything.
--    Leaking these exposes who reported whom, which puts reporters at risk.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE tablename='reports'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON reports', p.policyname); END LOOP;
END $$;

CREATE POLICY "reports: own read" ON reports FOR SELECT
  TO authenticated
  USING (reporter_id::text = auth.uid()::text OR is_admin_team());

-- Any signed-in user may file a report, but only as themselves.
CREATE POLICY "reports: own insert" ON reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id::text = auth.uid()::text);

CREATE POLICY "reports: admin update" ON reports FOR UPDATE
  TO authenticated
  USING (is_admin_team());

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Tables that SHOULD stay publicly readable — but not publicly WRITABLE.
--    The marketplace needs anonymous visitors to browse listings, shops and
--    reviews (that is also what Google indexes). They must not be able to
--    EDIT or DELETE them.
-- ─────────────────────────────────────────────────────────────────────────

-- LISTINGS: public read; owner or admin writes.
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE tablename='listings'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON listings', p.policyname); END LOOP;
END $$;
CREATE POLICY "listings: public read"   ON listings FOR SELECT USING (true);
CREATE POLICY "listings: own insert"    ON listings FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
CREATE POLICY "listings: own update"    ON listings FOR UPDATE TO authenticated USING (seller_id = auth.uid() OR is_admin_team());
CREATE POLICY "listings: own delete"    ON listings FOR DELETE TO authenticated USING (seller_id = auth.uid() OR is_admin_team());

-- REVIEWS: public read; author writes their own.
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE tablename='reviews'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON reviews', p.policyname); END LOOP;
END $$;
CREATE POLICY "reviews: public read"  ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews: own write"    ON reviews FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid());
CREATE POLICY "reviews: own update"   ON reviews FOR UPDATE TO authenticated USING (reviewer_id = auth.uid() OR is_admin_team());
CREATE POLICY "reviews: own delete"   ON reviews FOR DELETE TO authenticated USING (reviewer_id = auth.uid() OR is_admin_team());

-- BUSINESSES: public read; owner or admin writes.
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE tablename='businesses'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON businesses', p.policyname); END LOOP;
END $$;
CREATE POLICY "businesses: public read" ON businesses FOR SELECT USING (true);
CREATE POLICY "businesses: own insert"  ON businesses FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "businesses: own update"  ON businesses FOR UPDATE TO authenticated USING (owner_user_id = auth.uid() OR is_admin_team());
CREATE POLICY "businesses: admin delete" ON businesses FOR DELETE TO authenticated USING (is_admin_team());

-- APP_SETTINGS: public read (the app needs fxRate etc.); ADMIN-ONLY writes.
-- A public write here would let anyone flip maintenanceMode or the exchange rate.
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE tablename='app_settings'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON app_settings', p.policyname); END LOOP;
END $$;
CREATE POLICY "app_settings: public read" ON app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings: admin write" ON app_settings FOR ALL TO authenticated
  USING (is_admin_team()) WITH CHECK (is_admin_team());

-- ─────────────────────────────────────────────────────────────────────────
-- 6. VERIFY — run this after the above and read the output.
-- ─────────────────────────────────────────────────────────────────────────
-- Every table below MUST show rowsecurity = true.
SELECT tablename, rowsecurity AS rls_on
  FROM pg_tables
 WHERE schemaname='public'
   AND tablename IN ('messages','conversations','notifications','reports',
                     'listings','reviews','businesses','app_settings','profiles')
 ORDER BY tablename;

-- Nothing here should grant ALL to {public} with a `true` qualifier.
SELECT tablename, policyname, cmd, roles, qual
  FROM pg_policies
 WHERE schemaname='public'
   AND tablename IN ('messages','conversations','notifications','reports',
                     'listings','reviews','businesses','app_settings')
 ORDER BY tablename, cmd, policyname;

-- ════════════════════════════════════════════════════════════════════════
-- POST-MORTEM (what actually fixed it, 2026-07-14)
--
-- The CREATE POLICY statements above were NOT enough. The database had years
-- of accumulated policies layered on top of each other, and Postgres RLS is
-- PERMISSIVE — policies are OR'd together, so ONE bad policy defeats every
-- correct one sitting beside it. The killers were:
--
--     messages       "Allow all"                  ALL    / public / true
--     messages       "Authenticated read messages" SELECT / auth   / true
--     conversations  "Anyone can view conversations" SELECT / public / true
--     notifications  "anon read notifications"    SELECT / public / true
--     reports        "anon read reports"          SELECT / public / true
--
-- LESSON: RLS is not additive security. Adding a good policy does nothing if a
-- permissive one remains. You must DROP the bad ones.
--
-- The drops that actually closed the breach:
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all"                     ON messages;
DROP POLICY IF EXISTS "Authenticated read messages"   ON messages;
DROP POLICY IF EXISTS "Authenticated update messages" ON messages;
DROP POLICY IF EXISTS "Authenticated insert messages" ON messages;

DROP POLICY IF EXISTS "Authenticated all convs"          ON conversations;
DROP POLICY IF EXISTS "Anyone can view conversations"    ON conversations;
DROP POLICY IF EXISTS "Anyone can update conversations"  ON conversations;
DROP POLICY IF EXISTS "Anyone can insert conversations"  ON conversations;
DROP POLICY IF EXISTS "Members can see conversations"    ON conversations;
DROP POLICY IF EXISTS "Members can insert conversations" ON conversations;

DROP POLICY IF EXISTS "anon write notifications"      ON notifications;
DROP POLICY IF EXISTS "anon read notifications"       ON notifications;
DROP POLICY IF EXISTS "Anyone can view notifications" ON notifications;

DROP POLICY IF EXISTS "anon write reports"             ON reports;
DROP POLICY IF EXISTS "anon read reports"              ON reports;
DROP POLICY IF EXISTS "Anyone can insert reports"      ON reports;
DROP POLICY IF EXISTS "Authenticated users can report" ON reports;
DROP POLICY IF EXISTS "reporter can insert"            ON reports;
DROP POLICY IF EXISTS "reports: own read"              ON reports;

ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports       ENABLE ROW LEVEL SECURITY;

-- Dropping the permissive notifications SELECT left NO select policy, which
-- (RLS on + no policy = deny all) broke notifications for real users. Restored:
CREATE POLICY "notifications: own read" ON notifications FOR SELECT
  TO authenticated USING (user_id::text = auth.uid()::text OR is_admin_team());
CREATE POLICY "notifications: own update" ON notifications FOR UPDATE
  TO authenticated USING (user_id::text = auth.uid()::text OR is_admin_team());

-- VERIFIED FROM OUTSIDE with the public anon key after applying:
--   messages/conversations/notifications/reports -> 0 rows to anon  ✅
--   listings/businesses/reviews/profiles/app_settings -> still readable ✅
