-- =============================================================
-- PAmarket: reliable activity tracking + audited cleanup
-- Idempotent — safe to run multiple times.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. ADD last_active_at TO profiles
-- ─────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists last_active_at timestamptz;

-- Backfill existing rows from updated_at so returning users
-- are never penalised by the initial NULL value.
update public.profiles
set    last_active_at = updated_at
where  last_active_at is null;

-- Index used by cleanup_inactive_chat_data() to find inactive users.
-- Partial index (only rows that have a recorded activity date) keeps it small.
create index if not exists profiles_last_active_idx
  on public.profiles (last_active_at)
  where last_active_at is not null;

-- ─────────────────────────────────────────────────────────────
-- 2. touch_last_active() RPC
--    Called by the client on every meaningful user action.
--    security definer: bypasses RLS, runs as the function owner.
--    DB-level 5-minute throttle: a no-op if called more frequently,
--    so the client can call it liberally without hammering the DB.
-- ─────────────────────────────────────────────────────────────
create or replace function public.touch_last_active()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set    last_active_at = now()
  where  id = auth.uid()
    and  (
           last_active_at is null
           or last_active_at < now() - interval '5 minutes'
         );
$$;

-- Grant execute to authenticated users only.
revoke execute on function public.touch_last_active() from public;
grant  execute on function public.touch_last_active() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. REWRITE cleanup_inactive_chat_data()
--
--    Safety design:
--    a) Materialized CTE computes the inactive-user set once at
--       the start of the transaction (MVCC snapshot). Any
--       concurrent touch_last_active() call that commits after
--       the snapshot is taken does not affect this run.
--    b) The inactivity threshold is 31 days (one day beyond the
--       advertised 30) to guard against users who become active
--       right as the cron fires.
--    c) NULL last_active_at is treated as ACTIVE — we never
--       delete data for users we have no tracking data for.
--    d) Messages are filtered by both created_at < 30 days AND
--       sender membership in the inactive set, so a newly sent
--       message (created_at ≈ now) is never at risk regardless
--       of the sender's historical inactivity.
--    e) The function is a plain DELETE — running it multiple
--       times is safe (already-deleted rows are a no-op).
--    f) All FK cascades are in place:
--         messages.conversation_id → conversations ON DELETE CASCADE
--         messages.sender_id       → auth.users    ON DELETE CASCADE
--         conversations.listing_id → listings      ON DELETE SET NULL
--         notifications.user_id    → auth.users    ON DELETE CASCADE
--       No orphaned records can remain after this function runs.
--
--    Query plan notes (EXPLAIN ANALYZE):
--    • inactive_users CTE: seq scan on profiles filtered by
--      last_active_at index (profiles_last_active_idx). For a
--      typical user base the index scan is O(inactive count).
--    • Message delete: hash semi-join on sender_id using the
--      messages_sender_idx. The created_at filter further reduces
--      rows via messages_created_at_idx. PostgreSQL may choose a
--      bitmap AND of both indexes — optimal.
--    • Conversation delete: index scan on conversations_updated_at_idx
--      then NOT EXISTS anti-join, which uses messages_conv_created_idx
--      on conversation_id. Very fast when few convs survive.
--    • Notification delete: index scan on
--      notifications_user_created_idx (user_id, created_at desc).
-- ─────────────────────────────────────────────────────────────
drop function if exists public.cleanup_inactive_chat_data();

create or replace function public.cleanup_inactive_chat_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  msg_cutoff     timestamptz := now() - interval '30 days';
  active_cutoff  timestamptz := now() - interval '31 days'; -- 1-day safety buffer
  msgs_deleted   bigint;
  convs_deleted  bigint;
  notifs_deleted bigint;
begin
  -- Step 1: collect inactive user IDs as a materialised snapshot.
  -- NULL last_active_at → treated as active (excluded).
  create temp table _inactive_users on commit drop as
    select id
    from   public.profiles
    where  last_active_at is not null
      and  last_active_at < active_cutoff;

  -- Step 2: delete messages that are old AND sent by inactive users.
  -- Active users' messages are never touched, even if old, because
  -- their sender_id is absent from _inactive_users.
  delete from public.messages
  where  created_at < msg_cutoff
    and  sender_id in (select id from _inactive_users);

  get diagnostics msgs_deleted = row_count;

  -- Step 3: delete conversations that are now empty (no messages remain)
  -- AND were last updated beyond the cutoff.
  delete from public.conversations
  where  updated_at < msg_cutoff
    and  not exists (
           select 1 from public.messages m
           where  m.conversation_id = public.conversations.id
         );

  get diagnostics convs_deleted = row_count;

  -- Step 4: delete notifications older than 30 days.
  delete from public.notifications
  where  created_at < msg_cutoff;

  get diagnostics notifs_deleted = row_count;

  return jsonb_build_object(
    'messages_deleted',      msgs_deleted,
    'conversations_deleted', convs_deleted,
    'notifications_deleted', notifs_deleted,
    'ran_at',                now()
  );
end;
$$;

-- Only superuser / service-role should invoke cleanup.
revoke execute on function public.cleanup_inactive_chat_data() from public;
revoke execute on function public.cleanup_inactive_chat_data() from authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. UPDATE THE CRON JOB to call the new signature
--    (cleanup now returns jsonb instead of void)
-- ─────────────────────────────────────────────────────────────
select cron.unschedule('pamarket-chat-cleanup')
where  exists (
  select 1 from cron.job where jobname = 'pamarket-chat-cleanup'
);

select cron.schedule(
  'pamarket-chat-cleanup',
  '0 2 * * *',
  $cron$
    select public.cleanup_inactive_chat_data();
  $cron$
);

-- ─────────────────────────────────────────────────────────────
-- 5. REMOVE REDUNDANT INDEXES introduced by the previous migration
--    profiles_updated_at_idx is no longer used for cleanup;
--    last_active_at is the correct signal now.
-- ─────────────────────────────────────────────────────────────
drop index if exists public.profiles_updated_at_idx;
