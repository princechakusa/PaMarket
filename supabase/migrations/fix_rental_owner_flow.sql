-- ============================================================================
-- PaMarket — let a verified rental owner actually manage their fleet
-- ----------------------------------------------------------------------------
-- Adding a vehicle failed on a real device with "Access denied. Your company
-- must be active to add vehicles." The company *was* active, and RLS was not
-- the problem: an owner INSERT reaches the row policy fine. The real failure is
--
--   permission denied for function rental_rebuild_search_index_row
--
-- rental_rebuild_search_index_row() is SECURITY DEFINER and has no EXECUTE
-- grant to `authenticated`, which is correct — it rewrites a search index and
-- should not be callable directly. But the search-index triggers that call it
-- (rlsi_from_listing / rlsi_from_media / rlsi_from_specs / rlsi_from_featured)
-- are NOT security definer, so they execute as the calling user and hit that
-- missing grant. The insert aborts with SQLSTATE 42501, and add-vehicle.tsx
-- maps any 42501 to the "must be active" message — which is why the error
-- pointed at the wrong thing.
--
-- Fix: make the four trigger wrappers SECURITY DEFINER so they run with the
-- privileges of the function owner, exactly like every other rental trigger on
-- these tables (rental_listing_init_state, rental_sync_fleet_count, etc. are
-- already secdef). No EXECUTE grant is added to rental_rebuild_search_index_row
-- itself, so it stays uncallable by clients, and no RLS policy is touched:
-- ownership is still enforced by owns_active_rental_company() on every insert
-- and update.
--
-- search_path is pinned on each, which is required for SECURITY DEFINER
-- functions to avoid search-path hijacking.
--
-- Idempotent. Run once via the Supabase SQL Editor.
-- ============================================================================

alter function public.rlsi_from_listing()  security definer set search_path = public;
alter function public.rlsi_from_media()    security definer set search_path = public;
alter function public.rlsi_from_specs()    security definer set search_path = public;
alter function public.rlsi_from_featured() security definer set search_path = public;

notify pgrst, 'reload schema';

-- ── Missing INSERT policy on rental_company_profiles ────────────────────────
-- Saving the company profile, the logo and the cover all failed on device with
--
--   new row violates row-level security policy for table "rental_company_profiles"
--
-- The table had SELECT and UPDATE policies for the owner but no INSERT policy,
-- and every one of those screens uses upsert(). PostgreSQL evaluates the INSERT
-- branch of an upsert against an INSERT/ALL policy, so with none present the
-- write was rejected before the ON CONFLICT clause could ever apply — the row
-- existed, but the statement never got that far. The image uploads reached R2
-- successfully first, which is why the user saw the generic "Upload failed"
-- rather than a permission error.
--
-- The new policy reuses owns_active_rental_company(), the same predicate the
-- existing UPDATE policy uses, so an owner can create their own profile row and
-- nobody can create one for a company they do not own. The admin ALL policy is
-- untouched.
drop policy if exists "co_profiles_insert" on public.rental_company_profiles;
create policy "co_profiles_insert"
  on public.rental_company_profiles for insert
  to authenticated
  with check (public.owns_active_rental_company(company_id));

notify pgrst, 'reload schema';
