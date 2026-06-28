-- =============================================================
-- Fix conversation_deletions RLS — security-definer RPCs
-- Same pattern as fix_user_saves_rls_2026_06.sql.
-- Idempotent — safe to run multiple times.
-- =============================================================

-- Ensure table + RLS exist
create table if not exists public.conversation_deletions (
  user_id         uuid not null,
  conversation_id text not null,
  deleted_at      timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

alter table public.conversation_deletions enable row level security;

-- Grant table-level privileges (belt + braces alongside the policies)
grant select, insert, update, delete on public.conversation_deletions to authenticated;

-- Recreate policies with explicit role binding
drop policy if exists "convdel own select" on public.conversation_deletions;
create policy "convdel own select"
  on public.conversation_deletions for select
  to authenticated
  using (user_id::text = auth.uid()::text);

drop policy if exists "convdel own insert" on public.conversation_deletions;
create policy "convdel own insert"
  on public.conversation_deletions for insert
  to authenticated
  with check (user_id::text = auth.uid()::text);

drop policy if exists "convdel own delete" on public.conversation_deletions;
create policy "convdel own delete"
  on public.conversation_deletions for delete
  to authenticated
  using (user_id::text = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────
-- record_conversation_deletion(conversation_id)
--   Upserts a deletion record for the calling user. auth.uid()
--   is resolved server-side so there can be no client-side
--   session / state mismatch.
-- ─────────────────────────────────────────────────────────────
create or replace function public.record_conversation_deletion(p_conversation_id text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.conversation_deletions (user_id, conversation_id, deleted_at)
  values (auth.uid(), p_conversation_id, now())
  on conflict (user_id, conversation_id) do update
    set deleted_at = now();
$$;

revoke execute on function public.record_conversation_deletion(text) from public;
grant  execute on function public.record_conversation_deletion(text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- revoke_conversation_deletion(conversation_id)
--   Removes the deletion record (conversation revived / undeleted).
-- ─────────────────────────────────────────────────────────────
create or replace function public.revoke_conversation_deletion(p_conversation_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.conversation_deletions
  where user_id        = auth.uid()
    and conversation_id = p_conversation_id;
$$;

revoke execute on function public.revoke_conversation_deletion(text) from public;
grant  execute on function public.revoke_conversation_deletion(text) to authenticated;

notify pgrst, 'reload schema';
