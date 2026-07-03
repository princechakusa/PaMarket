-- ============================================================
-- fix_rental_business_analytics_auth_bypass.sql
--
-- SECURITY — found during the production readiness audit (2026-07-03).
-- CRITICAL: confirmed live and exploitable.
--
-- rental_business_analytics() had:
--   if v_owner_id != auth.uid() and not public.is_admin() then
--     raise exception 'Not authorized';
--   end if;
-- When the caller is unauthenticated, auth.uid() is NULL. In SQL,
-- `anything != NULL` evaluates to NULL, and plpgsql's `if` treats a NULL
-- condition as FALSE — so the raise never fires and the function returns
-- full 30-day analytics (views, saves, chats, WhatsApp clicks, call
-- clicks, fleet count, rating, review count) for ANY company_id to ANY
-- caller, no login required. Reproduced live:
--   curl -X POST .../rpc/rental_business_analytics -d '{"p_company_id":"..."}'
--   (no Authorization beyond the public anon/publishable key)
--   → returned real numbers.
--
-- This let any competitor pull any rental company's private performance
-- data anonymously, and — because the grant is only "to authenticated"
-- while the bug bypasses the in-function check — any logged-in user
-- (not just the owner) could pull ANY OTHER company's analytics too.
--
-- FIX: check auth.uid() is null FIRST (explicit, no NULL-comparison
-- ambiguity), before the ownership comparison.
-- ============================================================

create or replace function public.rental_business_analytics(p_company_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_owner_id uuid;
  v_result   jsonb;
  v_since    timestamptz := now() - interval '30 days';
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'AUTEN';
  end if;

  -- Auth: must be the company owner or an admin
  select b.owner_user_id into v_owner_id
  from public.rental_companies rc
  join public.businesses b on b.id = rc.business_id
  where rc.id = p_company_id
  limit 1;

  if v_owner_id is null or (v_owner_id != auth.uid() and not public.is_admin()) then
    raise exception 'Not authorized' using errcode = 'AUTHR';
  end if;

  select jsonb_build_object(
    'views_30d',      coalesce(sum(case when event_type='view'         then 1 else 0 end),0),
    'saves_30d',      coalesce(sum(case when event_type='save'         then 1 else 0 end),0),
    'chats_30d',      coalesce(sum(case when event_type='chat_open'    then 1 else 0 end),0),
    'whatsapp_30d',   coalesce(sum(case when event_type='whatsapp_click' then 1 else 0 end),0),
    'calls_30d',      coalesce(sum(case when event_type='call_click'   then 1 else 0 end),0),
    'total_events',   count(*)
  ) into v_result
  from public.rental_activity_logs al
  join public.rental_vehicle_listings l on l.id = al.listing_id
  where l.company_id = p_company_id
    and al.created_at >= v_since;

  select v_result || jsonb_build_object(
    'fleet_count',  coalesce(rc.fleet_count, 0),
    'avg_rating',   coalesce(rc.avg_rating, 0),
    'review_count', coalesce(rc.review_count, 0)
  ) into v_result
  from public.rental_companies rc
  where rc.id = p_company_id;

  return v_result;
end;
$$;

grant execute on function public.rental_business_analytics(uuid) to authenticated;

-- ── VERIFY (run after applying, unauthenticated) ────────────────────
-- curl -X POST .../rpc/rental_business_analytics -d '{"p_company_id":"<any real id>"}'
-- Expect: {"code":"AUTEN","message":"Not authenticated"} — never real numbers.
-- ============================================================
