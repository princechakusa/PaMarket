import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deploy:  supabase functions deploy amos-tiktok-oauth --no-verify-jwt
// Required — TikTok's OAuth redirect hits this function directly as a
// browser navigation with no Authorization/apikey header at all
// (start step) or only a `code`/`state` query param (callback step).
// Supabase's platform gateway would reject both without this flag,
// same reason as every other AMOS function that talks to an external
// automation/redirect caller.
//
// AMOS Module 14 — TikTok Content Posting API, OAuth (Login Kit).
//
// Two steps, both served by this one function via a `step` query param:
//   1. step=start  (admin, authenticated via Supabase session JWT) —
//      generates a random state token, stores it server-side with a
//      short TTL, and 302-redirects the admin's browser to TikTok's
//      authorize URL.
//   2. step=callback (TikTok, unauthenticated browser redirect) —
//      TikTok sends the user back here with `code` + the same `state`.
//      This step verifies the state was one WE issued (via the stored
//      row, single-use, expiring) — since this leg of the flow has no
//      JWT to check, the state token is what stands in for "this really
//      is our own OAuth flow completing, not an attacker hitting the
//      callback directly." Exchanges the code for tokens, stores them in
//      Vault via the same amos_set_integration_credential pattern every
//      other AMOS provider uses, then redirects back to the admin panel.
//
// credentials_ref value: "<openId>:<accessToken>:<refreshToken>" — one
// secret holding all three pieces TikTokPublisher needs (access tokens
// expire in 24h and must be refreshed using the refresh token, which is
// valid 365 days).

const ALLOWED_ORIGINS = new Set([
  'https://pamarketzw.com',
  'https://www.pamarketzw.com',
  'https://admin.pamarketzw.com',
  'https://pamarket.chakusaprince.workers.dev',
])

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://pamarketzw.com'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Vary': 'Origin',
  }
}

const ADMIN_TEAM_ROLES = new Set(['super_admin', 'admin', 'moderator', 'support', 'finance'])
const TIKTOK_SCOPES = 'user.info.basic,video.publish'
const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes — plenty for an admin to complete the TikTok login screen

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  const step = url.searchParams.get('step')
  const selfUrl = `${url.origin}${url.pathname}`

  const projectUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY') || ''
  const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET') || ''
  const adminReturnUrl = Deno.env.get('AMOS_ADMIN_URL') || 'https://pamarket.chakusaprince.workers.dev'

  if (step === 'start') {
    // Authenticated admin only — this leg requires the normal Supabase
    // session JWT, same dual-auth posture as every other AMOS admin action.
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })

    const { data: userData, error: userError } = await db.auth.getUser(token)
    if (userError || !userData?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })

    const { data: profile } = await db.from('profiles').select('role').eq('id', userData.user.id).maybeSingle()
    if (!profile || !ADMIN_TEAM_ROLES.has(profile.role)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    if (!clientKey) {
      return new Response(JSON.stringify({ error: 'TIKTOK_CLIENT_KEY not configured' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const state = crypto.randomUUID()
    const { error: stateError } = await db.from('amos_oauth_states').insert({
      provider: 'tiktok', state, created_by: userData.user.id, expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
    })
    if (stateError) {
      return new Response(JSON.stringify({ error: 'Failed to start OAuth flow: ' + stateError.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const authorizeUrl = new URL('https://www.tiktok.com/v2/auth/authorize/')
    authorizeUrl.searchParams.set('client_key', clientKey)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('scope', TIKTOK_SCOPES)
    authorizeUrl.searchParams.set('redirect_uri', `${selfUrl}?step=callback`)
    authorizeUrl.searchParams.set('state', state)

    // JSON, not a 302 — the caller is the admin panel's own JS doing an
    // authenticated fetch() (to attach the session JWT as a header,
    // which a plain browser navigation/window.open can't do). The
    // browser itself performs the actual navigation to TikTok using the
    // URL returned here via window.location, so the JWT is never
    // exposed in a URL, browser history, or referrer header.
    return new Response(JSON.stringify({ authorizeUrl: authorizeUrl.toString() }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  if (step === 'callback') {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const errorParam = url.searchParams.get('error')

    if (errorParam) {
      return Response.redirect(`${adminReturnUrl}/?tiktok_error=${encodeURIComponent(errorParam)}`, 302)
    }
    if (!code || !state) {
      return Response.redirect(`${adminReturnUrl}/?tiktok_error=missing_code_or_state`, 302)
    }

    // Single-use, expiring: delete-and-check-rowcount rather than a
    // separate exists-check-then-delete, so two concurrent requests with
    // the same state can't both pass (a real attack the naive version
    // would be vulnerable to).
    const { data: deletedState, error: stateDeleteError } = await db
      .from('amos_oauth_states')
      .delete()
      .eq('provider', 'tiktok')
      .eq('state', state)
      .gte('expires_at', new Date().toISOString())
      .select('id')
    if (stateDeleteError || !deletedState || deletedState.length === 0) {
      return Response.redirect(`${adminReturnUrl}/?tiktok_error=invalid_or_expired_state`, 302)
    }

    try {
      const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'cache-control': 'no-cache' },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${selfUrl}?step=callback`,
        }),
      })
      const tokenBody = await tokenRes.json()
      if (!tokenRes.ok || !tokenBody.access_token) {
        console.error('[amos-tiktok-oauth] token exchange failed:', tokenBody)
        return Response.redirect(`${adminReturnUrl}/?tiktok_error=token_exchange_failed`, 302)
      }

      const secretValue = `${tokenBody.open_id}:${tokenBody.access_token}:${tokenBody.refresh_token}`
      const { error: setError } = await db.rpc('amos_set_integration_credential', {
        p_provider: 'tiktok', p_secret_name: 'tiktok_oauth_tokens', p_secret_value: secretValue,
      })
      if (setError) {
        console.error('[amos-tiktok-oauth] failed to store credential:', setError.message)
        return Response.redirect(`${adminReturnUrl}/?tiktok_error=credential_store_failed`, 302)
      }

      console.log('[amos-tiktok-oauth] TikTok connected successfully, open_id=', tokenBody.open_id)
      return Response.redirect(`${adminReturnUrl}/?tiktok_connected=1`, 302)
    } catch (error) {
      console.error('[amos-tiktok-oauth] callback error:', error instanceof Error ? error.message : String(error))
      return Response.redirect(`${adminReturnUrl}/?tiktok_error=unexpected_error`, 302)
    }
  }

  return new Response(JSON.stringify({ error: 'Unknown step — expected ?step=start or ?step=callback' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
})
