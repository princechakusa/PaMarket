-- ─────────────────────────────────────────────────────────────
-- conversations + messages tables
-- ─────────────────────────────────────────────────────────────

create table if not exists public.conversations (
  id          text primary key,
  members     uuid[] not null default '{}',
  listing_id  uuid references public.listings(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists conversations_members_idx
  on public.conversations using gin (members);

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

alter table public.conversations enable row level security;

-- Only participants can read a conversation
drop policy if exists "conversations: member read" on public.conversations;
create policy "conversations: member read"
  on public.conversations for select
  using (auth.uid() = any(members));

-- A participant can create a conversation they are part of
drop policy if exists "conversations: member insert" on public.conversations;
create policy "conversations: member insert"
  on public.conversations for insert
  with check (auth.uid() = any(members));

drop policy if exists "conversations: member update" on public.conversations;
create policy "conversations: member update"
  on public.conversations for update
  using (auth.uid() = any(members));

-- ─────────────────────────────────────────────────────────────

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id text not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  sender_name     text not null default '',
  text            text not null,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conv_created_idx
  on public.messages (conversation_id, created_at asc);

alter table public.messages enable row level security;

-- Participants in the conversation can read its messages
drop policy if exists "messages: member read" on public.messages;
create policy "messages: member read"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and auth.uid() = any(c.members)
    )
  );

-- Participants can send messages
drop policy if exists "messages: member insert" on public.messages;
create policy "messages: member insert"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and auth.uid() = any(c.members)
    )
  );

-- A user can mark messages as read
drop policy if exists "messages: member update" on public.messages;
create policy "messages: member update"
  on public.messages for update
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and auth.uid() = any(c.members)
    )
  );
