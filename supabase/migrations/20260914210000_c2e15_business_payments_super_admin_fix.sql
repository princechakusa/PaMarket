-- C2E-15: business_payments authorization fix.
--
-- Confirmed live before this change: business_payments has 3 RLS policies
-- (admin_read_all_payments, admin_update_payments, owner_insert_payments;
-- no DELETE policy exists at all -- DELETE is fully blocked for every
-- non-service role regardless of grant, unaffected by this migration).
-- Both admin_read_all_payments and admin_update_payments use a literal
-- `EXISTS (select 1 from profiles where profiles.id = auth.uid() and
-- profiles.role = 'admin')` check -- a super_admin caller does not match
-- this at all, only the exact string 'admin'.
--
-- Confirmed live impact: www/admin.html directly selects/updates this
-- table (Finance dashboard, business-upgrade approve/decline flows,
-- revenue totals) after its own login already admits any ADMIN_ROLES
-- member, including super_admin -- so a super_admin logging into the live
-- legacy Admin today gets zero rows / blocked updates on every one of
-- those screens despite being let in as legitimate staff. This is a real,
-- reproducible defect in the live system, not a hypothetical one.
--
-- owner_insert_payments is untouched: it is correctly owner-scoped
-- (businesses.owner_user_id = auth.uid()) and was never part of this
-- defect -- payments are created by the owning business, never by admin.
--
-- Fix: replace the literal string comparison with is_admin() (admin +
-- super_admin), the exact precedent already used by every sibling
-- business-domain table (businesses, business_verifications,
-- rental_companies, rental_vehicle_listings, and business_staff as of
-- C2E-14) -- not a new or broader helper, and not has_admin_privilege(),
-- to stay consistent with that specific sibling-table precedent rather
-- than the RPC-internal aggregate functions' own (also-correct, but
-- differently-styled) has_admin_privilege('admin') gate.
--
-- moderator/support/finance remain excluded, matching both the existing
-- admin_revenue_summary()/admin_top_payers() RPCs (already
-- has_admin_privilege('admin')-gated, excluding finance/moderator/support)
-- and every sibling business-domain table's is_admin() convention. No
-- broadening beyond admin+super_admin.

drop policy if exists "admin_read_all_payments" on "public"."business_payments";
create policy "admin_read_all_payments" on "public"."business_payments"
  for select
  using (
    public.is_admin()
    or (business_id in (select businesses.id from public.businesses where businesses.owner_user_id = auth.uid()))
  );

drop policy if exists "admin_update_payments" on "public"."business_payments";
create policy "admin_update_payments" on "public"."business_payments"
  for update
  using (
    public.is_admin()
    or (business_id in (select businesses.id from public.businesses where businesses.owner_user_id = auth.uid()))
  );
