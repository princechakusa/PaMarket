import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkAmosRateLimit } from '../_shared/amos-rate-limit.ts'

// Deploy:  supabase functions deploy amos-advanced-intelligence --no-verify-jwt
//
// AMOS Module 8 — Advanced Market Intelligence (internal signals).
//
// Deepens Module 1's research beyond zero-result search gaps:
//   1. Trending searches — a term whose search volume THIS WEEK clearly
//      exceeds its own recent baseline (the prior 3 weeks), regardless
//      of whether it currently has results. Module 1 only ever looked at
//      zero/low-result terms; a rising term that already has results is
//      still a real signal worth a content push (it's climbing, not
//      failing).
//   2. Supply gaps — categories where this week's search volume clearly
//      outstrips active listing supply (a ratio, not Module 7's blunt
//      "fewer than 3 listings" threshold), a sharper signal for where to
//      recruit sellers.
//
// Writes into amos_market_intelligence (Module 0's schema, unchanged),
// tagged raw.source='amos_module_8'/'amos_module_8_trending' so the
// rollback script can find and remove exactly what this module wrote.
//
// Deliberately does NOT touch Google Trends, Reddit, or news scraping —
// no credential or scraping infrastructure exists for any of them in
// this project. Recorded as an explicit note in the summary, not
// silently skipped.
//
// Same dual-auth + rate-limit pattern as every other amos-* function.

const ALLOWED_ORIGINS = new Set(['https://pamarketzw.com', 'https://www.pamarketzw.com', 'https://admin.pamarketzw.com'])
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
const TREND_MIN_RECENT_COUNT = 3       // ignore noise: a term needs at least this many searches this week to be considered
const TREND_MIN_GROWTH_RATIO = 2.0     // this week's volume must be at least 2x the prior-3-week weekly average
const SUPPLY_GAP_MIN_SEARCHES = 5      // ignore noise on the supply-gap side too

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
    const rate = await checkAmosRateLimit(db, 'amos-advanced-intelligence', userData.user.id, { windowMinutes: 10, maxCalls: 5 })
    if (!rate.allowed) return json({ error: `Too many manual runs — try again in ${rate.retryAfterSeconds}s` }, 429)
  }

  const summary = { trending_terms_found: 0, supply_gaps_found: 0, notes: [] as string[], errors: [] as string[] }
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600e3)
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 3600e3)

  // ── 1. Trending searches (velocity, not just zero-result) ───────────
  try {
    const { data: rows, error } = await db.from('search_logs').select('term, results, created_at').gte('created_at', fourWeeksAgo.toISOString()).limit(20000)
    if (error) throw error

    const recentCounts = new Map<string, number>()
    const priorCounts = new Map<string, number>()
    for (const r of rows || []) {
      const term = (r.term || '').trim().toLowerCase()
      if (!term) continue
      const createdAt = new Date(r.created_at)
      if (createdAt >= weekAgo) recentCounts.set(term, (recentCounts.get(term) || 0) + 1)
      else priorCounts.set(term, (priorCounts.get(term) || 0) + 1)
    }

    const trending: { term: string; recent: number; priorWeeklyAvg: number; ratio: number }[] = []
    for (const [term, recent] of recentCounts.entries()) {
      if (recent < TREND_MIN_RECENT_COUNT) continue
      const priorTotal = priorCounts.get(term) || 0
      const priorWeeklyAvg = priorTotal / 3 // 3 prior weeks in the 4-week window
      const ratio = priorWeeklyAvg > 0 ? recent / priorWeeklyAvg : recent // brand-new term this week: treat as maximally trending
      if (ratio >= TREND_MIN_GROWTH_RATIO) trending.push({ term, recent, priorWeeklyAvg, ratio })
    }
    trending.sort((a, b) => b.ratio - a.ratio)

    // Replace today's batch (recomputed snapshot, not append-only — same
    // approach Module 1's research runner already uses).
    await db.from('amos_market_intelligence').delete()
      .eq('signal_type', 'internal_search_gap')
      .eq('raw->>source', 'amos_module_8_trending')
      .gte('collected_at', `${today}T00:00:00Z`)

    for (const t of trending.slice(0, 30)) {
      const { error: insertError } = await db.from('amos_market_intelligence').insert({
        country_code: 'ZW',
        signal_type: 'internal_search_gap', // reuses the existing signal_type — this IS a search-demand signal, just velocity-based rather than zero-result-based
        topic: t.term,
        score: Math.round(t.ratio * 10),
        rationale: `Searched ${t.recent} time(s) this week vs. a ${t.priorWeeklyAvg.toFixed(1)}/week baseline over the prior 3 weeks — a ${t.ratio.toFixed(1)}x rise. Worth a timely content push regardless of whether it currently has results.`,
        raw: { source: 'amos_module_8_trending', recent_count: t.recent, prior_weekly_avg: t.priorWeeklyAvg, growth_ratio: t.ratio },
        expires_at: new Date(now.getTime() + 7 * 24 * 3600e3).toISOString(),
      })
      if (insertError) summary.errors.push(`trending/${t.term}: ${insertError.message}`)
      else summary.trending_terms_found++
    }
  } catch (e) { summary.errors.push('Trending search detection: ' + (e instanceof Error ? e.message : String(e))) }

  // ── 2. Supply gaps (search demand vs. active listing supply, by
  //    category — approximated by matching search terms to category
  //    names/keywords already present in the app's own category list) ──
  try {
    const REAL_CATEGORIES = ['property', 'vehicles', 'rooms', 'electronics', 'jobs', 'furniture', 'fashion', 'services', 'agriculture', 'pets', 'kids', 'other']
    const { data: searchRows } = await db.from('search_logs').select('term').gte('created_at', weekAgo.toISOString()).limit(20000)
    const { data: listingRows } = await db.from('listings').select('category').eq('status', 'active')

    const listingCounts = new Map<string, number>()
    for (const r of listingRows || []) {
      const cat = (r as { category: string | null }).category || 'other'
      listingCounts.set(cat, (listingCounts.get(cat) || 0) + 1)
    }

    const searchCounts = new Map<string, number>()
    for (const r of searchRows || []) {
      const term = ((r as { term: string }).term || '').toLowerCase()
      const matchedCategory = REAL_CATEGORIES.find((c) => term.includes(c))
      if (matchedCategory) searchCounts.set(matchedCategory, (searchCounts.get(matchedCategory) || 0) + 1)
    }

    await db.from('amos_market_intelligence').delete()
      .eq('signal_type', 'internal_search_gap')
      .eq('raw->>source', 'amos_module_8_supply_gap')
      .gte('collected_at', `${today}T00:00:00Z`)

    for (const [cat, searches] of searchCounts.entries()) {
      if (searches < SUPPLY_GAP_MIN_SEARCHES) continue
      const listings = listingCounts.get(cat) || 0
      const ratio = listings > 0 ? searches / listings : searches
      if (ratio < 1.5) continue // demand isn't meaningfully ahead of supply
      const { error: insertError } = await db.from('amos_market_intelligence').insert({
        country_code: 'ZW',
        signal_type: 'internal_search_gap',
        topic: `${cat} (supply gap)`,
        score: Math.round(ratio * 10),
        rationale: `${searches} category-matching search(es) this week vs. only ${listings} active listing(s) — demand is outpacing supply ${ratio.toFixed(1)}x. Recommend a seller-acquisition push for this category.`,
        raw: { source: 'amos_module_8_supply_gap', category: cat, searches, active_listings: listings, ratio },
        expires_at: new Date(now.getTime() + 7 * 24 * 3600e3).toISOString(),
      })
      if (insertError) summary.errors.push(`supply_gap/${cat}: ${insertError.message}`)
      else summary.supply_gaps_found++
    }
  } catch (e) { summary.errors.push('Supply gap detection: ' + (e instanceof Error ? e.message : String(e))) }

  summary.notes.push('Google Trends, Reddit, and news monitoring are not implemented — no official Trends API, and no scraping infrastructure or credential exists in this project for the others. Competitor tracking is a separate function (amos-competitor-tracker) driven by an admin-maintained watchlist, not automated discovery.')

  const ok = summary.errors.length === 0
  const finishedAt = Date.now()
  console.log(`[amos-advanced-intelligence] run finished ok=${ok} ${summary.trending_terms_found} trending term(s), ${summary.supply_gaps_found} supply gap(s)`)
  if (summary.errors.length) console.error('[amos-advanced-intelligence] errors:', summary.errors)
  await db.from('job_runs').insert({
    job: 'amos_advanced_intelligence', ok,
    detail: `${summary.trending_terms_found} trending term(s), ${summary.supply_gaps_found} supply gap(s)`,
    rows_affected: summary.trending_terms_found + summary.supply_gaps_found,
    started_at: new Date(startedAt).toISOString(),
    trigger_type: triggeredBy.actorRole === 'system' ? 'cron' : 'manual',
    meta: { ...summary, triggered_by: triggeredBy.actorRole, duration_ms: finishedAt - startedAt },
  })
  if (triggeredBy.actorRole !== 'system') {
    await db.from('admin_audit_logs').insert({
      actor_id: triggeredBy.actorId, actor_email: triggeredBy.actorEmail, actor_role: triggeredBy.actorRole,
      action: 'run_amos_advanced_intelligence', entity: 'amos_market_intelligence', entity_id: null,
      after_state: { ...summary, duration_ms: finishedAt - startedAt }, reason: 'manual trigger from AMOS Market Intelligence',
    })
  }
  return json({ success: ok, ...summary, duration_ms: finishedAt - startedAt }, ok ? 200 : 207)
})
