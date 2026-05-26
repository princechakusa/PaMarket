SET search_path = public;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio                  text,
  ADD COLUMN IF NOT EXISTS job_types            text,
  ADD COLUMN IF NOT EXISTS expected_salary      text,
  ADD COLUMN IF NOT EXISTS whatsapp_number      text,
  ADD COLUMN IF NOT EXISTS phone_for_calls      text,
  ADD COLUMN IF NOT EXISTS contact_method       text DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS contact_availability text DEFAULT 'Anytime',
  ADD COLUMN IF NOT EXISTS linkedin_url         text,
  ADD COLUMN IF NOT EXISTS github_url           text,
  ADD COLUMN IF NOT EXISTS website_url          text,
  ADD COLUMN IF NOT EXISTS cv_file_name         text;
