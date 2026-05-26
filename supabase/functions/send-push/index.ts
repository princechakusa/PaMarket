const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getFCMAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const b64url = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const sigInput = b64url(header) + '.' + b64url(payload);
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\n/g, '');
  const cryptoKey = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput));
  const jwt = sigInput + '.' + btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt });
  const data = await res.json();
  if (!data.access_token) throw new Error('FCM auth failed: ' + JSON.stringify(data));
  return data.access_token;
}

async function sendFCM(token, projectId, accessToken, title, body, data, imageUrl) {
  const message = {
    token: token,
    notification: { title: title, body: body },
    data: data,
    android: { priority: 'high', notification: { channel_id: 'pamarket_default', sound: 'default', image: imageUrl || undefined } },
    apns: imageUrl ? { payload: { aps: {} }, fcm_options: { image: imageUrl } } : undefined,
  };
  const res = await fetch('https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message }),
  });
  const result = await res.json();
  return !result.error;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (data, status = 200) => new Response(JSON.stringify(data), { status: status, headers: { ...CORS, 'Content-Type': 'application/json' } });

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const db = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    const authHeader = req.headers.get('Authorization') || '';
    const userJwt = authHeader.replace('Bearer ', '').trim();
    if (!userJwt) return json({ error: 'Missing authorization' }, 401);

    const { data: { user }, error: authErr } = await db.auth.getUser(userJwt);
    if (authErr || !user) return json({ error: 'Invalid token' }, 401);

    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'admin') return json({ error: 'Admin only' }, 403);

    const reqBody = await req.json();
    const target      = reqBody.target;
    const title       = reqBody.title;
    const msg         = reqBody.body;
    const type        = reqBody.type || 'info';
    const deepLink    = reqBody.deepLink || null;
    const imageUrl    = reqBody.imageUrl || null;
    const provinces   = reqBody.provinces || null;
    const scheduledFor = reqBody.scheduledFor || null;

    if (!title || !msg) return json({ error: 'title and body required' }, 400);

    if (scheduledFor) {
      const { error } = await db.from('scheduled_notifications').insert({ target: target, title: title, body: msg, type: type, deep_link: deepLink, image_url: imageUrl, provinces: provinces, scheduled_for: scheduledFor, status: 'pending' });
      if (error) throw error;
      return json({ scheduled: true, scheduled_for: scheduledFor });
    }

    let q = db.from('profiles').select('id, push_token, province');
    if (target === 'verified')        q = q.eq('verified', true);
    else if (target === 'unverified') q = q.eq('verified', false);
    else if (target !== 'all' && target !== 'sellers' && target !== 'buyers') q = q.eq('id', target);
    if (provinces && provinces.length > 0) q = q.in('province', provinces);

    const { data: rawProfiles, error: pErr } = await q.limit(5000);
    if (pErr) throw pErr;

    let profiles = rawProfiles || [];

    if (target === 'sellers' || target === 'buyers') {
      const { data: listings } = await db.from('listings').select('seller_id').neq('status', 'banned').limit(10000);
      const sellerSet = new Set((listings || []).map((l) => l.seller_id));
      profiles = profiles.filter((p) => target === 'sellers' ? sellerSet.has(p.id) : !sellerSet.has(p.id));
    }

    const now = Date.now();
    const dbRows = profiles.map((p) => ({ id: crypto.randomUUID(), user_id: p.id, title: title, body: msg, type: type, read: false, created_at: now, meta: { deepLink: deepLink, imageUrl: imageUrl } }));
    for (let i = 0; i < dbRows.length; i += 100) { await db.from('notifications').insert(dbRows.slice(i, i + 100)); }

    const withToken = profiles.filter((p) => p.push_token);
    let fcmSent = 0, fcmFailed = 0;

    if (withToken.length > 0) {
      const sa = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT'));
      const accessToken = await getFCMAccessToken(sa);
      const fcmData = { type: type };
      if (deepLink) fcmData.deepLink = deepLink;
      for (let i = 0; i < withToken.length; i += 25) {
        const results = await Promise.all(withToken.slice(i, i + 25).map((p) => sendFCM(p.push_token, sa.project_id, accessToken, title, msg, fcmData, imageUrl)));
        results.forEach((ok) => ok ? fcmSent++ : fcmFailed++);
      }
    }

    return json({ success: true, total_users: profiles.length, fcm_sent: fcmSent, fcm_failed: fcmFailed, no_token: profiles.length - withToken.length, db_inserted: dbRows.length });

  } catch (e) {
    return json({ error: e.message }, 500);
  }
});


const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushRequest {
  target: string;        // 'all'|'verified'|'unverified'|'sellers'|'buyers'|<user_id>
  title: string;
  body: string;
  type?: string;
  deepLink?: string;
  imageUrl?: string;
  provinces?: string[];
  scheduledFor?: string; // ISO datetime string
}

// Build a signed JWT and exchange it for an FCM OAuth 2.0 access token
async function getFCMAccessToken(sa: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const b64url = (o: object) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  };

  const sigInput = `${b64url(header)}.${b64url(payload)}`;

  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\n/g, '');

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(sigInput),
  );

  const jwt = `${sigInput}.${btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('FCM auth failed: ' + JSON.stringify(data));
  return data.access_token;
}

// Send a single FCM message to one device token
async function sendFCM(opts: {
  token: string;
  projectId: string;
  accessToken: string;
  title: string;
  body: string;
  data: Record<string, string>;
  imageUrl?: string;
}): Promise<boolean> {
  const message: Record<string, unknown> = {
    token: opts.token,
    notification: { title: opts.title, body: opts.body },
    data: opts.data,
    android: {
      priority: 'high',
      notification: {
        channel_id: 'pamarket_default',
        sound: 'default',
        ...(opts.imageUrl ? { image: opts.imageUrl } : {}),
      },
    },
    apns: opts.imageUrl
      ? { payload: { aps: {} }, fcm_options: { image: opts.imageUrl } }
      : undefined,
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${opts.projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    },
  );

  const result = await res.json();
  return !result.error;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

    // Service-role client for DB operations
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify caller is an admin
    const authHeader = req.headers.get('Authorization') ?? '';
    const userJwt = authHeader.replace('Bearer ', '').trim();
    if (!userJwt) return json({ error: 'Missing authorization' }, 401);

    const { data: { user }, error: authErr } = await db.auth.getUser(userJwt);
    if (authErr || !user) return json({ error: 'Invalid token' }, 401);

    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') return json({ error: 'Admin only' }, 403);

    // Parse request
    const body: PushRequest = await req.json();
    const {
      target, title, body: msg,
      type = 'info', deepLink, imageUrl,
      provinces, scheduledFor,
    } = body;

    if (!title || !msg) return json({ error: 'title and body required' }, 400);

    // ── Scheduling path ──────────────────────────────────────
    if (scheduledFor) {
      const { error } = await db.from('scheduled_notifications').insert({
        target, title, body: msg, type,
        deep_link:    deepLink   ?? null,
        image_url:    imageUrl   ?? null,
        provinces:    provinces  ?? null,
        scheduled_for: scheduledFor,
        status: 'pending',
      });
      if (error) throw error;
      return json({ scheduled: true, scheduled_for: scheduledFor });
    }

    // ── Immediate send path ──────────────────────────────────
    // Build profile query
    let q = db.from('profiles').select('id, push_token, province');

    if (target === 'verified')        q = q.eq('verified', true);
    else if (target === 'unverified') q = q.eq('verified', false);
    else if (target !== 'all' && target !== 'sellers' && target !== 'buyers')
      q = q.eq('id', target);   // single user

    if (provinces && provinces.length > 0) q = q.in('province', provinces);

    const { data: rawProfiles, error: pErr } = await q.limit(5000);
    if (pErr) throw pErr;

    let profiles = rawProfiles ?? [];

    // Sellers / buyers split
    if (target === 'sellers' || target === 'buyers') {
      const { data: listings } = await db
        .from('listings').select('seller_id').neq('status', 'banned').limit(10000);
      const sellerSet = new Set((listings ?? []).map((l: Record<string, string>) => l.seller_id));
      profiles = profiles.filter((p: Record<string, string>) =>
        target === 'sellers' ? sellerSet.has(p.id) : !sellerSet.has(p.id),
      );
    }

    // Insert in-app notification rows (DB — shows inside the app)
    const now = Date.now();
    const dbRows = profiles.map((p: Record<string, string>) => ({
      id:         crypto.randomUUID(),
      user_id:    p.id,
      title, body: msg, type,
      read:       false,
      created_at: now,
      meta:       { deepLink: deepLink ?? null, imageUrl: imageUrl ?? null },
    }));

    for (let i = 0; i < dbRows.length; i += 100) {
      await db.from('notifications').insert(dbRows.slice(i, i + 100));
    }

    // Send FCM push to devices that have a token
    const withToken = profiles.filter((p: Record<string, string>) => p.push_token);

    let fcmSent = 0, fcmFailed = 0;

    if (withToken.length > 0) {
      const sa = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!);
      const accessToken = await getFCMAccessToken(sa);
      const fcmData: Record<string, string> = { type };
      if (deepLink) fcmData.deepLink = deepLink;

      for (let i = 0; i < withToken.length; i += 25) {
        const results = await Promise.all(
          withToken.slice(i, i + 25).map((p: Record<string, string>) =>
            sendFCM({
              token:       p.push_token,
              projectId:   sa.project_id,
              accessToken,
              title, body: msg,
              data:        fcmData,
              imageUrl,
            }),
          ),
        );
        results.forEach(ok => ok ? fcmSent++ : fcmFailed++);
      }
    }

    return json({
      success:     true,
      total_users: profiles.length,
      fcm_sent:    fcmSent,
      fcm_failed:  fcmFailed,
      no_token:    profiles.length - withToken.length,
      db_inserted: dbRows.length,
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
