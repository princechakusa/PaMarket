-- Custom screening questions per job listing
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS custom_questions jsonb DEFAULT '[]'::jsonb;

-- Candidate answers stored on each application
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS answers jsonb DEFAULT '[]'::jsonb;
