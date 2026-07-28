-- ============================================================================
-- PaMarket — stop auto-rejecting listings that merely mention "fake" or
-- "counterfeit"
-- ----------------------------------------------------------------------------
-- The live check_listing_content() trigger (body last set by
-- fix_check_listing_content_search_path.sql — moderation_backend_phase_a.sql's
-- tiered moderation_rules engine was never actually applied to this database:
-- `select to_regclass('public.moderation_rules')` returns null here) hard-blocks
-- on the plain words 'fake' and 'counterfeit' with a word-boundary match and no
-- context. A legitimate seller writing "100% authentic, not a fake" or "no
-- counterfeits sold here" — extremely common phrasing in the Fashion category,
-- where authenticity concerns are top of mind — gets rejected outright with
-- "Listing contains prohibited content: fake/counterfeit".
--
-- Fix: drop 'fake' and 'counterfeit' from the banned_words array. Everything
-- else (scam, fraud, stolen, illegal, drugs, weapon, gun, pirated, smuggle(ing),
-- bribe, corrupt, and all loan/lending terms) is unchanged.
--
-- Idempotent. Run once via the Supabase CLI / SQL Editor.
-- ============================================================================

create or replace function check_listing_content()
returns trigger language plpgsql set search_path = public as $$
declare
  banned_words text[] := array[
    'scam','fraud','stolen','illegal','drugs','weapon','gun',
    'pirated','smuggle','smuggling','bribe','corrupt',
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

-- Verification (run manually):
--   insert into listings (seller_id, title, description, category, price, currency, city)
--   values ('<some user id>'::uuid, 'Genuine leather jacket', '100% authentic, not a fake or counterfeit', 'fashion', 40, 'USD', 'Harare');
--   -- expect: insert succeeds (no exception)
