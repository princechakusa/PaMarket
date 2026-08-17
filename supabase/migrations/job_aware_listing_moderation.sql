-- ============================================================================
-- PaMarket — stop blocking legitimate job posts for using finance/compliance
-- vocabulary
-- ----------------------------------------------------------------------------
-- Jobs are stored in `listings` with category='jobs', so they run through the
-- same check_listing_content() trigger as products. That word list exists to
-- keep loan-shark adverts and illegal-goods listings off the marketplace, and
-- it does that job well — but applied to a job post the same words describe
-- ordinary professions:
--
--   "Full charge accountant"  -> loan reconciliation, credit facilities
--   "Fraud analyst"           -> fraud
--   "Pharmacist"              -> drugs
--   "Security officer"        -> weapon policy
--   "Compliance officer"      -> anti-corruption
--
-- A real seller reported exactly this: a legitimate accounting vacancy was
-- rejected with "Listing contains prohibited content: loan".
--
-- The matcher itself is NOT the bug. The word-boundary regex added by
-- fix_fake_counterfeit_false_positive.sql is correct — 'loan' cannot match
-- inside 'accountant'. The defect is that the function never looks at
-- NEW.category, so one list is applied to two very different kinds of content.
--
-- Fix: branch on NEW.category. Marketplace listings keep the existing list
-- byte-for-byte. Jobs get a list that still blocks recruitment for genuinely
-- unsafe or criminal activity but drops the vocabulary that legitimately
-- appears in finance, pharmacy, security and compliance roles.
--
-- This deliberately does NOT weaken the marketplace path: a loan advert is not
-- category='jobs', so it is still rejected exactly as before.
--
-- Idempotent. Run once via the Supabase SQL Editor.
-- ============================================================================

create or replace function check_listing_content()
returns trigger language plpgsql set search_path = public as $$
declare
  -- Marketplace list — unchanged from fix_fake_counterfeit_false_positive.sql.
  marketplace_words text[] := array[
    'scam','fraud','stolen','illegal','drugs','weapon','gun',
    'pirated','smuggle','smuggling','bribe','corrupt',
    -- money lending / loan offers — not a supported category on PaMarket
    'loan','loans','lending','lender','moneylender','microloan','microlending',
    'payday loan','quick cash','instant cash','borrow money','money to borrow',
    'interest rate','shark loan','loan shark','cash advance','credit facility'
  ];
  -- Job list — criminal activity only. Words describing a lawful occupation
  -- (loan, lending, lender, interest rate, credit facility, fraud, drugs,
  -- weapon, gun, corrupt) are intentionally absent: a fraud analyst, a
  -- pharmacist and a credit controller all need them to describe the role.
  -- Recruitment for actual crime is still caught by the terms kept here, and
  -- jobs remain subject to every other check on this table.
  job_words text[] := array[
    'scam','stolen','illegal','bribe','pirated','smuggle','smuggling',
    'money laundering','launder money','human trafficking'
  ];
  banned_words text[];
  w text;
  content text;
begin
  if coalesce(new.category, '') = 'jobs' then
    banned_words := job_words;
  else
    banned_words := marketplace_words;
  end if;

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

-- Verification (run manually; all of these are covered by the automated
-- checks that accompanied this migration):
--
--   -- job that must now PASS
--   insert into listings (seller_id, title, description, category, price, currency, city)
--   values ('<user id>'::uuid, 'Full charge accountant',
--           'Reconcile loan accounts and credit facilities. Track interest rate changes.',
--           'jobs', 0, 'USD', 'Harare');
--
--   -- job that must still FAIL
--   insert into listings (seller_id, title, description, category, price, currency, city)
--   values ('<user id>'::uuid, 'Courier needed',
--           'Help us smuggle goods across the border.',
--           'jobs', 0, 'USD', 'Harare');
--
--   -- marketplace loan advert — must still FAIL exactly as before
--   insert into listings (seller_id, title, description, category, price, currency, city)
--   values ('<user id>'::uuid, 'Quick loans available',
--           'Instant cash loan, low interest rate.',
--           'services', 0, 'USD', 'Harare');
