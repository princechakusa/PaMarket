-- Expands listing-text moderation to cover the same scam categories
-- apps/mobile/lib/safety.ts already flags in CHAT messages (credential
-- phishing, advance-fee/loan scams, illegal goods) — previously these only
-- existed as a client-side warning on chat, with no equivalent check on
-- listing title/description, even though a scammer posting a fake "iPhone
-- for sale, pay a clearance fee first" ad is exactly the same pattern.
-- Also adds a lightweight account-history signal: newly-created accounts
-- (< 72h old) get escalated to under_review instead of a soft "flagged"
-- when any pattern matches, since a scam listing is disproportionately
-- likely to come from a brand-new account rather than an established one.
--
-- Reproduces the full check_listing_content() body (CREATE OR REPLACE fully
-- replaces it) on top of enforce_job_posting_verification.sql, adding:
--   1. flag_reason column on listings, so admins reviewing a flagged/
--      under_review listing can see why, instead of just "flagged".
--   2. credential-phishing / illegal-goods pattern match -> content_blocked
--      (same treatment as an existing moderation_rules 'block' row).
--   3. advance-fee pattern match -> FLAG (same as moderation_rules 'flag').
--   4. new-account (< 72h) + any FLAG -> escalated to under_review instead
--      of flagged, and seller sanction history is not otherwise touched.
--
-- Idempotent. Run once in the Supabase SQL Editor, after
-- enforce_job_posting_verification.sql.

alter table public.listings
  add column if not exists flag_reason text;

create or replace function public.check_listing_content()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r        record;
  content  text;
  outcome  text := 'ALLOW';
  reason   text;
  nonascii int;
  bb       bytea;
  poster_company_verified boolean;
  poster_created_at timestamptz;
  is_new_account boolean;
begin
  -- Sanction enforcement (new listings only).
  if tg_op = 'INSERT' then
    if public.is_user_banned(new.seller_id) then
      raise exception 'account_banned: this account is banned from posting';
    end if;
    if public.is_user_suspended(new.seller_id) then
      raise exception 'account_suspended: this account is suspended from posting';
    end if;
  end if;

  -- Job postings require company verification — same rule the mobile app's
  -- jobs/post.tsx gate already displays, now actually enforced server-side.
  if tg_op = 'INSERT' and new.category = 'jobs' then
    select company_verified into poster_company_verified
    from public.profiles where id = new.seller_id;
    if coalesce(poster_company_verified, false) is not true then
      raise exception 'company_verification_required: employer verification is required to post a job';
    end if;
  end if;

  -- Skip when nothing text-relevant changed on UPDATE (e.g. a boost or a
  -- moderator status change) so we never re-flag admin decisions.
  if tg_op = 'UPDATE'
     and new.title       is not distinct from old.title
     and new.description is not distinct from old.description then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.status in ('removed','under_review','flagged','deleted')
     and new.status is distinct from old.status then
    return new;
  end if;

  content := lower(coalesce(new.title,'') || ' ' || coalesce(new.description,''));

  -- Configurable rule evaluation.
  for r in select * from public.moderation_rules where enabled loop
    if (r.match_type = 'contains' and content like '%' || lower(r.pattern) || '%')
       or (r.match_type = 'word'  and content ~* ('\m' || r.pattern || '\M'))
       or (r.match_type = 'regex' and content ~* r.pattern) then
      if r.risk = 'block' then
        raise exception 'content_blocked: prohibited content (%)', r.label;
      else
        outcome := 'FLAG';
        reason := coalesce(reason, r.label);
      end if;
    end if;
  end loop;

  -- Credential phishing / illegal goods — unambiguous enough to block
  -- outright, same as a 'block' moderation_rules row.
  if content ~* '\y(?:send|share|give|forward)\s+(?:me\s+)?(?:your\s+)?(?:otp|one[\s-]?time[\s-]?pin|verification\s+code|pin\s+code)\y'
     or content ~* '\ywhat''?s\s+your\s+(?:otp|pin|password)\y'
     or content ~* '\y(?:cocaine|heroin|crystal\s+meth)\y' then
    raise exception 'content_blocked: prohibited content (scam or illegal-goods pattern)';
  end if;

  -- Advance-fee / fake-investment scam wording — flag for review, same
  -- treatment as a soft moderation_rules match.
  if content ~* '\y(?:pay|send|transfer)\s+(?:a\s+)?(?:small\s+)?(?:registration|processing|clearance|delivery|customs|advance|upfront)\s+fee\y'
     or content ~* '\yloan\s+(?:guaranteed|approved)\s+(?:without|no)\s+(?:collateral|credit\s+check)\y'
     or content ~* '\y(?:100%|guaranteed)\s+(?:returns?|profit)\y'
     or content ~* '\ydouble\s+your\s+(?:money|investment)\y' then
    outcome := 'FLAG';
    reason := coalesce(reason, 'advance-fee / investment-scam wording');
  end if;

  -- Excessive emoji / non-ASCII spam.
  nonascii := char_length(content) - char_length(regexp_replace(content, '[^[:ascii:]]', '', 'g'));
  if nonascii > 20 then
    outcome := 'FLAG';
    reason := coalesce(reason, 'excessive non-ASCII / emoji spam');
  end if;

  -- Hidden/suspicious Unicode (zero-width chars, BOM, RTL override). Compared
  -- as UTF-8 byte sequences so the check is encoding-safe and cannot error:
  --   U+200B/C/D = E2 80 8B/8C/8D · U+FEFF = EF BB BF · U+202E = E2 80 AE
  bb := convert_to(content, 'UTF8');
  if position('\xe2808b'::bytea in bb) > 0 or position('\xe2808c'::bytea in bb) > 0
     or position('\xe2808d'::bytea in bb) > 0 or position('\xefbbbf'::bytea in bb) > 0
     or position('\xe280ae'::bytea in bb) > 0 then
    outcome := 'FLAG';
    reason := coalesce(reason, 'hidden/suspicious unicode characters');
  end if;

  -- New-account signal: escalate a soft FLAG to under_review (hidden pending
  -- manual review) rather than the lighter 'flagged' state, when the poster's
  -- account is under 72 hours old.
  if outcome = 'FLAG' and tg_op = 'INSERT' then
    select created_at into poster_created_at from public.profiles where id = new.seller_id;
    is_new_account := poster_created_at is not null and poster_created_at >= now() - interval '72 hours';
    if is_new_account then
      new.status := 'under_review';
      new.flag_reason := coalesce(reason, 'flagged content') || ' (new account, < 72h old)';
      return new;
    end if;
  end if;

  -- Medium risk → create/keep the listing but hidden pending review.
  -- Never override an admin-set moderation state.
  if outcome = 'FLAG' then
    if tg_op = 'INSERT' or new.status in ('active','pending') then
      new.status := 'flagged';
      new.flag_reason := reason;
    end if;
  end if;

  return new;
end;
$$;

-- Trigger itself is unchanged (still fires before insert or update on
-- public.listings), just re-declared here for a self-contained migration.
drop trigger if exists trg_listing_moderation on public.listings;
create trigger trg_listing_moderation
  before insert or update on public.listings
  for each row execute function public.check_listing_content();

notify pgrst, 'reload schema';

-- Verification (run manually):
--   insert into listings (seller_id, title, description, category, price, currency, status)
--     values ('<uid>', 'iPhone 14 for sale', 'Pay a small clearance fee first and I will ship', 'electronics', 400, 'USD', 'active');
--   select status, flag_reason from listings order by created_at desc limit 1;
--   -- expect status = 'flagged' (established account) or 'under_review' (account < 72h old)
