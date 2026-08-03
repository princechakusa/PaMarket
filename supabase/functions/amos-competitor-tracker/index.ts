import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkAmosRateLimit } from '../_shared/amos-rate-limit.ts'

// Deploy:  supabase functions deploy amos-competitor-tracker --no-verify-jwt
//
// AMOS Module 8 — Competitor tracking.
//
// Deliberately NOT automated discovery or scraping — no scraping
// infrastructure or credential exists in this project, and "who is
// PaMarket's competitor" is business knowledge only a human has, not
// something to guess. Instead: an admin maintains a short, real list in
// amos_competitor_watchlist (name/website/notes), and this function turns
// that into a structured amos_market_intelligence 'competitor' signal on
// a schedule — a reminder/prompt for the admin to actually go check each
// competitor, not an automated intelligence feed. Honest about what it
// is: a checklist generator, not a spy tool.
//
// Same dual-auth + rate-limit pattern as every other amos-* function.

const ALLOWED_ORIGINS = new Set(['https://pamarketzw.com', 'https://www.pamarketzw.com'])
function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://pamarketzw.com'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-automation-secret',
    'Vary': 'Origin',
  }
}

const ADMIN_TEAM_ROLES = new Set(['super_admin', 'admin', 'moderator', 'support', 'finance'])

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const startedAt = Date.now()
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })

  let triggeredBy = { actorId: null as string | null, actorEmail: null as string | null, actorRole: 'system' }
  const configuredSecret = Deno.env.get('AUTOMATION_SECRET') || ''
  const suppliedSecret = req.headers.get('x-automation-secret') || ''
  const cronAuthOk = !!configuredSecret && suppliedSecret === configuredSecret

  if (!cronAuthOk) {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'Unauthorized automation request' }, 401)
    const { data: userData, error: userError } = await db.auth.getUser(token)
    if (userError || !userData?.user) return json({ error: 'Unauthorized automation request' }, 401)
    const { data: profile, error: profileError } = await db.from('profiles').select('role, email').eq('id', userData.user.id).maybeSingle()
    if (profileError || !profile || !ADMIN_TEAM_ROLES.has(profile.role)) return json({ error: 'Unauthorized automation request' }, 401)
    triggeredBy = { actorId: userData.user.id, actorEmail: profile.email || userData.user.email || null, actorRole: profile.role }
    const rate = await checkAmosRateLimit(db, 'amos-competitor-tracker', userData.user.id, { windowMinutes: 10, maxCalls: 5 })
    if (!rate.allowed) return json({ error: `Too many manual runs — try again in ${rate.retryAfterSeconds}s` }, 429)
  }

  const summary = { competitors_tracked: 0, watchlist_empty: false, errors: [] as string[] }
  const today = new Date().toISOString().slice(0, 10)

  try {
    const { data: watchlist, error } = await db.from('amos_competitor_watchlist').select('*').eq('active', true)
    if (error) throw error

    if (!watchlist || !watchlist.length) {
      summary.watchlist_empty = true
    } else {
      // Replace today's batch, same recomputed-snapshot approach as
      // every other AMOS research source.
      await db.from('amos_market_intelligence').delete()
        .eq('signal_type', 'competitor')
        .gte('collected_at', `${today}T00:00:00Z`)

      for (const c of watchlist) {
        const row = c as { name: string; website_url: string | null; notes: string | null }
        const { error: insertError } = await db.from('amos_market_intelligence').insert({
          country_code: 'ZW',
          signal_type: 'competitor',
          topic: row.name,
          score: null,
          rationale: `Scheduled competitor check-in: ${row.name}${row.website_url ? ` (${row.website_url})` : ''}.${row.notes ? ` Notes: ${row.notes}` : ' No notes on file yet — worth a quick look at current pricing/promotions.'}`,
          raw: { source: 'amos_module_8', website_url: row.website_url, notes: row.notes },
          expires_at: new Date(Date.now() + 7 * 24 * 3600e3).toISOString(),
        })
        if (insertError) summary.errors.push(`${row.name}: ${insertError.message}`)
        else summary.competitors_tracked++
      }
    }
  } catch (e) { summary.errors.push(e instanceof Error ? e.message : String(e)) }

  const ok = summary.errors.length === 0
  const finishedAt = Date.now()
  const detail = summary.watchlist_empty
    ? 'Competitor watchlist is empty — add competitors in Market Intelligence to start tracking.'
    : `${summary.competitors_tracked} competitor(s) tracked`

  console.log(`[amos-competitor-tracker] run finished ok=${ok} ${detail}`)
  if (summary.errors.length) console.error('[amos-competitor-tracker] errors:', summary.errors)

  await db.from('job_runs').insert({
    job: 'amos_competitor_tracker', ok, detail,
    rows_affected: summary.competitors_tracked,
    started_at: new Date(startedAt).toISOString(),
    trigger_type: triggeredBy.actorRole === 'system' ? 'cron' : 'manual',
    meta: { ...summary, triggered_by: triggeredBy.actorRole, duration_ms: finishedAt - startedAt },
  })
  if (triggeredBy.actorRole !== 'system') {
    await db.from('admin_audit_logs').insert({
      actor_id: triggeredBy.actorId, actor_email: triggeredBy.actorEmail, actor_role: triggeredBy.actorRole,
      action: 'run_amos_competitor_tracker', entity: 'amos_market_intelligence', entity_id: null,
      after_state: { ...summary, duration_ms: finishedAt - startedAt }, reason: 'manual trigger from AMOS Market Intelligence',
    })
  }
  return json({ success: ok, ...summary, duration_ms: finishedAt - startedAt }, ok ? 200 : 207)
})
