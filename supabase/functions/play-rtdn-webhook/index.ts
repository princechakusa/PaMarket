// play-rtdn-webhook — receives Google Play Real-Time Developer Notifications
// (RTDN) for subscription lifecycle events (renewal, cancellation, billing
// retry, grace period, on-hold, revocation, expiry) that happen on Google's
// own schedule, not at a moment the app calls verify-play-subscription.
// Handles both subscription families verify-play-subscription does (shop
// plans → business_subscriptions/businesses, recruiter plans →
// recruiter_subscriptions/recruiter_profiles) by first checking which
// ledger table (play_subscriptions vs play_recruiter_subscriptions) the
// reported purchase token belongs to.
//
// This is the SOURCE OF TRUTH for subscription state after the initial
// purchase. Google delivers these as Pub/Sub push messages to this HTTPS
// endpoint (configured as the push subscription's endpoint URL in Google
// Cloud Console — see the setup guide for exact steps).
//
// Pub/Sub push message envelope:
//   { message: { data: <base64 JSON>, messageId, publishTime }, subscription }
// Decoded `data` (DeveloperNotification) shape:
//   { packageName, eventTimeMillis, subscriptionNotification: { subscriptionId, notificationType, purchaseToken } }
//
// notificationType values (SubscriptionNotificationType):
//   1 RECOVERED, 2 RENEWED, 3 CANCELED, 4 PURCHASED, 5 ON_HOLD,
//   6 IN_GRACE_PERIOD, 7 RESTARTED, 8 PRICE_CHANGE_CONFIRMED, 9 DEFERRED,
//   10 PAUSED, 11 PAUSE_SCHEDULE_CHANGED, 12 REVOKED, 13 EXPIRED
//
// Whatever the event type, the safe/correct action is always the same:
// re-fetch the subscription's CURRENT state from the Android Publisher API
// (subscriptionsv2) rather than trusting the notification type itself to
// infer state — Google's own docs recommend this, since it's simpler and
// avoids the webhook's event-type mapping ever drifting out of sync with
// the real subscriptionState enum.
//
// Required Edge Function secrets (shared with verify-play-subscription):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLAY_SERVICE_ACCOUNT,
//   ANDROID_PACKAGE_NAME
//   PLAY_RTDN_AUDIENCE  (optional: the OIDC audience Pub/Sub push auth is
//                        configured with, for verifying the request really
//                        came from Google — see setup guide step on
//                        "Enable authentication" for the push subscription)

function json(d: unknown, s?: number) {
  return new Response(JSON.stringify(d), { status: s || 200, headers: { 'Content-Type': 'application/json' } });
}

// ── Pub/Sub push authentication (OIDC) ──────────────────────────────────
// When PLAY_RTDN_AUDIENCE is set, every request must carry a Google-signed
// OIDC identity token (Pub/Sub push subscription with "Enable
// authentication" on) whose audience matches. Without this, the endpoint —
// which must be deployed with --no-verify-jwt so Pub/Sub can reach it —
// would accept forged notifications from anyone who learns its URL. A
// forged message can't grant entitlements (state is always re-fetched from
// Google), but it could burn Android Publisher API quota and probe tokens.
let _googleCertsCache: { keys: Array<Record<string, string>>; exp: number } | null = null;

async function getGoogleSigningKeys(): Promise<Array<Record<string, string>>> {
  const now = Date.now();
  if (_googleCertsCache && _googleCertsCache.exp > now) return _googleCertsCache.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error('Could not fetch Google signing keys: ' + res.status);
  const body = await res.json();
  _googleCertsCache = { keys: body.keys || [], exp: now + 3600_000 };
  return _googleCertsCache.keys;
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function verifyPubSubOidcToken(req: Request, expectedAudience: string): Promise<{ ok: boolean; reason?: string }> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return { ok: false, reason: 'missing bearer token' };

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed token' };

  let header: Record<string, string>, payload: Record<string, unknown>;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    return { ok: false, reason: 'undecodable token' };
  }
  if (header.alg !== 'RS256') return { ok: false, reason: 'unexpected alg' };

  const iss = payload.iss as string;
  if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
    return { ok: false, reason: 'wrong issuer' };
  }
  if (payload.aud !== expectedAudience) return { ok: false, reason: 'wrong audience' };
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < nowSec - 60) return { ok: false, reason: 'expired token' };

  const jwk = (await getGoogleSigningKeys()).find((k) => k.kid === header.kid);
  if (!jwk) return { ok: false, reason: 'unknown signing key' };

  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1])
  );
  return valid ? { ok: true } : { ok: false, reason: 'bad signature' };
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

async function fetchSubscriptionV2(packageName: string, purchaseToken: string, accessToken: string) {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false as const, reason: 'Google API error ' + res.status };
  const lineItem = Array.isArray(body.lineItems) ? body.lineItems[0] : null;
  return {
    ok: true as const,
    subscriptionState: mapSubscriptionState(body.subscriptionState),
    productId: lineItem?.productId as string | undefined,
    expiryTime: lineItem?.expiryTime as string | undefined,
    autoRenewing: !!lineItem?.autoRenewingPlan?.autoRenewEnabled,
    latestOrderId: body.latestOrderId as string | undefined,
    acknowledged: body.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
  };
}

// Acknowledge safety net — mirrors verify-play-subscription's post-activation
// acknowledge. If the synchronous verify path failed to acknowledge (or was
// never reached), the SUBSCRIPTION_PURCHASED/RENEWED RTDN gives us another
// chance before Google's 3-day auto-refund.
async function acknowledgeSubscription(
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
  // Pub/Sub push requests are POST-only with no custom headers we control —
  // always return 200 on a message we've handled (even if it turns out to
  // be irrelevant) so Pub/Sub doesn't endlessly retry; only return non-2xx
  // for genuine transient failures we WANT retried.
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Authenticate the push if an audience is configured. A rejected request
    // returns 403 (Pub/Sub treats non-2xx as retryable, but a genuine
    // attacker's request should never be acked as handled).
    const expectedAudience = Deno.env.get('PLAY_RTDN_AUDIENCE');
    if (expectedAudience) {
      const auth = await verifyPubSubOidcToken(req, expectedAudience);
      if (!auth.ok) {
        console.warn('play-rtdn-webhook: rejected unauthenticated push:', auth.reason);
        return json({ error: 'Unauthorized' }, 403);
      }
    }

    const envelope = await req.json();
    const messageData = envelope?.message?.data;
    if (!messageData) return json({ ok: true, skipped: 'no message data' }); // ack — malformed, nothing to retry

    const decoded = JSON.parse(atob(messageData));

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Voided/refunded ONE-TIME purchases (boosts, slot packs, job credits,
    // rental featured) — reverse the entitlement so a refunded buyer doesn't
    // keep it. revoke_play_purchase is idempotent and resolves the token
    // across all four consumable ledgers; voided SUBSCRIPTIONS also emit a
    // subscriptionNotification (REVOKED), which the flow below handles.
    const voided = decoded.voidedPurchaseNotification;
    if (voided?.purchaseToken) {
      const revokeRes = await db.rpc('revoke_play_purchase', { p_purchase_token: voided.purchaseToken });
      if (revokeRes.error) {
        console.error('[BILLING_ALERT] play-rtdn-webhook: revoke_play_purchase failed:', revokeRes.error.message);
        return json({ error: revokeRes.error.message }, 500); // retry
      }
      console.log('play-rtdn-webhook: voided purchase processed:', JSON.stringify(revokeRes.data));
      return json({ ok: true, voided: revokeRes.data });
    }

    const notif = decoded.subscriptionNotification;
    if (!notif || !notif.purchaseToken) {
      // Some other notification family (oneTimeProductNotification, test
      // notifications) — nothing to do, ack and move on.
      return json({ ok: true, skipped: 'not a subscription notification' });
    }

    const purchaseToken = notif.purchaseToken as string;

    // This webhook now handles two subscription families that share
    // identical lifecycle mechanics but live in different tables — check
    // shop subscriptions first (existing behavior), then recruiter
    // subscriptions, since a purchase token belongs to exactly one.
    const existing = await db.from('play_subscriptions').select('id').eq('purchase_token', purchaseToken).maybeSingle();
    if (existing.error) return json({ error: existing.error.message }, 500); // ask Pub/Sub to retry

    let isRecruiter = false;
    let rowId: string;
    if (existing.data) {
      rowId = existing.data.id;
    } else {
      const existingRecruiter = await db.from('play_recruiter_subscriptions').select('id').eq('purchase_token', purchaseToken).maybeSingle();
      if (existingRecruiter.error) return json({ error: existingRecruiter.error.message }, 500);
      if (!existingRecruiter.data) {
        // Token we've never seen in either table — most likely a
        // subscription started before this webhook existed, or a race with
        // verify-play-subscription's own insert. Ack without erroring; the
        // next sync verification or reconciliation poll will pick it up
        // once the row exists.
        return json({ ok: true, skipped: 'unknown purchase token' });
      }
      isRecruiter = true;
      rowId = existingRecruiter.data.id;
    }

    const table = isRecruiter ? 'play_recruiter_subscriptions' : 'play_subscriptions';
    const activateFn = isRecruiter ? 'activate_recruiter_subscription' : 'activate_play_subscription';
    const activateParam = isRecruiter ? 'p_play_recruiter_subscription_id' : 'p_play_subscription_id';
    const lifecycleTable = isRecruiter ? 'recruiter_subscriptions' : 'business_subscriptions';
    const lifecycleFk = isRecruiter ? 'recruiter_id' : 'business_id';
    const downgradeTable = isRecruiter ? 'recruiter_profiles' : 'businesses';
    const downgradeIdColumn = isRecruiter ? 'recruiter_id' : 'business_id';

    const saEnv = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
    const packageName = Deno.env.get('ANDROID_PACKAGE_NAME');
    if (!saEnv || !packageName) return json({ error: 'Server misconfigured' }, 500); // retry once secrets are fixed

    const accessToken = await getGoogleAccessToken(JSON.parse(saEnv));
    const sub = await fetchSubscriptionV2(packageName, purchaseToken, accessToken);
    if (!sub.ok) return json({ error: sub.reason }, 500); // transient Google-side error — let Pub/Sub retry

    const verifiedRes = await db.from(table).update({
      status: 'verified',
      subscription_state: sub.subscriptionState,
      auto_renewing: sub.autoRenewing,
      order_id: sub.latestOrderId || null,
      expiry_time: sub.expiryTime ? new Date(sub.expiryTime).toISOString() : null,
    }).eq('id', rowId);
    if (verifiedRes.error) {
      console.error('play-rtdn-webhook: failed to record verified status for', rowId, ':', verifiedRes.error.message);
      return json({ error: verifiedRes.error.message }, 500); // retry — state wasn't recorded
    }

    // Acknowledge if still pending (e.g. the synchronous verify path never
    // completed its acknowledge) — required within 3 days of purchase or
    // Google auto-refunds. Only meaningful while the subscription entitles.
    if (sub.acknowledged === false && (sub.subscriptionState === 'active' || sub.subscriptionState === 'in_grace_period') && sub.productId) {
      const acked = await acknowledgeSubscription(packageName, sub.productId, purchaseToken, accessToken).catch(() => false);
      if (!acked) console.error('play-rtdn-webhook: acknowledge failed for', sub.productId);
    }

    const activateRes = await db.rpc(activateFn, { [activateParam]: rowId });
    // Success requires BOTH no transport/DB error AND the RPC's own jsonb
    // payload saying ok:true — see verify-play-subscription for the same
    // rule. A silent business-logic failure here must not be acked as 200,
    // or Pub/Sub will never redeliver an event that needs reprocessing.
    if (activateRes.error || activateRes.data?.ok !== true) {
      console.error('[BILLING_ALERT] play-rtdn-webhook: activation failed for', rowId, ':', activateRes.error?.message || activateRes.data?.msg);
      return json({ error: activateRes.error?.message || activateRes.data?.msg || 'activation returned ok:false' }, 500);
    }

    // If the subscription is no longer active/in-grace, downgrade the
    // business/recruiter back to Free immediately rather than waiting for
    // a client-side expiry sweep to notice — that sweep only runs when the
    // OWNER'S device happens to boot the app.
    if (sub.subscriptionState !== 'active' && sub.subscriptionState !== 'in_grace_period') {
      const rowRes = await db.from(table).select(downgradeIdColumn).eq('id', rowId).single();
      if (rowRes.error) {
        console.error('play-rtdn-webhook: could not read', downgradeIdColumn, 'for downgrade, rowId', rowId, ':', rowRes.error.message);
        return json({ error: 'Downgrade lookup failed: ' + rowRes.error.message }, 500); // retry
      }
      const targetId = (rowRes.data as Record<string, string> | null)?.[downgradeIdColumn];
      if (targetId) {
        const expireRes = await db.from(lifecycleTable).update({ status: 'expired' })
          .eq(lifecycleFk, targetId).eq('status', 'active');
        if (expireRes.error) {
          console.error('play-rtdn-webhook: failed to expire', lifecycleTable, 'for', targetId, ':', expireRes.error.message);
          return json({ error: 'Could not expire subscription record: ' + expireRes.error.message }, 500); // retry
        }

        // This is the entitlement-integrity-critical write in this function:
        // if it silently fails, a lapsed/canceled subscriber keeps paid-tier
        // access indefinitely. Must be checked and must cause a retry, never
        // a silent 200.
        const downgradeRes = await db.from(downgradeTable).update({ plan_id: 'free' }).eq('id', targetId);
        if (downgradeRes.error) {
          console.error('[BILLING_ALERT] play-rtdn-webhook: FAILED to downgrade', downgradeTable, targetId, 'to free plan:', downgradeRes.error.message);
          return json({ error: 'Could not downgrade to free plan: ' + downgradeRes.error.message }, 500); // retry
        }
      }
    }

    return json({ ok: true });
  } catch (err) {
    // Only a genuinely malformed/unparseable payload should be acked
    // (retrying it would never succeed differently). Anything else —
    // network errors, unexpected exceptions from the DB/Google API calls
    // above — is a transient failure that Pub/Sub should redeliver, so it
    // must NOT be silently acked as ok:true.
    const message = (err as Error).message || String(err);
    const isParseFailure = err instanceof SyntaxError || /JSON/i.test(message);
    console.error('play-rtdn-webhook error:', message, isParseFailure ? '(treated as non-retryable parse failure)' : '(treated as transient — requesting retry)');
    if (isParseFailure) return json({ ok: true, error: message });
    return json({ error: message }, 500);
  }
});
