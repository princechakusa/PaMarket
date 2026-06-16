-- ─────────────────────────────────────────────────────────────
-- Make conversations.id TEXT (it was created as uuid, but the app uses
-- text ids like "conv_aaaaaa_bbbbbb" / "job_..."). This lets
-- conversations rows + their members array actually save, so push
-- notifications can resolve recipients reliably.
--
-- conversations.id is referenced by the messages RLS policies, so we must
-- drop those, alter the column, then recreate them. Run once in SQL Editor.
-- ─────────────────────────────────────────────────────────────

-- 1) Drop the message policies that reference conversations.id
drop policy if exists "messages: member read"   on public.messages;
drop policy if exists "messages: member insert" on public.messages;
drop policy if exists "messages: member update" on public.messages;

-- 2) Change the column type (uuid -> text). PK index is rebuilt automatically.
alter table public.conversations alter column id type text using id::text;

-- 3) Recreate the message policies (same membership rules as before)
create policy "messages: member read" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() = any(c.members)
    )
  );

create policy "messages: member insert" on public.messages
  for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() = any(c.members)
    )
  );

create policy "messages: member update" on public.messages
  for update using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() = any(c.members)
    )
  );
