-- Follow-up to 20260909061209_allow_customer_cancel_shop_order.sql:
-- notify_customer_order_status_change's "cancelled" message text
-- ("[Shop] cancelled your order #X") was only ever accurate because,
-- until that migration, only the shop owner or an admin could set
-- 'cancelled'. Now that a customer can cancel their own order, that same
-- wording would misleadingly tell the customer the SHOP cancelled it when
-- they did it themselves. Fixed by checking shop_order_status_history's
-- existing changed_by column: a customer-initiated cancellation skips the
-- customer notification entirely (they already know — they're the one who
-- just tapped Cancel) and instead notifies the shop owner, who previously
-- got no signal at all that a pending/confirmed order had been pulled.
-- Every other status/notification path (confirmed, declined, preparing,
-- ready, completed, and an owner/admin-initiated cancellation) is
-- byte-for-byte unchanged.
create or replace function public.notify_customer_order_status_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid;
  v_business_id uuid;
  v_owner_id uuid;
  v_business_name text;
  v_reference text;
  v_title text;
  v_body text;
begin
  -- 'pending' is only ever the initial status written by
  -- create_shop_order itself — never re-entered by update_shop_order_status
  -- (see its transition table) — so this exclusion is what separates
  -- "order just placed" (handled by the trigger above) from an actual
  -- status change.
  if NEW.status = 'pending' then
    return NEW;
  end if;

  select o.customer_id, o.business_id
  into v_customer_id, v_business_id
  from public.shop_orders o
  where o.id = NEW.order_id;

  if v_customer_id is null then
    return NEW;
  end if;

  select name, owner_user_id into v_business_name, v_owner_id from public.businesses where id = v_business_id;
  v_reference := upper(left(NEW.order_id::text, 8));

  -- The customer cancelling their own order is a different notification
  -- entirely: tell the shop owner instead of misleadingly telling the
  -- customer "the shop cancelled your order" when they did it themselves.
  if NEW.status = 'cancelled' and NEW.changed_by = v_customer_id then
    if v_owner_id is not null then
      begin
        insert into public.notifications (id, user_id, title, body, type, read, created_at, meta, event_key)
        values (
          gen_random_uuid()::text,
          v_owner_id::text,
          'Order cancelled by customer',
          'Order #' || v_reference || ' was cancelled by the customer before it was prepared.',
          'shop_order_status',
          false,
          (extract(epoch from now()) * 1000)::bigint,
          jsonb_build_object(
            'orderId', NEW.order_id,
            'businessId', v_business_id,
            'reference', v_reference,
            'status', NEW.status,
            'deepLink', 'ownerorder:' || NEW.order_id
          ),
          'shop_order_status:' || NEW.order_id || ':' || NEW.status || ':owner'
        )
        on conflict do nothing;
      exception when others then
        raise warning 'notify_customer_order_status_change: owner-cancel insert failed for order %: %', NEW.order_id, sqlerrm;
      end;
    end if;
    return NEW;
  end if;

  v_title := case NEW.status
    when 'confirmed' then 'Order confirmed'
    when 'declined' then 'Order declined'
    when 'cancelled' then 'Order cancelled'
    when 'preparing' then 'Order is being prepared'
    when 'ready' then 'Order is ready'
    when 'completed' then 'Order completed'
    else 'Order updated'
  end;

  v_body := coalesce(v_business_name, 'The shop') || ' ' || (case NEW.status
    when 'confirmed' then 'confirmed your order #' || v_reference || '. They''ll start preparing it soon.'
    when 'declined' then 'was unable to fulfil your order #' || v_reference || '.'
    when 'cancelled' then 'cancelled your order #' || v_reference || '.'
    when 'preparing' then 'is preparing your order #' || v_reference || '.'
    when 'ready' then 'says your order #' || v_reference || ' is ready.'
    when 'completed' then 'marked your order #' || v_reference || ' as completed. Thanks for ordering!'
    else 'updated your order #' || v_reference || '.'
  end);

  begin
    insert into public.notifications (id, user_id, title, body, type, read, created_at, meta, event_key)
    values (
      gen_random_uuid()::text,
      v_customer_id::text,
      v_title,
      v_body,
      'shop_order_status',
      false,
      (extract(epoch from now()) * 1000)::bigint,
      jsonb_build_object(
        'orderId', NEW.order_id,
        'businessId', v_business_id,
        'businessName', v_business_name,
        'reference', v_reference,
        'status', NEW.status,
        'deepLink', 'shoporder:' || NEW.order_id
      ),
      'shop_order_status:' || NEW.order_id || ':' || NEW.status
    )
    on conflict do nothing;
  exception when others then
    raise warning 'notify_customer_order_status_change: insert failed for order %: %', NEW.order_id, sqlerrm;
  end;

  return NEW;
end;
$function$;
