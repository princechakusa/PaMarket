// play-rtdn-webhook — receives Google Play Real-Time Developer Notifications
// (RTDN) for subscription lifecycle events (renewal, cancellation, billing
// retry, grace period, on-hold, revocation, expiry) that happen on Google's
// own schedule, not at a moment the app calls verify-play-subscription.
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
  };
}

Deno.serve(async (req) => {
  // Pub/Sub push requests are POST-only with no custom headers we control —
  // always return 200 on a message we've handled (even if it turns out to
  // be irrelevant) so Pub/Sub doesn't endlessly retry; only return non-2xx
  // for genuine transient failures we WANT retried.
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const envelope = await req.json();
    const messageData = envelope?.message?.data;
    if (!messageData) return json({ ok: true, skipped: 'no message data' }); // ack — malformed, nothing to retry

    const decoded = JSON.parse(atob(messageData));
    const notif = decoded.subscriptionNotification;
    if (!notif || !notif.purchaseToken) {
      // Could be a one-time-product notification (voidedPurchaseNotification /
      // oneTimeProductNotification) — boosts don't currently need RTDN (Phase 1
      // is sync-only per the boost implementation), so just ack and move on.
      return json({ ok: true, skipped: 'not a subscription notification' });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const purchaseToken = notif.purchaseToken as string;
    const existing = await db.from('play_subscriptions').select('id').eq('purchase_token', purchaseToken).maybeSingle();
    if (existing.error) return json({ error: existing.error.message }, 500); // ask Pub/Sub to retry
    if (!existing.data) {
      // Token we've never seen — most likely a subscription started before
      // this webhook existed, or a race with verify-play-subscription's own
      // insert. Ack without erroring; the next sync verification or
      // reconciliation poll will pick it up once the row exists.
      return json({ ok: true, skipped: 'unknown purchase token' });
    }
    const rowId = existing.data.id;

    const saEnv = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
    const packageName = Deno.env.get('ANDROID_PACKAGE_NAME');
    if (!saEnv || !packageName) return json({ error: 'Server misconfigured' }, 500); // retry once secrets are fixed

    const accessToken = await getGoogleAccessToken(JSON.parse(saEnv));
    const sub = await fetchSubscriptionV2(packageName, purchaseToken, accessToken);
    if (!sub.ok) return json({ error: sub.reason }, 500); // transient Google-side error — let Pub/Sub retry

    const verifiedRes = await db.from('play_subscriptions').update({
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

    const activateRes = await db.rpc('activate_play_subscription', { p_play_subscription_id: rowId });
    // Success requires BOTH no transport/DB error AND the RPC's own jsonb
    // payload saying ok:true — see verify-play-subscription for the same
    // rule. A silent business-logic failure here must not be acked as 200,
    // or Pub/Sub will never redeliver an event that needs reprocessing.
    if (activateRes.error || activateRes.data?.ok !== true) {
      console.error('play-rtdn-webhook: activation failed for', rowId, ':', activateRes.error?.message || activateRes.data?.msg);
      return json({ error: activateRes.error?.message || activateRes.data?.msg || 'activation returned ok:false' }, 500);
    }

    // If the subscription is no longer active/in-grace, downgrade the
    // business back to Free immediately rather than waiting for
    // business-subscription.js's client-side expiry sweep to notice —
    // that sweep only runs when the OWNER'S device happens to boot the app.
    if (sub.subscriptionState !== 'active' && sub.subscriptionState !== 'in_grace_period') {
      const rowRes = await db.from('play_subscriptions').select('business_id').eq('id', rowId).single();
      if (rowRes.error) {
        console.error('play-rtdn-webhook: could not read business_id for downgrade, rowId', rowId, ':', rowRes.error.message);
        return json({ error: 'Downgrade lookup failed: ' + rowRes.error.message }, 500); // retry
      }
      if (rowRes.data) {
        const expireRes = await db.from('business_subscriptions').update({ status: 'expired' })
          .eq('business_id', rowRes.data.business_id).eq('status', 'active');
        if (expireRes.error) {
          console.error('play-rtdn-webhook: failed to expire business_subscriptions for business', rowRes.data.business_id, ':', expireRes.error.message);
          return json({ error: 'Could not expire subscription record: ' + expireRes.error.message }, 500); // retry
        }

        // This is the entitlement-integrity-critical write in this function:
        // if it silently fails, a lapsed/canceled subscriber keeps paid-tier
        // access indefinitely. Must be checked and must cause a retry, never
        // a silent 200.
        const downgradeRes = await db.from('businesses').update({ plan_id: 'free' }).eq('id', rowRes.data.business_id);
        if (downgradeRes.error) {
          console.error('play-rtdn-webhook: FAILED to downgrade business', rowRes.data.business_id, 'to free plan:', downgradeRes.error.message);
          return json({ error: 'Could not downgrade business to free plan: ' + downgradeRes.error.message }, 500); // retry
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
