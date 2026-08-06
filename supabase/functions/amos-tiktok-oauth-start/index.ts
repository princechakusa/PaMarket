import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deploy:  supabase functions deploy amos-tiktok-oauth-start --no-verify-jwt
// (--no-verify-jwt is required by every AMOS function pattern even
// though this one DOES check a real Supabase session JWT itself —
// Supabase's platform gateway would otherwise require its own bearer
// token format before this function's code ever runs.)
//
// AMOS Module 14 — TikTok OAuth, step 1 of 2.
//
// Split into its own function (rather than one function branching on a
// ?step= query param) because TikTok's registered redirect URI is not
// allowed to contain query parameters at all — confirmed live in the
// developer portal ("Your uri should not contain query parameters").
// The callback leg (amos-tiktok-oauth-callback) therefore needs a
// completely clean URL with nothing after the path.
//
// Authenticated admin only (real Supabase session JWT + admin-team
// role check) — generates a random, short-lived, single-use state
// token, stores it, and returns TikTok's authorize URL as JSON. The
// admin panel's own JS does the actual browser navigation via
// window.location, so the session JWT is never exposed in a URL,
// browser history entry, or Referer header.

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
const TIKTOK_SCOPES = 'user.info.basic,video.upload'
const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes — plenty for an admin to complete the TikTok login screen

// Must exactly match the clean (no query params) redirect URI registered
// in TikTok's Login Kit settings.
const CALLBACK_URL = 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/amos-tiktok-oauth-callback'

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const projectUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const { data: userData, error: userError } = await db.auth.getUser(token)
  if (userError || !userData?.user) return json({ error: 'Unauthorized' }, 401)

  const { data: profile } = await db.from('profiles').select('role').eq('id', userData.user.id).maybeSingle()
  if (!profile || !ADMIN_TEAM_ROLES.has(profile.role)) return json({ error: 'Unauthorized' }, 401)

  const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY') || ''
  if (!clientKey) return json({ error: 'TIKTOK_CLIENT_KEY not configured' }, 500)

  const state = crypto.randomUUID()
  const { error: stateError } = await db.from('amos_oauth_states').insert({
    provider: 'tiktok', state, created_by: userData.user.id, expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
  })
  if (stateError) return json({ error: 'Failed to start OAuth flow: ' + stateError.message }, 500)

  const authorizeUrl = new URL('https://www.tiktok.com/v2/auth/authorize/')
  authorizeUrl.searchParams.set('client_key', clientKey)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('scope', TIKTOK_SCOPES)
  authorizeUrl.searchParams.set('redirect_uri', CALLBACK_URL)
  authorizeUrl.searchParams.set('state', state)

  return json({ authorizeUrl: authorizeUrl.toString() })
})
