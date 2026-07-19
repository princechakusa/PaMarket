-- ============================================================================
-- PaMarket — Marketplace notifications, phase 3
-- ----------------------------------------------------------------------------
-- In-app chat scam warning (Trust & Safety). Real-time trigger on message
-- insert — no separate scanning service, the check runs inline in the same
-- transaction as the message being saved, and reuses the existing
-- scheduled_notifications -> automation-runner -> send-push pipeline to
-- actually reach the recipient's phone.
--
-- Deliberately NOT flagging mobile-money keywords (EcoCash/OneMoney/etc) —
-- this app has no in-app escrow, so paying each other via mobile money is
-- normal, legitimate behavior here, not a red flag by itself. The real scam
-- pattern is a request to pay a deposit/advance BEFORE meeting or inspecting
-- the item — that's what's flagged, along with off-platform redirects
-- (WhatsApp/Telegram), OTP requests, and external links.
--
-- Idempotent. Run once in the Supabase SQL Editor, after phases 1-2.
-- ============================================================================

begin;

create or replace function public.notify_chat_scam_warning()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_members uuid[];
  v_recipient uuid;
  v_matched text;
begin
  if NEW.text is null or NEW.text = '' then
    return NEW;
  end if;

  v_matched := case
    when NEW.text ilike '%whatsapp%' then 'WhatsApp'
    when NEW.text ilike '%telegram%' then 'Telegram'
    when NEW.text ilike '%otp%' or NEW.text ilike '%verification code%' then 'an OTP or verification code'
    when NEW.text ~* 'https?://' then 'an external link'
    when NEW.text ilike '%pay first%' or NEW.text ilike '%send first%' or NEW.text ilike '%deposit first%'
      or NEW.text ilike '%pay in advance%' or NEW.text ilike '%pay upfront%'
      or NEW.text ilike '%send a deposit%' or NEW.text ilike '%send deposit%' then 'a request to pay before meeting'
    else null
  end;

  if v_matched is null then
    return NEW;
  end if;

  select c.members into v_members from public.conversations c where c.id = NEW.conversation_id;
  if v_members is null then
    return NEW;
  end if;

  foreach v_recipient in array v_members loop
    if v_recipient = NEW.sender_id then
      continue;
    end if;
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        v_recipient::text,
        '🚨 Be cautious with this chat',
        'This message mentions ' || v_matched || '. Never pay before you''ve inspected the item in person, and keep the chat on PaMarket so we can step in if something goes wrong.',
        'chat_scam_warning', 'chat:' || NEW.conversation_id, now()
      );
    exception when others then
      raise warning 'notify_chat_scam_warning: insert failed for conversation % / recipient %: %', NEW.conversation_id, v_recipient, sqlerrm;
    end;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_chat_scam_warning on public.messages;
create trigger trg_notify_chat_scam_warning
  after insert on public.messages
  for each row execute function public.notify_chat_scam_warning();

commit;

-- ============================================================================
-- Verification (run manually):
--   insert into conversations (id, members) values ('t1', array['<uid-a>','<uid-b>']);
--   insert into messages (conversation_id, sender_id, sender_name, text)
--     values ('t1', '<uid-a>', 'A', 'Just WhatsApp me and I''ll send the OTP');
--   select target, title, body from scheduled_notifications where type='chat_scam_warning';
--   -- expect one row targeting <uid-b>, not <uid-a>
-- ============================================================================
