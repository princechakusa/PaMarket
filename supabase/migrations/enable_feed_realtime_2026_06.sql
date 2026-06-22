-- ─────────────────────────────────────────────────────────────
-- FEED REALTIME PUBLICATION — 2026-06
-- Adds listings, businesses, and notifications to the Supabase
-- realtime publication so the app receives instant postgres_changes
-- events on INSERT, UPDATE and DELETE — matching the behaviour of
-- the messages table (which already works in real time).
--
-- Without this, the realtime channels in app.js subscribe but
-- receive no events, so the home feed / shop / notifications only
-- update when the user navigates or restarts the app.
--
-- Run ONCE in the Supabase SQL Editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- REPLICA IDENTITY FULL: include the full old row on UPDATE/DELETE
-- so the client payload always carries the row id we need to
-- match against local state.
ALTER TABLE public.listings      REPLICA IDENTITY FULL;
ALTER TABLE public.businesses    REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Add each table to the realtime publication if not already there.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'listings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.listings';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'businesses'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- Force PostgREST + Realtime to reload so the new publication
-- membership is picked up without a server restart.
NOTIFY pgrst, 'reload schema';
