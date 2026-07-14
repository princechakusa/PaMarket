-- ============================================================
-- PaMarket — stop chat messages from cluttering the in-app
-- notification center (bell icon list).
--
-- Users have a dedicated Messages tab for chat; every new message was
-- ALSO creating a 'message'-type row in public.notifications via the
-- trg_notify_message_recipients trigger (see
-- fix_message_notifications_server_side.sql), making the bell icon list
-- noisy. This does NOT touch phone push notifications for messages —
-- those are sent separately by the notify-message edge function via a
-- Database Webhook, unaffected by this change.
--
-- Idempotent. Run once in the Supabase SQL Editor.
-- ============================================================

drop trigger if exists trg_notify_message_recipients on public.messages;
drop function if exists public.notify_message_recipients();

-- Clear out existing 'message'-type rows so the notification center is
-- clean immediately, not just for messages sent after this migration runs.
delete from public.notifications where type = 'message';
