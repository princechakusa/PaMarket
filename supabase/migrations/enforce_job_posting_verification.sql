-- The "Employer verification required" gate in apps/mobile/app/jobs/post.tsx
-- is client-side only — the actual public.listings INSERT policy
-- (fix_listings_rls_2026_07.sql) only checks auth.uid() = seller_id, with no
-- awareness of category or verification at all. Any authenticated user could
-- bypass the app entirely (direct API call, patched client) and post a
-- category='jobs' listing without ever being company-verified, defeating the
-- stated purpose of that gate ("protect job seekers from fraudulent
-- listings").
--
-- Extends the existing check_listing_content() trigger (same function that
-- already enforces ban/suspension and content-rule checks on every
-- insert/update) rather than adding a second, separate trigger — keeps one
-- place responsible for "can this listing be created" decisions.
--
-- Reproduces the full existing function body (CREATE OR REPLACE fully
-- replaces it) with one addition: reject an INSERT where category = 'jobs'
-- and the poster is not company_verified.

create or replace function public.check_listing_content()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r        record;
  content  text;
  outcome  text := 'ALLOW';
  nonascii int;
  bb       bytea;
  poster_company_verified boolean;
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
      end if;
    end if;
  end loop;

  -- Excessive emoji / non-ASCII spam.
  nonascii := char_length(content) - char_length(regexp_replace(content, '[^[:ascii:]]', '', 'g'));
  if nonascii > 20 then outcome := 'FLAG'; end if;

  -- Hidden/suspicious Unicode (zero-width chars, BOM, RTL override). Compared
  -- as UTF-8 byte sequences so the check is encoding-safe and cannot error:
  --   U+200B/C/D = E2 80 8B/8C/8D · U+FEFF = EF BB BF · U+202E = E2 80 AE
  bb := convert_to(content, 'UTF8');
  if position('\xe2808b'::bytea in bb) > 0 or position('\xe2808c'::bytea in bb) > 0
     or position('\xe2808d'::bytea in bb) > 0 or position('\xefbbbf'::bytea in bb) > 0
     or position('\xe280ae'::bytea in bb) > 0 then
    outcome := 'FLAG';
  end if;

  -- Medium risk → create/keep the listing but hidden pending review.
  -- Never override an admin-set moderation state.
  if outcome = 'FLAG' then
    if tg_op = 'INSERT' or new.status in ('active','pending') then
      new.status := 'flagged';
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
