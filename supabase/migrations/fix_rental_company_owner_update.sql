-- ============================================================================
-- PaMarket — let a rental owner save their own company's opening hours
-- ----------------------------------------------------------------------------
-- Saving the Company Profile failed on device with "Update matched 0 rows —
-- your company must be active to save changes", even for an active company the
-- user owns. The profile upsert was fine (that INSERT policy was added
-- earlier); the failure was the sibling write in the same save():
--
--   update rental_companies set days_open, opens_at, closes_at where id = ...
--
-- rental_companies had SELECT policies and an admin ALL policy, but no owner
-- UPDATE policy at all. With RLS enabled and no matching policy the statement
-- silently affects zero rows rather than erroring, so the app's row-count guard
-- reported it as an inactive-company problem — the company was active and owned
-- the whole time.
--
-- The new policy reuses owns_active_rental_company(id), the same predicate the
-- rental_company_profiles and rental_vehicle_listings policies use, so an owner
-- may edit only their own active company. A pending/suspended company still
-- cannot be edited by its owner, and admins keep their existing ALL access.
--
-- Deliberately narrow: an owner may edit their company's own details but must
-- not be able to approve, suspend or un-reject themselves. There was no
-- existing guard on status (only an audit trigger), so one is added below —
-- without it, granting UPDATE would have let any owner write status='active'
-- and bypass admin verification entirely.
--
-- Idempotent. Run once via the Supabase SQL Editor.
-- ============================================================================

drop policy if exists "companies_owner_update" on public.rental_companies;
create policy "companies_owner_update"
  on public.rental_companies for update
  to authenticated
  using (public.owns_active_rental_company(id))
  with check (public.owns_active_rental_company(id));

notify pgrst, 'reload schema';

-- ── status may only be changed by an admin ──────────────────────────────────
-- The UPDATE policy above is what a rental owner needs to save opening hours,
-- but UPDATE covers every column. Approval state is an admin decision, so any
-- non-admin attempt to change status is reverted to the stored value rather
-- than erroring — the rest of the owner's edit still saves.
create or replace function public.rental_company_protect_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return NEW; end if;
  if NEW.status is distinct from OLD.status then
    NEW.status := OLD.status;
  end if;
  if NEW.approved_at is distinct from OLD.approved_at then
    NEW.approved_at := OLD.approved_at;
  end if;
  if NEW.approved_by is distinct from OLD.approved_by then
    NEW.approved_by := OLD.approved_by;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_rental_company_protect_status on public.rental_companies;
create trigger trg_rental_company_protect_status
  before update on public.rental_companies
  for each row execute function public.rental_company_protect_status();

notify pgrst, 'reload schema';
