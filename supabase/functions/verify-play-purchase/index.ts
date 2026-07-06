// verify-play-purchase — server-side verification of Google Play Billing
// CONSUMABLE purchases: listing boosts (boost_1day/7day/30day) and business
// featured-slot packs (featured_slot_pack_1/3). Activates the corresponding
// entitlement only after Google confirms the purchase is real and
// unconsumed. This is the ONLY code path that can boost a listing or grant
// extra featured slots via Play Billing — the client never grants its own
// entitlement. (Subscriptions are handled by the separate
// verify-play-subscription function, since Play models them very
// differently — recurring state, not a one-shot consumable.)
//
// Call shape (boost):     POST { listingId: uuid, productId: 'boost_1day'|'boost_7day'|'boost_30day', purchaseToken, orderId? }
// Call shape (slot pack): POST { businessId: uuid, productId: 'featured_slot_pack_1'|'featured_slot_pack_3', purchaseToken, orderId? }
// Auth: caller must be a signed-in user (their own JWT, not service-role).
//
// Flow (identical for both product families, just a different target table/RPC):
//   1. Authenticate the caller via their bearer token.
//   2. Reject if purchaseToken was already recorded (anti-replay, idempotency).
//   3. Insert a `pending` ledger row.
//   4. Call the Android Publisher API (purchases.products.get) with a
//      service-account-signed OAuth token to confirm the purchase server-side.
//   5. On success: mark `verified`, call the activation RPC (service-role,
//      not callable by the client) to atomically grant the entitlement.
//   6. On failure at any step: mark `failed` with the reason, never activate.
//
// Required Edge Function secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
//   GOOGLE_PLAY_SERVICE_ACCOUNT              (service-account JSON with
//                                              Android Publisher API access)
//   ANDROID_PACKAGE_NAME                     (e.g. com.pamarket.app)

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

// Product IDs come from the single shared catalogue — see the file header
// comment in _shared/billing-products.ts for why this can't be the exact
// same file the client (www/js/billing-products.js) loads. isActiveProductId
// is the production-safety check: it returns false for any 'planned' family
// (recruiter subs, job boosts/credits, rental featured slots), so a request
// naming one of those is rejected here even though this function's own
// BOOST_PRODUCTS/SLOT_PACK_PRODUCTS lookups below only ever contain 'active' entries.
import { BOOST_PRODUCTS, SLOT_PACK_PRODUCTS, getProductStatus } from '../_shared/billing-products.ts';

// ── Google OAuth (service account → Android Publisher API) ──────────────
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

// Verifies a consumable product purchase via the Android Publisher API.
// Returns the parsed purchase state so the caller can decide pass/fail.
async function verifyProductPurchase(
  packageName: string, productId: string, purchaseToken: string, accessToken: string
): Promise<{ ok: boolean; reason?: string; purchaseTimeMillis?: string; orderId?: string; purchaseState?: number; consumptionState?: number }> {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { ok: false, reason: 'Google API error ' + res.status + ': ' + (body?.error?.message || JSON.stringify(body)) };
  }

  // purchaseState: 0 = purchased, 1 = canceled, 2 = pending
  const purchaseState = body['purchaseState'];
  if (purchaseState !== 0) {
    return { ok: false, reason: 'Purchase not in a completed state (purchaseState=' + purchaseState + ')', purchaseState };
  }

  return {
    ok: true,
    purchaseTimeMillis: body['purchaseTimeMillis'],
    orderId: body['orderId'],
    purchaseState,
    consumptionState: body['consumptionState'],
  };
}

// Marks the purchase as consumed on Google's side so it can't be replayed
// as a "new" purchase and re-verified indefinitely.
async function consumeProductPurchase(
  packageName: string, productId: string, purchaseToken: string, accessToken: string
): Promise<boolean> {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:consume`;
  const res = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken } });
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

    // Anon-key client to authenticate the caller as themselves first —
    // never trust a client-supplied user_id in the request body.
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const authResult = await authClient.auth.getUser(userJwt);
    if (authResult.error || !authResult.data?.user) return json({ error: 'Invalid token' }, 401);
    const userId = authResult.data.user.id;

    const body = await req.json();
    const listingId = body?.listingId;
    const businessId = body?.businessId;
    const productId = body?.productId;
    const purchaseToken = body?.purchaseToken;
    const orderIdFromClient = body?.orderId || null;

    if (!productId || !purchaseToken) {
      return json({ error: 'productId and purchaseToken are required' }, 400);
    }
    const productStatus = getProductStatus(productId);
    if (productStatus === 'planned') {
      // Recognized product (e.g. a job_boost_* id) whose backend doesn't
      // exist yet — a clean, explicit "not implemented" response rather than
      // a generic error. Never throws, never touches any ledger table, and
      // does not affect the live boost/slot-pack paths below at all.
      return json({ ok: false, notImplemented: true, error: 'This product is not available for purchase yet.' }, 501);
    }
    if (productStatus === 'unknown') {
      return json({ error: 'Unknown productId: ' + productId }, 400);
    }

    // Service-role client for everything past this point — neither ledger
    // table has a client INSERT/UPDATE policy at all, and neither activation
    // RPC is granted to `authenticated`, so this Edge Function's own
    // elevated credential is the only way any of these writes can happen.
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const isBoost = productId in BOOST_PRODUCTS;
    const slotCount = SLOT_PACK_PRODUCTS[productId]?.extraSlots;
    if (!isBoost && !slotCount) return json({ error: 'Unknown productId: ' + productId }, 400);

    const table = isBoost ? 'play_purchases' : 'featured_slot_packs';
    const activateFn = isBoost ? 'activate_play_boost' : 'activate_featured_slot_pack';
    const activateParam = isBoost ? 'p_purchase_id' : 'p_pack_id';

    if (isBoost) {
      if (!listingId) return json({ error: 'listingId is required for a boost purchase' }, 400);
      const listingRes = await db.from('listings').select('id, seller_id').eq('id', listingId).maybeSingle();
      if (listingRes.error || !listingRes.data) return json({ error: 'Listing not found' }, 404);
      if (listingRes.data.seller_id !== userId) return json({ error: 'You do not own this listing' }, 403);
    } else {
      if (!businessId) return json({ error: 'businessId is required for a featured-slot-pack purchase' }, 400);
      const bizRes = await db.from('businesses').select('id, owner_user_id').eq('id', businessId).maybeSingle();
      if (bizRes.error || !bizRes.data) return json({ error: 'Business not found' }, 404);
      if (bizRes.data.owner_user_id !== userId) return json({ error: 'You do not own this business' }, 403);
    }

    // Anti-replay / idempotency: if this exact token was already processed,
    // never verify or activate again — just report the existing outcome.
    const existing = await db.from(table).select('id, status, expiry_time').eq('purchase_token', purchaseToken).maybeSingle();
    if (existing.error) {
      console.error('verify-play-purchase: existing-token lookup failed:', existing.error.message);
      return json({ error: 'Could not check purchase history: ' + existing.error.message }, 500);
    }
    if (existing.data) {
      if (existing.data.status === 'consumed') {
        return json({ ok: true, already_processed: true, until: existing.data.expiry_time || null });
      }
      if (existing.data.status === 'verified') {
        // Verified but not yet consumed (e.g. activation failed transiently
        // last time) — retry activation without re-verifying.
        const activateRes = await db.rpc(activateFn, { [activateParam]: existing.data.id });
        if (activateRes.error || !activateRes.data?.ok) {
          console.error('verify-play-purchase: activation failed (retry branch):', activateRes.error?.message || activateRes.data?.msg);
          return json({ error: 'Could not activate: ' + (activateRes.error?.message || activateRes.data?.msg) }, 500);
        }
        return json({ ok: true, ...activateRes.data });
      }
      // status === 'pending' or 'failed' — fall through and re-attempt
      // verification against Google (e.g. a prior attempt errored before
      // Google responded).
    }

    // Insert (or leave as-is) the pending ledger row before calling Google,
    // so there's always a durable record even if the function crashes
    // mid-verification.
    let purchaseRowId: string;
    if (existing.data) {
      purchaseRowId = existing.data.id;
    } else {
      const insertPayload: Record<string, unknown> = {
        user_id: userId,
        product_id: productId,
        purchase_token: purchaseToken,
        order_id: orderIdFromClient,
        status: 'pending',
      };
      if (isBoost) insertPayload.listing_id = listingId;
      else { insertPayload.business_id = businessId; insertPayload.extra_slots = slotCount; }

      const insertRes = await db.from(table).insert(insertPayload).select('id').single();
      if (insertRes.error || !insertRes.data) {
        // Unique-violation on purchase_token means a concurrent request beat
        // us to it — treat as already-processed rather than erroring.
        if (String(insertRes.error?.message || '').includes('unique')) {
          return json({ ok: true, already_processed: true });
        }
        return json({ error: 'Could not record purchase: ' + insertRes.error?.message }, 500);
      }
      purchaseRowId = insertRes.data.id;
    }

    const saEnv = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
    const packageName = Deno.env.get('ANDROID_PACKAGE_NAME');
    if (!saEnv || !packageName) {
      const failRes = await db.from(table).update({ status: 'failed', verification_error: 'Server misconfigured (missing service account or package name)' }).eq('id', purchaseRowId);
      if (failRes.error) console.error('verify-play-purchase: failed to record "Server misconfigured" status:', failRes.error.message);
      return json({ error: 'Server misconfigured' }, 500);
    }

    let accessToken: string;
    try {
      accessToken = await getGoogleAccessToken(JSON.parse(saEnv));
    } catch (e) {
      const failRes = await db.from(table).update({ status: 'failed', verification_error: 'Google auth failed: ' + (e as Error).message }).eq('id', purchaseRowId);
      if (failRes.error) console.error('verify-play-purchase: failed to record "Google auth failed" status:', failRes.error.message);
      return json({ error: 'Verification unavailable' }, 500);
    }

    const verifyResult = await verifyProductPurchase(packageName, productId, purchaseToken, accessToken);
    if (!verifyResult.ok) {
      const failRes = await db.from(table).update({ status: 'failed', verification_error: verifyResult.reason }).eq('id', purchaseRowId);
      if (failRes.error) console.error('verify-play-purchase: failed to record verification-failure status:', failRes.error.message);
      return json({ error: 'Purchase verification failed: ' + verifyResult.reason }, 402);
    }

    // Verified — mark it before activating, so even if activation fails we
    // have a durable "this token IS genuine" record to retry activation from
    // (see the existing.data.status === 'verified' branch above).
    const verifiedRes = await db.from(table).update({
      status: 'verified',
      order_id: verifyResult.orderId || orderIdFromClient,
      purchase_time: verifyResult.purchaseTimeMillis ? new Date(Number(verifyResult.purchaseTimeMillis)).toISOString() : null,
      verified_at: new Date().toISOString(),
    }).eq('id', purchaseRowId);
    if (verifiedRes.error) {
      // This is the row the idempotent retry branch above depends on (it
      // checks status==='verified') — if it never lands, a retry re-runs
      // verification instead of fast-pathing to activation, which is safe
      // but must not happen silently.
      console.error('verify-play-purchase: failed to record verified status:', verifiedRes.error.message);
      return json({ error: 'Purchase verified with Google but could not be recorded: ' + verifiedRes.error.message }, 500);
    }

    const activateRes = await db.rpc(activateFn, { [activateParam]: purchaseRowId });
    if (activateRes.error || !activateRes.data?.ok) {
      // Verified but not yet consumed — the client can retry and the branch
      // above will pick this back up without re-billing or re-verifying.
      console.error('verify-play-purchase: activation failed:', activateRes.error?.message || activateRes.data?.msg);
      return json({ error: 'Purchase verified but activation failed: ' + (activateRes.error?.message || activateRes.data?.msg) }, 500);
    }

    // Tell Google Play the consumable has been delivered/used, so the user
    // can buy the same product again (a fresh boost/pack) in the future.
    consumeProductPurchase(packageName, productId, purchaseToken, accessToken).catch(() => {});

    return json({ ok: true, ...activateRes.data });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
