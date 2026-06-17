-- ─────────────────────────────────────────────────────────────
-- Make conversations.id TEXT to match the app's text ids ("conv_…"/"job_…")
-- and messages.conversation_id (already text), so conversations rows + members
-- save and push notifications resolve recipients reliably.
--
-- Bulletproof: drops every FK pointing at conversations.id, removes the uuid
-- default, retypes the column, and recreates the messages policies with casts
-- so no uuid=text mismatch can occur. Run once in the SQL Editor.
-- ─────────────────────────────────────────────────────────────

-- 1) Drop the message policies that reference conversations.id
drop policy if exists "messages: member read"   on public.messages;
drop policy if exists "messages: member insert" on public.messages;
drop policy if exists "messages: member update" on public.messages;

-- 2) Drop EVERY foreign key that points at conversations.id (name-agnostic)
do $$
declare r record;
begin
  for r in (
    select tc.table_schema, tc.table_name, tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name
     and tc.table_schema   = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_name  = 'conversations'
      and ccu.column_name = 'id'
  ) loop
    execute format('alter table %I.%I drop constraint %I', r.table_schema, r.table_name, r.constraint_name);
  end loop;
end $$;

-- 3) Remove the uuid default, then retype conversations.id to text
alter table public.conversations alter column id drop default;
alter table public.conversations alter column id type text using id::text;

-- 4) Recreate the message policies with casts (types always match now)
create policy "messages: member read" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id::text = messages.conversation_id
        and auth.uid() = any (c.members)
    )
  );

create policy "messages: member insert" on public.messages
  for insert with check (
    auth.uid()::text = messages.sender_id and
    exists (
      select 1 from public.conversations c
      where c.id::text = messages.conversation_id
        and auth.uid() = any (c.members)
    )
  );

create policy "messages: member update" on public.messages
  for update using (
    exists (
      select 1 from public.conversations c
      where c.id::text = messages.conversation_id
        and auth.uid() = any (c.members)
    )
  );
