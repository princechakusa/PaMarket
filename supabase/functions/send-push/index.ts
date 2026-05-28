const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── FCM HTTP v1 ───────────────────────────────────────────
async function getFCMAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const b64url = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iss: sa['client_email'], scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const sigInput = b64url(header) + '.' + b64url(payload);
  const pem = sa['private_key'].replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\n/g, '');
  const cryptoKey = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput));
  const jwt = sigInput + '.' + btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt });
  const tokenData = await res.json();
  if (!tokenData['access_token']) throw new Error('FCM auth failed: ' + JSON.stringify(tokenData));
  return tokenData['access_token'];
}

async function sendFCM(pushToken, projectId, accessToken, title, body, fcmData, imageUrl) {
  const message = {
    token: pushToken,
    notification: { title: title, body: body },
    data: fcmData,
    android: { priority: 'high', notification: { channel_id: 'pamarket_default', sound: 'default', image: imageUrl || undefined } },
    apns: imageUrl ? { payload: { aps: {} }, fcm_options: { image: imageUrl } } : undefined,
  };
  const fcmUrl = 'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send';
  const res = await fetch(fcmUrl, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message }),
  });
  const result = await res.json();
  return !result['error'];
}

// ── Web Push (VAPID) ──────────────────────────────────────
function b64ToUint8(b64: string): Uint8Array {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

function uint8ToB64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function buildVapidHeader(endpoint: string, vapidPublic: string, vapidPrivate: string): Promise<string> {
  const audience = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 12 * 3600;
  const header = { typ: 'JWT', alg: 'ES256' };
  const claims = { aud: audience, exp: expiry, sub: 'mailto:admin@pamarket.co.zw' };
  const enc = (o: object) => uint8ToB64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsignedToken = enc(header) + '.' + enc(claims);
  const privKey = await crypto.subtle.importKey(
    'raw', b64ToUint8(vapidPrivate),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privKey,
    new TextEncoder().encode(unsignedToken)
  );
  const jwt = unsignedToken + '.' + uint8ToB64url(new Uint8Array(sig));
  return `vapid t=${jwt},k=${vapidPublic}`;
}

async function encryptWebPush(plaintext: string, subKeys: { p256dh: string; auth: string }): Promise<{ ciphertext: ArrayBuffer; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const p256dh = b64ToUint8(subKeys.p256dh);
  const auth   = b64ToUint8(subKeys.auth);

  // Generate ephemeral server key pair
  const serverKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
  const serverPublicKeyJwk = await crypto.subtle.exportKey('jwk', serverKeyPair.publicKey);

  // Import client's p256dh key
  const clientPublicKey = await crypto.subtle.importKey(
    'raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );

  // Derive shared secret via ECDH
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey }, serverKeyPair.privateKey, 256
  );

  // Salt (16 random bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Export raw server public key
  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey));

  // HKDF to derive IKM and then content + nonce keys (RFC 8291)
  const encoder = new TextEncoder();

  async function hkdfExtract(salt: Uint8Array, ikm: ArrayBuffer): Promise<CryptoKey> {
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey', 'deriveBits']);
    return key;
  }

  // Build ikm using auth tag
  const authInfo = encoder.encode('WebPush: info\0').buffer;
  const authContext = new Uint8Array([...encoder.encode('WebPush: info\0'), ...p256dh, ...serverPublicKeyRaw]);

  const prk = await crypto.subtle.importKey('raw', sharedBits, { name: 'HKDF' }, false, ['deriveBits']);
  const ikm = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: auth, info: authContext }, prk, 256
  );

  const prkKey = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);

  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = encoder.encode('Content-Encoding: nonce\0');

  const cek = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo }, prkKey, 128);
  const nonceBytes = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, prkKey, 96);

  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const nonce = new Uint8Array(nonceBytes);

  // Pad plaintext with a \x02 delimiter (RFC 8291 §4)
  const paddedData = new Uint8Array([...encoder.encode(plaintext), 2]);

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedData);

  return { ciphertext, salt, serverPublicKey: serverPublicKeyRaw };
}

async function sendWebPush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string, vapidPublic: string, vapidPrivate: string): Promise<boolean> {
  try {
    const { ciphertext, salt, serverPublicKey } = await encryptWebPush(payload, subscription.keys);

    // Build aes128gcm content-encoding header (RFC 8188)
    const recordSize = 4096;
    const header = new Uint8Array(16 + 4 + 1 + serverPublicKey.length);
    header.set(salt, 0);
    const view = new DataView(header.buffer);
    view.setUint32(16, recordSize, false); // big-endian
    header[20] = serverPublicKey.length;
    header.set(serverPublicKey, 21);

    const body = new Uint8Array(header.length + ciphertext.byteLength);
    body.set(header);
    body.set(new Uint8Array(ciphertext), header.length);

    const authorization = await buildVapidHeader(subscription.endpoint, vapidPublic, vapidPrivate);

    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Authorization': authorization,
      },
      body: body,
    });
    return res.status >= 200 && res.status < 300;
  } catch(e) {
    return false;
  }
}

// ── Main handler ──────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (data, status?) => new Response(JSON.stringify(data), { status: status || 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const db = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    const authHeader = req.headers.get('Authorization') || '';
    const userJwt = authHeader.replace('Bearer ', '').trim();
    if (!userJwt) return json({ error: 'Missing authorization' }, 401);

    const authResult = await db.auth.getUser(userJwt);
    if (authResult.error || !authResult.data || !authResult.data.user) return json({ error: 'Invalid token' }, 401);
    const callerId = authResult.data.user['id'];

    const profileResult = await db.from('profiles').select('role').eq('id', callerId).single();
    if (!profileResult.data || profileResult.data['role'] !== 'admin') return json({ error: 'Admin only' }, 403);

    const reqBody = await req.json();
    const target       = reqBody['target'];
    const title        = reqBody['title'];
    const msg          = reqBody['body'];
    const type         = reqBody['type'] || 'info';
    const deepLink     = reqBody['deepLink'] || null;
    const imageUrl     = reqBody['imageUrl'] || null;
    const provinces    = reqBody['provinces'] || null;
    const scheduledFor = reqBody['scheduledFor'] || null;

    if (!title || !msg) return json({ error: 'title and body required' }, 400);

    if (scheduledFor) {
      const schedResult = await db.from('scheduled_notifications').insert({ target: target, title: title, body: msg, type: type, deep_link: deepLink, image_url: imageUrl, provinces: provinces, scheduled_for: scheduledFor, status: 'pending' });
      if (schedResult.error) throw schedResult.error;
      return json({ scheduled: true, scheduled_for: scheduledFor });
    }

    let q = db.from('profiles').select('id, push_token, push_subscription, province');
    if (target === 'verified')        q = q.eq('verified', true);
    else if (target === 'unverified') q = q.eq('verified', false);
    else if (target !== 'all' && target !== 'sellers' && target !== 'buyers') q = q.eq('id', target);
    if (provinces && provinces.length > 0) q = q.in('province', provinces);

    const profilesResult = await q.limit(5000);
    if (profilesResult.error) throw profilesResult.error;

    let profiles = profilesResult.data || [];

    if (target === 'sellers' || target === 'buyers') {
      const listingsResult = await db.from('listings').select('seller_id').neq('status', 'banned').limit(10000);
      const sellerSet = new Set((listingsResult.data || []).map((l) => l['seller_id']));
      profiles = profiles.filter((p) => target === 'sellers' ? sellerSet.has(p['id']) : !sellerSet.has(p['id']));
    }

    // Insert notification records into DB so in-app notification centre shows them
    const now = Date.now();
    const dbRows = profiles.map((p) => ({
      id: crypto.randomUUID(),
      user_id: p['id'],
      title: title,
      body: msg,
      type: type,
      read: false,
      created_at: now,
      meta: { deepLink: deepLink, imageUrl: imageUrl },
    }));
    for (let i = 0; i < dbRows.length; i += 100) {
      await db.from('notifications').insert(dbRows.slice(i, i + 100));
    }

    const pushPayload = JSON.stringify({ title, body: msg, type, deepLink, image: imageUrl || undefined });

    // ── FCM (legacy push_token) ────────────────────────────
    const withFCM = profiles.filter((p) => p['push_token']);
    let fcmSent = 0, fcmFailed = 0;

    if (withFCM.length > 0) {
      const saEnv = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
      if (saEnv) {
        const sa = JSON.parse(saEnv);
        const accessToken = await getFCMAccessToken(sa);
        const fcmData: Record<string, string> = { type };
        if (deepLink) fcmData['deepLink'] = deepLink;
        for (let i = 0; i < withFCM.length; i += 25) {
          const batch = withFCM.slice(i, i + 25);
          const results = await Promise.all(batch.map((p) => sendFCM(p['push_token'], sa['project_id'], accessToken, title, msg, fcmData, imageUrl)));
          results.forEach((ok) => { if (ok) fcmSent++; else fcmFailed++; });
        }
      }
    }

    // ── Web Push (VAPID push_subscription) ─────────────────
    const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const withWebPush  = profiles.filter((p) => p['push_subscription']);
    let webPushSent = 0, webPushFailed = 0;

    if (withWebPush.length > 0 && vapidPublic && vapidPrivate) {
      for (const p of withWebPush) {
        try {
          const sub = typeof p['push_subscription'] === 'string'
            ? JSON.parse(p['push_subscription'])
            : p['push_subscription'];
          const ok = await sendWebPush(sub, pushPayload, vapidPublic, vapidPrivate);
          if (ok) webPushSent++; else webPushFailed++;
        } catch(e) {
          webPushFailed++;
        }
      }
    }

    return json({
      success: true,
      total_users:    profiles.length,
      fcm_sent:       fcmSent,
      fcm_failed:     fcmFailed,
      web_push_sent:  webPushSent,
      web_push_failed: webPushFailed,
      no_token:       profiles.filter(p => !p['push_token'] && !p['push_subscription']).length,
      db_inserted:    dbRows.length,
    });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
