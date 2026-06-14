// notify-message — sends an FCM push to the recipient when a chat message is
// inserted. Wired via a Supabase Database Webhook on public.messages (INSERT).
// The app already shows the in-app notification; this makes it appear on the
// phone's lock screen / tray even when the app is backgrounded or closed.
//
// Required Edge Function secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
//   FIREBASE_SERVICE_ACCOUNT                 (same JSON used by send-push)
//   NOTIFY_WEBHOOK_SECRET                    (a random string; also set as the
//                                             webhook's "x-webhook-secret" header)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

async function getFCMAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
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
  if (!tokenData['access_token']) throw new Error('FCM auth failed: ' + JSON.stringify(tokenData));
  return tokenData['access_token'];
}

async function sendFCM(pushToken: string, projectId: string, accessToken: string, title: string, body: string, data: Record<string, string>): Promise<boolean> {
  const message = {
    token: pushToken,
    notification: { title, body },
    data,
    android: { priority: 'high', notification: { channel_id: 'pamarket_default', sound: 'default' } },
  };
  const res = await fetch('https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const result = await res.json();
  return !result['error'];
}

// Turn the stored message text into a clean preview (offers/replies are JSON).
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
    // Verify the webhook secret so only your DB webhook can trigger pushes.
    const expected = Deno.env.get('NOTIFY_WEBHOOK_SECRET');
    if (expected && req.headers.get('x-webhook-secret') !== expected) return json({ error: 'unauthorized' }, 401);

    const payload = await req.json();
    const record = payload && (payload.record || payload.new || payload); // DB webhook -> .record
    if (!record || !record.conversation_id || !record.sender_id) return json({ skipped: 'no record' });

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Recipients = conversation members who didn't send the message.
    const convRes = await db.from('conversations').select('members').eq('id', record.conversation_id).single();
    let members: string[] = (convRes.data && Array.isArray(convRes.data.members)) ? convRes.data.members : [];
    if (!members.length) {
      // Fallback: derive the other member from prior messages in this conversation.
      const others = await db.from('messages').select('sender_id').eq('conversation_id', record.conversation_id).neq('sender_id', record.sender_id).limit(1);
      members = [record.sender_id, ...((others.data || []).map((r: any) => r.sender_id))];
    }
    const recipients = members.filter((m) => m && m !== record.sender_id);
    if (!recipients.length) return json({ skipped: 'no recipient' });

    const profRes = await db.from('profiles').select('id, push_token').in('id', recipients);
    const tokens = (profRes.data || []).filter((p: any) => p.push_token);
    if (!tokens.length) return json({ skipped: 'no push tokens' });

    const saEnv = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!saEnv) return json({ error: 'FIREBASE_SERVICE_ACCOUNT not set' }, 500);
    const sa = JSON.parse(saEnv);
    const accessToken = await getFCMAccessToken(sa);

    const title = record.sender_name || 'New message';
    const body = preview(record.text, !!record.image);
    const data = { type: 'message', deepLink: 'Messages', conversationId: String(record.conversation_id) };

    let sent = 0, failed = 0;
    await Promise.all(tokens.map(async (p: any) => {
      const ok = await sendFCM(p.push_token, sa['project_id'], accessToken, title, body, data);
      if (ok) sent++; else failed++;
    }));

    return json({ success: true, sent, failed });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
