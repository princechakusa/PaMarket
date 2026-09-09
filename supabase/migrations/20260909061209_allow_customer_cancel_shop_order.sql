-- Allows the customer who placed a shop order to cancel it themselves,
-- while it's still pending or confirmed — before the shop has actually
-- started preparing it. Stage 1's update_shop_order_status() deliberately
-- excluded customers entirely ("only the shop owner or an administrator
-- may change order status in this stage"); this was flagged as a real
-- missing feature, not a security fix, so the only change here is adding
-- one more authorized-caller branch with its own narrower transition set —
-- everything else (owner transitions, admin override, invalid-status/
-- invalid-transition handling, status history logging) is unchanged.
--
-- Deliberately NOT allowed: cancelling once the order is 'preparing',
-- 'ready', or 'completed' — the shop may have already committed real
-- effort/stock by then, so cancellation past that point goes through the
-- shop (existing owner-side flow), not the customer directly.
create or replace function public.update_shop_order_status(
  p_order_id uuid,
  p_new_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_order record;
  v_is_owner boolean;
  v_is_admin boolean;
  v_is_customer boolean;
  v_valid_transition boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated', 'msg', 'Please sign in again.');
  end if;

  if p_new_status not in ('pending','confirmed','declined','preparing','ready','completed','cancelled') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status', 'msg', 'That is not a valid order status.');
  end if;

  select o.id, o.business_id, o.customer_id, o.status into v_order
  from public.shop_orders o
  where o.id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'msg', 'Order not found.');
  end if;

  v_is_admin := public.is_admin();
  select exists (
    select 1 from public.businesses b where b.id = v_order.business_id and b.owner_user_id = v_uid
  ) into v_is_owner;
  v_is_customer := (v_order.customer_id = v_uid);

  -- Customer may now cancel their own order; every other transition
  -- remains owner/admin-only exactly as before.
  if not (v_is_owner or v_is_admin or v_is_customer) then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'msg', 'You are not allowed to update this order.');
  end if;

  if v_is_admin and not v_is_owner then
    -- Administrators may make any transition, including correcting a
    -- final status, per the business rule that only an admin may
    -- change an order once it has reached a final state.
    v_valid_transition := true;
  elsif v_is_owner then
    v_valid_transition := (v_order.status, p_new_status) in (
      ('pending','confirmed'), ('pending','declined'), ('pending','cancelled'),
      ('confirmed','preparing'), ('confirmed','cancelled'),
      ('preparing','ready'), ('preparing','cancelled'),
      ('ready','completed')
    );
  elsif v_is_customer then
    v_valid_transition := p_new_status = 'cancelled' and v_order.status in ('pending', 'confirmed');
  end if;

  if not v_valid_transition then
    return jsonb_build_object('ok', false, 'code', 'invalid_transition', 'msg', 'This order cannot move from ' || v_order.status || ' to ' || p_new_status || '.');
  end if;

  update public.shop_orders
  set status = p_new_status, updated_at = now()
  where id = p_order_id;

  insert into public.shop_order_status_history (order_id, status, note, changed_by)
  values (p_order_id, p_new_status, p_note, v_uid);

  return jsonb_build_object('ok', true, 'order_id', p_order_id, 'status', p_new_status);
exception
  when others then
    return jsonb_build_object('ok', false, 'code', 'update_failed', 'msg', 'Could not update this order. Please try again.');
end;
$function$;

-- Grants unchanged — same authenticated-only execute as before.
revoke all on function public.update_shop_order_status(uuid, text, text) from public, anon;
grant execute on function public.update_shop_order_status(uuid, text, text) to authenticated, service_role;
