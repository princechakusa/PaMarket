-- ============================================================
-- 202608190007_message_distinct_recipient_limit.sql
--
-- FIX (Audit 3/5 P1, verified live 2026-08-19): enforce_message_rate_limit()
-- caps total message VOLUME at 60/5min per sender, but does nothing about
-- SPREAD — the count is over all messages regardless of conversation_id.
-- A single account could message 60 distinct victims every 5 minutes
-- (~17k/day theoretical ceiling), which is a real harassment/spam fan-out
-- vector distinct from flooding one person. Confirmed live: no separate
-- distinct-recipient/distinct-conversation check exists anywhere.
--
-- FIX: extend the SAME trigger function (not a new trigger) with two more
-- checks, both counting DISTINCT conversation_id — which, since
-- conversation ids are deterministic per pair (conversationIdFor in
-- apps/mobile/lib/messages.ts), is an accurate proxy for "distinct people
-- contacted," and correctly does NOT penalize an extended back-and-forth
-- with the SAME person (same conversation_id, doesn't add to the count).
--
--   max_new_conversations_per_hour = 20
--   max_new_conversations_per_day  = 60
--
-- Sized for real marketplace behavior: an active buyer browsing and
-- contacting several sellers in one session might reasonably message
-- 5-15 different sellers; a very active power-user across a full day might
-- reach 20-30. 20/hour and 60/day sit comfortably above that while cutting
-- the theoretical abuse ceiling by >99% (17k/day -> 60/day distinct
-- victims). The existing 60/5min volume cap is untouched and still governs
-- normal back-and-forth chat within a conversation.
--
-- Staff remain exempt (same is_moderator() guard as the existing checks).
-- Direct-API-proof: this is a BEFORE INSERT trigger, not a client-side
-- check, so it applies identically to the app, the website, or a raw
-- PostgREST call.
-- ============================================================

insert into public.moderation_settings (key, int_value)
values
  ('max_new_conversations_per_hour', 20),
  ('max_new_conversations_per_day', 60)
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
  hour_lim int;
  hour_cnt int;
  day_lim int;
  day_cnt int;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  if public.is_moderator() then
    return new;
  end if;

  -- Server-authoritative timestamp: prevents backdating out of any window
  -- below.
  new.created_at := now();

  -- Existing volume cap (unchanged) — total messages, any conversation.
  select int_value into lim
  from public.moderation_settings
  where key = 'max_messages_per_5min';
  if lim is null then lim := 60; end if;
  if lim > 0 then
    select count(*) into cnt
    from public.messages
    where sender_id = new.sender_id
      and created_at > now() - interval '5 minutes';

    if cnt >= lim then
      raise exception 'rate_limited: too many messages sent recently. Please wait a moment and try again.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- New: distinct-recipient (distinct conversation_id) spread caps. A
  -- continuing conversation with someone already messaged in the window
  -- does not count again, since conversation_id repeats for the same pair.
  select int_value into hour_lim
  from public.moderation_settings
  where key = 'max_new_conversations_per_hour';
  if hour_lim is null then hour_lim := 20; end if;
  if hour_lim > 0 then
    select count(distinct conversation_id) into hour_cnt
    from public.messages
    where sender_id = new.sender_id
      and created_at > now() - interval '1 hour'
      and conversation_id <> new.conversation_id;

    if hour_cnt >= hour_lim then
      raise exception 'rate_limited: too many new conversations started recently. Please wait a little before contacting more people.'
        using errcode = 'check_violation';
    end if;
  end if;

  select int_value into day_lim
  from public.moderation_settings
  where key = 'max_new_conversations_per_day';
  if day_lim is null then day_lim := 60; end if;
  if day_lim > 0 then
    select count(distinct conversation_id) into day_cnt
    from public.messages
    where sender_id = new.sender_id
      and created_at > now() - interval '24 hours'
      and conversation_id <> new.conversation_id;

    if day_cnt >= day_lim then
      raise exception 'rate_limited: too many new conversations started today. Please try again tomorrow.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- Verification (run after applying):
--   select prosrc from pg_proc where proname = 'enforce_message_rate_limit';
--   select key, int_value from moderation_settings where key like 'max_new_conversations%';
-- ============================================================
