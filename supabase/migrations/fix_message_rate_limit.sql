-- Server-side message rate limit (anti-spam / anti-flood, direct-API proof).
--
-- js/chats.js and www/js/messages.js send one INSERT per message with no
-- cooldown; a scripted client can flood a conversation or fan out spam to
-- many conversations. There was no DB-level backstop. Mirrors the pattern in
-- add_listing_rate_limit.sql: a BEFORE INSERT trigger, configurable via the
-- existing public.moderation_settings table, staff exempt.

insert into public.moderation_settings (key, int_value)
values ('max_messages_per_5min', 60)
on conflict (key) do nothing;

create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lim int;
  cnt int;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  if public.is_moderator() then
    return new;
  end if;

  select int_value into lim
  from public.moderation_settings
  where key = 'max_messages_per_5min';
  if lim is null then lim := 60; end if;
  if lim <= 0 then return new; end if;      -- disabled

  -- Server-authoritative timestamp: prevents backdating out of the window.
  new.created_at := now();

  select count(*) into cnt
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '5 minutes';

  if cnt >= lim then
    raise exception 'rate_limited: too many messages sent recently. Please wait a moment and try again.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_message_rate_limit on public.messages;
create trigger trg_message_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_message_rate_limit();

-- Verification:
--   update public.moderation_settings set int_value = 2 where key='max_messages_per_5min';
--   -- as a normal user, insert 2 messages → OK; the 3rd within 5 min → ERROR 'rate_limited: …'
--   update public.moderation_settings set int_value = 60 where key='max_messages_per_5min';
