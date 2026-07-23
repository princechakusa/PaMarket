-- ============================================================================
-- PaMarket — Diagnose personal (conv_) conversations with 3+ members
-- ----------------------------------------------------------------------------
-- READ-ONLY. Run manually in the Supabase SQL Editor to see which personal
-- 1:1 conversations have silently gained extra members due to the bug fixed
-- in www/js/app.js and www/js/messages.js (unguarded conv.members.push in
-- the sync paths, missing the conv_-prefix 1:1 check that was already
-- correctly applied in one of the three occurrences).
--
-- otherId = c.members.find(m => m !== u.id) picks the FIRST non-self member —
-- for a conv_ thread with 3+ members, this can silently show the wrong
-- person's name/avatar in the chat header even though messages/history are
-- intact and correctly attributed per-message.
--
-- This query does NOT modify any data. Review the output before deciding on
-- a repair approach — do not blindly drop members without understanding
-- whether real messages exist from each one (dropping a member with real
-- message history would only fix the DISPLAY, not silently delete messages,
-- but you should still know what's there before touching it).
-- ============================================================================

select
  c.id as conversation_id,
  c.members,
  array_length(c.members, 1) as member_count,
  (
    select array_agg(distinct m.sender_id)
    from public.messages m
    where m.conversation_id = c.id
  ) as actual_message_senders,
  (select count(*) from public.messages m where m.conversation_id = c.id) as message_count,
  c.created_at,
  c.updated_at
from public.conversations c
where c.id like 'conv_%'
  and array_length(c.members, 1) > 2
order by c.updated_at desc;
