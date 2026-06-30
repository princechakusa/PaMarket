-- ─────────────────────────────────────────────────────────────
-- increment_listing_view RPC
--
-- Called by the client once per session per listing (deduplicated
-- client-side). Uses security definer to bypass the listings RLS
-- "own insert/update" policy so any authenticated or anonymous
-- viewer can increment the counter.
-- ─────────────────────────────────────────────────────────────

create or replace function public.increment_listing_view(listing_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_views integer;
begin
  update public.listings
  set views = coalesce(views, 0) + 1
  where id = listing_id
    and status = 'active'
  returning views into new_views;

  return json_build_object('views', coalesce(new_views, 0));
end;
$$;

-- Allow anonymous and authenticated callers so logged-out browsers
-- also increment the counter.
grant execute on function public.increment_listing_view(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- business_followers unique constraint
--
-- Prevents duplicate follow rows that could inflate follower counts.
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────

alter table public.business_followers
  drop constraint if exists business_followers_business_id_user_id_key;

alter table public.business_followers
  add constraint business_followers_business_id_user_id_key
  unique (business_id, user_id);

-- ─────────────────────────────────────────────────────────────
-- reviews UPDATE RLS policy
--
-- INSERT ... ON CONFLICT DO UPDATE requires an UPDATE policy.
-- Without it, upsert silently fails when a reviewer changes their
-- rating or re-submits a review. This allows reviewers to update
-- only their own rows (same anti-self-review check as INSERT).
-- ─────────────────────────────────────────────────────────────

drop policy if exists "reviews: own update" on public.reviews;
create policy "reviews: own update"
  on public.reviews for update
  using (auth.uid() = reviewer_id)
  with check (auth.uid() = reviewer_id and auth.uid() <> seller_id);
