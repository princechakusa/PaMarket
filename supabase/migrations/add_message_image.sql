-- ─────────────────────────────────────────────────────────────
-- Add image column to chat messages so photos sync to the recipient.
-- Without it, a photo message only carried "[Photo]" text and the
-- image URL was dropped, so the other person saw "[Photo]" with no image.
-- Safe to run more than once. Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS image text;
