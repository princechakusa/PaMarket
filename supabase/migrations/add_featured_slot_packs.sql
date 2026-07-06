-- =============================================================
-- PaMarket: Google Play Billing — extra featured-slot packs
--
-- Business plans grant a baseline number of free featured slots
-- (H.PLAN_ENTITLEMENTS.featuredSlots). This table tracks ADDITIONAL slots
-- purchased on top of the plan baseline, via a Play Billing consumable —
-- replacing the old WhatsApp/admin-invoice "buy more featured slots" flow.
--
-- Unlike a per-listing boost (play_purchases), a slot pack isn't tied to
-- one listing at purchase time — it's a business-level credit that raises
-- how many of the business's OWN listings can be featured concurrently.
-- Extra slots do not expire on their own; they're consumed by however many
-- listings the business currently has featured (see H.featuredSlots in
-- business-featured.js, which sums plan baseline + active pack credits).
-- =============================================================

create table if not exists public.featured_slot_packs (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  product_id      text not null check (product_id in ('featured_slot_pack_1', 'featured_slot_pack_3')),
  extra_slots     int  not null check (extra_slots in (1, 3)),

  purchase_token  text not null,
  order_id        text,

  status          text not null default 'pending'
                    check (status in ('pending', 'verified', 'failed', 'consumed')),
  verification_error text,

  purchase_time   timestamptz,
  created_at      timestamptz not null default now(),
  verified_at     timestamptz,

  constraint uq_slot_pack_token unique (purchase_token)
);

create index if not exists slot_packs_business_idx on public.featured_slot_packs (business_id, status);

alter table public.featured_slot_packs enable row level security;

drop policy if exists "featured_slot_packs: owner read" on public.featured_slot_packs;
create policy "featured_slot_packs: owner read"
  on public.featured_slot_packs for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_user_id = auth.uid()
    )
  );

drop policy if exists "featured_slot_packs: admin all" on public.featured_slot_packs;
create policy "featured_slot_packs: admin all"
  on public.featured_slot_packs for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── activate_featured_slot_pack RPC ──────────────────────────
-- Marks a verified slot-pack purchase as consumed. There's no listing/
-- ranking mutation here (unlike activate_play_boost) — the extra slot
-- becomes usable the moment this row exists with status='consumed'; the
-- client sums active packs at render time (see featuredSlots() in
-- business-featured.js). Not granted to authenticated — service-role only.
create or replace function public.activate_featured_slot_pack(
  p_pack_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pack record;
begin
  select * into v_pack
  from public.featured_slot_packs
  where id = p_pack_id
  for update;

  if v_pack is null then
    return jsonb_build_object('ok', false, 'msg', 'Slot pack record not found');
  end if;

  if v_pack.status = 'consumed' then
    return jsonb_build_object('ok', true, 'already_consumed', true, 'extra_slots', v_pack.extra_slots);
  end if;

  if v_pack.status != 'verified' then
    return jsonb_build_object('ok', false, 'msg', 'Purchase is not in a verified state: ' || v_pack.status);
  end if;

  update public.featured_slot_packs set status = 'consumed' where id = p_pack_id;

  return jsonb_build_object('ok', true, 'extra_slots', v_pack.extra_slots);
end;
$$;

revoke execute on function public.activate_featured_slot_pack(uuid) from public;
revoke execute on function public.activate_featured_slot_pack(uuid) from authenticated;
revoke execute on function public.activate_featured_slot_pack(uuid) from anon;

notify pgrst, 'reload schema';
