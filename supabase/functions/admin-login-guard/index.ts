// admin-login-guard — authenticated destructive-action throttling and the
// legacy admin panel's server-observed IP helper.
//
// The old anonymous `check` / `record` login-state actions are deliberately
// retired. A browser cannot prove that Supabase Auth rejected a password, so
// accepting its claimed email/result allowed anyone to manufacture attempts
// and lock out a chosen administrator. Password brute-force protection is
// owned by Supabase Auth. The admin clients retain their local duplicate/UX
// limiter and send bounded, non-authoritative security signals through
// record-security-event.
//
// Deploy:  supabase functions deploy admin-login-guard --no-verify-jwt
// Required Edge Function secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
// Optional:
//   ADMIN_ALERT_USER_IDS  comma-separated profile ids to push-alert (falls
//                         back to every profile with role in ADMIN_ROLES)
//
// Migrated to the shared allowlist (Stage 6).
import { corsHeaders } from '../_shared/cors.ts';
import { ADMIN_ALERT_ROLES, isRetiredPublicLoginStateAction, trustedCloudflareIp } from '../_shared/admin-login-guard-policy.ts';

// Destructive-mutation throttle (ban/delete/role-change). A compromised or
// rogue admin session should not be able to mass-ban/mass-delete faster than
// a human plausibly would. Server-side and keyed by admin UID (not IP) since,
// unlike login, the caller is already authenticated here.
const MAX_MUTATIONS_PER_WINDOW = 20;
const MUTATION_WINDOW_MS       = 5 * 60 * 1000;   // 20 destructive actions / 5 min
const MUTATION_BLOCK_MS        = 10 * 60 * 1000;  // then a 10 min cool-down

function realIp(req: Request): string {
  // Only Cloudflare's own header is trusted. Browser-controlled forwarding
  // headers are never accepted as an attributed client IP.
  return trustedCloudflareIp(req.headers);
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (data: unknown, status?: number) =>
    new Response(JSON.stringify(data), { status: status || 200, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body['action'];

    // These actions previously accepted a caller-selected email plus a
    // caller-asserted authentication result. Reject them before constructing
    // a service-role client so no anonymous request can read or write login
    // attempt/block state, even if obsolete client code replays the request.
    if (isRetiredPublicLoginStateAction(action)) {
      return json({ error: 'unsupported_action' }, 410);
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const ip = realIp(req);

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

    return json({ error: 'unknown action' }, 400);
  } catch (_err) {
    return json({ error: 'internal_error' }, 500);
  }
});

// How often this function alerts admins when the authenticated destructive-
// mutation throttle opens a block.
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

async function alertAdmins(db: any, info: { ip: string; email: string; ipFails: number; emailFails: number; blockReason: string }) {
  // Cooldown check: skip alerting entirely (no new in-app row, no push) if
  // we already sent a security_alert within the cooldown window. Reuses the
  // notifications table itself as the ledger rather than a new table —
  // notifications_type_idx (user_id, type, created_at desc) doesn't cover a
  // user_id-less scan, so this is a small bounded scan (recent rows only,
  // capped by the 30-day purge job), acceptable for a low-frequency check.
  const since = Date.now() - ALERT_COOLDOWN_MS;
  const recent = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'security_alert')
    .gt('created_at', since);
  if ((recent.count || 0) > 0) return;

  const explicit = (Deno.env.get('ADMIN_ALERT_USER_IDS') || '').split(',').map((s) => s.trim()).filter(Boolean);

  let targetIds = explicit;
  if (!targetIds.length) {
    const admins = await db.from('profiles').select('id').in('role', [...ADMIN_ALERT_ROLES]);
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
  //
  // target:'admins' (not 'all'): this is a security alert about a blocked
  // login attempt — it must reach admin/moderator/support/finance staff
  // only, the same role set the in-app notifications rows above are scoped
  // to. send-push resolves 'admins' via profiles.role, matching the existing
  // admin-role mechanism rather than a new one.
  try {
    await fetch(Deno.env.get('SUPABASE_URL') + '/functions/v1/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        'x-automation-secret': Deno.env.get('AUTOMATION_SECRET') || '',
      },
      body: JSON.stringify({ target: 'admins', title, body: message, type: 'security_alert' }),
    });
  } catch (_e) { /* db notification row above is the durable record */ }
}
