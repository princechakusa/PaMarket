SET search_path = public;

-- ── MESSAGES ─────────────────────────────────────────────────────────────────
-- sender_id = text, conversation_id = text, conversations.id = uuid
-- members = uuid[]

DROP POLICY IF EXISTS "anon read messages"           ON public.messages;
DROP POLICY IF EXISTS "anon write messages"          ON public.messages;
DROP POLICY IF EXISTS "participants_read_messages"   ON public.messages;
DROP POLICY IF EXISTS "participants_insert_messages" ON public.messages;
DROP POLICY IF EXISTS "messages: member read"        ON public.messages;
DROP POLICY IF EXISTS "messages: member insert"      ON public.messages;
DROP POLICY IF EXISTS "messages: member update"      ON public.messages;

CREATE POLICY "messages: member read" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id::uuid
        AND auth.uid() = ANY(members)
    )
  );

CREATE POLICY "messages: member insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id::uuid
        AND auth.uid() = ANY(members)
    )
  );

CREATE POLICY "messages: member update" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id::uuid
        AND auth.uid() = ANY(members)
    )
  );


-- ── CONVERSATIONS ─────────────────────────────────────────────────────────────
-- id = uuid, members = uuid[]

DROP POLICY IF EXISTS "anon read conversations"      ON public.conversations;
DROP POLICY IF EXISTS "anon write conversations"     ON public.conversations;
DROP POLICY IF EXISTS "conversations: member read"   ON public.conversations;
DROP POLICY IF EXISTS "conversations: member insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations: member update" ON public.conversations;

CREATE POLICY "conversations: member read" ON public.conversations
  FOR SELECT TO authenticated
  USING (auth.uid() = ANY(members));

CREATE POLICY "conversations: member insert" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = ANY(members));

CREATE POLICY "conversations: member update" ON public.conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = ANY(members));


-- ── PROFILES ─────────────────────────────────────────────────────────────────
-- id = uuid

DROP POLICY IF EXISTS "profiles: public read"       ON public.profiles;
DROP POLICY IF EXISTS "authenticated_read_profiles" ON public.profiles;

CREATE POLICY "profiles: authenticated read" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles: own insert" ON public.profiles;
CREATE POLICY "profiles: own insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles: own update" ON public.profiles;
CREATE POLICY "profiles: own update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ── APPLICATIONS ─────────────────────────────────────────────────────────────
-- applicant_id = uuid, employer_id = uuid

DROP POLICY IF EXISTS "anon read applications"               ON public.applications;
DROP POLICY IF EXISTS "anon write applications"              ON public.applications;
DROP POLICY IF EXISTS "applications: read"                   ON public.applications;
DROP POLICY IF EXISTS "applications: insert"                 ON public.applications;
DROP POLICY IF EXISTS "applications: employer update"        ON public.applications;
DROP POLICY IF EXISTS "employer_applicant_read_applications" ON public.applications;
DROP POLICY IF EXISTS "applicant_insert_applications"        ON public.applications;
DROP POLICY IF EXISTS "employer_update_application_status"   ON public.applications;

CREATE POLICY "applications: read" ON public.applications
  FOR SELECT TO authenticated
  USING (
    applicant_id = auth.uid()
    OR employer_id = auth.uid()
  );

CREATE POLICY "applications: insert" ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (applicant_id = auth.uid());

CREATE POLICY "applications: employer update" ON public.applications
  FOR UPDATE TO authenticated
  USING (employer_id = auth.uid())
  WITH CHECK (employer_id = auth.uid());
