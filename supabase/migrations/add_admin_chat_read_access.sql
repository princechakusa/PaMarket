-- The admin panel's "User Chats" section queries conversations/messages using
-- the logged-in admin's own (anon-key) session — there was never an RLS
-- policy letting an admin read a conversation they aren't a member of, so
-- the old flat query only ever returned rows for conversations the admin
-- account itself happened to be a participant in, silently hiding everything
-- else (looked like "chats not fully loading"). Run in Supabase SQL Editor.

drop policy if exists "conversations: admin read" on public.conversations;
create policy "conversations: admin read"
  on public.conversations for select
  using (public.is_admin());

drop policy if exists "messages: admin read" on public.messages;
create policy "messages: admin read"
  on public.messages for select
  using (public.is_admin());
