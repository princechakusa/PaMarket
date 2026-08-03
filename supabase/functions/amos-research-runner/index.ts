import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkAmosRateLimit } from '../_shared/amos-rate-limit.ts'

// Deploy:  supabase functions deploy amos-research-runner --no-verify-jwt
// (required: the pg_cron path calls this with only x-automation-secret, no
// apikey/Authorization header — same as automation-runner. Auth is fully
// handled inside this function instead, via either path below.)
//
// AMOS Module 1 — Market Intelligence / Research runner.
//
// Two isolated auth paths, same principle as automation-runner but extended
// for a second caller:
//   1. Cron path — x-automation-secret header matches AUTOMATION_SECRET.
//      No pg_cron schedule is wired up yet (manual-trigger only, per the
//      decision to review output quality first), but the function supports
//      it from day one so enabling the schedule later needs no code change.
//   2. Manual path — a Supabase session JWT (Authorization: Bearer <token>)
//      belonging to a signed-in admin-team profile, used by the "Run Now"
//      button in admin.html's System Health tab. The cron secret never
//      touches browser code; this path verifies the JWT server-side against
//      Supabase Auth, then checks profiles.role is an admin-team role,
//      rejecting anyone else. Every manual run is written to
//      admin_audit_logs with actor_id/actor_email/timestamp/result — the
//      cron path logs as actor 'system' instead.
//
// Two signal sources, each isolated in its own try/catch so one failing
// never blocks the other:
//   1. Internal search gaps — zero/low-result search_logs terms (already
//      collected by both the website and the RN app's lib/telemetry.ts).
//   2. ZW calendar — upcoming public holidays / school terms / salary
//      periods from amos_zw_calendar (Module 1's own reference table).
// Both write into amos_market_intelligence (Module 0's schema, unchanged).
//
// No external API calls anywhere in this function.

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
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-automation-secret',
    'Vary': 'Origin',
  }
}

const SEARCH_GAP_WINDOW_DAYS = 14
const SEARCH_GAP_MIN_OCCURRENCES = 2
const CALENDAR_LOOKAHEAD_DAYS = 21
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

  // ── Auth: cron secret OR a signed-in admin-team JWT — never both paths
  // trusted implicitly, each fully verified before anything runs. ────────
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

    // Verify the JWT is a real, current Supabase session (not just
    // well-formed) by asking Auth to resolve it to a user.
    const { data: userData, error: userError } = await db.auth.getUser(token)
    if (userError || !userData?.user) return json({ error: 'Unauthorized automation request' }, 401)

    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('role, email, name')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (profileError || !profile || !ADMIN_TEAM_ROLES.has(profile.role)) {
      return json({ error: 'Unauthorized automation request' }, 401)
    }

    triggeredBy = {
      actorId: userData.user.id,
      actorEmail: profile.email || userData.user.email || null,
      actorRole: profile.role,
    }

    // Rate limit only the manual path — a scheduled cron run is never
    // spammy, and the cron secret is already the higher-trust path.
    const rate = await checkAmosRateLimit(db, 'amos-research-runner', userData.user.id, { windowMinutes: 10, maxCalls: 5 })
    if (!rate.allowed) {
      return json({ error: `Too many manual runs — try again in ${rate.retryAfterSeconds}s` }, 429)
    }
  }

  const summary = {
    search_gaps_found: 0,
    calendar_signals_written: 0,
    errors: [] as string[],
  }

  // Housekeeping (Production Readiness Audit, Medium #4 fix): purge
  // amos_manual_trigger_log rows older than a day. Piggybacked onto this
  // function's existing daily schedule rather than adding a dedicated
  // cron entry for something this lightweight — best-effort, a failure
  // here never blocks real research collection below.
  try {
    const { data: purged } = await db.rpc('amos_purge_old_trigger_log')
    if (typeof purged === 'number' && purged > 0) console.log(`[amos-research-runner] purged ${purged} old rate-limit log row(s)`)
  } catch (e) { console.warn('[amos-research-runner] trigger log purge failed (non-fatal):', e instanceof Error ? e.message : String(e)) }
  try {
    const { data: purgedUnsub } = await db.rpc('amos_purge_old_unsubscribe_attempts')
    if (typeof purgedUnsub === 'number' && purgedUnsub > 0) console.log(`[amos-research-runner] purged ${purgedUnsub} old unsubscribe-attempt row(s)`)
  } catch (e) { console.warn('[amos-research-runner] unsubscribe attempts purge failed (non-fatal):', e instanceof Error ? e.message : String(e)) }

  // ── Source 1: internal search gaps ──────────────────────────────────────
  try {
    const since = new Date(Date.now() - SEARCH_GAP_WINDOW_DAYS * 24 * 3600e3).toISOString()
    const { data: rows, error } = await db
      .from('search_logs')
      .select('term, results')
      .gte('created_at', since)
      .or('results.eq.0,results.is.null')
      .limit(5000)
    if (error) throw error

    const counts = new Map<string, number>()
    for (const r of (rows || [])) {
      const term = (r.term || '').trim().toLowerCase()
      if (!term) continue
      counts.set(term, (counts.get(term) || 0) + 1)
    }

    const today = new Date().toISOString().slice(0, 10)
    const gapRows = Array.from(counts.entries())
      .filter(([, count]) => count >= SEARCH_GAP_MIN_OCCURRENCES)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([term, count]) => ({
        country_code: 'ZW',
        signal_type: 'internal_search_gap',
        topic: term,
        score: count,
        rationale: `Searched ${count} time(s) in the last ${SEARCH_GAP_WINDOW_DAYS} days with zero/near-zero results — unmet demand PaMarket's own catalogue isn't meeting yet.`,
        raw: { window_days: SEARCH_GAP_WINDOW_DAYS, occurrences: count },
        expires_at: new Date(Date.now() + SEARCH_GAP_WINDOW_DAYS * 24 * 3600e3).toISOString(),
      }))

    // Replace today's batch rather than accumulating duplicates across runs
    // — this signal is a re-computed snapshot, not an append-only log.
    await db.from('amos_market_intelligence')
      .delete()
      .eq('signal_type', 'internal_search_gap')
      .gte('collected_at', `${today}T00:00:00Z`)

    if (gapRows.length) {
      const { error: insertError } = await db.from('amos_market_intelligence').insert(gapRows)
      if (insertError) throw insertError
    }
    summary.search_gaps_found = gapRows.length
  } catch (error) {
    summary.errors.push('Search gap analysis: ' + (error instanceof Error ? error.message : String(error)))
  }

  // ── Source 2: ZW calendar (holidays / school terms / salary periods) ───
  try {
    const { data: calendarRows, error } = await db
      .from('amos_zw_calendar')
      .select('event_type, event_date, label, category_hint, recurs_yearly')
    if (error) throw error

    const now = new Date()
    const horizon = new Date(now.getTime() + CALENDAR_LOOKAHEAD_DAYS * 24 * 3600e3)
    const today = now.toISOString().slice(0, 10)

    const upcoming = (calendarRows || [])
      .map((row) => {
        const eventDate = new Date(row.event_date + 'T00:00:00Z')
        if (row.recurs_yearly) {
          // Project this year's occurrence of the same month/day; if it
          // already passed this year, project next year's instead.
          const projected = new Date(Date.UTC(now.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate()))
          if (projected < now) projected.setUTCFullYear(projected.getUTCFullYear() + 1)
          return { ...row, occursOn: projected }
        }
        return { ...row, occursOn: eventDate }
      })
      .filter((row) => row.occursOn >= now && row.occursOn <= horizon)

    const signalTypeFor = (eventType: string) =>
      eventType === 'public_holiday' ? 'public_holiday'
      : eventType === 'salary_period' ? 'salary_period'
      : 'school_term' // school_term_start / school_term_end both fold into this signal_type

    const calendarSignalRows = upcoming.map((row) => {
      const daysAway = Math.round((row.occursOn.getTime() - now.getTime()) / (24 * 3600e3))
      return {
        country_code: 'ZW',
        signal_type: signalTypeFor(row.event_type),
        topic: row.label,
        score: Math.max(1, CALENDAR_LOOKAHEAD_DAYS - daysAway), // sooner = higher score
        rationale: `${row.label} in ${daysAway} day(s)${row.category_hint ? ` — historically relevant to: ${row.category_hint}` : ''}.`,
        raw: { event_type: row.event_type, event_date: row.occursOn.toISOString().slice(0, 10), days_away: daysAway, category_hint: row.category_hint },
        expires_at: row.occursOn.toISOString(),
      }
    })

    // Same re-computed-snapshot approach as the search-gap source.
    await db.from('amos_market_intelligence')
      .delete()
      .in('signal_type', ['public_holiday', 'school_term', 'salary_period'])
      .gte('collected_at', `${today}T00:00:00Z`)

    if (calendarSignalRows.length) {
      const { error: insertError } = await db.from('amos_market_intelligence').insert(calendarSignalRows)
      if (insertError) throw insertError
    }
    summary.calendar_signals_written = calendarSignalRows.length
  } catch (error) {
    summary.errors.push('Calendar signals: ' + (error instanceof Error ? error.message : String(error)))
  }

  const ok = summary.errors.length === 0
  const detail = ok
    ? `${summary.search_gaps_found} search gap(s), ${summary.calendar_signals_written} calendar signal(s)`
    : summary.errors.join('; ').slice(0, 2000)
  const finishedAt = Date.now()

  console.log(`[amos-research-runner] run finished ok=${ok} ${detail}`)
  if (summary.errors.length) console.error('[amos-research-runner] errors:', summary.errors)

  await db.from('job_runs').insert({
    job: 'amos_research_runner',
    ok,
    detail,
    rows_affected: summary.search_gaps_found + summary.calendar_signals_written,
    started_at: new Date(startedAt).toISOString(),
    trigger_type: triggeredBy.actorRole === 'system' ? 'cron' : 'manual',
    meta: { ...summary, triggered_by: triggeredBy.actorRole, duration_ms: finishedAt - startedAt },
  })

  // Cron runs are routine and already heartbeat via job_runs above; only
  // manual runs (an admin deliberately clicking "Run Now") go into the
  // audit trail, since that's the action a human is accountable for.
  if (triggeredBy.actorRole !== 'system') {
    await db.from('admin_audit_logs').insert({
      actor_id: triggeredBy.actorId,
      actor_email: triggeredBy.actorEmail,
      actor_role: triggeredBy.actorRole,
      action: 'run_amos_research_runner',
      entity: 'amos_market_intelligence',
      entity_id: null,
      after_state: { ...summary, duration_ms: finishedAt - startedAt },
      reason: 'manual trigger from AMOS System Health',
    })
  }

  return json({ success: ok, ...summary, duration_ms: finishedAt - startedAt }, ok ? 200 : 207)
})
