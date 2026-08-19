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
  // notification_type_enabled() (see
  // 202607280002_notification_preferences_and_listing_reminders.sql) groups
  // these three under the `messages` preference column — this map never got
  // the same three keys, so a user who turned off message notifications
  // still received chat_scam_warning and message_noreply_reminder pushes.
  // 'message' itself isn't listed here on purpose: real chat messages push
  // via a separate direct-FCM path (send-push), not scheduled_notifications,
  // so it never reaches this function.
  chat_scam_warning: 'messages',
  message_noreply_reminder: 'messages',
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

// FCM permanent registration failures — the device token will never work
// again, so retrying it forever is pointless. Anything else (5xx, quota,
// network) is treated as temporary and the token is left alone.
const FCM_PERMANENT_TOKEN_ERRORS = [
  'UNREGISTERED',
  'INVALID_ARGUMENT',
  'SENDER_ID_MISMATCH',
  'NOT_FOUND',
];

type FcmResult = {
  ok: boolean;
  /** Sanitized reason, safe to persist — never contains the token or payload. */
  reason?: string;
  /** True only for errors that mean this device token is permanently dead. */
  permanentTokenFailure?: boolean;
};

async function sendFCM(pushToken: string, projectId: string, accessToken: string, title: string, body: string, data: Record<string, string>): Promise<FcmResult> {
  const message = {
    token: pushToken,
    notification: { title, body },
    data,
    android: { priority: 'high', notification: { channel_id: 'pamarket_default', sound: 'default' } },
    apns: { payload: { aps: { sound: 'default' } } },
  };
  const url = 'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send';

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
  } catch (e) {
    // Network/DNS failure never reached FCM — temporary by definition.
    return { ok: false, reason: 'network: ' + String((e as Error)?.message || e).slice(0, 120) };
  }

  const result = await res.json().catch(() => ({} as Record<string, unknown>));
  const err = result['error'] as
    | { status?: string; message?: string; details?: Array<Record<string, string>> }
    | undefined;

  if (res.ok && !err) return { ok: true };

  // Record the status code and FCM's own status enum only — the message can
  // echo request content, and the token must never be persisted.
  const status = err?.status || '';
  const detail = err?.details?.find((d) => typeof d['errorCode'] === 'string')?.['errorCode'] || '';
  const code = detail || status;
  const permanent = FCM_PERMANENT_TOKEN_ERRORS.includes(code);

  return {
    ok: false,
    reason: ('http ' + res.status + (code ? ' ' + code : '')).slice(0, 200),
    permanentTokenFailure: permanent,
  };
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
      .select('id,user_id,title,body,type,meta,push_sent,push_status')
      .eq('id', notificationId)
      .maybeSingle();
    if (notifRes.error || !notifRes.data) return json({ skipped: 'notification not found' });

    const notif = notifRes.data as { id: string; user_id: string; title: string; body: string; type: string; meta: any; push_sent: boolean; push_status: string };
    // Already handled (e.g. send-push inserted this row itself and already
    // pushed) — the trigger's guard should already prevent this call, but
    // re-check here too since the http_post dispatch is async and could in
    // principle be retried by pg_net.
    if (notif.push_sent || notif.push_status !== 'pending') return json({ skipped: 'already handled' });

    const markStatus = (push_status: string, push_sent: boolean, push_error: string | null = null) =>
      db.from('notifications').update({ push_status, push_sent, push_error }).eq('id', notif.id);

    const preferenceColumn = PREFERENCE_COLUMN_BY_TYPE[String(notif.type).toLowerCase()];
    if (preferenceColumn) {
      const prefRes = await db
        .from('notification_preferences')
        .select(preferenceColumn)
        .eq('user_id', notif.user_id)
        .maybeSingle();
      if (!prefRes.error && prefRes.data && (prefRes.data as any)[preferenceColumn] === false) {
        await markStatus('opted_out', false);
        return json({ skipped: 'opted out' });
      }
    }

    const tokenRes = await db.from('push_tokens').select('id,token').eq('user_id', notif.user_id);
    const tokens = (tokenRes.data || []).filter((row: { token?: string }) => row.token);
    if (tokenRes.error || tokens.length === 0) {
      await markStatus('no_token', false, 'no registered device');
      return json({ skipped: 'no push token' });
    }

    await markStatus('sending', false);
    const saEnv = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!saEnv) {
      await markStatus('failed', false, 'push transport unavailable');
      return json({ error: 'FIREBASE_SERVICE_ACCOUNT not set' }, 500);
    }
    const sa = JSON.parse(saEnv);
    let accessToken: string;
    try {
      accessToken = await getFCMAccessToken(sa);
    } catch (_error) {
      await markStatus('failed', false, 'FCM authentication failed');
      return json({ error: 'FCM authentication failed' }, 500);
    }

    const deepLink = notif.meta?.deepLink || null;
    const data: Record<string, string> = { type: notif.type, notificationId: notif.id };
    if (deepLink) data['deepLink'] = deepLink;

    const attempts = await Promise.all(tokens.map((row: { id: string; token: string }) =>
      sendFCM(row.token, sa['project_id'], accessToken, notif.title, notif.body, data)
    ));
    const deadTokenIds = tokens
      .filter((_row: { id: string }, index: number) => attempts[index].permanentTokenFailure)
      .map((row: { id: string }) => row.id);
    if (deadTokenIds.length) await db.from('push_tokens').delete().in('id', deadTokenIds);
    const fcm = attempts.find((attempt) => attempt.ok) || attempts[0];

    if (!fcm.ok) {
      // Previously markSent() ran here too, so a rejected push was recorded as
      // delivered — the row looked identical to a success and there was no way
      // to see, or retry, a failure. Leave push_sent false and keep the reason.
      await db
        .from('notifications')
        .update({ push_status: 'failed', push_sent: false, push_error: fcm.reason || 'all device pushes failed' })
        .eq('id', notif.id);

      // A permanently dead registration should not be retried forever. Only
      // remove on FCM's permanent codes — never on 5xx, quota or network
      // errors, which are transient and would drop a healthy device.
      return json({ success: false, sent: 0, failed: attempts.length, pruned: deadTokenIds.length, error: fcm.reason });
    }

    await db
      .from('notifications')
      .update({ push_status: 'sent', push_sent: true, push_error: null })
      .eq('id', notif.id);

    return json({ success: true, sent: attempts.filter((attempt) => attempt.ok).length, failed: attempts.filter((attempt) => !attempt.ok).length, pruned: deadTokenIds.length });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
