-- ============================================================
-- fix_rental_increment_view.sql
--
-- BUG: rental_hardening.sql overwrote rental_increment_view() and dropped
-- the company_id lookup that the original rental_marketplace_schema.sql
-- version had. rental_activity_logs.company_id is NOT NULL, so every call
-- (every vehicle detail page view) has been failing with:
--   null value in column "company_id" of relation "rental_activity_logs"
--   violates not-null constraint
-- This silently broke view-count tracking and threw a 400 in the console
-- on every vehicle detail page load.
--
-- FIX: restore the company_id lookup (via a subquery on the listing),
-- keep the deleted_at guard and on-conflict safety from the hardening
-- version. Run once in Supabase SQL Editor.
-- ============================================================

create or replace function public.rental_increment_view(p_listing_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.rental_vehicle_listings
  set view_count = coalesce(view_count, 0) + 1
  where id = p_listing_id and deleted_at is null;

  insert into public.rental_activity_logs (listing_id, company_id, user_id, event_type)
  select p_listing_id, l.company_id, auth.uid(), 'view'
  from public.rental_vehicle_listings l
  where l.id = p_listing_id
  on conflict do nothing;
end;
$$;

grant execute on function public.rental_increment_view(uuid) to anon, authenticated;
-- ============================================================
