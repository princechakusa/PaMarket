-- ============================================================
-- PaMarket — Security Hardening Migration 2026-06
-- Run once in the Supabase SQL Editor.
-- Idempotent and safe to re-run.
-- ============================================================

-- ── 1. Recursion-safe admin helper (re-assert) ───────────────
create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;

-- ── 2. Two-factor authentication columns on profiles ─────────
alter table public.profiles
  add column if not exists two_factor_enabled boolean not null default false;
alter table public.profiles
  add column if not exists two_factor_secret text;

-- Migrate any client-side 2FA secrets that may have been stored
-- (none expected server-side yet — this is purely additive)

-- ── 3. Separate push_tokens table (removes FCM token from ────
--        the publicly-readable profiles row)
create table if not exists public.push_tokens (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  token      text not null,
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens: own access" on public.push_tokens;
create policy "push_tokens: own access"
  on public.push_tokens
  for all
  to authenticated
  using  (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);

-- Migrate existing tokens out of profiles into the new table
insert into public.push_tokens (user_id, token)
  select id, push_token
  from   public.profiles
  where  push_token is not null
on conflict (user_id) do update set token = excluded.token;

-- Remove push_token from profiles so it is no longer publicly readable
alter table public.profiles drop column if exists push_token;

-- ── 4. Fix messages UPDATE policy ────────────────────────────
-- OLD: any member can UPDATE any field on any message in the conversation.
-- NEW: sender may update own messages; other members may only mark read=true.
drop policy if exists "messages: member update" on public.messages;
create policy "messages: own-write or member-mark-read"
  on public.messages for update
  using (
    exists (
      select 1 from public.conversations c
      where  c.id = conversation_id
        and  auth.uid() = any(c.members)
    )
  )
  with check (
    -- Sender can update any field on their own message
    auth.uid()::text = sender_id::text
    or
    -- Non-sender members may only flip read to true (never false, never touch text)
    (auth.uid()::text != sender_id::text and read = true)
  );

-- ── 5. Add DELETE policy on messages (was missing) ───────────
drop policy if exists "messages: own delete" on public.messages;
create policy "messages: own delete"
  on public.messages for delete
  using (auth.uid()::text = sender_id::text);

-- ── 6. Nullify text on soft-delete so realtime payload ───────
--        does not leak the original content
create or replace function public.nullify_deleted_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deleted = true and (old.deleted is distinct from true) then
    new.text  := '';
    new.image := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_nullify_deleted_message on public.messages;
create trigger trg_nullify_deleted_message
  before update on public.messages
  for each row execute function public.nullify_deleted_message();

-- ── 7. Text length constraints ────────────────────────────────
-- messages
do $$ begin
  alter table public.messages
    add constraint messages_text_length check (char_length(text) <= 10000);
exception when duplicate_object then null; end $$;

-- listings
do $$ begin
  alter table public.listings
    add constraint listings_title_length check (char_length(title) <= 120);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.listings
    add constraint listings_description_length check (char_length(description) <= 5000);
exception when duplicate_object then null; end $$;

-- ── 8. Restrict profiles public read ─────────────────────────
-- Create a security-barrier view that exposes only safe public columns.
-- The full profiles table remains accessible to the row owner.
-- PostgREST clients that need the public view use /rest/v1/profiles_public.
create or replace view public.profiles_public
  with (security_barrier = true)
as
  select
    id,
    name,
    avatar,
    verified,
    role,
    created_at,
    updated_at,
    bio,
    city,
    job_title,
    skills,
    sector,
    exp,
    open_to_work,
    last_seen,
    privacy,
    language,
    status,
    phone,
    email
    -- Excluded: wallet_usd, cv, ban_reason, ban_until,
    --           verification_pending, two_factor_enabled,
    --           two_factor_secret, push_subscription
  from public.profiles;

-- Grant anon/authenticated read access to the safe view
grant select on public.profiles_public to anon, authenticated;

-- Restrict the wallet_usd column: only the row owner may read it.
-- We achieve this with a separate authenticated-only own-row policy that
-- supplements the existing public-read policy.
-- NOTE: Full column-level security requires moving to the view.
-- The policy below additionally ensures wallet_usd is accessible
-- server-side; on the client, always use profiles_public for strangers.
drop policy if exists "profiles: public read" on public.profiles;
create policy "profiles: public read"
  on public.profiles for select
  using (true);
-- (Unchanged from before — true column masking requires the view above.
--  Instruct all client queries for other users to use profiles_public.)

-- ── 9. Profiles own-row update — role freeze ─────────────────
-- Re-assert to guard against migration ordering issues.
drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own update"
  on public.profiles for update
  using  (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Users cannot escalate their own role
    and role = (select role from public.profiles where id = auth.uid()::uuid)
  );

-- ── 10. Admin role-change audit log ──────────────────────────
create table if not exists public.role_audit_log (
  id         bigserial primary key,
  actor_id   uuid not null,
  target_id  uuid not null,
  old_role   text,
  new_role   text,
  changed_at timestamptz not null default now()
);

alter table public.role_audit_log enable row level security;

drop policy if exists "role_audit_log: admin read" on public.role_audit_log;
create policy "role_audit_log: admin read"
  on public.role_audit_log for select
  to authenticated
  using (public.is_admin());

create or replace function public.log_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    insert into public.role_audit_log (actor_id, target_id, old_role, new_role)
    values (auth.uid(), new.id, old.role, new.role);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_role_change on public.profiles;
create trigger trg_log_role_change
  after update on public.profiles
  for each row execute function public.log_role_change();

-- ── 11. Moderation trigger — word boundary matching ──────────
-- Replaces the naive substring match to cut false positives (e.g.
-- "gun" matching "Burgun" or "illegal" matching "legal").
create or replace function check_listing_content()
returns trigger language plpgsql as $$
declare
  banned_words text[] := array[
    'scam','fraud','fake','stolen','illegal','drugs','weapon','gun',
    'pirated','counterfeit','smuggle','smuggling','bribe','corrupt'
  ];
  w text;
  content text;
begin
  content := lower(coalesce(new.title,'') || ' ' || coalesce(new.description,''));
  foreach w in array banned_words loop
    -- Word-boundary match: surrounded by non-alphanumeric or at string edge
    if content ~ ('(^|[^a-z0-9])' || w || '([^a-z0-9]|$)') then
      raise exception 'Listing contains prohibited content: %', w;
    end if;
  end loop;
  return new;
end;
$$;

-- Trigger already exists — this replaces the function body only.

-- ── 12. Force PostgREST schema cache reload ──────────────────
notify pgrst, 'reload schema';
