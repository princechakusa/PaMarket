-- ============================================================
-- DIAGNOSE_RENTAL_STATE.sql  (read-only — changes nothing)
--
-- Paste the whole file into the Supabase SQL Editor and run it.
-- It answers, in one shot, why the rental section is empty:
--   1. Does a rental company row exist at all, and what status is it in?
--   2. Do any vehicle listings exist, and are they approved + active?
--   3. Which profiles actually have the admin role (approvals only
--      work when the logged-in admin.html user is one of these)?
--   4. Are the "admin all" RLS policies present on the rental tables?
--   5. What do the audit logs say happened (or failed to happen)?
--
-- The SQL Editor runs as postgres, so it sees ALL rows regardless
-- of RLS — this is the ground truth the app cannot show us.
-- ============================================================

-- 1. Every rental company, any status
select 'rental_companies' as what, id, business_id, status, admin_note, created_at
from public.rental_companies
order by created_at desc;

-- 2. Every vehicle listing, any status
select 'rental_vehicle_listings' as what, id, company_id, status, admin_status, deleted_at, created_at
from public.rental_vehicle_listings
order by created_at desc;

-- 3. Who is an admin (approvals in admin.html only work for these users)
select 'admin_profiles' as what, id, username, role
from public.profiles
where role = 'admin';

-- 4. RLS policies on the two critical tables
select 'policies' as what, tablename, policyname, cmd
from pg_policies
where tablename in ('rental_companies','rental_vehicle_listings')
order by tablename, policyname;

-- 5. Rental audit trail — shows whether any approval ever committed
select 'audit_logs' as what, actor_id, action, target_table, target_id, created_at
from public.rental_audit_logs
order by created_at desc
limit 30;

-- ── How to read the results ─────────────────────────────────
-- • Query 1 empty            → the rental company was never created;
--                              redo the rental business setup in the app.
-- • Query 1 status='pending' → approval never committed; approve it in
--                              admin.html (it now reports a real error
--                              if the update is blocked instead of a
--                              false success toast).
-- • Query 2 empty            → no vehicles were ever added; the rental
--                              page being empty is correct — add a car.
-- • Query 2 admin_status='pending_review' → approve the listing in admin.html.
-- • Query 3 empty            → no profile has role='admin'; run:
--       update public.profiles set role='admin' where id = '<your-user-id>';
-- • Query 4 missing "admin all" rows → re-run rental_marketplace_schema.sql
--   policy section (or ask for a one-off policy fix).
-- ============================================================
