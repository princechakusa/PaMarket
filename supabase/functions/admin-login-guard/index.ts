// admin-login-guard — server-side brute-force protection for the admin panel
// login (www/admin.html). Client-side sessionStorage lockouts are trivially
// bypassed (clear storage / new tab / new IP), so the real gate lives here:
//
//   check  → called BEFORE Supabase auth. Returns whether this IP+email pair
//            is currently locked out. The real client IP is only visible to
//            an edge function (CF-Connecting-IP / x-forwarded-for), never to
//            browser JS.
//   record → called AFTER each login attempt (success or failure). Persists
//            the attempt with the real IP, and once a caller crosses the
//            failure threshold, opens a timed IP block and pushes an admin
//            alert (via send-push) naming the IP and email that were tried.
//
// Deploy:  supabase functions deploy admin-login-guard --no-verify-jwt
// Required Edge Function secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
// Optional:
//   ADMIN_ALERT_USER_IDS  comma-separated profile ids to push-alert (falls
//                         back to every profile with role in ADMIN_ROLES)
//
// Requires admin_login_attempts.ip (text) and table admin_ip_blocks — see
// supabase/schema/admin_login_guard.sql.

const ALLOWED_ORIGINS = new Set([
  'https://pamarketzw.com',
  'https://www.pamarketzw.com',
  'https://admin.pamarketzw.com',
  'https://pamarket.chakusaprince.workers.dev',
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

const MAX_FAILS_PER_IP    = 8;   // across any email, from one IP
const MAX_FAILS_PER_EMAIL = 5;   // across any IP, against one admin email
const BLOCK_MS            = 30 * 60 * 1000;   // 30 min hard block
const WINDOW_MS           = 15 * 60 * 1000;   // failures older than this don't count

// Destructive-mutation throttle (ban/delete/role-change). A compromised or
// rogue admin session should not be able to mass-ban/mass-delete faster than
// a human plausibly would. Server-side and keyed by admin UID (not IP) since,
// unlike login, the caller is already authenticated here.
const MAX_MUTATIONS_PER_WINDOW = 20;
const MUTATION_WINDOW_MS       = 5 * 60 * 1000;   // 20 destructive actions / 5 min
const MUTATION_BLOCK_MS        = 10 * 60 * 1000;  // then a 10 min cool-down

function realIp(req: Request): string {
  // Cloudflare sets CF-Connecting-IP; fall back to the first hop of XFF.
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (data: unknown, status?: number) =>
    new Response(JSON.stringify(data), { status: status || 200, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const ip = realIp(req);
    const body = await req.json().catch(() => ({}));
    const action = body['action'];
    const email = String(body['email'] || '').trim().toLowerCase();

    if (action === 'whoami') {
      // Cheap real-IP echo for the admin panel's audit logger (section 9 of
      // the SOC brief wants IP + browser on every audit entry, not just
      // login attempts). No auth check needed — an IP address alone isn't
      // sensitive, and the caller must already be an authenticated admin to
      // reach any code path that uses this.
      return json({ ip });
    }

    if (action === 'mutation-check' || action === 'mutation-record') {
      // Unlike login/whoami, these need to know WHICH admin is calling —
      // verify the caller's JWT rather than trusting a client-supplied id
      // (that would let a compromised session claim to be someone else and
      // burn a different admin's quota, or just lie about being blocked).
      const authHeader = req.headers.get('authorization') || '';
      const jwt = authHeader.replace(/^Bearer\s+/i, '');
      if (!jwt) return json({ error: 'Missing authorization' }, 401);
      const userResult = await db.auth.getUser(jwt);
      if (userResult.error || !userResult.data?.user) return json({ error: 'Invalid token' }, 401);
      const adminId = userResult.data.user.id;

      const now = new Date().toISOString();
      const blocked = await db
        .from('admin_mutation_blocks')
        .select('until, reason')
        .eq('admin_id', adminId)
        .gt('until', now)
        .order('until', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (blocked.data) {
        return json({ blocked: true, until: blocked.data['until'], reason: blocked.data['reason'] });
      }

      if (action === 'mutation-check') {
        return json({ blocked: false });
      }

      // mutation-record: log this destructive action, then check the
      // rolling window and open a throttle block if the admin has crossed it.
      const actionName = String(body['action_name'] || 'unknown').slice(0, 100);
      await db.from('admin_mutation_log').insert({ admin_id: adminId, action_name: actionName, ip });

      const since = new Date(Date.now() - MUTATION_WINDOW_MS).toISOString();
      const countRes = await db
        .from('admin_mutation_log')
        .select('id', { count: 'exact', head: true })
        .eq('admin_id', adminId)
        .gt('created_at', since);
      const count = countRes.count || 0;

      if (count >= MAX_MUTATIONS_PER_WINDOW) {
        const until = new Date(Date.now() + MUTATION_BLOCK_MS).toISOString();
        await db.from('admin_mutation_blocks').insert({
          admin_id: adminId, until, reason: `${count} destructive actions in ${MUTATION_WINDOW_MS / 60000} min`,
        });
        try {
          const emailRes = await db.from('profiles').select('email').eq('id', adminId).single();
          await alertAdmins(db, {
            ip, email: emailRes.data?.email || adminId, ipFails: 0, emailFails: 0,
            blockReason: `mutation throttle: ${count} destructive actions in ${MUTATION_WINDOW_MS / 60000} min`,
          });
        } catch (_e) { /* alert is best-effort */ }
        return json({ blocked: true, until, reason: 'mutation rate limit exceeded' });
      }

      return json({ blocked: false, countInWindow: count });
    }

    if (action === 'check') {
      if (!email) return json({ error: 'email required' }, 400);
      const now = new Date().toISOString();
      const blocked = await db
        .from('admin_ip_blocks')
        .select('until, reason')
        .or(`ip.eq.${ip},email.eq.${email}`)
        .gt('until', now)
        .order('until', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (blocked.data) {
        return json({ blocked: true, until: blocked.data['until'], reason: blocked.data['reason'] });
      }
      return json({ blocked: false, ip });
    }

    if (action === 'record') {
      const ok = !!body['ok'];
      const reason = body['reason'] || null;
      const userAgent = req.headers.get('user-agent') || null;

      await db.from('admin_login_attempts').insert({
        email: email || null, ok, reason, ip, user_agent: userAgent,
      });

      if (ok) return json({ recorded: true });

      const since = new Date(Date.now() - WINDOW_MS).toISOString();
      const [byIp, byEmail] = await Promise.all([
        db.from('admin_login_attempts').select('id', { count: 'exact', head: true }).eq('ip', ip).eq('ok', false).gt('created_at', since),
        email
          ? db.from('admin_login_attempts').select('id', { count: 'exact', head: true }).eq('email', email).eq('ok', false).gt('created_at', since)
          : Promise.resolve({ count: 0 } as any),
      ]);

      const ipFails = byIp.count || 0;
      const emailFails = byEmail.count || 0;
      const triggerIp = ipFails >= MAX_FAILS_PER_IP;
      const triggerEmail = emailFails >= MAX_FAILS_PER_EMAIL;

      if (triggerIp || triggerEmail) {
        const until = new Date(Date.now() + BLOCK_MS).toISOString();
        const blockReason = triggerIp && triggerEmail
          ? 'repeated failed logins (ip+email)'
          : triggerIp ? 'repeated failed logins (ip)' : 'repeated failed logins (email)';

        await db.from('admin_ip_blocks').insert({
          ip: triggerIp ? ip : null,
          email: triggerEmail ? email : null,
          until, reason: blockReason,
        });

        // Fire-and-forget push alert to admins — never let a delivery failure
        // affect the lockout response itself.
        try {
          await alertAdmins(db, { ip, email, ipFails, emailFails, blockReason });
        } catch (_e) { /* alert is best-effort */ }

        return json({ blocked: true, until, reason: blockReason });
      }

      return json({ recorded: true, ipFailsInWindow: ipFails, emailFailsInWindow: emailFails });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

async function alertAdmins(db: any, info: { ip: string; email: string; ipFails: number; emailFails: number; blockReason: string }) {
  const explicit = (Deno.env.get('ADMIN_ALERT_USER_IDS') || '').split(',').map((s) => s.trim()).filter(Boolean);

  let targetIds = explicit;
  if (!targetIds.length) {
    const admins = await db.from('profiles').select('id').in('role', ['admin', 'moderator', 'support', 'finance']);
    targetIds = (admins.data || []).map((p: any) => p['id']);
  }
  if (!targetIds.length) return;

  const title = 'Admin login blocked — possible attack';
  const message = `IP ${info.ip} tried "${info.email || 'unknown email'}" and was blocked (${info.blockReason}). `
    + `${info.ipFails} failed attempts from this IP, ${info.emailFails} against this email in the last 15 min.`;

  await db.from('notifications').insert(
    targetIds.map((id: string) => ({
      id: crypto.randomUUID(),
      user_id: id,
      title,
      body: message,
      type: 'security_alert',
      read: false,
      created_at: Date.now(),
      meta: { ip: info.ip, email: info.email },
    })),
  );

  // Reuse the existing push pipeline (FCM/web-push + preference checks) rather
  // than reimplementing delivery here — security_alert is not in the opt-out
  // map in notify-message/send-push, so it always reaches the device.
  try {
    await fetch(Deno.env.get('SUPABASE_URL') + '/functions/v1/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        'x-automation-secret': Deno.env.get('AUTOMATION_SECRET') || '',
      },
      body: JSON.stringify({ target: 'all', title, body: message, type: 'security_alert' }),
    });
  } catch (_e) { /* db notification row above is the durable record */ }
}
