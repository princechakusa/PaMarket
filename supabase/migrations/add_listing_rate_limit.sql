-- ============================================================================
-- R2 — Server-side listing rate limit (anti-spam, direct-API proof)
--
-- The app already soft-limits posting (5/24h in moderation.js) but that is
-- client-side and trivially bypassed by calling PostgREST directly. This adds a
-- BEFORE INSERT trigger on public.listings so the cap is enforced in the
-- database for every path (app, website, direct API).
--
-- Design:
--   * Configurable via public.moderation_settings (moderator-managed).
--     Key 'max_listings_per_24h' (default 25). Set <= 0 to disable.
--   * Staff (admin/moderator) are exempt.
--   * created_at is forced to now() for non-staff inserts so a caller cannot
--     backdate rows to slip outside the 24h counting window.
--   * Raised as 'rate_limited: …' so it flows through the same moderation
--     error handling as content_blocked / account_suspended (see safety.js).
--   * Runs alongside the Phase A content/sanction trigger — it does not modify
--     or duplicate that function.
-- ============================================================================

-- ── Config store (moderator-only) ───────────────────────────────────────────
create table if not exists public.moderation_settings (
  key        text primary key,
  int_value  int,
  updated_at timestamptz not null default now()
);

insert into public.moderation_settings (key, int_value)
values ('max_listings_per_24h', 25)
on conflict (key) do nothing;

alter table public.moderation_settings enable row level security;

drop policy if exists "moderation_settings: moderator all" on public.moderation_settings;
create policy "moderation_settings: moderator all"
  on public.moderation_settings
  for all
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- ── Enforcement trigger ─────────────────────────────────────────────────────
create or replace function public.enforce_listing_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lim int;
  cnt int;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  -- Staff manage content freely.
  if public.is_moderator() then
    return new;
  end if;

  select int_value into lim
  from public.moderation_settings
  where key = 'max_listings_per_24h';
  if lim is null then lim := 25; end if;
  if lim <= 0 then return new; end if;      -- disabled

  -- Server-authoritative timestamp: prevents backdating out of the window.
  new.created_at := now();

  select count(*) into cnt
  from public.listings
  where seller_id = new.seller_id
    and created_at > now() - interval '24 hours'
    and status <> 'deleted';

  if cnt >= lim then
    raise exception 'rate_limited: daily posting limit reached (%). Please try again later.', lim
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_listing_rate_limit on public.listings;
create trigger trg_listing_rate_limit
  before insert on public.listings
  for each row execute function public.enforce_listing_rate_limit();

-- Verification:
--   update public.moderation_settings set int_value = 2 where key='max_listings_per_24h';
--   -- as a normal user, insert 2 listings → OK; the 3rd → ERROR 'rate_limited: …'
--   update public.moderation_settings set int_value = 25 where key='max_listings_per_24h';
