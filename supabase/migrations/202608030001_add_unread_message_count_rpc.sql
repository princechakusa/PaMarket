-- The home tab and Account tab both computed their unread-message badge
-- with `messages.select('id',{count:'exact',head:true}).eq('read',false)
-- .neq('sender_id', me)` — no filter at all restricting this to
-- conversations the user is actually a member of. Every user saw a count
-- of every unread message on the entire platform that they didn't
-- personally send, not just their own. Correctness bug (wrong badge for
-- every user) and a scalability one (grows with total platform message
-- volume, not per-user, as the user base grows).
--
-- messages.conversation_id and conversations.id are both `text`;
-- conversations.members is `uuid[]` (has an existing GIN index,
-- conversations_members_idx) — the containment check below uses it.
create or replace function public.get_unread_message_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.read = false
    and m.sender_id <> auth.uid()::text
    and c.members @> array[auth.uid()]
$$;

revoke all on function public.get_unread_message_count() from public, anon;
grant execute on function public.get_unread_message_count() to authenticated;
