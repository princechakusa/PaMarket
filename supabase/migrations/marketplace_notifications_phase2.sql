-- ============================================================================
-- PaMarket — Marketplace notifications, phase 2
-- ----------------------------------------------------------------------------
-- Continues marketplace_notifications_phase1.sql. Adds:
--
--   1. Job application push (employer new-lead alert on insert, candidate
--      shortlisted/declined alert on status change) — the applications
--      table already sends transactional EMAIL via notify-application, this
--      adds the missing phone push, delivered the same way as phase 1 (via
--      scheduled_notifications + automation-runner + send-push).
--
--   2. Personalized Recommendations — this marketplace never had server-side
--      view history (the "Recently Viewed" strip is pure client localStorage,
--      js/listing-extras.js `pm_recent`), so there was nothing to recommend
--      from. This adds a real signal: viewed_listings logs each signed-in
--      view (hooked into the existing increment_listing_view RPC, no new
--      client call needed), and a weekly poll job recommends one fresh
--      listing in the viewer's most-viewed category.
--
-- Idempotent. Run once in the Supabase SQL Editor, after phase 1.
-- ============================================================================

begin;

-- ============================================================================
-- 1. Job application push notifications
-- ============================================================================
create or replace function public.notify_job_application_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        NEW.employer_id::text,
        '📩 New application for "' || NEW.job_title || '"',
        coalesce(nullif(NEW.applicant_name,''), 'A candidate') || ' applied for your job posting "' || NEW.job_title || '".',
        'job_application', 'JobApplications?jobId=' || NEW.job_id, now()
      );
    exception when others then
      raise warning 'notify_job_application_events: insert-notify failed for application %: %', NEW.id, sqlerrm;
    end;
    return NEW;
  end if;

  if TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status and NEW.status in ('shortlisted','declined') then
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        NEW.applicant_id::text,
        case when NEW.status = 'shortlisted' then '🎉 You''ve been shortlisted!' else 'Application update' end,
        case when NEW.status = 'shortlisted'
          then coalesce(nullif(NEW.company,''), 'The employer') || ' shortlisted you for "' || NEW.job_title || '".'
          else coalesce(nullif(NEW.company,''), 'The employer') || ' decided not to move forward with your application for "' || NEW.job_title
            || '". Keep applying — the right fit is out there.'
        end,
        case when NEW.status = 'shortlisted' then 'job_shortlisted' else 'job_declined' end,
        'AppliedJobs', now()
      );
    exception when others then
      raise warning 'notify_job_application_events: status-notify failed for application %: %', NEW.id, sqlerrm;
    end;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_job_application on public.applications;
create trigger trg_notify_job_application
  after insert or update of status on public.applications
  for each row execute function public.notify_job_application_events();

-- ============================================================================
-- 2a. viewed_listings — per-user view history (drives recommendations)
-- ============================================================================
create table if not exists public.viewed_listings (
  user_id    uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  category   text not null default 'other',
  view_count integer not null default 1,
  viewed_at  timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index if not exists viewed_listings_user_recent_idx on public.viewed_listings (user_id, viewed_at desc);

alter table public.viewed_listings enable row level security;

drop policy if exists "viewed listings: own read" on public.viewed_listings;
create policy "viewed listings: own read"
  on public.viewed_listings for select
  using (auth.uid() = user_id);

-- No insert/update policy: written only by the security-definer RPC below.

-- ============================================================================
-- 2b. increment_listing_view — extended to log view history for signed-in
--     users. Same RPC detail.js already calls on every listing view, so no
--     new client-side call is needed.
-- ============================================================================
create or replace function public.increment_listing_view(listing_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  new_views integer;
  v_category text;
begin
  update public.listings
  set views = coalesce(views, 0) + 1
  where id = listing_id
    and status = 'active'
  returning views, category into new_views, v_category;

  if auth.uid() is not null and v_category is not null then
    insert into public.viewed_listings (user_id, listing_id, category, view_count, viewed_at)
    values (auth.uid(), listing_id, v_category, 1, now())
    on conflict (user_id, listing_id)
    do update set view_count = public.viewed_listings.view_count + 1, viewed_at = now(), category = excluded.category;
  end if;

  return json_build_object('views', coalesce(new_views, 0));
end;
$$;

grant execute on function public.increment_listing_view(uuid) to anon, authenticated;

-- ============================================================================
-- 2c. Weekly recommendation poll — called by automation-runner
-- ============================================================================
alter table public.profiles
  add column if not exists last_recommendation_at timestamptz;

create or replace function public.run_personalized_recommendations()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_category text;
  v_listing_id uuid;
  v_listing_title text;
  v_listing_price numeric;
  v_listing_currency text;
  v_listing_city text;
  v_count integer := 0;
begin
  for rec in
    select p.id as user_id
    from public.profiles p
    where (p.last_recommendation_at is null or p.last_recommendation_at < now() - interval '7 days')
      and exists (
        select 1 from public.viewed_listings vl
        where vl.user_id = p.id and vl.viewed_at >= now() - interval '7 days'
      )
    limit 300
  loop
    v_category := null;
    select vl.category into v_category
    from public.viewed_listings vl
    where vl.user_id = rec.user_id and vl.viewed_at >= now() - interval '7 days'
    group by vl.category
    order by count(*) desc, max(vl.viewed_at) desc
    limit 1;

    if v_category is null then
      continue;
    end if;

    v_listing_id := null;
    select l.id, l.title, l.price, l.currency, l.city
      into v_listing_id, v_listing_title, v_listing_price, v_listing_currency, v_listing_city
    from public.listings l
    where l.status = 'active'
      and l.category = v_category
      and l.seller_id <> rec.user_id
      and l.created_at >= now() - interval '14 days'
      and not exists (
        select 1 from public.viewed_listings vl2
        where vl2.user_id = rec.user_id and vl2.listing_id = l.id
      )
    order by l.created_at desc
    limit 1;

    -- Nothing fresh to recommend right now — push the cooldown out a week
    -- either way, so we don't re-scan this user every single tick.
    if v_listing_id is null then
      update public.profiles set last_recommendation_at = now() where id = rec.user_id;
      continue;
    end if;

    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        rec.user_id::text,
        '✨ More ' || v_category || ' picks for you',
        'Based on what you''ve been browsing, check out "' || v_listing_title || '" for ' || v_listing_currency || ' ' || v_listing_price
          || ' in ' || v_listing_city || '.',
        'personalized_recommendation', 'Detail?id=' || v_listing_id, now()
      );
      update public.profiles set last_recommendation_at = now() where id = rec.user_id;
      v_count := v_count + 1;
    exception when others then
      raise warning 'run_personalized_recommendations: failed for user %: %', rec.user_id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('recommended', v_count);
end;
$$;

revoke all on function public.run_personalized_recommendations() from public, anon, authenticated;
grant execute on function public.run_personalized_recommendations() to service_role;

commit;

-- ============================================================================
-- Optional: schedule automation-runner itself. This repo has no working
-- schedule for it yet (checked: no pg_cron entry, no GitHub Action). If your
-- project has the pg_net extension enabled, this is the standard way to have
-- pg_cron call an Edge Function on a timer — NOT run automatically here
-- because it requires you to paste in your own project ref + a secret,
-- which shouldn't be committed to source control:
--
-- select cron.schedule(
--   'automation-runner-tick', '*/15 * * * *',
--   $cron$
--   select net.http_post(
--     url := 'https://<your-project-ref>.supabase.co/functions/v1/automation-runner',
--     headers := jsonb_build_object('Content-Type','application/json','x-automation-secret','<your AUTOMATION_SECRET>'),
--     body := '{}'::jsonb
--   );
--   $cron$
-- );
--
-- Verification (run manually):
--   select run_personalized_recommendations();
--   select * from scheduled_notifications where type = 'personalized_recommendation' order by created_at desc limit 5;
--   select * from scheduled_notifications where type in ('job_application','job_shortlisted','job_declined') order by created_at desc limit 5;
-- ============================================================================
