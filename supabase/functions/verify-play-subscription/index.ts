// verify-play-subscription — server-side verification of a Google Play
// Billing subscription purchase, then activates the plan only after Google
// confirms the subscription is real and active. The client never grants its
// own entitlement. Handles TWO subscription families that share the same
// verify → activate mechanics but target different tables:
//   - Shop plan upgrades (shop_starter_*, shop_pro_*, shop_premium_*)
//     target `businesses`, keyed by the caller-supplied businessId.
//   - Recruiter plan upgrades (recruiter_*, recruiter_pro_*) target
//     `recruiter_profiles`, keyed by the CALLER'S OWN user id — there's no
//     separate recruiter-onboarding step, a profile is created lazily via
//     get_or_create_recruiter_profile on first purchase.
//
// Call shape: POST { businessId?: uuid, productId: string, purchaseToken: string }
// (businessId required only for shop-plan productIds; omitted for recruiter ones)
// Auth: caller must be a signed-in user (their own JWT, not service-role).
//
// This function handles the INITIAL purchase/upgrade moment (synchronous
// verification). Ongoing lifecycle changes (renewal, cancellation, billing
// retry, grace period, revocation) that happen on Google's own schedule —
// not at a moment this function is called — are handled by the separate
// play-rtdn-webhook function via Real-Time Developer Notifications. This
// function and the RTDN webhook both funnel into the same
// activate_play_subscription RPC, so entitlement logic lives in one place.
//
// Required Edge Function secrets (shared with verify-play-purchase):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
//   GOOGLE_PLAY_SERVICE_ACCOUNT, ANDROID_PACKAGE_NAME

// Product IDs come from the single shared catalogue — see the file header
// comment in _shared/billing-products.ts for why this can't be the exact
// same file the client (www/js/billing-products.js) loads. getProductStatus
// is the production-safety check: it tells us whether productId belongs to
// an 'active' family (shop + recruiter subscriptions — both fully
// implemented below), a 'planned' family (documented in the catalogue, no
// backend yet), or is genuinely 'unknown' (typo / garbage input). The
// product maps themselves only ever contain 'active' entries.
import { SUBSCRIPTION_PRODUCTS, RECRUITER_SUBSCRIPTION_PRODUCTS, getProductStatus } from '../_shared/billing-products.ts';

const ALLOWED_ORIGINS = new Set([
  'https://pamarketzw.com',
  'https://www.pamarketzw.com',
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

let _tokenCache: { value: string; exp: number } | null = null;

async function getGoogleAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (_tokenCache && _tokenCache.exp - 120 > now) return _tokenCache.value;

  const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa['client_email'],
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const sigInput = b64url(header) + '.' + b64url(payload);
  const pem = sa['private_key'].replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\n/g, '');
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput));
  const jwt = sigInput + '.' + btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt,
  });
  const tokenData = await res.json();
  if (!res.ok || !tokenData['access_token']) {
    throw new Error('Google auth failed (' + res.status + '): ' + JSON.stringify(tokenData));
  }
  const ttl = Number(tokenData['expires_in']) || 3600;
  _tokenCache = { value: tokenData['access_token'], exp: now + ttl };
  return _tokenCache.value;
}

// Maps the Play API's SUBSCRIPTION_STATE_* enum to our lowercase column values.
function mapSubscriptionState(raw: string): string {
  const m: Record<string, string> = {
    SUBSCRIPTION_STATE_PENDING: 'pending',
    SUBSCRIPTION_STATE_ACTIVE: 'active',
    SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'in_grace_period',
    SUBSCRIPTION_STATE_ON_HOLD: 'on_hold',
    SUBSCRIPTION_STATE_CANCELED: 'canceled',
    SUBSCRIPTION_STATE_EXPIRED: 'expired',
    SUBSCRIPTION_STATE_PAUSED: 'paused',
  };
  return m[raw] || 'pending';
}

export async function fetchSubscriptionV2(packageName: string, purchaseToken: string, accessToken: string) {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false as const, reason: 'Google API error ' + res.status + ': ' + (body?.error?.message || JSON.stringify(body)) };
  }
  const lineItem = Array.isArray(body.lineItems) ? body.lineItems[0] : null;
  return {
    ok: true as const,
    subscriptionState: mapSubscriptionState(body.subscriptionState),
    productId: lineItem?.productId as string | undefined,
    expiryTime: lineItem?.expiryTime as string | undefined,
    autoRenewing: !!lineItem?.autoRenewingPlan?.autoRenewEnabled,
    latestOrderId: body.latestOrderId as string | undefined,
    startTime: body.startTime as string | undefined,
    acknowledged: body.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
  };
}

// Google requires every subscription purchase to be ACKNOWLEDGED within
// 3 days or it is automatically refunded and revoked — nothing else in the
// stack does this (the client never calls the plugin's acknowledgePurchase,
// and consuming only applies to one-time products), so the server must.
// Uses the v3 subscriptions (v1-style) acknowledge endpoint, which is still
// the only acknowledge call — subscriptionsv2 has no equivalent.
export async function acknowledgeSubscription(
  packageName: string, subscriptionProductId: string, purchaseToken: string, accessToken: string
): Promise<boolean> {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(subscriptionProductId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return res.ok;
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
    const purchaseToken = body?.purchaseToken;

    if (!productId || !purchaseToken) {
      return json({ error: 'productId and purchaseToken are required' }, 400);
    }

    const productStatus = getProductStatus(productId);
    if (productStatus === 'planned') {
      // Recognized product (e.g. a job_boost_* id) whose backend doesn't
      // exist yet — a clean, explicit "not implemented" response rather
      // than a generic error. Never throws, never touches any subscription
      // ledger, and does not affect the shop/recruiter paths below at all.
      return json({ ok: false, notImplemented: true, error: 'This product is not available for purchase yet.' }, 501);
    }
    if (productStatus === 'unknown') {
      return json({ error: 'Unknown productId: ' + productId }, 400);
    }

    // Two subscription families share this function today: shop plans
    // (target: businesses, keyed by businessId) and recruiter plans (target:
    // recruiter_profiles, keyed by the caller's own user id — a recruiter
    // profile is created lazily on first purchase, there's no separate
    // "recruiter onboarding" step the client has to complete first).
    const isRecruiter = productId in RECRUITER_SUBSCRIPTION_PRODUCTS;
    const mapped = isRecruiter ? RECRUITER_SUBSCRIPTION_PRODUCTS[productId] : SUBSCRIPTION_PRODUCTS[productId];
    if (!mapped) return json({ error: 'Unknown productId: ' + productId }, 400);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const table = isRecruiter ? 'play_recruiter_subscriptions' : 'play_subscriptions';
    const activateFn = isRecruiter ? 'activate_recruiter_subscription' : 'activate_play_subscription';
    const activateParam = isRecruiter ? 'p_play_recruiter_subscription_id' : 'p_play_subscription_id';

    let targetId: string; // businessId for shop plans, recruiter_profiles.id for recruiter plans
    if (isRecruiter) {
      const profRes = await db.rpc('get_or_create_recruiter_profile', { p_user_id: userId });
      if (profRes.error || !profRes.data) {
        return json({ error: 'Could not resolve recruiter profile: ' + (profRes.error?.message || 'unknown error') }, 500);
      }
      targetId = profRes.data as string;
    } else {
      if (!businessId) return json({ error: 'businessId is required for a shop subscription purchase' }, 400);
      // Caller must own the business they're upgrading.
      const bizRes = await db.from('businesses').select('id, owner_user_id').eq('id', businessId).maybeSingle();
      if (bizRes.error || !bizRes.data) return json({ error: 'Business not found' }, 404);
      if (bizRes.data.owner_user_id !== userId) return json({ error: 'You do not own this business' }, 403);
      targetId = businessId;
    }
    const targetColumn = isRecruiter ? 'recruiter_id' : 'business_id';

    // Idempotency: a token already processed is never re-verified.
    const existing = await db.from(table).select('id, status, subscription_state, expiry_time, user_id').eq('purchase_token', purchaseToken).maybeSingle();
    if (existing.error) {
      console.error('verify-play-subscription: existing-token lookup failed:', existing.error.message);
      return json({ error: 'Could not check purchase history: ' + existing.error.message }, 500);
    }
    if (existing.data && existing.data.user_id !== userId) {
      // A token already recorded for a DIFFERENT account must never be
      // retried/re-activated (or have its state disclosed) by this caller.
      return json({ error: 'This purchase belongs to a different account' }, 403);
    }
    let rowId: string;
    if (existing.data) {
      rowId = existing.data.id;
      if (existing.data.status === 'verified') {
        const activateRes = await db.rpc(activateFn, { [activateParam]: rowId });
        // Success requires BOTH no transport/DB error AND the RPC's own
        // jsonb payload saying ok:true — the RPC can resolve without
        // throwing and still report a business-logic failure (e.g. plan
        // conflict), which must never be reported to the caller as success.
        if (activateRes.error || activateRes.data?.ok !== true) {
          console.error('verify-play-subscription: activation failed (retry branch):', activateRes.error?.message || activateRes.data?.msg);
          return json({ error: 'Activation failed: ' + (activateRes.error?.message || activateRes.data?.msg || 'unknown error') }, 500);
        }
        return json({ ok: true, ...activateRes.data });
      }
      // status is 'pending' or 'failed' — fall through and re-verify.
    } else {
      const insertRes = await db.from(table).insert({
        [targetColumn]: targetId,
        user_id: userId,
        product_id: productId,
        purchase_token: purchaseToken,
        plan_id: mapped.planId,
        billing_cycle: mapped.cycle,
        status: 'pending',
      }).select('id').single();
      if (insertRes.error || !insertRes.data) {
        if (String(insertRes.error?.message || '').includes('uq_play_subscription_token') || String(insertRes.error?.message || '').includes('uq_play_recruiter_subscription_token')) {
          return json({ ok: true, already_processed: true });
        }
        return json({ error: 'Could not record subscription: ' + insertRes.error?.message }, 500);
      }
      rowId = insertRes.data.id;
    }

    const saEnv = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
    const packageName = Deno.env.get('ANDROID_PACKAGE_NAME');
    if (!saEnv || !packageName) {
      const failRes = await db.from(table).update({ status: 'failed', verification_error: 'Server misconfigured' }).eq('id', rowId);
      if (failRes.error) console.error('verify-play-subscription: failed to record "Server misconfigured" status:', failRes.error.message);
      return json({ error: 'Server misconfigured' }, 500);
    }

    let accessToken: string;
    try {
      accessToken = await getGoogleAccessToken(JSON.parse(saEnv));
    } catch (e) {
      const failRes = await db.from(table).update({ status: 'failed', verification_error: 'Google auth failed: ' + (e as Error).message }).eq('id', rowId);
      if (failRes.error) console.error('verify-play-subscription: failed to record "Google auth failed" status:', failRes.error.message);
      return json({ error: 'Verification unavailable' }, 500);
    }

    const sub = await fetchSubscriptionV2(packageName, purchaseToken, accessToken);
    if (!sub.ok) {
      const failRes = await db.from(table).update({ status: 'failed', verification_error: sub.reason }).eq('id', rowId);
      if (failRes.error) console.error('verify-play-subscription: failed to record verification-failure status:', failRes.error.message);
      return json({ error: 'Subscription verification failed: ' + sub.reason }, 402);
    }
    if (sub.productId && sub.productId !== productId) {
      const failRes = await db.from(table).update({ status: 'failed', verification_error: 'Product mismatch: expected ' + productId + ', got ' + sub.productId }).eq('id', rowId);
      if (failRes.error) console.error('verify-play-subscription: failed to record product-mismatch status:', failRes.error.message);
      return json({ error: 'Product mismatch' }, 402);
    }

    const verifiedRes = await db.from(table).update({
      status: 'verified',
      subscription_state: sub.subscriptionState,
      auto_renewing: sub.autoRenewing,
      order_id: sub.latestOrderId || null,
      purchase_time: sub.startTime ? new Date(sub.startTime).toISOString() : new Date().toISOString(),
      expiry_time: sub.expiryTime ? new Date(sub.expiryTime).toISOString() : null,
      verified_at: new Date().toISOString(),
    }).eq('id', rowId);
    if (verifiedRes.error) {
      // This is the row that governs the idempotent retry branch above (it
      // checks status==='verified') — if it never actually lands as
      // 'verified', a retry would re-run this whole verification instead of
      // fast-pathing to activation, which is safe but must not be silent.
      console.error('verify-play-subscription: failed to record verified status:', verifiedRes.error.message);
      return json({ error: 'Subscription verified with Google but could not be recorded: ' + verifiedRes.error.message }, 500);
    }

    const activateRes = await db.rpc(activateFn, { [activateParam]: rowId });
    if (activateRes.error || activateRes.data?.ok !== true) {
      console.error('verify-play-subscription: activation failed:', activateRes.error?.message || activateRes.data?.msg);
      return json({ error: 'Subscription verified but activation failed: ' + (activateRes.error?.message || activateRes.data?.msg || 'unknown error') }, 500);
    }

    // Acknowledge AFTER granting the entitlement (Play policy: only
    // acknowledge once you've delivered). Unacknowledged subscriptions are
    // auto-refunded by Google after 3 days. Retried once; if it still
    // fails, the RTDN webhook re-attempts on the next lifecycle event.
    if (sub.acknowledged === false) {
      let acked = await acknowledgeSubscription(packageName, sub.productId || productId, purchaseToken, accessToken).catch(() => false);
      if (!acked) {
        acked = await acknowledgeSubscription(packageName, sub.productId || productId, purchaseToken, accessToken).catch(() => false);
        if (!acked) console.error('verify-play-subscription: acknowledge failed twice for', productId, '— Google will auto-refund in 3 days unless the RTDN retry succeeds.');
      }
    }

    return json({ ok: true, ...activateRes.data });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
