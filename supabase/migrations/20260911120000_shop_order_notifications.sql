-- ============================================================
-- PaMarket — Shop Order Notifications (Stage 4)
--
-- Reuses the existing notification pipeline exactly as-is:
--   - public.notifications is the single in-app table (id text, user_id
--     text, title, body, type, meta jsonb, created_at bigint epoch-ms).
--   - Its own `notifications_dispatch_push` AFTER INSERT trigger (see
--     notification_push_dispatch_trigger.sql) already calls the
--     dispatch-notification-push edge function for every new row with
--     push_sent = false — no new edge function, no new webhook, no
--     change to send-push/automation-runner/dispatch-notification-push.
--   - Missing/expired push tokens, missing FCM credentials, and opted-out
--     preferences are already handled safely inside
--     dispatch-notification-push; nothing here needs to duplicate that.
--
-- Two new SECURITY DEFINER triggers, following the exact shape of the
-- existing notify_review_recipient() / notify_listing_status_change()
-- triggers (insert straight into public.notifications, wrapped in
-- begin/exception so a notification failure can NEVER roll back the
-- order transaction it's attached to):
--   1. shop_orders AFTER INSERT -> notifies the shop owner of a new order.
--      Fires only when a real row is inserted — create_shop_order's own
--      idempotency (a retried request returns the existing order via its
--      "idempotent_replay" path and never inserts a second shop_orders
--      row) already makes this fire at most once per real order. No
--      client-supplied price/title/total is used — every value comes
--      from the row that create_shop_order itself computed and stored.
--   2. shop_order_status_history AFTER INSERT (excluding the initial
--      'pending' row created by create_shop_order itself) -> notifies the
--      customer of a status change. update_shop_order_status only
--      inserts a history row on a genuinely valid transition, so a
--      repeated/no-op status update never reaches this trigger either.
--
-- Idempotency (defense in depth, not just "the RPC already prevents it"):
-- a new event_key column + partial unique index on public.notifications,
-- mirroring scheduled_notifications' own existing
-- scheduled_notifications_idempotency_idx. Both triggers insert with
-- `on conflict do nothing` against a deterministic key derived from the
-- server-side order id (+ status for status-change events) — never from
-- anything client-supplied.
--
-- Safe to run more than once.
-- ============================================================

alter table public.notifications add column if not exists event_key text;

create unique index if not exists notifications_event_key_idx
  on public.notifications (event_key)
  where event_key is not null;

-- ── 1. New order -> notify the shop owner ────────────────────────────
create or replace function public.notify_shop_owner_new_order()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_owner_id uuid;
  v_business_name text;
  v_reference text;
begin
  select owner_user_id, name into v_owner_id, v_business_name
  from public.businesses
  where id = NEW.business_id;

  -- shop_orders.business_id is `references businesses(id) on delete
  -- restrict`, so this should never be null in practice — guard anyway
  -- rather than ever raise inside an order-creation transaction.
  if v_owner_id is null then
    return NEW;
  end if;

  v_reference := upper(left(NEW.id::text, 8));

  begin
    insert into public.notifications (id, user_id, title, body, type, read, created_at, meta, event_key)
    values (
      gen_random_uuid()::text,
      v_owner_id::text,
      'New order request',
      'You received a new order request.'
        || ' #' || v_reference
        || ' - ' || NEW.item_count || ' item' || case when NEW.item_count = 1 then '' else 's' end
        || ', ' || NEW.currency || NEW.total,
      'shop_order_new',
      false,
      (extract(epoch from now()) * 1000)::bigint,
      jsonb_build_object(
        'orderId', NEW.id,
        'businessId', NEW.business_id,
        'businessName', v_business_name,
        'reference', v_reference,
        'itemCount', NEW.item_count,
        'total', NEW.total,
        'currency', NEW.currency,
        'deepLink', 'ownerorder:' || NEW.id
      ),
      'shop_order_new:' || NEW.id
    )
    on conflict do nothing;
  exception when others then
    -- Never let a notification failure roll back a successfully created
    -- order — this is an AFTER INSERT trigger inside create_shop_order's
    -- own transaction.
    raise warning 'notify_shop_owner_new_order: insert failed for order %: %', NEW.id, sqlerrm;
  end;

  return NEW;
end;
$function$;

drop trigger if exists trg_notify_shop_owner_new_order on public.shop_orders;
create trigger trg_notify_shop_owner_new_order
  after insert on public.shop_orders
  for each row execute function public.notify_shop_owner_new_order();

-- ── 2. Status change -> notify the customer ──────────────────────────
create or replace function public.notify_customer_order_status_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid;
  v_business_id uuid;
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

  select name into v_business_name from public.businesses where id = v_business_id;
  v_reference := upper(left(NEW.order_id::text, 8));

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

drop trigger if exists trg_notify_customer_order_status_change on public.shop_order_status_history;
create trigger trg_notify_customer_order_status_change
  after insert on public.shop_order_status_history
  for each row execute function public.notify_customer_order_status_change();
