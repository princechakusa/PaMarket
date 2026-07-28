-- Fixes a genuine bug in run_listing_view_reminders() (added in
-- 202607280002_notification_preferences_and_listing_reminders.sql): it
-- referenced business_leads.listing_id, which does not exist on the live
-- schema (business_leads only has business_id — leads are recorded against
-- a shop, not a specific listing). This made the function fail outright
-- with "column bl.listing_id does not exist" every time it ran, confirmed
-- by directly invoking it against the linked database.
--
-- Fix: match on the listing's business_id instead, which is the closest
-- real equivalent of "already contacted this seller" available in the
-- current schema. Listings with no business_id (individual sellers) simply
-- never match any business_leads row, which is correct — that lead table
-- has nothing to say about a non-business seller anyway.

begin;

create or replace function public.run_listing_view_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_count integer := 0;
  v_inserted integer := 0;
begin
  for rec in
    select
      vl.user_id,
      vl.listing_id,
      l.title,
      l.price,
      l.currency,
      l.city
    from public.viewed_listings vl
    join public.listings l on l.id = vl.listing_id
    where l.status = 'active'
      and l.seller_id::text <> vl.user_id::text
      and vl.viewed_at <= now() - interval '20 hours'
      and vl.viewed_at >= now() - interval '48 hours'
      and (vl.reminder_sent_at is null or vl.reminder_sent_at < now() - interval '30 days')
      and public.notification_type_enabled(vl.user_id, 'listing_view_reminder')
      and public.under_daily_engagement_cap(vl.user_id)
      and not exists (
        select 1
        from public.user_saves us
        where us.user_id::text = vl.user_id::text
          and us.listing_id::text = vl.listing_id::text
      )
      and not exists (
        select 1
        from public.business_leads bl
        where bl.user_id::text = vl.user_id::text
          and l.business_id is not null
          and bl.business_id = l.business_id
      )
      and not exists (
        select 1
        from public.conversations c
        where c.listing_id::text = vl.listing_id::text
          and c.members @> array[vl.user_id]
      )
    order by vl.viewed_at asc
    limit 300
  loop
    begin
      insert into public.scheduled_notifications (
        target,
        title,
        body,
        type,
        deep_link,
        scheduled_for,
        idempotency_key
      )
      values (
        rec.user_id::text,
        'Still interested in "' || left(rec.title, 70) || '"?',
        'You viewed it yesterday'
          || case when rec.price is not null
               then ' for ' || coalesce(nullif(rec.currency, ''), 'USD') || ' ' || rec.price
               else ''
             end
          || coalesce(' in ' || nullif(rec.city, ''), '')
          || '. Open the listing to save it or contact the seller.',
        'listing_view_reminder',
        'Detail?id=' || rec.listing_id,
        now(),
        'listing-view-reminder:' || rec.user_id || ':' || rec.listing_id || ':' || to_char(current_date, 'YYYY-MM-DD')
      )
      on conflict do nothing;

      get diagnostics v_inserted = row_count;
      if v_inserted = 1 then
        update public.viewed_listings
        set reminder_sent_at = now()
        where user_id = rec.user_id and listing_id = rec.listing_id;

        v_count := v_count + 1;
      end if;
    exception when others then
      raise warning 'run_listing_view_reminders: failed for user % / listing %: %',
        rec.user_id, rec.listing_id, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('reminded', v_count);
end;
$$;

revoke all on function public.run_listing_view_reminders() from public, anon, authenticated;
grant execute on function public.run_listing_view_reminders() to service_role;

commit;
