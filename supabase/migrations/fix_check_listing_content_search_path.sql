-- ============================================================================
-- PaMarket — Pin search_path on check_listing_content
-- ----------------------------------------------------------------------------
-- Supabase's database linter flags public.check_listing_content as having a
-- role-mutable search_path (0011_function_search_path_mutable) — a hardening
-- gap inherited from security_hardening_2026_06.sql / block_lending_listings.sql,
-- neither of which pinned it. Function body unchanged, only the search_path
-- is now fixed.
--
-- Idempotent. Run once in the Supabase SQL Editor.
-- ============================================================================

create or replace function check_listing_content()
returns trigger language plpgsql set search_path = public as $$
declare
  banned_words text[] := array[
    'scam','fraud','fake','stolen','illegal','drugs','weapon','gun',
    'pirated','counterfeit','smuggle','smuggling','bribe','corrupt',
    -- money lending / loan offers — not a supported category on PaMarket
    'loan','loans','lending','lender','moneylender','microloan','microlending',
    'payday loan','quick cash','instant cash','borrow money','money to borrow',
    'interest rate','shark loan','loan shark','cash advance','credit facility'
  ];
  w text;
  content text;
begin
  content := lower(coalesce(new.title,'') || ' ' || coalesce(new.description,''));
  foreach w in array banned_words loop
    -- Word-boundary match: surrounded by non-alphanumeric or at string edge.
    -- Multi-word phrases (e.g. "loan shark") match literally since a space
    -- is already a non-alphanumeric boundary character.
    if content ~ ('(^|[^a-z0-9])' || w || '([^a-z0-9]|$)') then
      raise exception 'Listing contains prohibited content: %', w;
    end if;
  end loop;
  return new;
end;
$$;

-- Trigger already exists (trg_listing_moderation on listings) — this replaces
-- the function body only.

notify pgrst, 'reload schema';
