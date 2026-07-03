-- ============================================================
-- fix_rental_company_profiles_doc_leak.sql
--
-- SECURITY — found during the production readiness RLS audit (2026-07-03).
--
-- rental_company_profiles had a single blanket policy:
--   create policy "rental_company_profiles: public read"
--     on public.rental_company_profiles for select using (true);
-- Confirmed live via anon REST call: this exposes business_reg_doc,
-- owner_id_doc, tax_clearance_doc, fleet_insurance_doc — verification
-- document URLs — to ANY unauthenticated request. No frontend code
-- anywhere selects these columns (only logo_url/cover_url/about/
-- service_location_ids are ever queried publicly), so this was pure
-- unintended exposure, not a used feature.
--
-- RLS is row-level only — it cannot hide individual columns from a
-- policy that otherwise allows the row. The fix is a security-definer
-- view exposing only the public-safe columns, with the base table
-- locked down to owner/admin for SELECT.
-- ============================================================

-- 1. Lock the base table's SELECT to the owner and admin only.
drop policy if exists "rental_company_profiles: public read" on public.rental_company_profiles;
create policy "rental_company_profiles: owner read"
  on public.rental_company_profiles for select
  using (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
    or public.is_admin()
  );

-- 2. Public-safe view: only marketing/contact fields, never the document
--    columns. security_invoker so it runs as the querying role (respects
--    the caller's own grants — it doesn't need to bypass RLS on the base
--    table because it simply never selects the sensitive columns).
create or replace view public.rental_company_profiles_public
with (security_invoker = true) as
select
  company_id,
  about,
  tagline,
  cover_url,
  logo_url,
  service_location_ids,
  website_url,
  facebook_url,
  instagram_url,
  airport_transfer,
  long_term_rental,
  corporate_accounts,
  fleet_management
from public.rental_company_profiles;

grant select on public.rental_company_profiles_public to anon, authenticated;

-- ── FRONTEND CHANGE REQUIRED ─────────────────────────────────────────
-- Customer-facing reads (www/js/rentals.js, RentalVehicleDetail/
-- RentalCompanyProfile loaders) must switch from
--   .from('rental_company_profiles')
-- to
--   .from('rental_company_profiles_public')
-- (shipped alongside this migration). The owner's own profile page
-- (rentals-business.js) keeps reading the base table directly, since
-- the owner is allowed to see their own row including doc fields.
--
-- ── VERIFY (run as anon after applying) ──────────────────────────────
-- select * from rental_company_profiles limit 1;              -- expect []
-- select * from rental_company_profiles_public limit 1;       -- expect the safe columns only
-- ============================================================
