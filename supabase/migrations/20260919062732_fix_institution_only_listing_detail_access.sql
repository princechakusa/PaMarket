-- Real bug found 2026-09-19: an "Institution Only" listing showed up
-- correctly in its institution's own feed (get_institution_listings is
-- SECURITY DEFINER and bypasses this RLS policy entirely for the list
-- view), but tapping into it from that exact same feed 404'd for anyone
-- except the listing's own seller -- this policy's institution_visibility
-- exclusion blocked the plain-select detail fetch (app/listing/[id].tsx)
-- for every other viewer, even ones legitimately browsing that same
-- institution hub.
--
-- The exclusion is intentionally kept for anon/unauthenticated access
-- (an institution_only listing should never be visible to someone who
-- isn't even signed in), but any authenticated user is already trusted to
-- browse institution hubs freely in this app, and Home/Search already
-- apply their own explicit query-level filter to keep institution_only
-- listings out of the general feeds independent of this policy (see
-- INSTITUTION_VISIBILITY_ATTR_KEY filters in apps/mobile/app/(tabs)/index.tsx
-- and search.tsx) -- so loosening this specific clause to "any signed-in
-- user" does not leak institution_only listings into any general feed,
-- it only fixes direct detail access for the case they're already
-- legitimately shown in (the institution hub itself).
drop policy if exists "listings: public read active" on public.listings;
create policy "listings: public read active" on public.listings
for select
to anon, authenticated
using (
  (
    status = 'active'
    and expires_at > now()
    and private.listing_principals_are_active(seller_id, business_id)
    and (
      coalesce(attributes ->> 'institution_visibility', 'public') <> 'institution_only'
      or auth.uid() is not null
    )
  )
  or auth.uid() = seller_id
  or is_moderator()
);
