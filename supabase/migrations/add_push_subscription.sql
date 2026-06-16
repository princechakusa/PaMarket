-- ─────────────────────────────────────────────────────────────
-- Web Push subscription column (iOS PWA / desktop browser push).
-- Native Android uses profiles.push_token (added in add_push_notifications.sql);
-- this stores the Web Push (VAPID) subscription JSON the client saves.
-- Safe to run more than once. Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_subscription text;
