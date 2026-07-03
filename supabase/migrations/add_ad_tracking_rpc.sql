-- ============================================================
-- PaMarket — secure ad impression/click tracking RPCs
--
-- Task 3: the website must track ad impressions and clicks, but the anon key
-- cannot (and must not) UPDATE paid_ads directly (admin-write RLS). These
-- security-definer RPCs increment the counters atomically without exposing
-- write access to the table — same approach as the app's listing-view RPC.
--
-- paid_ads(id text, impressions integer, clicks integer, active boolean, ...)
-- Idempotent. Run once in the Supabase SQL Editor.
-- ============================================================

create or replace function public.track_ad_impression(p_ad_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.paid_ads
    set impressions = coalesce(impressions, 0) + 1
    where id = p_ad_id and active = true;
end;
$$;

create or replace function public.track_ad_click(p_ad_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.paid_ads
    set clicks = coalesce(clicks, 0) + 1
    where id = p_ad_id and active = true;
end;
$$;

-- Public site + app both call these; anon and authenticated may execute.
grant execute on function public.track_ad_impression(text) to anon, authenticated;
grant execute on function public.track_ad_click(text)      to anon, authenticated;
