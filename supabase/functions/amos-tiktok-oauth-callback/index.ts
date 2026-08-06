import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deploy:  supabase functions deploy amos-tiktok-oauth-callback --no-verify-jwt
// Required — TikTok's OAuth redirect hits this function as a plain
// browser navigation with no Authorization/apikey header, only
// `code`/`state`/`error` query params.
//
// AMOS Module 14 — TikTok OAuth, step 2 of 2.
//
// This exact URL (with NO query parameters appended, ever — TikTok
// rejects a redirect_uri containing any) is what's registered as the
// redirect URI in TikTok's Login Kit settings, and is the URL passed as
// redirect_uri both when generating the authorize link
// (amos-tiktok-oauth-start) and when exchanging the code for tokens
// below — TikTok requires it match exactly in both places.
//
// Unauthenticated by design (TikTok's redirect carries no admin session)
// — the single-use, expiring `state` token issued by the start leg is
// what proves this callback belongs to a real admin-initiated flow
// rather than an attacker hitting this URL directly with a guessed or
// replayed code.

const CALLBACK_URL = 'https://gxgytumhknmnwspxjzxw.supabase.co/functions/v1/amos-tiktok-oauth-callback'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const projectUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY') || ''
  const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET') || ''
  const adminReturnUrl = Deno.env.get('AMOS_ADMIN_URL') || 'https://pamarket.chakusaprince.workers.dev'

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
  // the same state can't both pass.
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
        redirect_uri: CALLBACK_URL,
      }),
    })
    const tokenBody = await tokenRes.json()
    if (!tokenRes.ok || !tokenBody.access_token) {
      console.error('[amos-tiktok-oauth-callback] token exchange failed:', tokenBody)
      return Response.redirect(`${adminReturnUrl}/?tiktok_error=token_exchange_failed`, 302)
    }

    const secretValue = `${tokenBody.open_id}:${tokenBody.access_token}:${tokenBody.refresh_token}`
    const { error: setError } = await db.rpc('amos_set_integration_credential', {
      p_provider: 'tiktok', p_secret_name: 'tiktok_oauth_tokens', p_secret_value: secretValue,
    })
    if (setError) {
      console.error('[amos-tiktok-oauth-callback] failed to store credential:', setError.message)
      return Response.redirect(`${adminReturnUrl}/?tiktok_error=credential_store_failed`, 302)
    }

    console.log('[amos-tiktok-oauth-callback] TikTok connected successfully, open_id=', tokenBody.open_id)
    return Response.redirect(`${adminReturnUrl}/?tiktok_connected=1`, 302)
  } catch (error) {
    console.error('[amos-tiktok-oauth-callback] callback error:', error instanceof Error ? error.message : String(error))
    return Response.redirect(`${adminReturnUrl}/?tiktok_error=unexpected_error`, 302)
  }
})
