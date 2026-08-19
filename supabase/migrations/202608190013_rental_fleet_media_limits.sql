-- ============================================================
-- 202608190013_rental_fleet_media_limits.sql
--
-- Audit 4/5 item 6 (verified live 2026-08-19): no DB-level cap exists on
-- vehicles per rental company or media rows per vehicle — confirmed
-- unbounded via schema/RLS inspection. Current live volume is trivial (1
-- company, 1 vehicle, 1 media row total), so this is a proactive ceiling
-- ahead of real growth, not a response to observed abuse — sized so it
-- cannot affect any existing customer today.
--
-- Same proven BEFORE INSERT trigger pattern used throughout this
-- engagement (moderation_settings-driven, moderator-exempt).
--
--   max_rental_vehicles_per_company = 100   (a large real fleet; company
--                                             status is admin-approval-
--                                             gated already, this is a
--                                             volume backstop, not the
--                                             primary trust gate)
--   max_rental_media_per_vehicle    = 20    (most vehicles need 5-10
--                                             photos; 20 covers an
--                                             unusually thorough listing)
--
-- Vehicle count excludes archived/soft-deleted listings (status <>
-- 'archived'), matching the soft-delete pattern already in use for this
-- table (rental-fleet/manage.tsx sets status='archived' + deleted_at, it
-- never hard-deletes) — an archived vehicle should not permanently occupy
-- a company's fleet-size budget.
-- ============================================================

insert into public.moderation_settings (key, int_value)
values
  ('max_rental_vehicles_per_company', 100),
  ('max_rental_media_per_vehicle', 20)
on conflict (key) do nothing;

create or replace function public.enforce_rental_vehicle_limit()
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

  if public.is_moderator() then
    return new;
  end if;

  select int_value into lim
  from public.moderation_settings
  where key = 'max_rental_vehicles_per_company';
  if lim is null then lim := 100; end if;
  if lim <= 0 then return new; end if;

  select count(*) into cnt
  from public.rental_vehicle_listings
  where company_id = new.company_id
    and status <> 'archived';

  if cnt >= lim then
    raise exception 'rate_limited: this company has reached the maximum number of vehicle listings (%). Contact support to raise this limit.', lim
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rental_vehicle_limit on public.rental_vehicle_listings;
create trigger trg_rental_vehicle_limit
  before insert on public.rental_vehicle_listings
  for each row execute function public.enforce_rental_vehicle_limit();

create or replace function public.enforce_rental_media_limit()
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

  if public.is_moderator() then
    return new;
  end if;

  select int_value into lim
  from public.moderation_settings
  where key = 'max_rental_media_per_vehicle';
  if lim is null then lim := 20; end if;
  if lim <= 0 then return new; end if;

  select count(*) into cnt
  from public.rental_vehicle_media
  where listing_id = new.listing_id;

  if cnt >= lim then
    raise exception 'rate_limited: this vehicle already has the maximum number of photos (%). Remove one before adding another.', lim
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rental_media_limit on public.rental_vehicle_media;
create trigger trg_rental_media_limit
  before insert on public.rental_vehicle_media
  for each row execute function public.enforce_rental_media_limit();

-- Verification (run after applying):
--   select tgname, tgenabled from pg_trigger where tgrelid='rental_vehicle_listings'::regclass and tgname='trg_rental_vehicle_limit';
--   select tgname, tgenabled from pg_trigger where tgrelid='rental_vehicle_media'::regclass and tgname='trg_rental_media_limit';
--   select key, int_value from moderation_settings where key like 'max_rental%';
-- ============================================================
