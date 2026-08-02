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

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return html('<p>This unsubscribe link is invalid or has expired.</p>', 400)
  }

  const projectUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: didUnsubscribe, error } = await db.rpc('amos_unsubscribe_by_token', { p_token: token })

  if (error) {
    return html('<p>Something went wrong. Please try again later or contact support@pamarketzw.com.</p>', 500)
  }
  if (!didUnsubscribe) {
    return html('<p>This unsubscribe link is invalid or has expired.</p>', 404)
  }

  return html(`
    <p style="font-size:15px;line-height:1.6;margin:0 0 8px">You've been unsubscribed from PaMarket marketing emails.</p>
    <p style="font-size:13px;color:#64748B;line-height:1.6;margin:0">You'll still receive account and transaction-related emails. You can re-enable marketing emails anytime in your account settings.</p>
  `)
})
