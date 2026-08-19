-- ============================================================
-- 202608190004_business_leads_rate_limit.sql
--
-- FIX (production audit 3/5, verified live 2026-08-19): public.business_leads
-- has no rate limit or dedup of any kind — confirmed live (only
-- trg_notify_lead_recipient exists on the table, no rate-limit trigger; RLS
-- requires auth.uid() = user_id but does not bound frequency). Every insert
-- unconditionally fires notify_lead_recipient() (see
-- fix_review_lead_notifications_server_side.sql), pushing a "New Lead"
-- notification to the business owner with no cooldown. An authenticated
-- user can script repeated inserts (or just rapidly tap Call/WhatsApp in the
-- app) against the same or different businesses to flood an owner's device
-- with notifications indefinitely — the clearest proven harassment/spam
-- path found in this audit pass.
--
-- FIX: same proven pattern as messages/reports/listings — a
-- moderator-exempt, server-authoritative BEFORE INSERT trigger, configurable
-- via the existing public.moderation_settings table. Limit is generous
-- (20 leads / 5 min per user) since a genuine shopper legitimately tapping
-- Call/WhatsApp across several different businesses in one browsing session
-- must not be blocked — this only stops sustained/scripted flooding, not
-- normal contact behavior.
-- ============================================================

insert into public.moderation_settings (key, int_value)
values ('max_business_leads_per_5min', 20)
on conflict (key) do nothing;

create or replace function public.enforce_business_lead_rate_limit()
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
  where key = 'max_business_leads_per_5min';
  if lim is null then lim := 20; end if;
  if lim <= 0 then return new; end if;      -- disabled

  -- Server-authoritative timestamp: prevents backdating out of the window.
  new.created_at := now();

  select count(*) into cnt
  from public.business_leads
  where user_id = new.user_id
    and created_at > now() - interval '5 minutes';

  if cnt >= lim then
    raise exception 'rate_limited: too many contact actions submitted recently. Please wait a moment and try again.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_business_lead_rate_limit on public.business_leads;
create trigger trg_business_lead_rate_limit
  before insert on public.business_leads
  for each row execute function public.enforce_business_lead_rate_limit();

-- Verification (run after applying):
--   select tgname, tgenabled from pg_trigger where tgrelid='business_leads'::regclass and tgname='trg_business_lead_rate_limit';
--   select key, int_value from moderation_settings where key='max_business_leads_per_5min';
-- ============================================================
