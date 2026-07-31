// dispatch-notification-push — sends the FCM push for a single row that was
// just inserted into public.notifications.
//
// Most notification types (rental listing decisions, business
// verification/suspension, new reviews, new leads, job application status
// changes, admin/moderation notices) are written by Postgres triggers that
// insert straight into public.notifications and stop there — no push was
// ever sent for them, so they only ever showed up in the in-app Notifications
// screen, never the OS tray. This function is called by a single AFTER
// INSERT trigger on public.notifications (see
// notification_push_dispatch_trigger.sql) so every notification type gets a
// push without touching those ~20 individual trigger functions.
//
// send-push already sends its own push for the notifications it inserts
// (targeted admin broadcasts, scheduled_notifications delivery) — those rows
// are inserted with push_sent = true so this function's guard (push_sent =
// false) skips them and they're never double-sent.
//
// Required Edge Function secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
//   FIREBASE_SERVICE_ACCOUNT                 (service-account JSON)
//   AUTOMATION_SECRET                        (shared with automation-runner; must match x-automation-secret)

const PREFERENCE_COLUMN_BY_TYPE: Record<string, string> = {
  listing_approved: 'approvals',
  listing_rejected: 'approvals',
  listing_flagged: 'approvals',
  rental_listing_decision: 'approvals',
  rental_company_decision: 'approvals',
  listing_expiry: 'listing_updates',
  stale_listing: 'listing_updates',
  view_milestone: 'listing_updates',
  price_drop: 'price_drops',
  saved_search_match: 'favourites',
  personalized_recommendation: 'recommendations',
  shop_new_arrivals: 'recommendations',
  category_digest: 'recommendations',
  listing_view_reminder: 'recommendations',
  verification_nudge: 'verification_reminders',
  boost: 'promotions',
  promotion: 'promotions',
  sale: 'promotions',
};

let _tokenCache: { value: string; exp: number } | null = null;

async function getFCMAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (_tokenCache && _tokenCache.exp - 120 > now) return _tokenCache.value;

  const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iss: sa['client_email'], scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const sigInput = b64url(header) + '.' + b64url(payload);
  const pem = sa['private_key'].replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\n/g, '');
  const cryptoKey = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput));
  const jwt = sigInput + '.' + btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt });
  const tokenData = await res.json();
  if (!res.ok || !tokenData['access_token']) throw new Error('FCM auth failed (' + res.status + '): ' + JSON.stringify(tokenData));

  const ttl = Number(tokenData['expires_in']) || 3600;
  _tokenCache = { value: tokenData['access_token'], exp: now + ttl };
  return _tokenCache.value;
}

async function sendFCM(pushToken: string, projectId: string, accessToken: string, title: string, body: string, data: Record<string, string>): Promise<boolean> {
  const message = {
    token: pushToken,
    notification: { title, body },
    data,
    android: { priority: 'high', notification: { channel_id: 'pamarket_default', sound: 'default' } },
    apns: { payload: { aps: { sound: 'default' } } },
  };
  const url = 'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const result = await res.json().catch(() => ({}));
  return res.ok && !result['error'];
}

Deno.serve(async (req) => {
  const json = (data: unknown, status?: number) => new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json' } });

  try {
    const expected = Deno.env.get('AUTOMATION_SECRET');
    if (!expected) return json({ error: 'misconfigured' }, 500);
    if (req.headers.get('x-automation-secret') !== expected) return json({ error: 'unauthorized' }, 401);

    const { notificationId } = await req.json();
    if (!notificationId) return json({ skipped: 'no notificationId' });

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const notifRes = await db
      .from('notifications')
      .select('id,user_id,title,body,type,meta,push_sent')
      .eq('id', notificationId)
      .maybeSingle();
    if (notifRes.error || !notifRes.data) return json({ skipped: 'notification not found' });

    const notif = notifRes.data as { id: string; user_id: string; title: string; body: string; type: string; meta: any; push_sent: boolean };
    // Already handled (e.g. send-push inserted this row itself and already
    // pushed) — the trigger's guard should already prevent this call, but
    // re-check here too since the http_post dispatch is async and could in
    // principle be retried by pg_net.
    if (notif.push_sent) return json({ skipped: 'already sent' });

    const markSent = () => db.from('notifications').update({ push_sent: true }).eq('id', notif.id);

    const preferenceColumn = PREFERENCE_COLUMN_BY_TYPE[String(notif.type).toLowerCase()];
    if (preferenceColumn) {
      const prefRes = await db
        .from('notification_preferences')
        .select(preferenceColumn)
        .eq('user_id', notif.user_id)
        .maybeSingle();
      if (!prefRes.error && prefRes.data && (prefRes.data as any)[preferenceColumn] === false) {
        await markSent();
        return json({ skipped: 'opted out' });
      }
    }

    const tokenRes = await db.from('push_tokens').select('token').eq('user_id', notif.user_id).maybeSingle();
    if (tokenRes.error || !tokenRes.data?.token) {
      await markSent();
      return json({ skipped: 'no push token' });
    }

    const saEnv = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!saEnv) return json({ error: 'FIREBASE_SERVICE_ACCOUNT not set' }, 500);
    const sa = JSON.parse(saEnv);
    const accessToken = await getFCMAccessToken(sa);

    const deepLink = notif.meta?.deepLink || null;
    const data: Record<string, string> = { type: notif.type, notificationId: notif.id };
    if (deepLink) data['deepLink'] = deepLink;

    const ok = await sendFCM(tokenRes.data.token, sa['project_id'], accessToken, notif.title, notif.body, data);
    await markSent();

    return json({ success: ok });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
