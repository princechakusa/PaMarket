-- Restrict chat data to authenticated conversation members.
--
-- Both client writes are UPSERTs. Conversations therefore need SELECT,
-- INSERT and UPDATE policies, and both INSERT/UPDATE checks must accept the
-- member row. Messages need the same paths plus a recursion-safe membership
-- lookup: querying conversations directly from a messages policy re-enters
-- conversations RLS.

create or replace function public.is_conversation_member(p_conversation_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.conversations as c
    where c.id = p_conversation_id
      and auth.uid() = any(c.members)
  );
$$;

revoke all on function public.is_conversation_member(text) from public;
revoke all on function public.is_conversation_member(text) from anon;
grant execute on function public.is_conversation_member(text) to authenticated;

-- Remove every existing policy, including any permissive FOR ALL policy whose
-- name differs between environments. RLS policies are ORed, so leaving even
-- one USING (true) policy would defeat the member-only policies below.
do $policy_cleanup$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'conversations'
  loop
    execute format('drop policy %I on public.conversations', p.policyname);
  end loop;

  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'messages'
  loop
    execute format('drop policy %I on public.messages', p.policyname);
  end loop;
end
$policy_cleanup$;

-- Remove the earlier experimental helper after dropping any policy that may
-- still depend on it. It granted EXECUTE to PUBLIC/anon and is no longer used.
drop function if exists public.is_conv_member(text);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "conversations: member select"
  on public.conversations
  for select
  to authenticated
  using ((select auth.uid()) = any(members));

create policy "conversations: member insert"
  on public.conversations
  for insert
  to authenticated
  with check ((select auth.uid()) = any(members));

create policy "conversations: member update"
  on public.conversations
  for update
  to authenticated
  using ((select auth.uid()) = any(members))
  with check ((select auth.uid()) = any(members));

create policy "conversations: member delete"
  on public.conversations
  for delete
  to authenticated
  using ((select auth.uid()) = any(members));

create policy "messages: member select"
  on public.messages
  for select
  to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "messages: member insert"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())::text
    and public.is_conversation_member(conversation_id)
  );

-- The app updates read receipts and reactions on messages sent by the other
-- participant, so UPDATE is member-scoped rather than sender-only. USING and
-- WITH CHECK are both required for INSERT ... ON CONFLICT DO UPDATE.
create policy "messages: member update"
  on public.messages
  for update
  to authenticated
  using (public.is_conversation_member(conversation_id))
  with check (public.is_conversation_member(conversation_id));

create policy "messages: member delete"
  on public.messages
  for delete
  to authenticated
  using (public.is_conversation_member(conversation_id));

notify pgrst, 'reload schema';
