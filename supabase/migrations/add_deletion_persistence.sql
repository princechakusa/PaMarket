-- Persist per-user conversation deletions + ensure notification deletes persist.
-- Comparisons cast both sides to text so they work whether user_id is uuid or text.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor).

create table if not exists public.conversation_deletions (
  user_id         uuid not null,
  conversation_id text not null,
  deleted_at      timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

alter table public.conversation_deletions enable row level security;

drop policy if exists "convdel own select" on public.conversation_deletions;
create policy "convdel own select" on public.conversation_deletions
  for select to authenticated using (user_id::text = auth.uid()::text);

drop policy if exists "convdel own insert" on public.conversation_deletions;
create policy "convdel own insert" on public.conversation_deletions
  for insert to authenticated with check (user_id::text = auth.uid()::text);

drop policy if exists "convdel own delete" on public.conversation_deletions;
create policy "convdel own delete" on public.conversation_deletions
  for delete to authenticated using (user_id::text = auth.uid()::text);

-- Make sure users can delete their own notifications (so a delete persists).
drop policy if exists "own notifications: delete" on public.notifications;
create policy "own notifications: delete" on public.notifications
  for delete to authenticated using (user_id::text = auth.uid()::text);
