-- ============================================================
-- PaMarket — authorization hardening for rental SECURITY DEFINER RPCs
--
-- Audit findings (Section 9):
--
-- S2 (HIGH): rental_set_listing_state(p_listing_id, ...) is SECURITY DEFINER and
--   granted to authenticated, but performs NO ownership check. Any authenticated
--   user could change ANY rental vehicle's operational state (e.g. flag a
--   competitor's whole fleet as 'maintenance'/unavailable). Cross-business
--   integrity attack. Fix: require the caller to own the listing's company (or
--   be an admin) before mutating state.
--
-- S1 (MEDIUM): get_or_create_rental_conversation(p_listing_id, p_company_id,
--   p_user_id) trusts a CALLER-SUPPLIED p_user_id instead of auth.uid(), so a
--   caller could create conversation-context bindings on behalf of another user
--   (lead/inquiry spoofing). Fix: ignore p_user_id, use auth.uid(). Signature is
--   kept (param retained but overridden) so existing grants/clients don't break.
--
-- S3 (LOW): rental_aggregate_daily(p_date) is a cron aggregation job but was
--   granted to authenticated. Revoke from authenticated (cron uses service role).
--
-- The app does not currently call any of these three RPCs, so this hardening has
-- no effect on existing flows. Idempotent. Run once in the Supabase SQL Editor.
-- ============================================================

-- ── S2: ownership check on state transitions ──────────────────────────
create or replace function public.rental_set_listing_state(
  p_listing_id  uuid,
  p_new_state   text,
  p_reason      text    default null,
  p_auto_return timestamptz default null
)
returns void language plpgsql security definer
set search_path = public as $$
begin
  -- Caller must own the company that owns this listing, or be an admin.
  if not public.is_admin() and not exists (
    select 1
    from public.rental_vehicle_listings l
    join public.rental_companies rc on rc.id = l.company_id
    join public.businesses b        on b.id = rc.business_id
    where l.id = p_listing_id
      and b.owner_user_id = auth.uid()
  ) then
    raise exception 'Not authorized to change the state of this listing.';
  end if;

  insert into public.rental_vehicle_states
    (listing_id, current_state, changed_by, change_reason, auto_return_at)
  values
    (p_listing_id, p_new_state, auth.uid(), p_reason, p_auto_return)
  on conflict (listing_id) do update set
    current_state  = excluded.current_state,
    changed_by     = excluded.changed_by,
    change_reason  = excluded.change_reason,
    auto_return_at = excluded.auto_return_at,
    updated_at     = now();
end;
$$;

-- ── S1: use auth.uid(), never a caller-supplied identity ──────────────
create or replace function public.get_or_create_rental_conversation(
  p_listing_id uuid,
  p_company_id uuid,
  p_user_id    uuid
)
returns text language plpgsql security definer
set search_path = public as $$
declare
  v_conv_id      text;
  v_company_uid  uuid;
  v_user_id      uuid := auth.uid();   -- authoritative identity; p_user_id ignored
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select b.owner_user_id into v_company_uid
  from public.rental_companies rc
  join public.businesses b on b.id = rc.business_id
  where rc.id = p_company_id
  limit 1;

  if v_company_uid is null then
    raise exception 'Company not found or has no owner.';
  end if;

  if v_user_id = v_company_uid then
    raise exception 'Cannot open a conversation with your own company.';
  end if;

  select conversation_id into v_conv_id
  from public.rental_conversation_context
  where user_id = v_user_id and listing_id = p_listing_id;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  v_conv_id := 'rental_' || least(v_user_id::text, v_company_uid::text)
               || '_' || greatest(v_user_id::text, v_company_uid::text)
               || '_' || replace(p_listing_id::text, '-', '');

  insert into public.rental_conversation_context
    (conversation_id, listing_id, company_id, user_id)
  values
    (v_conv_id, p_listing_id, p_company_id, v_user_id)
  on conflict (user_id, listing_id) do update set
    conversation_id = excluded.conversation_id,
    company_id      = excluded.company_id;

  return v_conv_id;
end;
$$;

-- ── S3: cron-only aggregation must not be user-callable ───────────────
revoke execute on function public.rental_aggregate_daily(date) from authenticated;
