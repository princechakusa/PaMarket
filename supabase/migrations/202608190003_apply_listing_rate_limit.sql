-- ============================================================
-- 202608190003_apply_listing_rate_limit.sql
--
-- FIX (production audit 3/5, verified live 2026-08-19): supabase/migrations/
-- add_listing_rate_limit.sql was written to cap listing creation at 25/24h
-- per seller (a direct-API-proof BEFORE INSERT trigger, same pattern already
-- proven live for messages and reports), but it uses a legacy, non-
-- timestamped filename. `supabase db push` silently skips every migration
-- file that doesn't match the "<timestamp>_name.sql" pattern (confirmed by
-- the CLI's own "file name must match pattern" output against ~60 other
-- legacy-named files in this repo) — so this migration was NEVER actually
-- considered for application, and was silently missing in production this
-- whole time. Confirmed live: enforce_listing_rate_limit() does not exist,
-- trg_listing_rate_limit does not exist on public.listings, and
-- max_listings_per_24h is absent from moderation_settings.
--
-- This migration reproduces add_listing_rate_limit.sql's content verbatim
-- under a properly-timestamped filename so the CLI will actually apply it.
-- No changes to the original logic. moderation_settings and is_moderator()
-- already exist live (created by fix_message_rate_limit.sql /
-- 202608030004_reports_self_report_guard_and_rate_limit.sql), so the
-- `create table if not exists` / policy statements below are no-ops against
-- the current DB — kept for standalone correctness in case this is ever
-- applied to a fresh environment.
-- ============================================================

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

-- Verification (run after applying):
--   select tgname, tgenabled from pg_trigger where tgrelid='listings'::regclass and tgname='trg_listing_rate_limit';
--   select key, int_value from moderation_settings where key='max_listings_per_24h';
-- ============================================================
