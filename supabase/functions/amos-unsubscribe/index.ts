import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deploy:  supabase functions deploy amos-unsubscribe --no-verify-jwt
// (must be publicly reachable with no auth — this IS the auth: a real
// email client clicking a link, not a logged-in session. Standard for
// one-click unsubscribe, matching how transactional email providers
// expect this to work.)
//
// AMOS Module 5 — marketing-email unsubscribe endpoint. GET
// /amos-unsubscribe?token=<uuid> flips profiles.marketing_email_opt_out
// via the amos_unsubscribe_by_token RPC (AMOS_MODULE_5_CHANNEL_
// INTEGRATIONS.sql) and returns a small plain-HTML confirmation page —
// no JS, no redirect chain, works even in the most locked-down email
// client webview.
//
// Production Readiness Audit fix (Medium #3): IP-based rate limiting.
// UUIDv4 tokens (122 bits of entropy) make brute-forcing infeasible, so
// this isn't a security boundary — it's a resource-exhaustion guard
// against volumetric abuse of the one genuinely public, unauthenticated
// AMOS endpoint. Fails open on a rate-limit-table hiccup, same philosophy
// as checkAmosRateLimit.

const RATE_LIMIT_WINDOW_MINUTES = 10
const RATE_LIMIT_MAX_REQUESTS = 20

function realIp(req: Request): string {
  // Same extraction order as admin-login-guard's realIp() — Cloudflare
  // sets CF-Connecting-IP; fall back to the first hop of XFF.
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

Deno.serve(async (req) => {
  const html = (body: string, status = 200) => new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PaMarket</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#F8FAFC;color:#0F172A;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px">
<div style="max-width:420px;text-align:center;background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:32px 28px">
<div style="font-size:20px;font-weight:900;letter-spacing:-.02em;margin-bottom:16px">Pa<span style="color:#E8A33D">Market</span></div>
${body}
</div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )

  if (req.method !== 'GET') return html('<p>Method not allowed.</p>', 405)

  const projectUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const ip = realIp(req)
  try {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString()
    const { count, error: rateError } = await db
      .from('amos_unsubscribe_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', since)
    if (!rateError && (count || 0) >= RATE_LIMIT_MAX_REQUESTS) {
      console.warn(`[amos-unsubscribe] rate limited: ip=${ip} count=${count}`)
      return html('<p>Too many requests. Please try again later.</p>', 429)
    }
    await db.from('amos_unsubscribe_attempts').insert({ ip })
  } catch (e) {
    // Fail open — a rate-limit hiccup should never block a real
    // unsubscribe request.
    console.warn('[amos-unsubscribe] rate limit check failed, failing open:', e instanceof Error ? e.message : String(e))
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    console.log(`[amos-unsubscribe] invalid token format from ip=${ip}`)
    return html('<p>This unsubscribe link is invalid or has expired.</p>', 400)
  }

  const { data: didUnsubscribe, error } = await db.rpc('amos_unsubscribe_by_token', { p_token: token })

  if (error) {
    console.error('[amos-unsubscribe] RPC error:', error.message)
    return html('<p>Something went wrong. Please try again later or contact support@pamarketzw.com.</p>', 500)
  }
  if (!didUnsubscribe) {
    console.log(`[amos-unsubscribe] unknown token from ip=${ip}`)
    return html('<p>This unsubscribe link is invalid or has expired.</p>', 404)
  }

  console.log(`[amos-unsubscribe] successful unsubscribe from ip=${ip}`)
  return html(`
    <p style="font-size:15px;line-height:1.6;margin:0 0 8px">You've been unsubscribed from PaMarket marketing emails.</p>
    <p style="font-size:13px;color:#64748B;line-height:1.6;margin:0">You'll still receive account and transaction-related emails. You can re-enable marketing emails anytime in your account settings.</p>
  `)
})
