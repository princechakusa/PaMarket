import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkAmosRateLimit } from '../_shared/amos-rate-limit.ts'

// Deploy:  supabase functions deploy amos-analytics-collector --no-verify-jwt
// (same reason as every other amos-* function: the cron path calls this
// with only x-automation-secret, no apikey/Authorization header.)
//
// AMOS Module 6 — Analytics & Performance Tracking.
//
// Collects into amos_metrics_daily (Module 0's schema, unchanged) once
// per day: real PaMarket marketplace metrics (listings created, active
// users, category mix — all directly queryable, nothing fabricated) and
// AMOS's own operational funnel (drafts generated -> approved/rejected ->
// scheduled -> published). Deliberately does NOT collect social-platform
// insights (reach, engagement, CTR from Facebook/Instagram/etc.) in this
// module: as of Module 5, no channel has a real credential connected yet
// (Facebook's Page token still doesn't exist in this project — see
// Module 4's completion report), so there is no real API to call for
// that data. Rather than fabricate placeholder numbers, this collector
// checks amos_integrations for each platform and only attempts a
// platform's insights call if it's actually 'connected' — currently
// none are, so this path is built and ready but inert until a real
// connection exists, same pattern as every other "missing credential"
// case in this project.
//
// UNIQUE(country_code, date, channel, metric) on amos_metrics_daily means
// re-running this on the same day safely upserts rather than duplicating.
//
// Same dual-auth pattern as every other amos-* function.

const ALLOWED_ORIGINS = new Set([
  'https://pamarketzw.com',
  'https://www.pamarketzw.com',
])

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
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const startedAt = Date.now()
  const projectUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(projectUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let triggeredBy: { actorId: string | null; actorEmail: string | null; actorRole: string } = {
    actorId: null, actorEmail: null, actorRole: 'system',
  }

  const configuredSecret = Deno.env.get('AUTOMATION_SECRET') || ''
  const suppliedSecret = req.headers.get('x-automation-secret') || ''
  const cronAuthOk = !!configuredSecret && suppliedSecret === configuredSecret

  if (!cronAuthOk) {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'Unauthorized automation request' }, 401)

    const { data: userData, error: userError } = await db.auth.getUser(token)
    if (userError || !userData?.user) return json({ error: 'Unauthorized automation request' }, 401)

    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('role, email')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (profileError || !profile || !ADMIN_TEAM_ROLES.has(profile.role)) {
      return json({ error: 'Unauthorized automation request' }, 401)
    }

    triggeredBy = { actorId: userData.user.id, actorEmail: profile.email || userData.user.email || null, actorRole: profile.role }

    const rate = await checkAmosRateLimit(db, 'amos-analytics-collector', userData.user.id, { windowMinutes: 10, maxCalls: 5 })
    if (!rate.allowed) return json({ error: `Too many manual runs — try again in ${rate.retryAfterSeconds}s` }, 429)
  }

  const summary = { metrics_written: 0, errors: [] as string[] }
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 24 * 3600e3).toISOString()
  const last7d = new Date(Date.now() - 7 * 24 * 3600e3).toISOString()

  const upsertMetric = async (channel: string, metric: string, value: number, source: 'internal' | 'api' = 'internal') => {
    const { error } = await db.from('amos_metrics_daily')
      .upsert({ country_code: 'ZW', date: today, channel, metric, value, source }, { onConflict: 'country_code,date,channel,metric' })
    if (error) { summary.errors.push(`${channel}/${metric}: ${error.message}`) } else { summary.metrics_written++ }
  }

  // ── Real marketplace metrics ────────────────────────────────────────
  try {
    const { count: listingsToday } = await db.from('listings').select('id', { count: 'exact', head: true }).gte('created_at', yesterday)
    await upsertMetric('marketplace', 'listings_created', listingsToday || 0)
  } catch (e) { summary.errors.push('listings_created: ' + (e instanceof Error ? e.message : String(e))) }

  // profiles has two parallel presence columns — last_seen (written by
  // the RN mobile app's telemetry) and last_seen_at (written by the
  // website's telemetry, a pre-existing inconsistency in this codebase,
  // not introduced here). "Active" has to check both, or mobile-only or
  // website-only users would be undercounted depending on which column
  // is queried.
  try {
    const { count: activeToday } = await db.from('profiles').select('id', { count: 'exact', head: true })
      .or(`last_seen.gte.${yesterday},last_seen_at.gte.${yesterday}`)
    await upsertMetric('marketplace', 'active_users_24h', activeToday || 0)
  } catch (e) { summary.errors.push('active_users_24h: ' + (e instanceof Error ? e.message : String(e))) }

  try {
    const { count: active7d } = await db.from('profiles').select('id', { count: 'exact', head: true })
      .or(`last_seen.gte.${last7d},last_seen_at.gte.${last7d}`)
    await upsertMetric('marketplace', 'active_users_7d', active7d || 0)
  } catch (e) { summary.errors.push('active_users_7d: ' + (e instanceof Error ? e.message : String(e))) }

  try {
    const { count: newUsersToday } = await db.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', yesterday)
    await upsertMetric('marketplace', 'new_users', newUsersToday || 0)
  } catch (e) { summary.errors.push('new_users: ' + (e instanceof Error ? e.message : String(e))) }

  // ── AMOS's own operational funnel ───────────────────────────────────
  try {
    const { count: draftsToday } = await db.from('amos_content_drafts').select('id', { count: 'exact', head: true }).gte('created_at', yesterday)
    await upsertMetric('amos', 'drafts_generated', draftsToday || 0)
  } catch (e) { summary.errors.push('drafts_generated: ' + (e instanceof Error ? e.message : String(e))) }

  try {
    const { count: approvedToday } = await db.from('amos_content_drafts').select('id', { count: 'exact', head: true }).eq('status', 'approved').gte('reviewed_at', yesterday)
    await upsertMetric('amos', 'drafts_approved', approvedToday || 0)
  } catch (e) { summary.errors.push('drafts_approved: ' + (e instanceof Error ? e.message : String(e))) }

  try {
    const { count: rejectedToday } = await db.from('amos_content_drafts').select('id', { count: 'exact', head: true }).eq('status', 'rejected').gte('reviewed_at', yesterday)
    await upsertMetric('amos', 'drafts_rejected', rejectedToday || 0)
  } catch (e) { summary.errors.push('drafts_rejected: ' + (e instanceof Error ? e.message : String(e))) }

  try {
    const { count: publishedToday } = await db.from('amos_schedule').select('id', { count: 'exact', head: true }).eq('status', 'published').gte('last_attempt_at', yesterday)
    await upsertMetric('amos', 'items_published', publishedToday || 0)
  } catch (e) { summary.errors.push('items_published: ' + (e instanceof Error ? e.message : String(e))) }

  try {
    const { count: intelToday } = await db.from('amos_market_intelligence').select('id', { count: 'exact', head: true }).gte('collected_at', yesterday)
    await upsertMetric('amos', 'intelligence_signals_collected', intelToday || 0)
  } catch (e) { summary.errors.push('intelligence_signals_collected: ' + (e instanceof Error ? e.message : String(e))) }

  // ── Category mix (marketplace health, not AMOS-specific) ────────────
  try {
    const { data: categoryRows } = await db.from('listings').select('category').gte('created_at', yesterday)
    const counts = new Map<string, number>()
    for (const r of categoryRows || []) {
      const cat = (r as { category: string | null }).category || 'other'
      counts.set(cat, (counts.get(cat) || 0) + 1)
    }
    for (const [cat, count] of counts.entries()) {
      await upsertMetric('marketplace', `category_${cat}_listings`, count)
    }
  } catch (e) { summary.errors.push('category mix: ' + (e instanceof Error ? e.message : String(e))) }

  // ── Social platform insights — only for genuinely connected channels.
  //    As of this module's build, none are connected, so this loop does
  //    nothing yet — built and ready, not fabricating data. ────────────
  try {
    const { data: connected } = await db.from('amos_integrations').select('provider').eq('status', 'connected')
    for (const row of connected || []) {
      // No insights-fetching implemented for any provider yet — every
      // adapter's publish() call so far only returns a post id/url, not
      // ongoing engagement metrics. Recording this explicitly rather than
      // silently skipping, so System Health shows it was considered.
      summary.errors.push(`${(row as { provider: string }).provider}: connected, but insights collection not implemented yet (Module 6 covers internal metrics only)`)
    }
  } catch { /* amos_integrations read failure here shouldn't fail the whole run */ }

  const ok = summary.errors.length === 0
  const finishedAt = Date.now()
  const detail = `${summary.metrics_written} metric(s) written` + (summary.errors.length ? `, ${summary.errors.length} note(s)` : '')

  console.log(`[amos-analytics-collector] run finished ok=${ok} ${detail}`)
  if (summary.errors.length) console.error('[amos-analytics-collector] errors:', summary.errors)

  await db.from('job_runs').insert({
    job: 'amos_analytics_collector',
    ok,
    detail,
    rows_affected: summary.metrics_written,
    started_at: new Date(startedAt).toISOString(),
    trigger_type: triggeredBy.actorRole === 'system' ? 'cron' : 'manual',
    meta: { ...summary, triggered_by: triggeredBy.actorRole, duration_ms: finishedAt - startedAt },
  })

  if (triggeredBy.actorRole !== 'system') {
    await db.from('admin_audit_logs').insert({
      actor_id: triggeredBy.actorId,
      actor_email: triggeredBy.actorEmail,
      actor_role: triggeredBy.actorRole,
      action: 'run_amos_analytics_collector',
      entity: 'amos_metrics_daily',
      entity_id: null,
      after_state: { ...summary, duration_ms: finishedAt - startedAt },
      reason: 'manual trigger from AMOS Dashboard',
    })
  }

  return json({ success: ok, ...summary, duration_ms: finishedAt - startedAt }, ok ? 200 : 207)
})
