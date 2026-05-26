const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (data, status) => new Response(JSON.stringify(data), { status: status || 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

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

    let q = db.from('profiles').select('id, push_token, province');
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

    const withToken = profiles.filter((p) => p['push_token']);
    let fcmSent = 0;
    let fcmFailed = 0;

    if (withToken.length > 0) {
      const sa = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT'));
      const accessToken = await getFCMAccessToken(sa);
      const fcmData = { type: type };
      if (deepLink) fcmData['deepLink'] = deepLink;

      for (let i = 0; i < withToken.length; i += 25) {
        const batch = withToken.slice(i, i + 25);
        const results = await Promise.all(batch.map((p) => sendFCM(p['push_token'], sa['project_id'], accessToken, title, msg, fcmData, imageUrl)));
        results.forEach((ok) => { if (ok) { fcmSent++; } else { fcmFailed++; } });
      }
    }

    return json({ success: true, total_users: profiles.length, fcm_sent: fcmSent, fcm_failed: fcmFailed, no_token: profiles.length - withToken.length, db_inserted: dbRows.length });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
