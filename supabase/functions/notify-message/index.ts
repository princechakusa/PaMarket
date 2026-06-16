// notify-message — sends an FCM push to the recipient when a chat message is
// inserted. Wired via a Supabase Database Webhook on public.messages (INSERT).
//
// Required Edge Function secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
//   FIREBASE_SERVICE_ACCOUNT                 (service-account JSON)
//   NOTIFY_WEBHOOK_SECRET                    (must match the webhook header)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── OAuth token cache (reused across invocations while the instance is warm) ──
let _tokenCache: { value: string; exp: number } | null = null;

async function getFCMAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (_tokenCache && _tokenCache.exp - 120 > now) return _tokenCache.value; // reuse until ~2 min before expiry

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

type FCMResult = { ok: boolean; invalid: boolean; status: number; error?: string };

// Send one FCM message, retrying transient failures (network / 5xx / 429).
async function sendFCM(pushToken: string, projectId: string, accessToken: string, title: string, body: string, data: Record<string, string>): Promise<FCMResult> {
  const message = {
    token: pushToken,
    notification: { title, body },
    data,
    android: { priority: 'high', notification: { channel_id: 'pamarket_default', sound: 'default' } },
  };
  const url = 'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send';
  const MAX = 3;

  for (let attempt = 1; attempt <= MAX; attempt++) {
    let res: Response | null = null;
    let result: any = {};
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      result = await res.json().catch(() => ({}));
    } catch (e) {
      // Network error — transient. Retry with backoff, else give up.
      if (attempt < MAX) { await sleep(attempt * 400); continue; }
      console.error('FCM fetch threw (gave up):', (e as Error).message);
      return { ok: false, invalid: false, status: 0, error: (e as Error).message };
    }

    if (res.ok && !result['error']) {
      console.log('FCM ok →', pushToken.slice(0, 12) + '…');
      return { ok: true, invalid: false, status: res.status };
    }

    const err = result['error'] || {};
    const fcmStatus: string = err['status'] || '';
    const errorCode: string = (Array.isArray(err['details']) ? err['details'].find((d: any) => d['errorCode'])?.['errorCode'] : '') || '';
    const invalid =
      res.status === 404 ||
      fcmStatus === 'NOT_FOUND' || fcmStatus === 'UNREGISTERED' || fcmStatus === 'INVALID_ARGUMENT' ||
      errorCode === 'UNREGISTERED' || errorCode === 'INVALID_ARGUMENT';
    const transient = res.status === 429 || res.status >= 500 || fcmStatus === 'UNAVAILABLE' || fcmStatus === 'INTERNAL';

    if (transient && attempt < MAX) { await sleep(attempt * 400); continue; }

    console.warn('FCM fail →', pushToken.slice(0, 12) + '…', 'http:', res.status, 'status:', fcmStatus, 'code:', errorCode, 'invalid:', invalid);
    return { ok: false, invalid, status: res.status, error: fcmStatus || errorCode || ('http_' + res.status) };
  }
  return { ok: false, invalid: false, status: 0, error: 'exhausted' };
}

// Clean preview text (offers/replies are stored as JSON).
function preview(text: string | null, hasImage: boolean): string {
  if (hasImage) return '📷 Photo';
  if (typeof text === 'string' && text.charAt(0) === '{') {
    try {
      const o = JSON.parse(text);
      if (o && o._offer) return '💰 Sent an offer';
      if (o && o._reply && o.t) return String(o.t);
    } catch (_) { /* fall through */ }
  }
  return text || 'New message';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const json = (d: unknown, s?: number) => new Response(JSON.stringify(d), { status: s || 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

  try {
    const expected = Deno.env.get('NOTIFY_WEBHOOK_SECRET');
    if (expected && req.headers.get('x-webhook-secret') !== expected) {
      console.warn('Rejected: bad or missing x-webhook-secret');
      return json({ error: 'unauthorized' }, 401);
    }

    const payload = await req.json();
    const record = payload && (payload.record || payload.new || payload);
    if (!record || !record.conversation_id || !record.sender_id) return json({ skipped: 'no record' });

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const convId = String(record.conversation_id);
    const senderId = String(record.sender_id);

    // ── Recipients: the conversation members who aren't the sender ──
    // Canonical source is conversations.members. (For this to work reliably,
    // conversations.id must be TEXT — matching the app's "conv_/job_" ids.)
    let recipients: string[] = [];
    const convRes = await db.from('conversations').select('members').eq('id', convId).maybeSingle();
    if (convRes.error) console.warn('conversation lookup:', convRes.error.message);
    const members: string[] = (convRes.data && Array.isArray(convRes.data.members)) ? convRes.data.members : [];
    recipients = members.filter((m) => m && m !== senderId);

    // Fallback (bounded): other participants who have posted in the thread.
    if (!recipients.length) {
      const others = await db.from('messages').select('sender_id').eq('conversation_id', convId).neq('sender_id', senderId).limit(10);
      recipients = [...new Set((others.data || []).map((r: any) => String(r.sender_id)))];
    }
    if (!recipients.length) { console.log('skipped: no recipient for', convId); return json({ skipped: 'no recipient' }); }

    const profRes = await db.from('profiles').select('id, push_token').in('id', recipients);
    if (profRes.error) console.warn('profiles lookup error:', profRes.error.message);
    const tokens = (profRes.data || []).filter((p: any) => p.push_token);
    console.log('conversation:', convId, '| recipients:', recipients.length, '| with token:', tokens.length);
    if (!tokens.length) return json({ skipped: 'no push tokens' });

    const saEnv = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!saEnv) return json({ error: 'FIREBASE_SERVICE_ACCOUNT not set' }, 500);
    const sa = JSON.parse(saEnv);
    const accessToken = await getFCMAccessToken(sa);

    const title = record.sender_name || 'New message';
    const body = preview(record.text, !!record.image);
    const data = { type: 'message', deepLink: 'chat:' + convId, conversationId: convId };

    let sent = 0, failed = 0;
    const deadTokenIds: string[] = [];
    await Promise.all(tokens.map(async (p: any) => {
      const r = await sendFCM(p.push_token, sa['project_id'], accessToken, title, body, data);
      if (r.ok) { sent++; } else { failed++; if (r.invalid) deadTokenIds.push(p.id); }
    }));

    // Prune dead/expired tokens so we stop pushing to them.
    if (deadTokenIds.length) {
      const del = await db.from('profiles').update({ push_token: null }).in('id', deadTokenIds);
      if (del.error) console.warn('failed to clear dead tokens:', del.error.message);
      else console.log('cleared dead push tokens for', deadTokenIds.length, 'profile(s)');
    }

    console.log('done → sent:', sent, 'failed:', failed, 'pruned:', deadTokenIds.length);
    return json({ success: true, sent, failed, pruned: deadTokenIds.length });
  } catch (err) {
    console.error('notify-message error:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
