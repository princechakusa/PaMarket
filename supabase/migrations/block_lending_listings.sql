-- ============================================================================
-- PaMarket — Block money-lending / loan listings
-- ----------------------------------------------------------------------------
-- PaMarket only supports 12 categories (Electronics, Vehicles, Kids, Pets,
-- Fashion, Rooms, Jobs, Agriculture, Services, Property, Furniture, Other) —
-- money lending / loan offers are not one of them and must never be postable,
-- regardless of category chosen. Extends the existing word-boundary content
-- filter (check_listing_content, last replaced by
-- security_hardening_2026_06.sql) with finance/lending terms.
--
-- Idempotent — replaces the function body only, same trigger as before.
-- Run once in the Supabase SQL Editor.
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

-- ============================================================================
-- Verification (run manually, not part of the migration):
--
--   insert into listings (seller_id, title, description, category, price, currency, city)
--   values ('<some user id>'::uuid, 'Quick Cash Loans Available', 'Need money? Ask me', 'services', 0, 'USD', 'Harare');
--   -- expect: ERROR: Listing contains prohibited content: quick cash
-- ============================================================================
