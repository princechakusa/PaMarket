-- Tighten the conversations UPDATE policy.
-- Before: only a USING clause gated updates, so a member could rewrite the
-- `members` array (e.g. add/remove participants) since the new row wasn't
-- checked. Add a WITH CHECK so the caller must remain a member of the row
-- both before AND after the update.
--
-- Run in Supabase SQL Editor. Safe to re-run.

drop policy if exists "conversations: member update" on public.conversations;

create policy "conversations: member update"
  on public.conversations for update
  using      (auth.uid() = any(members))
  with check (auth.uid() = any(members));
