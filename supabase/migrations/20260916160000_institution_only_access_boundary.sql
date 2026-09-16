-- Institutions Phase 8B: closes the Phase 6/7/8A-confirmed gap where
-- "institution_only" was excluded from discovery/browse query shapes but
-- fully readable by anyone via direct listing ID (RLS never checked
-- attributes->>'institution_visibility' at all). Two changes:
--   1. Tighten the existing "listings: public read active" SELECT policy's
--      general-public branch to exclude institution_only rows. Owner and
--      moderator branches are untouched -- verified live before this
--      migration (pg_policies) to match Phase 8A's citation exactly.
--   2. Add one narrow, security definer, institution-scoped read RPC
--      (get_institution_listings), modeled directly on the existing
--      search_active_jobs() precedent (same STABLE/SECURITY DEFINER/
--      search_path shape, same p_limit/p_offset pagination convention).
--      Its own institution_id=p_institution_id join is the entire security
--      boundary -- there is no listing-id parameter, so it structurally
--      cannot be used to fetch an arbitrary listing or another
--      institution's rows, regardless of what a client asks for.
-- Plain RLS cannot distinguish "institution feed request" from "direct
-- listing-detail request" against the same row (row-level security has no
-- visibility into query shape/intent) -- that is why both changes are
-- required together, not either alone. See the Phase 8A audit.

drop policy if exists "listings: public read active" on public.listings;
create policy "listings: public read active" on public.listings
  for select to authenticated, anon
  using (
    (
      status = 'active'
      and expires_at > now()
      and private.listing_principals_are_active(seller_id, business_id)
      and coalesce(attributes->>'institution_visibility', 'public') <> 'institution_only'
    )
    or auth.uid() = seller_id
    or is_moderator()
  );

create or replace function public.get_institution_listings(
  p_institution_id uuid,
  p_limit integer default 20,
  p_offset integer default 0
)
returns setof public.listings
language sql stable security definer set search_path to 'public'
as $$
  select l.* from public.listings l
  where l.institution_id = p_institution_id
    and exists (select 1 from public.institutions i where i.id = p_institution_id and i.is_active = true)
    and l.status = 'active'
    and (l.expires_at is null or l.expires_at > now())
  order by l.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.get_institution_listings(uuid, integer, integer) to anon, authenticated;

comment on function public.get_institution_listings is
  'Institutions Phase 8B: the only path that can return institution_only listings to a general (non-owner, non-moderator) caller. Scoped entirely by its own institution_id join -- no listing-id parameter exists, so it cannot serve an arbitrary listing or leak another institution''s rows. Institution existence+active is re-checked here (never trusts that the caller already validated it client-side).';

-- run_personalized_recommendations() is SECURITY DEFINER and therefore
-- bypasses the RLS change above entirely -- it needs its own explicit
-- exclusion, unconditionally, regardless of the RLS/RPC changes.
create or replace function public.run_personalized_recommendations()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      -- Phase 8B: never recommend an institution_only listing to a general
      -- user through this audience-wide channel.
      and coalesce(l.attributes->>'institution_visibility', 'public') <> 'institution_only'
      and not exists (
        select 1 from public.viewed_listings vl2
        where vl2.user_id = rec.user_id and vl2.listing_id = l.id
      )
    order by l.created_at desc
    limit 1;

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
      perform public.log_notification_automation_error('run_personalized_recommendations', SQLSTATE, SQLERRM);
      raise warning 'run_personalized_recommendations: failed for user %: %', rec.user_id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('recommended', v_count);
end;
$function$;
