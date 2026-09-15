// Batch 2: Commerce — Shop Orders, Ads & Boosts, Play Billing, Finance.
// Four real domains sharing one service module (not four separate
// architectures). Every mutation reuses an existing secure RPC
// (update_shop_order_status, admin_set_paid_ad_active,
// admin_pause_scheduled_paid_ad) or the one narrow admin-read policy added
// in this batch (paid_ads). No refund/void/reversal control is exposed —
// none exists server-side.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };
export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export const COMMERCE_PAGE_SIZE = 20;
export const SHOP_ORDER_STATUSES = ['pending', 'confirmed', 'declined', 'preparing', 'ready', 'completed', 'cancelled'] as const;

// ── Shop Orders ─────────────────────────────────────────────────────────

export type ShopOrderRow = {
  id: string; business_id: string | null; customer_id: string | null; status: string | null;
  fulfillment_method: string | null; customer_name: string | null; item_count: number | null;
  total: number | null; currency: string | null; created_at: string | null; updated_at: string | null;
};

export async function listShopOrders(status: string | undefined, page: number, pageSize = COMMERCE_PAGE_SIZE): Promise<QueryResult<Page<ShopOrderRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('shop_orders')
    .select('id, business_id, customer_id, status, fulfillment_method, customer_name, item_count, total, currency, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

export type ShopOrderDetail = ShopOrderRow & { delivery_address: string | null; customer_phone: string | null; customer_note: string | null };
export async function getShopOrder(id: string): Promise<QueryResult<ShopOrderDetail | null>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('shop_orders')
    .select('id, business_id, customer_id, status, fulfillment_method, delivery_address, customer_name, customer_phone, customer_note, item_count, total, currency, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? null, error: null };
}

export type ShopOrderItemRow = { id: string; title_snapshot: string | null; unit_price_snapshot: number | null; currency_snapshot: string | null; quantity: number | null; subtotal_snapshot: number | null };
export async function getShopOrderItems(orderId: string): Promise<QueryResult<ShopOrderItemRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('shop_order_items')
    .select('id, title_snapshot, unit_price_snapshot, currency_snapshot, quantity, subtotal_snapshot')
    .eq('order_id', orderId);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

export type ShopOrderHistoryRow = { id: string; status: string | null; note: string | null; created_at: string | null };
export async function getShopOrderHistory(orderId: string): Promise<QueryResult<ShopOrderHistoryRow[]>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client
    .from('shop_order_status_history')
    .select('id, status, note, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data ?? [], error: null };
}

/** Existing RPC (C2E-5): AAL2-required on the admin-override branch only —
 * never on owner/customer transitions, which this same RPC also serves. */
export async function updateShopOrderStatus(orderId: string, newStatus: string, note?: string): Promise<QueryResult<{ ok: boolean; msg?: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.rpc('update_shop_order_status', { p_order_id: orderId, p_new_status: newStatus, p_note: note ?? null });
  if (error) return { data: null, error: normalizeError(error) };
  const result = data as unknown as { ok: boolean; code?: string; msg?: string };
  if (!result?.ok) return { data: null, error: { code: result?.code ?? 'failed', message: result?.msg ?? 'Order status update failed.', retryable: false } };
  return { data: result, error: null };
}

// ── Ads & Boosts ────────────────────────────────────────────────────────

export type PaidAdRow = {
  id: string; ad_type: string | null; business_name: string | null; headline: string | null;
  target_cat: string | null; starts_at: string | null; ends_at: string | null; active: boolean | null;
  status: string | null; price_paid: number | null; impressions: number | null; clicks: number | null; created_at: string | null;
};

export async function listPaidAds(activeOnly: boolean | undefined, page: number, pageSize = COMMERCE_PAGE_SIZE): Promise<QueryResult<Page<PaidAdRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('paid_ads')
    .select('id, ad_type, business_name, headline, target_cat, starts_at, ends_at, active, status, price_paid, impressions, clicks, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (activeOnly !== undefined) query = query.eq('active', activeOnly);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}

/** Existing RPC (C2E-5): is_admin() + AAL2. */
export async function setPaidAdActive(id: string, active: boolean): Promise<QueryResult<{ id: string; active: boolean; status: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.rpc('admin_set_paid_ad_active', { p_ad_id: id, p_active: active });
  if (error) return { data: null, error: normalizeError(error) };
  const row = data?.[0];
  if (!row) return { data: null, error: { code: 'empty_response', message: 'No ad was returned.', retryable: false } };
  return { data: row, error: null };
}

/** Existing RPC (C2E-5): is_admin() + AAL2. Only valid for status='scheduled'. */
export async function pauseScheduledPaidAd(id: string): Promise<QueryResult<{ id: string; active: boolean; status: string }>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const { data, error } = await client.rpc('admin_pause_scheduled_paid_ad', { p_ad_id: id });
  if (error) return { data: null, error: normalizeError(error) };
  const row = data?.[0];
  if (!row) return { data: null, error: { code: 'empty_response', message: 'No ad was returned.', retryable: false } };
  return { data: row, error: null };
}

// ── Play Billing ────────────────────────────────────────────────────────
// purchase_token is never selected — sensitive receipt credential.

export type PlayPurchaseRow = { id: string; user_id: string | null; listing_id: string | null; product_id: string | null; status: string | null; platform: string | null; purchase_time: string | null; verified_at: string | null };
export async function listPlayPurchases(status: string | undefined, page: number, pageSize = COMMERCE_PAGE_SIZE): Promise<QueryResult<Page<PlayPurchaseRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('play_purchases')
    .select('id, user_id, listing_id, product_id, status, platform, purchase_time, verified_at', { count: 'exact' })
    .order('purchase_time', { ascending: false });
  if (status) query = query.eq('status', status);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}
// No refund/void RPC exists for play_purchases — none is exposed here.

// ── Finance ─────────────────────────────────────────────────────────────
// getRevenueSummary/getTopPayers now live in services/dashboard/query.ts
// only -- this file used to have its own byte-identical copies of both
// (found during the final production audit).

export type SubscriptionRow = { id: string; business_id: string | null; status: string | null; plan_id: string | null; billing_cycle: string | null; current_period_end: string | null; auto_renew: boolean | null };
export async function listSubscriptions(status: string | undefined, page: number, pageSize = COMMERCE_PAGE_SIZE): Promise<QueryResult<Page<SubscriptionRow>>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  let query = client
    .from('business_subscriptions')
    .select('id, business_id, status, plan_id, billing_cycle, current_period_end, auto_renew', { count: 'exact' })
    .order('current_period_end', { ascending: false });
  if (status) query = query.eq('status', status);
  const from = Math.max(0, page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { data: null, error: normalizeError(error) };
  return { data: { rows: data ?? [], total: count ?? 0, page: Math.max(1, page), pageSize }, error: null };
}
