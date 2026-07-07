-- =============================================================
-- PaMarket: Google Play Billing — rental featured slot purchases
--
-- rental_featured_listings already exists (rental_marketplace_schema.sql,
-- TABLE 15) but is admin-only today — every row requires approved_by, and
-- there is no INSERT policy for a company owner or a purchase path at all.
-- This migration adds a Play Billing purchase ledger (same pending ->
-- verified -> consumed lifecycle as featured_slot_packs) whose activation
-- RPC inserts a SYSTEM-purchased row into rental_featured_listings
-- (approved_by = null) — the existing admin-approval path is untouched,
-- this is simply a second way a featured row can come to exist.
-- =============================================================

create table if not exists public.rental_featured_slot_packs (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references public.rental_vehicle_listings(id) on delete cascade,
  company_id      uuid not null references public.rental_companies(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  product_id      text not null check (product_id in ('rental_featured_slot_7day', 'rental_featured_slot_30day')),
  duration_days   int  not null check (duration_days in (7, 30)),

  purchase_token  text not null,
  order_id        text,

  status          text not null default 'pending'
                    check (status in ('pending', 'verified', 'failed', 'consumed')),
  verification_error text,

  purchase_time   timestamptz,
  created_at      timestamptz not null default now(),
  verified_at     timestamptz,

  constraint uq_rental_featured_pack_token unique (purchase_token)
);

create index if not exists rental_featured_packs_listing_idx on public.rental_featured_slot_packs (listing_id);
create index if not exists rental_featured_packs_company_idx on public.rental_featured_slot_packs (company_id, status);

alter table public.rental_featured_slot_packs enable row level security;

drop policy if exists "rental_featured_slot_packs: owner read" on public.rental_featured_slot_packs;
create policy "rental_featured_slot_packs: owner read"
  on public.rental_featured_slot_packs for select
  using (
    exists (
      select 1 from public.rental_companies rc
      join public.businesses b on b.id = rc.business_id
      where rc.id = company_id and b.owner_user_id = auth.uid()
    )
  );

drop policy if exists "rental_featured_slot_packs: admin all" on public.rental_featured_slot_packs;
create policy "rental_featured_slot_packs: admin all"
  on public.rental_featured_slot_packs for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── activate_rental_featured_slot_pack RPC ──────────────────────────
-- Grants a rental featured placement from a VERIFIED Google Play purchase.
-- Inserts directly into rental_featured_listings with approved_by = null
-- (distinguishing a system/purchased row from an admin-approved one — both
-- are read identically by the existing "rfl: public read" policy and the
-- rlsi_from_featured() denormalization trigger, so no other rental code
-- needs to change). If the listing already has an active featured row,
-- this EXTENDS it (stacks duration) rather than creating a second
-- concurrent row, mirroring activate_play_boost's "extend, don't reset"
-- behavior for regular listing boosts.
create or replace function public.activate_rental_featured_slot_pack(
  p_pack_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pack record;
  v_existing record;
  v_starts timestamptz;
  v_ends   timestamptz;
begin
  select * into v_pack
  from public.rental_featured_slot_packs
  where id = p_pack_id
  for update;

  if v_pack is null then
    return jsonb_build_object('ok', false, 'msg', 'Featured slot pack record not found');
  end if;

  if v_pack.status = 'consumed' then
    return jsonb_build_object('ok', true, 'already_consumed', true);
  end if;

  if v_pack.status != 'verified' then
    return jsonb_build_object('ok', false, 'msg', 'Purchase is not in a verified state: ' || v_pack.status);
  end if;

  select * into v_existing
  from public.rental_featured_listings
  where listing_id = v_pack.listing_id and is_active = true and ends_at > now()
  order by ends_at desc
  limit 1
  for update;

  -- NOTE: must be `found`, not `v_existing is not null` — a record IS NOT
  -- NULL only when EVERY field is non-null, and purchased rows always carry
  -- approved_by = null, which would silently route every extension into the
  -- insert branch and stack duplicate concurrent featured rows.
  if found then
    v_starts := v_existing.starts_at;
    v_ends   := v_existing.ends_at + (v_pack.duration_days || ' days')::interval;
    update public.rental_featured_listings
    set ends_at = v_ends
    where id = v_existing.id;
  else
    v_starts := now();
    v_ends   := now() + (v_pack.duration_days || ' days')::interval;
    insert into public.rental_featured_listings (listing_id, company_id, starts_at, ends_at, priority, approved_by, is_active)
    values (v_pack.listing_id, v_pack.company_id, v_starts, v_ends, 1, null, true);
  end if;

  update public.rental_featured_slot_packs
  set status = 'consumed'
  where id = p_pack_id;

  return jsonb_build_object('ok', true, 'until', v_ends, 'days', v_pack.duration_days);
end;
$$;

revoke execute on function public.activate_rental_featured_slot_pack(uuid) from public;
revoke execute on function public.activate_rental_featured_slot_pack(uuid) from authenticated;
revoke execute on function public.activate_rental_featured_slot_pack(uuid) from anon;

notify pgrst, 'reload schema';
