-- Bug found in TestFlight testing: report submission (both listings and
-- users) started failing with "could not submit report" after
-- 202608030004 shipped. Root cause: public.reports.created_at is `bigint`
-- (epoch milliseconds — there is no default, the column was previously
-- just left null on every insert), NOT a timestamp type. The rate-limit
-- trigger added in 202608030004 did `new.created_at := now()` (a
-- timestamptz) and compared `created_at > now() - interval '5 minutes'`
-- (bigint vs timestamptz) — both are type errors that fail on EVERY
-- insert into reports, at runtime, inside a BEFORE INSERT trigger, which
-- is why db push didn't catch it: PL/pgSQL doesn't validate expressions
-- against real column types until the function actually executes.

create or replace function public.enforce_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lim int;
  cnt int;
  now_ms bigint;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  if public.is_moderator() then
    return new;
  end if;

  select int_value into lim
  from public.moderation_settings
  where key = 'max_reports_per_5min';
  if lim is null then lim := 10; end if;
  if lim <= 0 then return new; end if;      -- disabled

  now_ms := (extract(epoch from now()) * 1000)::bigint;

  -- Server-authoritative timestamp: prevents backdating out of the window.
  new.created_at := now_ms;

  select count(*) into cnt
  from public.reports
  where reporter_id::text = new.reporter_id::text
    and created_at > now_ms - 300000; -- 5 minutes, in milliseconds

  if cnt >= lim then
    raise exception 'rate_limited: too many reports submitted recently. Please wait a moment and try again.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
