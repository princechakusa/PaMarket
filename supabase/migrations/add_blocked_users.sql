-- Server-enforced user blocking (replaces client-only localStorage blockedUsers[])
-- Run in Supabase SQL Editor

create table if not exists public.blocked_users (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocked_users_no_self check (blocker_id <> blocked_id),
  constraint blocked_users_unique unique (blocker_id, blocked_id)
);

create index if not exists blocked_users_blocker_idx on public.blocked_users (blocker_id);
create index if not exists blocked_users_blocked_idx on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;

-- A user can see who they've blocked, and can see if they've been blocked
-- (needed so the client can avoid showing "send" UI for a blocker's chat).
drop policy if exists "blocked_users: participant read" on public.blocked_users;
create policy "blocked_users: participant read"
  on public.blocked_users for select
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

drop policy if exists "blocked_users: own insert" on public.blocked_users;
create policy "blocked_users: own insert"
  on public.blocked_users for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "blocked_users: own delete" on public.blocked_users;
create policy "blocked_users: own delete"
  on public.blocked_users for delete
  using (auth.uid() = blocker_id);

-- Admins can read all blocks (moderation/abuse override visibility)
drop policy if exists "blocked_users: admin read" on public.blocked_users;
create policy "blocked_users: admin read"
  on public.blocked_users for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin','moderator','super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Enforce blocks at the message-insert layer so a block can't be
-- bypassed by calling Supabase directly (client-only checks aren't real
-- enforcement). If either party has blocked the other, the insert is
-- rejected instead of silently disappearing, so senders get a clear error.
-- ─────────────────────────────────────────────────────────────
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
  select m into other_id from unnest(c.members) as m where m <> new.sender_id limit 1;
  if other_id is null then
    return new;
  end if;
  if exists (
    select 1 from public.blocked_users
    where (blocker_id = other_id and blocked_id = new.sender_id)
       or (blocker_id = new.sender_id and blocked_id = other_id)
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
