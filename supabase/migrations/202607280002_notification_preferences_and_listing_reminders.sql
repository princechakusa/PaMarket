-- PaMarket automatic notification controls and viewed-listing reminders.
--
-- Adds durable per-user preferences, teaches proactive notification jobs to
-- respect them, and reminds a buyer once when they viewed an active listing
-- roughly one day ago but did not save or contact the shop about it.

begin;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  messages boolean not null default true,
  listing_updates boolean not null default true,
  approvals boolean not null default true,
  promotions boolean not null default true,
  favourites boolean not null default true,
  price_drops boolean not null default true,
  recommendations boolean not null default true,
  verification_reminders boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
grant select, insert, update on public.notification_preferences to authenticated;
revoke all on public.notification_preferences from anon;

drop policy if exists "notification preferences: own read" on public.notification_preferences;
create policy "notification preferences: own read"
  on public.notification_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notification preferences: own insert" on public.notification_preferences;
create policy "notification preferences: own insert"
  on public.notification_preferences for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "notification preferences: own update" on public.notification_preferences;
create policy "notification preferences: own update"
  on public.notification_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.notification_type_enabled(p_user_id uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_type in ('message', 'chat_scam_warning', 'message_noreply_reminder')
      then coalesce(pref.messages, true)
    when p_type in ('listing_approved', 'listing_rejected', 'listing_flagged')
      then coalesce(pref.approvals, true)
    when p_type in ('listing_expiry', 'stale_listing', 'view_milestone')
      then coalesce(pref.listing_updates, true)
    when p_type in ('price_drop')
      then coalesce(pref.price_drops, true)
    when p_type in ('saved_search_match')
      then coalesce(pref.favourites, true)
    when p_type in ('personalized_recommendation', 'shop_new_arrivals', 'category_digest', 'listing_view_reminder')
      then coalesce(pref.recommendations, true)
    when p_type in ('verification_nudge')
      then coalesce(pref.verification_reminders, true)
    when p_type in ('boost', 'promotion', 'sale')
      then coalesce(pref.promotions, true)
    else true
  end
  from (select 1) seed
  left join public.notification_preferences pref on pref.user_id = p_user_id;
$$;

revoke all on function public.notification_type_enabled(uuid, text) from public, anon, authenticated;
grant execute on function public.notification_type_enabled(uuid, text) to service_role;

-- Include all proactive reminders in the shared two-per-day engagement cap.
create or replace function public.under_daily_engagement_cap(p_user_id uuid, p_cap integer default 2)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) < p_cap
  from public.scheduled_notifications
  where target = p_user_id::text
    and type in (
      'shop_new_arrivals',
      'category_digest',
      'view_milestone',
      'personalized_recommendation',
      'listing_view_reminder',
      'verification_nudge'
    )
    and created_at >= now() - interval '24 hours';
$$;

revoke all on function public.under_daily_engagement_cap(uuid, integer) from public, anon, authenticated;
grant execute on function public.under_daily_engagement_cap(uuid, integer) to service_role;

alter table public.viewed_listings
  add column if not exists reminder_sent_at timestamptz;

create index if not exists viewed_listings_reminder_due_idx
  on public.viewed_listings (viewed_at)
  where reminder_sent_at is null;

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
          and bl.listing_id::text = vl.listing_id::text
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

-- Verification reminders remain useful, but now honor the user's preference,
-- share the proactive daily cap, and use a calmer 14-day repeat interval.
create or replace function public.run_verification_nudge()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_count integer := 0;
begin
  for rec in
    select id
    from public.profiles
    where coalesce(verified, false) = false
      and coalesce(verification_pending, false) = false
      and created_at <= now() - interval '3 days'
      and (last_verification_nudge_at is null or last_verification_nudge_at < now() - interval '14 days')
      and public.notification_type_enabled(id, 'verification_nudge')
      and public.under_daily_engagement_cap(id)
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
        rec.id::text,
        'Verify your PaMarket account',
        'Join verified users, earn buyer trust, and make your listings stand out.',
        'verification_nudge',
        'Account',
        now(),
        'verification-nudge:' || rec.id || ':' || to_char(current_date, 'IYYY-IW')
      )
      on conflict do nothing;

      update public.profiles
      set last_verification_nudge_at = now()
      where id = rec.id;

      v_count := v_count + 1;
    exception when others then
      raise warning 'run_verification_nudge: failed for user %: %', rec.id, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('notified', v_count);
end;
$$;

revoke all on function public.run_verification_nudge() from public, anon, authenticated;
grant execute on function public.run_verification_nudge() to service_role;

commit;
