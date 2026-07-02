-- ============================================================
-- enforce_rental_access_control_v2.sql
--
-- Completes the work of enforce_rental_access_control_v1.sql.
--
-- v1 created the new active-only policies but dropped only its own
-- policy names. The ORIGINAL policies from rental_marketplace_schema.sql
-- and rental_hardening.sql (named "rvl: owner insert" etc.) were never
-- removed. Because PostgreSQL RLS policies are permissive (OR'd),
-- those old policies still allowed pending/rejected company owners to
-- write. This file drops them so only the status-gated policies remain.
--
-- KEEPS every "admin all" policy: admin.html approval flow depends on
-- them (is_admin() via authenticated role, not service_role).
--
-- Requires: enforce_rental_access_control_v1.sql already run.
-- Safe to run once in Supabase SQL Editor. No data is modified.
-- ============================================================

-- rental_companies: inserts go through rental_setup_company RPC only;
-- updates are admin-only. Owner read stays via v1 "companies_select".
drop policy if exists "rental_companies: owner insert" on public.rental_companies;
drop policy if exists "rental_companies: owner update" on public.rental_companies;

-- rental_company_profiles: owner writes require active company (v1 policy)
drop policy if exists "rental_company_profiles: owner write" on public.rental_company_profiles;

-- rental_vehicle_listings: owner writes require active company (v1 policies)
drop policy if exists "rvl: owner insert" on public.rental_vehicle_listings;
drop policy if exists "rvl: owner update" on public.rental_vehicle_listings;
-- rental_hardening.sql variants (same table, different names)
drop policy if exists "rental_listings: owner insert" on public.rental_vehicle_listings;
drop policy if exists "rental_listings: owner update" on public.rental_vehicle_listings;

-- Child tables: old "using (true)" public reads leaked unapproved
-- listings' data, and old owner writes ignored company status.
-- v1 policies handle both correctly.
drop policy if exists "rvm: public read"  on public.rental_vehicle_media;
drop policy if exists "rvm: owner write"  on public.rental_vehicle_media;

drop policy if exists "rvs: public read"  on public.rental_vehicle_specs;
drop policy if exists "rvs: owner write"  on public.rental_vehicle_specs;

drop policy if exists "rvf: public read"  on public.rental_vehicle_features;
drop policy if exists "rvf: owner write"  on public.rental_vehicle_features;

drop policy if exists "rva: public read"  on public.rental_vehicle_availability;
drop policy if exists "rva: owner write"  on public.rental_vehicle_availability;

-- ── VERIFICATION (optional; run after the drops) ─────────────────────────
-- select tablename, policyname, cmd from pg_policies
-- where tablename like 'rental%' order by tablename, policyname;
--
-- Expected: each rental table keeps its v1 policies plus one
-- "<table>: admin all" policy, and nothing named "owner insert/update/write".
-- ============================================================
