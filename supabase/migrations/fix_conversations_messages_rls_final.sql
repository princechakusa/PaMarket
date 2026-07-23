-- ============================================================
-- fix_conversations_messages_rls_final.sql
--
-- Business chat creation ("could not start this conversation") and the
-- keyboard white-screen were reported as STILL happening after the
-- on_conflict=id / visualViewport fixes shipped in js/chats.js — those are
-- confirmed live in the deployed JS bytes, so the remaining suspect is the
-- database side: this table pair has FIVE different migrations touching
-- its RLS over time (schema/conversations.sql, add_blocked_users.sql,
-- 202607140005_restrict_conversation_message_rls.sql,
-- fix_conversations_update_policy.sql, add_admin_chat_read_access.sql,
-- fix_message_send_and_conversation_deletion_bugs.sql), and there is no
-- reliable way from here to know exactly which subset actually ran in
-- production and in what order — some of them assume messages.sender_id is
-- uuid, which live testing just proved false:
--
--   curl .../messages?select=id&sender_id=eq.not-a-uuid   → [] (no type error)
--   curl .../conversations?select=id&members=cs.{not-a-uuid} → 22P02 (uuid type error)
--
-- i.e. messages.sender_id is TEXT in production; conversations.members is
-- uuid[]. Any policy or trigger comparing sender_id to a uuid value
-- WITHOUT casting fails with "operator does not exist: uuid = text" (or
-- <>) on every single row it touches — which, for an INSERT check or an
-- AFTER INSERT trigger, means every message insert fails. This migration
-- doesn't try to guess which historical file needs re-running: it drops
-- EVERY existing policy on both tables by name (like
-- 202607140005 already did) and rebuilds ONE clean, correct set from the
-- confirmed-live column types, so the end state is right regardless of
-- history. Also re-applies the corrected check_message_block() trigger
-- (fix_message_send_and_conversation_deletion_bugs.sql) and the admin-read
-- policies (add_admin_chat_read_access.sql), since neither is covered by
-- the policy-loop above (the trigger isn't a policy; admin read needs to
-- be re-added after the loop clears it).
--
-- Idempotent — safe to run even if some/all of this already applied.
-- Run once in the Supabase SQL Editor.
-- ============================================================

-- ── 1. Clean slate: drop every existing policy on both tables ───────────
do $policy_cleanup$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'conversations'
  loop
    execute format('drop policy %I on public.conversations', p.policyname);
  end loop;

  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'messages'
  loop
    execute format('drop policy %I on public.messages', p.policyname);
  end loop;
end
$policy_cleanup$;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- ── 2. Recursion-safe membership check (messages policies query
--      conversations; querying it directly from a messages policy would
--      re-enter conversations RLS) ──────────────────────────────────────
create or replace function public.is_conversation_member(p_conversation_id text)
returns boolean
language sql stable security definer set search_path = public set row_security = off
as $$
  select exists (
    select 1 from public.conversations as c
    where c.id = p_conversation_id
      and auth.uid() = any(c.members)
  );
$$;
revoke all on function public.is_conversation_member(text) from public, anon;
grant execute on function public.is_conversation_member(text) to authenticated;

-- ── 3. conversations: members read/insert/update/delete; admin read-all ──
create policy "conversations: member select"
  on public.conversations for select to authenticated
  using (auth.uid() = any(members));

create policy "conversations: member insert"
  on public.conversations for insert to authenticated
  with check (auth.uid() = any(members));

create policy "conversations: member update"
  on public.conversations for update to authenticated
  using (auth.uid() = any(members))
  with check (auth.uid() = any(members));

create policy "conversations: member delete"
  on public.conversations for delete to authenticated
  using (auth.uid() = any(members));

create policy "conversations: admin read"
  on public.conversations for select to authenticated
  using (public.is_admin());

-- ── 4. messages: sender_id is TEXT (confirmed live) — every comparison
--      against auth.uid() (uuid) must cast, or the check errors out for
--      every row and every insert silently fails. ─────────────────────
create policy "messages: member select"
  on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "messages: member insert"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())::text
    and public.is_conversation_member(conversation_id)
  );

-- Read receipts/reactions are written by the OTHER participant, not just
-- the sender, so update is member-scoped rather than sender-only.
create policy "messages: member update"
  on public.messages for update to authenticated
  using (public.is_conversation_member(conversation_id))
  with check (public.is_conversation_member(conversation_id));

create policy "messages: member delete"
  on public.messages for delete to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "messages: admin read"
  on public.messages for select to authenticated
  using (public.is_admin());

-- ── 5. Re-apply the corrected block-check trigger function (casts both
--      sides to text — the original, from add_blocked_users.sql, compared
--      a uuid array element to sender_id directly and errored on every
--      insert: "operator does not exist: uuid <> text"). ───────────────
create or replace function public.check_message_block()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  other_id uuid;
  c record;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if c is null then return new; end if;
  select m into other_id from unnest(c.members) as m where m::text <> new.sender_id::text limit 1;
  if other_id is null then return new; end if;
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

drop trigger if exists trg_check_message_block on public.messages;
create trigger trg_check_message_block
  before insert on public.messages
  for each row execute function public.check_message_block();

notify pgrst, 'reload schema';

-- Verification (run after applying):
--   select policyname, cmd, roles from pg_policies
--   where schemaname='public' and tablename in ('conversations','messages')
--   order by tablename, cmd, policyname;
--   -- expect exactly 5 policies per table (select/insert/update/delete +
--   -- admin select), no duplicates.
--
--   -- Then, signed in as a real user in the browser (not this editor):
--   -- 1. Open a business page → "Message Business" → confirm the thread
--   --    opens instead of the "already exists" toast.
--   -- 2. Send a message in it → confirm it appears (not silently dropped).
-- ============================================================
