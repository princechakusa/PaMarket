-- OPTIONAL — improves read-receipt latency only.
--
-- Online presence and typing indicators use Supabase Realtime presence/broadcast
-- and need NO database changes. Read receipts already work via polling (the chat
-- re-syncs the messages.read flag every few seconds).
--
-- Running this makes the sender's ✓ flip to ✓✓ INSTANTLY (instead of within a few
-- seconds) by publishing UPDATE events on the messages table to Realtime.
-- Safe to run more than once.

DO $$
BEGIN
  -- Ensure the messages table streams changes to the realtime publication.
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
END $$;

-- REPLICA IDENTITY FULL lets the UPDATE payload include the row so the client can
-- match it to the conversation/message it already has.
ALTER TABLE public.messages REPLICA IDENTITY FULL;
