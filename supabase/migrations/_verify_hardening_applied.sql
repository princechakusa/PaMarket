-- ============================================================
-- PaMarket — READ-ONLY verification that all hardening is applied.
-- Run in the Supabase SQL editor. Every row should show status 'OK'.
-- Any 'MISSING' row = that migration did not take. This changes nothing.
-- ============================================================
with checks as (

  -- 1. reports: business/message target types accepted (fix_reports_target_types)
  select 'reports target_type includes business+message' as check_name,
    case when pg_get_constraintdef(c.oid) like '%business%'
          and pg_get_constraintdef(c.oid) like '%message%'
         then 'OK' else 'MISSING' end as status
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'reports' and c.conname = 'reports_target_type_check'

  union all
  -- fallback row if the constraint doesn't exist at all
  select 'reports target_type includes business+message',
         'MISSING'
  where not exists (
    select 1 from pg_constraint c join pg_class t on t.oid = c.conrelid
    where t.relname = 'reports' and c.conname = 'reports_target_type_check')

  union all
  -- 2. reviews: admin-or-own delete policy (fix_reviews_admin_moderation)
  select 'reviews admin/own delete policy',
    case when exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='reviews'
        and policyname='reviews: own or admin delete')
    then 'OK' else 'MISSING' end

  union all
  -- 3. message-notif trigger (fix_message_notifications_server_side)
  select 'messages notify trigger',
    case when exists (
      select 1 from pg_trigger
      where tgname='trg_notify_message_recipients' and not tgisinternal)
    then 'OK' else 'MISSING' end

  union all
  -- 4. notifications self-or-admin insert policy (fix_admin_notifications_insert)
  select 'notifications self/admin insert policy',
    case when exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='notifications'
        and policyname='notifications: self or admin insert')
    then 'OK' else 'MISSING' end

  union all
  -- 5a. rental RPC authz: set_listing_state now checks ownership (fix_rental_definer_rpc_authz)
  select 'rental_set_listing_state has ownership guard',
    case when exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='rental_set_listing_state'
        and pg_get_functiondef(p.oid) ilike '%Not authorized to change the state%')
    then 'OK' else 'MISSING' end

  union all
  -- 5b. rental RPC authz: get_or_create uses auth.uid(), ignores p_user_id
  select 'get_or_create_rental_conversation uses auth.uid()',
    case when exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='get_or_create_rental_conversation'
        and pg_get_functiondef(p.oid) ilike '%p_user_id ignored%')
    then 'OK' else 'MISSING' end

  union all
  -- 5c. rental_aggregate_daily not executable by authenticated
  select 'rental_aggregate_daily NOT granted to authenticated',
    case when not exists (
      select 1 from information_schema.role_routine_grants
      where routine_schema='public' and routine_name='rental_aggregate_daily'
        and grantee='authenticated' and privilege_type='EXECUTE')
    then 'OK' else 'STILL GRANTED' end

  union all
  -- 6a. review notify trigger (fix_review_lead_notifications_server_side)
  select 'reviews notify trigger',
    case when exists (
      select 1 from pg_trigger
      where tgname='trg_notify_review_recipient' and not tgisinternal)
    then 'OK' else 'MISSING' end

  union all
  -- 6b. lead notify trigger — only expected if business_leads table exists
  select 'business_leads notify trigger',
    case
      when to_regclass('public.business_leads') is null then 'N/A (no business_leads table)'
      when exists (select 1 from pg_trigger
                   where tgname='trg_notify_lead_recipient' and not tgisinternal) then 'OK'
      else 'MISSING' end

  union all
  -- 7a. ad tracking RPCs exist (add_ad_tracking_rpc)
  select 'track_ad_impression + track_ad_click exist',
    case when (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
               where n.nspname='public'
                 and p.proname in ('track_ad_impression','track_ad_click')) = 2
    then 'OK' else 'MISSING' end

  union all
  -- 7b. ad tracking RPCs executable by anon
  select 'ad tracking RPCs granted to anon',
    case when (select count(*) from information_schema.role_routine_grants
               where routine_schema='public'
                 and routine_name in ('track_ad_impression','track_ad_click')
                 and grantee='anon' and privilege_type='EXECUTE') = 2
    then 'OK' else 'MISSING' end
)
select check_name, status from checks order by status desc, check_name;
