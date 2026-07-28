// verify-apple-subscription — server-side verification of an App Store
// subscription purchase/upgrade, then activates the plan only after Apple
// confirms the subscription is real and active. Exact iOS counterpart of
// verify-play-subscription — same two families sharing this function (shop
// plans → businesses, keyed by businessId; recruiter plans → recruiter_
// profiles, keyed by the caller's own user id), same tables, same activation
// RPCs. Only the verification mechanism differs.
//
// Call shape: POST { businessId?: uuid, productId: string, purchaseToken: string }
// `purchaseToken` here is the subscription's stable originalTransactionId
// (see lib/iap.ts) — NOT the per-renewal transactionId, since that's what
// lets this row be found again later by apple-notifications-webhook when a
// renewal/cancellation event references the same subscription.
// Auth: caller must be a signed-in user (their own JWT, not service-role).
//
// This function handles the INITIAL purchase/upgrade moment. Ongoing
// lifecycle changes (renewal, cancellation, billing retry, grace period,
// revocation) that happen on Apple's own schedule are handled by the
// separate apple-notifications-webhook function via App Store Server
// Notifications V2. Both funnel into the same activate_play_subscription /
// activate_recruiter_subscription RPCs used by the Play flow, so entitlement
// logic lives in one place regardless of platform.
//
// Required Edge Function secrets: see supabase/functions/_shared/apple-iap.ts

import { SUBSCRIPTION_PRODUCTS, RECRUITER_SUBSCRIPTION_PRODUCTS, getProductStatus } from '../_shared/billing-products.ts';
import { fetchAppleSubscriptionStatus } from '../_shared/apple-iap.ts';

const ALLOWED_ORIGINS = new Set([
  'https://pamarketzw.com',
  'https://www.pamarketzw.com',
  'https://localhost',
  'capacitor://localhost',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://pamarketzw.com';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (d: unknown, s?: number) =>
    new Response(JSON.stringify(d), { status: s || 200, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

    const authHeader = req.headers.get('Authorization') || '';
    const userJwt = authHeader.replace('Bearer ', '').trim();
    if (!userJwt) return json({ error: 'Missing authorization' }, 401);

    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const authResult = await authClient.auth.getUser(userJwt);
    if (authResult.error || !authResult.data?.user) return json({ error: 'Invalid token' }, 401);
    const userId = authResult.data.user.id;

    const body = await req.json();
    const businessId = body?.businessId;
    const productId = body?.productId;
    const purchaseToken = body?.purchaseToken; // originalTransactionId

    if (!productId || !purchaseToken) {
      return json({ error: 'productId and purchaseToken are required' }, 400);
    }

    const productStatus = getProductStatus(productId);
    if (productStatus === 'planned') {
      return json({ ok: false, notImplemented: true, error: 'This product is not available for purchase yet.' }, 501);
    }
    if (productStatus === 'unknown') {
      return json({ error: 'Unknown productId: ' + productId }, 400);
    }

    const isRecruiter = productId in RECRUITER_SUBSCRIPTION_PRODUCTS;
    const mapped = isRecruiter ? RECRUITER_SUBSCRIPTION_PRODUCTS[productId] : SUBSCRIPTION_PRODUCTS[productId];
    if (!mapped) return json({ error: 'Unknown productId: ' + productId }, 400);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const table = isRecruiter ? 'play_recruiter_subscriptions' : 'play_subscriptions';
    const activateFn = isRecruiter ? 'activate_recruiter_subscription' : 'activate_play_subscription';
    const activateParam = isRecruiter ? 'p_play_recruiter_subscription_id' : 'p_play_subscription_id';

    let targetId: string;
    if (isRecruiter) {
      const profRes = await db.rpc('get_or_create_recruiter_profile', { p_user_id: userId });
      if (profRes.error || !profRes.data) {
        return json({ error: 'Could not resolve recruiter profile: ' + (profRes.error?.message || 'unknown error') }, 500);
      }
      targetId = profRes.data as string;
    } else {
      if (!businessId) return json({ error: 'businessId is required for a shop subscription purchase' }, 400);
      const bizRes = await db.from('businesses').select('id, owner_user_id').eq('id', businessId).maybeSingle();
      if (bizRes.error || !bizRes.data) return json({ error: 'Business not found' }, 404);
      if (bizRes.data.owner_user_id !== userId) return json({ error: 'You do not own this business' }, 403);
      targetId = businessId;
    }
    const targetColumn = isRecruiter ? 'recruiter_id' : 'business_id';

    const existing = await db.from(table).select('id, status, subscription_state, expiry_time, user_id').eq('purchase_token', purchaseToken).maybeSingle();
    if (existing.error) {
      console.error('verify-apple-subscription: existing-token lookup failed:', existing.error.message);
      return json({ error: 'Could not check purchase history: ' + existing.error.message }, 500);
    }
    if (existing.data && existing.data.user_id !== userId) {
      return json({ error: 'This purchase belongs to a different account' }, 403);
    }
    let rowId: string;
    if (existing.data) {
      rowId = existing.data.id;
      if (existing.data.status === 'verified') {
        const activateRes = await db.rpc(activateFn, { [activateParam]: rowId });
        if (activateRes.error || activateRes.data?.ok !== true) {
          console.error('verify-apple-subscription: activation failed (retry branch):', activateRes.error?.message || activateRes.data?.msg);
          return json({ error: 'Activation failed: ' + (activateRes.error?.message || activateRes.data?.msg || 'unknown error') }, 500);
        }
        return json({ ok: true, ...activateRes.data });
      }
    } else {
      const insertRes = await db.from(table).insert({
        [targetColumn]: targetId,
        user_id: userId,
        product_id: productId,
        purchase_token: purchaseToken,
        plan_id: mapped.planId,
        billing_cycle: mapped.cycle,
        status: 'pending',
        platform: 'ios',
      }).select('id').single();
      if (insertRes.error || !insertRes.data) {
        if (String(insertRes.error?.message || '').includes('unique') || String(insertRes.error?.message || '').includes('uq_play_subscription_token') || String(insertRes.error?.message || '').includes('uq_play_recruiter_subscription_token')) {
          return json({ ok: true, already_processed: true });
        }
        return json({ error: 'Could not record subscription: ' + insertRes.error?.message }, 500);
      }
      rowId = insertRes.data.id;
    }

    const sub = await fetchAppleSubscriptionStatus(purchaseToken);
    if (!sub.ok) {
      const failRes = await db.from(table).update({ status: 'failed', verification_error: sub.reason }).eq('id', rowId);
      if (failRes.error) console.error('verify-apple-subscription: failed to record verification-failure status:', failRes.error.message);
      return json({ error: 'Subscription verification failed: ' + sub.reason }, 402);
    }
    if (sub.productId && sub.productId !== productId) {
      const failRes = await db.from(table).update({ status: 'failed', verification_error: `Product mismatch: expected ${productId}, got ${sub.productId}` }).eq('id', rowId);
      if (failRes.error) console.error('verify-apple-subscription: failed to record product-mismatch status:', failRes.error.message);
      return json({ error: 'Product mismatch' }, 402);
    }

    const verifiedRes = await db.from(table).update({
      status: 'verified',
      subscription_state: sub.subscriptionState,
      auto_renewing: sub.autoRenewing,
      order_id: sub.transactionId || null,
      expiry_time: sub.expiryTime || null,
      verified_at: new Date().toISOString(),
    }).eq('id', rowId);
    if (verifiedRes.error) {
      console.error('verify-apple-subscription: failed to record verified status:', verifiedRes.error.message);
      return json({ error: 'Subscription verified with Apple but could not be recorded: ' + verifiedRes.error.message }, 500);
    }

    const activateRes = await db.rpc(activateFn, { [activateParam]: rowId });
    if (activateRes.error || activateRes.data?.ok !== true) {
      console.error('[BILLING_ALERT] verify-apple-subscription: verified-but-activation-failed:', activateRes.error?.message || activateRes.data?.msg);
      return json({ error: 'Subscription verified but activation failed: ' + (activateRes.error?.message || activateRes.data?.msg || 'unknown error') }, 500);
    }

    // No acknowledge step for Apple (that's a Play-only requirement) —
    // StoreKit purchases don't need a separate server-side acknowledgement
    // within a grace window the way Play subscriptions do.
    return json({ ok: true, ...activateRes.data });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
