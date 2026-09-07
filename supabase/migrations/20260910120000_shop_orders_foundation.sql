-- ============================================================
-- PaMarket — Shop Cart / Order-Request Feature, Stage 1: secure
-- database foundation and server-side order logic only.
--
-- Scope (per Stage 1 spec): opt-in `listings.is_orderable` flag, the
-- shop_orders / shop_order_items / shop_order_status_history tables,
-- the create_shop_order + update_shop_order_status RPCs, RLS, and
-- rate-limit protections. No mobile/website/WhatsApp/admin UI, no
-- online payment processing — first version is an order *request*
-- the shop owner confirms manually.
--
-- Reuses existing patterns confirmed live before writing this file:
--   - public.is_admin() for admin authorization (unchanged).
--   - the moderation_settings key/int_value table for configurable
--     rate limits (same table enforce_message_rate_limit() reads).
--   - the create_job_listing() RPC shape: SECURITY DEFINER, fixed
--     search_path, jsonb {ok, code, msg, ...} returns, an advisory
--     xact lock to serialize concurrent calls from the same user,
--     EXECUTE revoked from PUBLIC/anon and granted only to
--     authenticated + service_role.
--   - the enforce_job_insert_via_rpc() trigger shape for making a
--     table effectively RPC-only while RLS stays enabled.
--   - listings.business_id already uses `ON DELETE SET NULL` — the
--     same non-destructive convention is used here for
--     shop_order_items.listing_id.
--
-- Confirmed live before writing this migration (do not re-derive):
--   - listings.status is constrained to exactly:
--     'pending','active','paused','under_review','flagged','sold',
--     'removed','deleted' (listings_status_check). Only 'active' is
--     currently populated, but the others are valid and must not be
--     assumed away.
--   - businesses.status is currently 'active' or 'pending_activation'
--     live; "verified" everywhere else in the app (mobile + website +
--     prerender) means verification_level >= 2. Only businesses with
--     status='active' AND verification_level>=2 may be ordered from.
--   - listings has no pre-existing orderable/buyable/product-type
--     column, and there is no pre-existing order/cart table — this is
--     new, not a duplicate of something that already exists.
--   - business_staff exists (role manager/staff, status
--     invited/active/removed) but is NOT wired into any existing
--     listings/businesses write RLS (those check owner_user_id /
--     seller_id only). To stay consistent with that precedent, shop
--     order authorization below is owner_user_id-only, not
--     business_staff-inclusive. Flagged in the Stage 1 report as a
--     possible future enhancement, not assumed here.
-- Safe to run more than once.
-- ============================================================

-- ── Phase 2: opt-in orderable flag on listings ──────────────────
-- Every existing listing defaults to false and is never auto-enabled.
-- Only the existing "listings: update own" RLS policy (auth.uid() =
-- seller_id) can ever change it, so only the listing's own owner can
-- ever set it — a customer has no write path to this column at all.
alter table public.listings
  add column if not exists is_orderable boolean not null default false;

comment on column public.listings.is_orderable is
  'Opt-in flag: true only for listings the shop owner has explicitly marked as orderable through the shop cart feature. Default false for all existing and new listings. Full eligibility (active status, positive price, verified+active business) is re-checked server-side at order time by create_shop_order — this flag alone does not guarantee a listing is currently orderable.';

-- A listing not tied to any business can never be orderable — shop
-- orders are scoped to a single verified business by definition.
create or replace function public.enforce_listing_orderable_requires_business()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.is_orderable and new.business_id is null then
    raise exception 'LISTING_ORDERABLE_REQUIRES_BUSINESS: a listing must belong to a business before it can be marked orderable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_listing_orderable_requires_business on public.listings;
create trigger trg_listing_orderable_requires_business
  before insert or update of is_orderable, business_id on public.listings
  for each row execute function public.enforce_listing_orderable_requires_business();

-- ── Phase 3: order tables ───────────────────────────────────────

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending','confirmed','declined','preparing','ready','completed','cancelled')),
  fulfillment_method text not null
    check (fulfillment_method in ('collection','delivery')),
  delivery_address text,
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_note text,
  item_count integer not null check (item_count > 0),
  total numeric(12,2) not null check (total >= 0),
  currency text not null default 'USD',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One customer can never have two orders created from the same
  -- checkout attempt (network retry / double-tap safe).
  constraint shop_orders_customer_idempotency_unique unique (customer_id, idempotency_key)
);
create index if not exists shop_orders_business_idx on public.shop_orders (business_id, created_at desc);
create index if not exists shop_orders_customer_idx on public.shop_orders (customer_id, created_at desc);

drop trigger if exists shop_orders_set_updated_at on public.shop_orders;
create trigger shop_orders_set_updated_at
  before update on public.shop_orders
  for each row execute function public.set_updated_at();

-- Delivery address is required only when fulfillment is delivery;
-- collection orders never need one. Enforced at insert/update rather
-- than duplicated across every caller.
alter table public.shop_orders drop constraint if exists shop_orders_delivery_address_required;
alter table public.shop_orders add constraint shop_orders_delivery_address_required
  check (fulfillment_method <> 'delivery' or coalesce(length(trim(delivery_address)), 0) > 0);

create table if not exists public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  -- Never cascades from the listing: a listing can be edited or
  -- deleted long after an order is placed, but the order's own
  -- history (what was actually bought) must survive untouched.
  listing_id uuid references public.listings(id) on delete set null,
  title_snapshot text not null,
  -- A stable image path/public reference (e.g. the storage object
  -- path or a durable public URL), never a temporary signed URL that
  -- would expire and break historical order records.
  image_snapshot text,
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot >= 0),
  currency_snapshot text not null,
  quantity integer not null check (quantity > 0),
  subtotal_snapshot numeric(12,2) not null check (subtotal_snapshot >= 0),
  created_at timestamptz not null default now()
);
create index if not exists shop_order_items_order_idx on public.shop_order_items (order_id);
create index if not exists shop_order_items_listing_idx on public.shop_order_items (listing_id);

create table if not exists public.shop_order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  status text not null
    check (status in ('pending','confirmed','declined','preparing','ready','completed','cancelled')),
  note text,
  changed_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists shop_order_status_history_order_idx on public.shop_order_status_history (order_id, created_at);

-- ── Phase 8 note: existing-data safety ───────────────────────────
-- The is_orderable column above was added with `not null default
-- false`, so every one of the 74 currently-live listings becomes
-- non-orderable the instant the column exists — no backfill UPDATE
-- is needed or run. No existing row in listings/businesses/
-- conversations/notifications is touched by this migration.

-- ── Phase 6: Row Level Security ──────────────────────────────────
-- Supabase's default privileges grant anon/authenticated full table
-- privileges on any new public table (confirmed live via
-- pg_default_acl) — so every grant below is deliberately explicit,
-- not incremental. Anon gets nothing on any of the three tables.
-- authenticated gets SELECT only: all writes go through the
-- SECURITY DEFINER RPCs below, which run as the table owner and so
-- are not blocked by these RLS policies.

alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;
alter table public.shop_order_status_history enable row level security;

revoke all on table public.shop_orders from anon, authenticated;
revoke all on table public.shop_order_items from anon, authenticated;
revoke all on table public.shop_order_status_history from anon, authenticated;
grant select on table public.shop_orders to authenticated;
grant select on table public.shop_order_items to authenticated;
grant select on table public.shop_order_status_history to authenticated;

drop policy if exists "shop_orders: customer or owner or admin read" on public.shop_orders;
create policy "shop_orders: customer or owner or admin read"
  on public.shop_orders for select to authenticated
  using (
    customer_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = shop_orders.business_id and b.owner_user_id = auth.uid())
    or public.is_admin()
  );
-- No insert/update/delete policy on shop_orders for authenticated:
-- combined with the revoked table grants above, this makes the table
-- read-only to every client. All writes must go through
-- create_shop_order / update_shop_order_status.

drop policy if exists "shop_order_items: customer or owner or admin read" on public.shop_order_items;
create policy "shop_order_items: customer or owner or admin read"
  on public.shop_order_items for select to authenticated
  using (
    exists (
      select 1 from public.shop_orders o
      left join public.businesses b on b.id = o.business_id
      where o.id = shop_order_items.order_id
        and (o.customer_id = auth.uid() or b.owner_user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "shop_order_status_history: customer or owner or admin read" on public.shop_order_status_history;
create policy "shop_order_status_history: customer or owner or admin read"
  on public.shop_order_status_history for select to authenticated
  using (
    exists (
      select 1 from public.shop_orders o
      left join public.businesses b on b.id = o.business_id
      where o.id = shop_order_status_history.order_id
        and (o.customer_id = auth.uid() or b.owner_user_id = auth.uid() or public.is_admin())
    )
  );

-- ── Phase 7: rate-limit configuration ────────────────────────────
-- Same moderation_settings key/int_value table the messaging and
-- listing rate limiters already read, so these are runtime-tunable
-- from the same place without a further migration.
insert into public.moderation_settings (key, int_value) values
  ('max_shop_orders_per_hour', 10),
  ('max_shop_order_items_per_order', 30),
  ('max_quantity_per_shop_order_item', 20)
on conflict (key) do nothing;

-- ── Phase 4: create_shop_order RPC ───────────────────────────────
create or replace function public.create_shop_order(
  p_business_id uuid,
  p_items jsonb, -- [{"listing_id": "...", "quantity": 2}, ...]
  p_fulfillment_method text,
  p_customer_name text,
  p_customer_phone text,
  p_idempotency_key text,
  p_delivery_address text default null,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_existing record;
  v_business record;
  v_item jsonb;
  v_listing record;
  v_listing_id uuid;
  v_quantity integer;
  v_line_subtotal numeric(12,2);
  v_order_id uuid;
  v_order_currency text;
  v_item_count integer := 0;
  v_total numeric(12,2) := 0;
  v_snapshot_items jsonb := '[]'::jsonb;
  v_max_items int;
  v_max_qty int;
  v_max_per_hour int;
  v_recent_count int;
  v_seen_listing_ids uuid[] := '{}'::uuid[];
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated', 'msg', 'Please sign in again.');
  end if;

  if p_fulfillment_method not in ('collection','delivery') then
    return jsonb_build_object('ok', false, 'code', 'invalid_fulfillment_method', 'msg', 'Choose collection or delivery.');
  end if;

  if p_fulfillment_method = 'delivery' and coalesce(length(trim(p_delivery_address)), 0) = 0 then
    return jsonb_build_object('ok', false, 'code', 'delivery_address_required', 'msg', 'A delivery address is required for delivery orders.');
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'missing_idempotency_key', 'msg', 'Missing request key.');
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'code', 'empty_order', 'msg', 'Add at least one item to your order.');
  end if;

  -- Serialize concurrent submits from the same customer so two
  -- in-flight requests cannot both slip past the rate-limit count or
  -- both win a race on the same idempotency key.
  perform pg_advisory_xact_lock(hashtext('create_shop_order:' || v_uid::text));

  -- Idempotent replay: a retried/double-submitted request with the
  -- same key returns the order that already exists instead of ever
  -- creating a second one.
  select id, status, total, currency, item_count into v_existing
  from public.shop_orders
  where customer_id = v_uid and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'ok', true, 'code', 'idempotent_replay',
      'order_id', v_existing.id, 'status', v_existing.status,
      'total', v_existing.total, 'currency', v_existing.currency,
      'item_count', v_existing.item_count
    );
  end if;

  select int_value into v_max_per_hour from public.moderation_settings where key = 'max_shop_orders_per_hour';
  if v_max_per_hour is null then v_max_per_hour := 10; end if;
  if v_max_per_hour > 0 then
    select count(*) into v_recent_count
    from public.shop_orders
    where customer_id = v_uid and created_at > now() - interval '1 hour';
    if v_recent_count >= v_max_per_hour then
      return jsonb_build_object('ok', false, 'code', 'rate_limited', 'msg', 'Too many orders placed recently. Please try again later.');
    end if;
  end if;

  select int_value into v_max_items from public.moderation_settings where key = 'max_shop_order_items_per_order';
  if v_max_items is null then v_max_items := 30; end if;
  if jsonb_array_length(p_items) > v_max_items then
    return jsonb_build_object('ok', false, 'code', 'too_many_items', 'msg', 'This order has too many line items.');
  end if;

  select int_value into v_max_qty from public.moderation_settings where key = 'max_quantity_per_shop_order_item';
  if v_max_qty is null then v_max_qty := 20; end if;

  -- Business must exist, be active, and be verified (verification_level
  -- >= 2 — the same threshold used everywhere else in the app to show
  -- the verified badge / gate business-only surfaces).
  select id, status, verification_level into v_business
  from public.businesses
  where id = p_business_id
  for update;

  if not found or v_business.status <> 'active' or coalesce(v_business.verification_level, 0) < 2 then
    return jsonb_build_object('ok', false, 'code', 'shop_unavailable', 'msg', 'This shop is not currently accepting orders.');
  end if;

  -- Re-read and validate every listing server-side. All client-
  -- provided price/title/total values are ignored entirely — only
  -- listing_id and quantity are taken from the client.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item -> 'listing_id') is distinct from 'string' then
      return jsonb_build_object('ok', false, 'code', 'invalid_item', 'msg', 'One of the items in this order is invalid.');
    end if;

    begin
      v_listing_id := (v_item ->> 'listing_id')::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'code', 'invalid_item', 'msg', 'One of the items in this order is invalid.');
    end;

    if v_listing_id = any(v_seen_listing_ids) then
      return jsonb_build_object('ok', false, 'code', 'duplicate_item', 'msg', 'The same item was listed twice — combine the quantity instead.');
    end if;
    v_seen_listing_ids := v_seen_listing_ids || v_listing_id;

    if jsonb_typeof(v_item -> 'quantity') is distinct from 'number'
       or (v_item ->> 'quantity') !~ '^[0-9]+$' then
      return jsonb_build_object('ok', false, 'code', 'invalid_quantity', 'msg', 'Quantity must be a whole number.');
    end if;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_quantity <= 0 then
      return jsonb_build_object('ok', false, 'code', 'invalid_quantity', 'msg', 'Quantity must be at least 1.');
    end if;
    if v_quantity > v_max_qty then
      return jsonb_build_object('ok', false, 'code', 'quantity_too_high', 'msg', 'Quantity is too high for one order.');
    end if;

    -- Lock the row for the duration of this order so a concurrent
    -- owner edit (disabling is_orderable, changing price) cannot race
    -- with this checkout.
    select id, business_id, status, is_orderable, price, currency, title, photos
    into v_listing
    from public.listings
    where id = v_listing_id
    for update;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'listing_not_found', 'msg', 'One of the items in your order is no longer available.');
    end if;
    if v_listing.business_id is distinct from p_business_id then
      -- One order may only contain products from a single shop.
      return jsonb_build_object('ok', false, 'code', 'mixed_shop_order', 'msg', 'An order can only contain items from one shop.');
    end if;
    if v_listing.status <> 'active' or not v_listing.is_orderable then
      return jsonb_build_object('ok', false, 'code', 'listing_not_orderable', 'msg', 'One of the items in your order is no longer available.');
    end if;
    if v_listing.price is null or v_listing.price <= 0 then
      return jsonb_build_object('ok', false, 'code', 'listing_not_orderable', 'msg', 'One of the items in your order is no longer available.');
    end if;

    v_line_subtotal := round(v_listing.price * v_quantity, 2);
    v_total := v_total + v_line_subtotal;
    v_item_count := v_item_count + v_quantity;
    v_order_currency := coalesce(v_listing.currency, 'USD');

    -- Collected, not inserted yet: shop_order_items.order_id is a
    -- foreign key into shop_orders, which does not have a row yet.
    -- The snapshot rows are bulk-inserted only after the parent order
    -- row exists below, so this whole function creates order + items
    -- + history atomically with no dangling foreign key at any point.
    v_snapshot_items := v_snapshot_items || jsonb_build_object(
      'listing_id', v_listing.id,
      'title_snapshot', v_listing.title,
      'image_snapshot', case when v_listing.photos is not null and array_length(v_listing.photos, 1) > 0 then v_listing.photos[1] else null end,
      'unit_price_snapshot', v_listing.price,
      'currency_snapshot', v_order_currency,
      'quantity', v_quantity,
      'subtotal_snapshot', v_line_subtotal
    );
  end loop;

  v_order_id := gen_random_uuid();

  insert into public.shop_orders (
    id, business_id, customer_id, status, fulfillment_method, delivery_address,
    customer_name, customer_phone, customer_note, item_count, total, currency, idempotency_key
  ) values (
    v_order_id, p_business_id, v_uid, 'pending', p_fulfillment_method, p_delivery_address,
    coalesce(p_customer_name, ''), coalesce(p_customer_phone, ''), p_customer_note,
    v_item_count, v_total, coalesce(v_order_currency, 'USD'),
    p_idempotency_key
  );

  insert into public.shop_order_items (
    id, order_id, listing_id, title_snapshot, image_snapshot,
    unit_price_snapshot, currency_snapshot, quantity, subtotal_snapshot
  )
  select
    gen_random_uuid(), v_order_id,
    (i ->> 'listing_id')::uuid, i ->> 'title_snapshot', i ->> 'image_snapshot',
    (i ->> 'unit_price_snapshot')::numeric, i ->> 'currency_snapshot',
    (i ->> 'quantity')::integer, (i ->> 'subtotal_snapshot')::numeric
  from jsonb_array_elements(v_snapshot_items) as i;

  insert into public.shop_order_status_history (order_id, status, note, changed_by)
  values (v_order_id, 'pending', 'Order placed.', v_uid);

  return jsonb_build_object(
    'ok', true, 'order_id', v_order_id, 'status', 'pending',
    'total', v_total, 'currency', coalesce((select currency from public.shop_orders where id = v_order_id), 'USD'),
    'item_count', v_item_count
  );
exception
  when unique_violation then
    -- Two concurrent requests with the same idempotency key: the
    -- advisory lock above makes this very unlikely, but if it still
    -- happens, return the row the other request created rather than
    -- surfacing a raw constraint error.
    select id, status, total, currency, item_count into v_existing
    from public.shop_orders
    where customer_id = v_uid and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'ok', true, 'code', 'idempotent_replay',
        'order_id', v_existing.id, 'status', v_existing.status,
        'total', v_existing.total, 'currency', v_existing.currency,
        'item_count', v_existing.item_count
      );
    end if;
    return jsonb_build_object('ok', false, 'code', 'duplicate_request', 'msg', 'This order was already submitted.');
  when others then
    return jsonb_build_object('ok', false, 'code', 'order_failed', 'msg', 'Could not place this order. Please try again.');
end;
$function$;

revoke all on function public.create_shop_order(uuid, jsonb, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_shop_order(uuid, jsonb, text, text, text, text, text, text) to authenticated, service_role;

-- ── Phase 5: update_shop_order_status RPC ────────────────────────
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
  v_valid_transition boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated', 'msg', 'Please sign in again.');
  end if;

  if p_new_status not in ('pending','confirmed','declined','preparing','ready','completed','cancelled') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status', 'msg', 'That is not a valid order status.');
  end if;

  select o.id, o.business_id, o.status into v_order
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

  -- Customers are deliberately excluded: only the shop owner or an
  -- administrator may change order status in this stage.
  if not (v_is_owner or v_is_admin) then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'msg', 'You are not allowed to update this order.');
  end if;

  if v_is_admin and not v_is_owner then
    -- Administrators may make any transition, including correcting a
    -- final status, per the business rule that only an admin may
    -- change an order once it has reached a final state.
    v_valid_transition := true;
  else
    v_valid_transition := (v_order.status, p_new_status) in (
      ('pending','confirmed'), ('pending','declined'), ('pending','cancelled'),
      ('confirmed','preparing'), ('confirmed','cancelled'),
      ('preparing','ready'), ('preparing','cancelled'),
      ('ready','completed')
    );
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

revoke all on function public.update_shop_order_status(uuid, text, text) from public, anon;
grant execute on function public.update_shop_order_status(uuid, text, text) to authenticated, service_role;
