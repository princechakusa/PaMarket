-- Business onboarding: shop photos step
--
-- The create-a-business wizard now has a Photos step between Category and
-- Activate — the owner adds photos of their shop / what they sell (same
-- picker as posting a listing), and those photos show in the admin review
-- panel BEFORE activation so an admin can see what kind of business it
-- actually is before approving it.
--
-- Stored as a plain text[] of public R2 URLs, mirroring listings.photos.
-- The existing "businesses: owner update" RLS policy (with check
-- owner_user_id = auth.uid(), no column restriction) already lets an owner
-- write this; admins read it through the existing "businesses: admin all"
-- policy. No new policy needed.

alter table public.businesses
  add column if not exists photos text[] not null default '{}'::text[];

comment on column public.businesses.photos is
  'Shop photos added during onboarding (public R2 URLs). Shown to admins for pre-activation review and on the public shop page.';
