-- ============================================================
-- PaMarket — server-side notifications for new chat messages
--
-- Audit finding (Section 4, N1, HIGH): cross-user notifications were created
-- CLIENT-SIDE by H.pushNotif, which inserts a row with user_id = the RECIPIENT.
-- The notifications INSERT policy is `with check (auth.uid() = user_id)` (see
-- fix_notifications_rls_missing.sql, correctly hardened to stop an anon read
-- leak). Under that policy the sender CANNOT insert a notification for the
-- recipient, so every "New Message" / "New Photo" notification is rejected by
-- RLS and never reaches the other party's devices. The message itself still
-- syncs via the messages table + realtime, but the notification/badge/push does
-- not. Rental events already do this correctly via security-definer triggers;
-- general messaging had no such trigger.
--
-- Fix: a security-definer trigger on messages INSERT creates the notification
-- for each OTHER conversation member, bypassing the self-only insert RLS safely
-- (the function is owned by a privileged role; it only ever writes a
-- notification addressed to a genuine conversation participant).
--
-- The client H.pushNotif still runs and updates local state immediately for a
-- snappy UI; its cloud insert simply no-ops under RLS. To avoid showing the
-- recipient TWO rows (one from the client on the sender's device is local-only,
-- so there is no real duplicate across devices), the trigger is the single
-- source of truth for the recipient's persisted notification.
--
-- Idempotent. Run once in the Supabase SQL Editor.
-- ============================================================

create or replace function public.notify_message_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_members     uuid[];
  v_recipient   uuid;
  v_preview     text;
  v_sender_name text;
begin
  -- Resolve conversation members; if the conversation row is missing we cannot
  -- know the recipients, so do nothing (message still stored).
  select members into v_members
  from public.conversations
  where id = NEW.conversation_id;

  if v_members is null then
    return NEW;
  end if;

  v_sender_name := coalesce(nullif(NEW.sender_name, ''), 'Someone');
  v_preview     := left(coalesce(NEW.text, ''), 80);
  if v_preview = '' then
    v_preview := 'Sent you a message';
  end if;

  -- One notification per OTHER member (1:1 chats have exactly one).
  foreach v_recipient in array v_members loop
    if v_recipient is distinct from NEW.sender_id then
      insert into public.notifications (id, user_id, title, body, type, read, created_at, meta)
      values (
        gen_random_uuid()::text,
        v_recipient,
        'New Message',
        v_sender_name || ': ' || v_preview,
        'message',
        false,
        (extract(epoch from now()) * 1000)::bigint,
        jsonb_build_object(
          'conversationId', NEW.conversation_id,
          'deepLink',       'Chat?id=' || NEW.conversation_id
        )
      );
    end if;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_message_recipients on public.messages;
create trigger trg_notify_message_recipients
  after insert on public.messages
  for each row execute function public.notify_message_recipients();
