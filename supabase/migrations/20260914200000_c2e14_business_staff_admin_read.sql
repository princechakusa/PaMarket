-- C2E-14: business_staff admin read access.
--
-- Confirmed live before this change: business_staff has 4 RLS policies
-- (owner deletes, owner invites [insert], owner or self update, visible to
-- owner or member [select]) and none of them grant any staff/admin role
-- visibility — is_admin()/is_moderator()/is_admin_team()/
-- has_admin_privilege() appear nowhere in this table's policy set. The raw
-- table-level GRANT on `authenticated` (and `anon`) is the project's usual
-- pattern (RLS is the real gate; anon gets zero rows since auth.uid() is
-- always null for it, matching every sibling business_* table).
--
-- INSERT/UPDATE/DELETE are already correctly owner-scoped (confirmed via
-- shop_orders_foundation.sql's own investigation note: business_staff is
-- deliberately NOT wired into any other table's write authorization, and
-- its own INSERT/UPDATE/DELETE policies check businesses.owner_user_id
-- exclusively) — only SELECT is missing for admin. This migration adds
-- exactly that, as a new, separate, explicit policy — the existing owner/
-- self policy is untouched.
--
-- is_admin() (admin + super_admin) is reused rather than is_admin_team()
-- or a new helper: it is the exact precedent already used for every
-- sibling business-domain table (businesses: admin all, business_
-- verifications: admin all, rental_companies: admin all, rental_vehicle_
-- listings: admin all) — matching that precedent keeps business_staff
-- consistent with the rest of the Business Platform's authorization model
-- instead of introducing a broader (moderator/support/finance-inclusive)
-- or narrower (bespoke) rule with no existing analog.
--
-- No application code changes required. The only application consumer
-- (apps/mobile/app/business-staff/[id].tsx) is entirely owner/self-scoped
-- and is unaffected by an additive admin-only SELECT policy.

create policy "business_staff: admin read"
  on "public"."business_staff"
  for select
  using (public.is_admin());
