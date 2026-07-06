// verify-play-subscription — server-side verification of a Google Play
// Billing subscription purchase (business plan upgrades: shop_starter_*,
// shop_pro_*, shop_premium_*), then activates the plan only after Google
// confirms the subscription is real and active. This replaces the
// WhatsApp + admin "mark paid" upgrade flow entirely — the client never
// grants its own entitlement.
//
// Call shape: POST { businessId: uuid, productId: string, purchaseToken: string }
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
// an 'active' family (shop subscriptions — fully implemented below), a
// 'planned' family (e.g. recruiter_monthly — documented in the catalogue,
// no backend yet), or is genuinely 'unknown' (typo / garbage input).
// PRODUCT_MAP itself only ever contains 'active' shop-subscription entries.
import { SUBSCRIPTION_PRODUCTS as PRODUCT_MAP, getProductStatus } from '../_shared/billing-products.ts';

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
    const purchaseToken = body?.purchaseToken;

    if (!businessId || !productId || !purchaseToken) {
      return json({ error: 'businessId, productId, and purchaseToken are required' }, 400);
    }

    const productStatus = getProductStatus(productId);
    if (productStatus === 'planned') {
      // Recognized product (e.g. a recruiter_* id) whose backend doesn't
      // exist yet — a clean, explicit "not implemented" response rather
      // than a generic error. Never throws, never touches play_subscriptions,
      // and does not affect the shop-subscription path below at all.
      return json({ ok: false, notImplemented: true, error: 'This product is not available for purchase yet.' }, 501);
    }
    if (productStatus === 'unknown') {
      return json({ error: 'Unknown productId: ' + productId }, 400);
    }
    const mapped = PRODUCT_MAP[productId];
    if (!mapped) return json({ error: 'Unknown productId: ' + productId }, 400);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Caller must own the business they're upgrading.
    const bizRes = await db.from('businesses').select('id, owner_user_id').eq('id', businessId).maybeSingle();
    if (bizRes.error || !bizRes.data) return json({ error: 'Business not found' }, 404);
    if (bizRes.data.owner_user_id !== userId) return json({ error: 'You do not own this business' }, 403);

    // Idempotency: a token already processed is never re-verified.
    const existing = await db.from('play_subscriptions').select('id, status, subscription_state, expiry_time').eq('purchase_token', purchaseToken).maybeSingle();
    if (existing.error) {
      console.error('verify-play-subscription: existing-token lookup failed:', existing.error.message);
      return json({ error: 'Could not check purchase history: ' + existing.error.message }, 500);
    }
    let rowId: string;
    if (existing.data) {
      rowId = existing.data.id;
      if (existing.data.status === 'verified') {
        const activateRes = await db.rpc('activate_play_subscription', { p_play_subscription_id: rowId });
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
      const insertRes = await db.from('play_subscriptions').insert({
        business_id: businessId,
        user_id: userId,
        product_id: productId,
        purchase_token: purchaseToken,
        plan_id: mapped.planId,
        billing_cycle: mapped.cycle,
        status: 'pending',
      }).select('id').single();
      if (insertRes.error || !insertRes.data) {
        if (String(insertRes.error?.message || '').includes('uq_play_subscription_token')) {
          return json({ ok: true, already_processed: true });
        }
        return json({ error: 'Could not record subscription: ' + insertRes.error?.message }, 500);
      }
      rowId = insertRes.data.id;
    }

    const saEnv = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
    const packageName = Deno.env.get('ANDROID_PACKAGE_NAME');
    if (!saEnv || !packageName) {
      const failRes = await db.from('play_subscriptions').update({ status: 'failed', verification_error: 'Server misconfigured' }).eq('id', rowId);
      if (failRes.error) console.error('verify-play-subscription: failed to record "Server misconfigured" status:', failRes.error.message);
      return json({ error: 'Server misconfigured' }, 500);
    }

    let accessToken: string;
    try {
      accessToken = await getGoogleAccessToken(JSON.parse(saEnv));
    } catch (e) {
      const failRes = await db.from('play_subscriptions').update({ status: 'failed', verification_error: 'Google auth failed: ' + (e as Error).message }).eq('id', rowId);
      if (failRes.error) console.error('verify-play-subscription: failed to record "Google auth failed" status:', failRes.error.message);
      return json({ error: 'Verification unavailable' }, 500);
    }

    const sub = await fetchSubscriptionV2(packageName, purchaseToken, accessToken);
    if (!sub.ok) {
      const failRes = await db.from('play_subscriptions').update({ status: 'failed', verification_error: sub.reason }).eq('id', rowId);
      if (failRes.error) console.error('verify-play-subscription: failed to record verification-failure status:', failRes.error.message);
      return json({ error: 'Subscription verification failed: ' + sub.reason }, 402);
    }
    if (sub.productId && sub.productId !== productId) {
      const failRes = await db.from('play_subscriptions').update({ status: 'failed', verification_error: 'Product mismatch: expected ' + productId + ', got ' + sub.productId }).eq('id', rowId);
      if (failRes.error) console.error('verify-play-subscription: failed to record product-mismatch status:', failRes.error.message);
      return json({ error: 'Product mismatch' }, 402);
    }

    const verifiedRes = await db.from('play_subscriptions').update({
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

    const activateRes = await db.rpc('activate_play_subscription', { p_play_subscription_id: rowId });
    if (activateRes.error || activateRes.data?.ok !== true) {
      console.error('verify-play-subscription: activation failed:', activateRes.error?.message || activateRes.data?.msg);
      return json({ error: 'Subscription verified but activation failed: ' + (activateRes.error?.message || activateRes.data?.msg || 'unknown error') }, 500);
    }

    return json({ ok: true, ...activateRes.data });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
