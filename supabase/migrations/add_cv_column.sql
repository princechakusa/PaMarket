-- Add cv JSONB column to profiles for structured candidate CV data
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cv jsonb;
