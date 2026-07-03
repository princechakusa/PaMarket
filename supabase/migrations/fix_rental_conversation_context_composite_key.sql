-- ============================================================
-- fix_rental_conversation_context_composite_key.sql
--
-- Supersedes the "own update" policy patch (still applied by this file
-- too) with the correct structural fix requested in the critical-fix
-- audit: rental_conversation_context.conversation_id was the PRIMARY
-- KEY, but the underlying chat system gives ONE conversation_id per
-- (customer, owner) pair for its whole lifetime — never one per
-- listing. A returning customer asking about a second vehicle from the
-- same company therefore collided on that primary key. The previous
-- fix worked around this by overwriting the single row to describe
-- "whichever listing was discussed most recently," which is safe but
-- loses the earlier vehicle's context entirely.
--
-- This migration changes the key so BOTH inquiries keep their own row:
--   primary key (conversation_id, listing_id)
-- A conversation can now legitimately have one context row per distinct
-- listing the customer asked about inside it, while still preventing
-- duplicate rows for the same (conversation, listing) pair.
--
-- Safe to run even if the table already has rows: the existing
-- unique(user_id, listing_id) constraint means at most one row per
-- (user_id, listing_id) already exists, and conversation_id is
-- deterministic per (user_id, owner) — so no duplicate
-- (conversation_id, listing_id) pairs can already exist to violate
-- the new primary key.
--
-- Run once in Supabase SQL Editor.
-- ============================================================

alter table public.rental_conversation_context
  drop constraint if exists rental_conversation_context_pkey;

alter table public.rental_conversation_context
  add constraint rental_conversation_context_pkey
  primary key (conversation_id, listing_id);

-- user_id + listing_id stays unique (one context row per customer per
-- vehicle — re-contacting about the same vehicle just reuses the row).
-- Already exists from the original migration; re-asserted defensively.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rental_conversation_context_user_id_listing_id_key'
  ) then
    alter table public.rental_conversation_context
      add constraint rental_conversation_context_user_id_listing_id_key
      unique (user_id, listing_id);
  end if;
end $$;

-- ── UPDATE policy (own row) — still required so the frontend's upsert
--    can update a lead_id or refresh created_at without RLS silently
--    dropping the write. ─────────────────────────────────────────────
drop policy if exists "rcc: own update" on public.rental_conversation_context;
create policy "rcc: own update"
  on public.rental_conversation_context for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── VERIFY (optional) ─────────────────────────────────────────────────
-- select conname, contype from pg_constraint
-- where conrelid = 'public.rental_conversation_context'::regclass;
-- Expect the new composite primary key + the (user_id, listing_id) unique.
-- ============================================================
