-- =============================================================
-- PaMarket: fix check_message_block() uuid/text type mismatch
--
-- Root cause of "operator does not exist: uuid <> text" on every message
-- send: messages.sender_id is TEXT in the live schema (not uuid, despite
-- every migration comment assuming otherwise), while conversations.members
-- is uuid[]. check_message_block()'s `unnest(c.members) as m where m <>
-- new.sender_id` compared uuid <> text directly, which Postgres rejects
-- outright (no implicit cast for <> between these types) — this made EVERY
-- message insert fail with a 42883 error, surfaced to PostgREST as a 404,
-- silently swallowing every message users tried to send.
--
-- This predates and is unrelated to the conv_ id-collision fix — it's a
-- pre-existing bug that happened to be caught while investigating messages
-- not being delivered.
-- =============================================================

create or replace function public.check_message_block()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  other_id uuid;
  c record;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if c is null then
    return new;
  end if;
  select m into other_id from unnest(c.members) as m where m::text <> new.sender_id::text limit 1;
  if other_id is null then
    return new;
  end if;
  if exists (
    select 1 from public.blocked_users
    where (blocker_id = other_id and blocked_id::text = new.sender_id::text)
       or (blocker_id::text = new.sender_id::text and blocked_id = other_id)
  ) then
    raise exception 'Cannot send message: a block exists between these users';
  end if;
  return new;
end;
$$;

-- =============================================================
-- Second, unrelated fix bundled in the same investigation: record_conversation_deletion
-- let a null auth.uid() (unauthenticated/expired-session call) reach the
-- insert, where it hit conversation_deletions.user_id's NOT NULL constraint
-- as a raw, confusing error. Guard explicitly instead.
-- =============================================================

create or replace function public.record_conversation_deletion(p_conversation_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  insert into public.conversation_deletions (user_id, conversation_id, deleted_at)
  values (auth.uid(), p_conversation_id, now())
  on conflict (user_id, conversation_id) do update
    set deleted_at = now();
end;
$$;

notify pgrst, 'reload schema';
