-- ============================================================
-- fix_rental_conversation_context_update_rls.sql
--
-- BUG: rental_conversation_context had SELECT (own + company owner) and
-- INSERT policies, but no UPDATE policy. The frontend's chatCompany() now
-- upserts on conversation_id (the table's primary key) so that when a
-- returning customer messages the same company about a SECOND vehicle, the
-- existing context row is updated to describe the new listing (the
-- underlying chat system gives one thread per customer/owner pair for its
-- whole lifetime, never one per listing — see rentals.js comments). Without
-- an UPDATE policy, that upsert's UPDATE branch is silently blocked by RLS:
-- no error is raised, the row just never changes, and the business owner's
-- Recent Inquiries would keep pointing at the FIRST vehicle discussed
-- forever, not the current conversation topic.
--
-- FIX: allow the conversation's own customer (user_id = auth.uid()) to
-- update their own context row. Run once in Supabase SQL Editor.
-- ============================================================

drop policy if exists "rcc: own update" on public.rental_conversation_context;
create policy "rcc: own update"
  on public.rental_conversation_context for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── VERIFY (optional) ─────────────────────────────────────────────────
-- select policyname, cmd from pg_policies
-- where tablename = 'rental_conversation_context' order by cmd;
-- Expect: INSERT, SELECT (x2), UPDATE, ALL (admin) — five rows total.
-- ============================================================
