SET search_path = public;

DROP POLICY IF EXISTS "anon read messages" ON public.messages;
DROP POLICY IF EXISTS "anon write messages" ON public.messages;
DROP POLICY IF EXISTS "participants_read_messages" ON public.messages;
DROP POLICY IF EXISTS "participants_insert_messages" ON public.messages;
DROP POLICY IF EXISTS "messages: member read" ON public.messages;
DROP POLICY IF EXISTS "messages: member insert" ON public.messages;
DROP POLICY IF EXISTS "messages: member update" ON public.messages;

CREATE POLICY "messages: member read" ON public.messages
  FOR SELECT TO authenticated
  USING (
    (SELECT members FROM public.conversations WHERE id = conversation_id)
    @> jsonb_build_array(auth.uid()::text)
  );

CREATE POLICY "messages: member insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (SELECT members FROM public.conversations WHERE id = conversation_id)
        @> jsonb_build_array(auth.uid()::text)
  );

CREATE POLICY "messages: member update" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    (SELECT members FROM public.conversations WHERE id = conversation_id)
    @> jsonb_build_array(auth.uid()::text)
  );

DROP POLICY IF EXISTS "anon read conversations" ON public.conversations;
DROP POLICY IF EXISTS "anon write conversations" ON public.conversations;
DROP POLICY IF EXISTS "conversations: member read" ON public.conversations;
DROP POLICY IF EXISTS "conversations: member insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations: member update" ON public.conversations;

CREATE POLICY "conversations: member read" ON public.conversations
  FOR SELECT TO authenticated
  USING (members @> jsonb_build_array(auth.uid()::text));

CREATE POLICY "conversations: member insert" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (members @> jsonb_build_array(auth.uid()::text));

CREATE POLICY "conversations: member update" ON public.conversations
  FOR UPDATE TO authenticated
  USING (members @> jsonb_build_array(auth.uid()::text));

DROP POLICY IF EXISTS "profiles: public read" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_read_profiles" ON public.profiles;

CREATE POLICY "profiles: authenticated read" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles: own insert" ON public.profiles;
CREATE POLICY "profiles: own insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: own update" ON public.profiles;
CREATE POLICY "profiles: own update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "anon read applications" ON public.applications;
DROP POLICY IF EXISTS "anon write applications" ON public.applications;
DROP POLICY IF EXISTS "applications: read" ON public.applications;
DROP POLICY IF EXISTS "applications: insert" ON public.applications;
DROP POLICY IF EXISTS "applications: employer update" ON public.applications;
DROP POLICY IF EXISTS "employer_applicant_read_applications" ON public.applications;
DROP POLICY IF EXISTS "applicant_insert_applications" ON public.applications;
DROP POLICY IF EXISTS "employer_update_application_status" ON public.applications;

CREATE POLICY "applications: read" ON public.applications
  FOR SELECT TO authenticated
  USING (
    auth.uid() = applicant_id
    OR auth.uid() = employer_id
  );

CREATE POLICY "applications: insert" ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "applications: employer update" ON public.applications
  FOR UPDATE TO authenticated
  USING (auth.uid() = employer_id)
  WITH CHECK (auth.uid() = employer_id);
