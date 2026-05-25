SET search_path = public;

CREATE TABLE IF NOT EXISTS public.verifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid UNIQUE,
  id_doc       text,
  selfie       text,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
  admin_note   text,
  submitted_at timestamptz DEFAULT now(),
  reviewed_at  timestamptz,
  reviewed_by  text
);

ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read verifications"  ON public.verifications;
DROP POLICY IF EXISTS "anon write verifications" ON public.verifications;
DROP POLICY IF EXISTS "verifications: own read"  ON public.verifications;
DROP POLICY IF EXISTS "verifications: own write" ON public.verifications;
DROP POLICY IF EXISTS "verifications: auth read" ON public.verifications;

CREATE POLICY "verifications: own write" ON public.verifications
  FOR ALL TO authenticated
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "verifications: auth read" ON public.verifications
  FOR SELECT TO authenticated
  USING (true);
