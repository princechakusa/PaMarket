-- ============================================================
-- 202608190014_conversation_business_context_integrity.sql
--
-- Personal/Business chat separation hardening (verified live 2026-08-19).
--
-- FINDINGS THIS ADDRESSES:
--
-- 1. NO SERVER-SIDE VALIDATION OF business_id. The only RLS on
--    public.conversations is "auth.uid() = ANY(members)" for INSERT/UPDATE
--    (confirmed live via pg_policies). business_id has a foreign key to
--    businesses(id) but nothing checks the caller is *entitled* to attach
--    that particular business. A malicious authenticated user could insert
--    a conversation with members = [attacker, victim] and business_id =
--    any_business_they_do_not_own, forcing a thread into a business inbox
--    and having it render under that shop's name/logo (the Messages screen
--    displays the business identity for any row with business_id set).
--
-- 2. CLASSIFICATION COULD SILENTLY FLIP AFTER CREATION. The mobile listing
--    screen used to stamp business_id onto an already-existing PERSONAL
--    conversation when the same buyer later messaged the same seller about
--    a shop listing — moving that entire thread, history included, out of
--    the Personal inbox into Business. (The client-side half of this is
--    fixed in the same change set; this trigger is the server-side backstop
--    so no client, present or future, web or mobile, can do it again.)
--
-- RULE ENFORCED: business context is set by the context a conversation was
-- CREATED from, must be legitimate, and is immutable thereafter.
--
-- Legitimacy test for a non-null business_id: the business's owner must be
-- one of the conversation members. That is true for every real path —
--   * business profile contact  → members [customer, business.owner_user_id]
--   * business listing contact  → members [customer, seller(=owner)]
--   * rental company contact    → members [customer, business.owner_user_id]
-- — and false for the injection case, where the spoofed business's owner is
-- not a participant. Admins/moderators are exempt so moderation tooling and
-- support workflows are unaffected.
--
-- Deliberately NOT enforced here: "personal conversations must not carry
-- business_id" as a blanket CHECK. That would be equivalent to the above
-- (a personal thread by definition has no business owner participant beyond
-- coincidence) and risks rejecting legitimate historical shapes. The owner-
-- membership test is the precise version of the same intent.
--
-- Existing rows are untouched — this is a BEFORE INSERT/UPDATE trigger, so
-- it only governs new writes. The 12 known website-created biz_ rows with
-- NULL business_id remain exactly as they are (they are classified
-- correctly by id prefix on the client side); this migration does not
-- backfill or bulk-edit any production data.
-- ============================================================

create or replace function public.enforce_conversation_business_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  -- Staff bypass: moderation/support tooling must not be blocked.
  if public.is_moderator() then
    return new;
  end if;

  -- Classification is immutable once set.
  if tg_op = 'UPDATE' and new.business_id is distinct from old.business_id then
    raise exception 'conversation_context_immutable: a conversation''s business context cannot be changed after it is created.'
      using errcode = 'check_violation';
  end if;

  -- A non-null business context must be one the members actually represent.
  if new.business_id is not null then
    select owner_user_id into v_owner
    from public.businesses
    where id = new.business_id;

    if v_owner is null then
      raise exception 'conversation_context_invalid: unknown business for this conversation.'
        using errcode = 'check_violation';
    end if;

    if not (v_owner = any(new.members)) then
      raise exception 'conversation_context_forbidden: this business is not a participant in the conversation.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_conversation_business_context on public.conversations;
create trigger trg_conversation_business_context
  before insert or update on public.conversations
  for each row execute function public.enforce_conversation_business_context();

-- Verification (run after applying):
--   select tgname, tgenabled from pg_trigger where tgrelid='conversations'::regclass and tgname='trg_conversation_business_context';
--   -- injection attempt (should raise conversation_context_forbidden):
--   --   insert into conversations (id, members, business_id)
--   --   values ('x', array[auth.uid(), '<some-other-user>']::uuid[], '<business-you-do-not-own>');
-- ============================================================
