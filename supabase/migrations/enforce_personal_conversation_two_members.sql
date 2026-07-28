-- ============================================================================
-- PaMarket — Enforce personal (conv_) conversations stay exactly 2 members
-- ----------------------------------------------------------------------------
-- Root cause of the "opens the wrong conversation" bug: three places in the
-- client (www/js/app.js x2, www/js/messages.js) let conv.members silently
-- grow past 2 when a message arrived from a sender not yet in the local
-- members array. otherId = members.find(m => m !== u.id) then resolves to
-- an ambiguous/wrong person once a 3rd member sneaks in. The client-side
-- code has been fixed to guard this going forward, but a client-side-only
-- fix is not durable — a future code path, race condition, or edit could
-- reintroduce it. This migration makes it structurally impossible at the
-- database level, independent of any client behavior.
--
-- Personal 1:1 threads are identified by the 'conv_' id prefix (see
-- www/js/messages.js pairKey generation: 'conv_' + idFrag(a) + '_' +
-- idFrag(b) — always exactly 2 fragments, i.e. exactly 2 members).
-- Business/job threads ('biz_'/'job_' prefix) legitimately grow (staff
-- added to a business chat) and are NOT constrained by this trigger.
--
-- Idempotent. Run once in the Supabase SQL Editor.
-- ============================================================================

create or replace function public.enforce_personal_conversation_member_count()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.id like 'conv\_%' escape '\' and array_length(NEW.members, 1) is distinct from 2 then
    raise exception
      'Personal conversation % must have exactly 2 members, got %. Members: %',
      NEW.id, array_length(NEW.members, 1), NEW.members;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enforce_personal_conversation_member_count on public.conversations;
create trigger trg_enforce_personal_conversation_member_count
  before insert or update of members on public.conversations
  for each row
  execute function public.enforce_personal_conversation_member_count();

-- ============================================================================
-- Verification (run manually, not part of the migration):
--
--   -- expect: ERROR, blocked
--   update conversations set members = members || array['00000000-0000-0000-0000-000000000000'::uuid]
--   where id like 'conv\_%' escape '\' limit 1;
--
--   -- expect: succeeds normally
--   update conversations set updated_at = now() where id like 'conv\_%' escape '\' limit 1;
-- ============================================================================
