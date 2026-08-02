import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkAmosRateLimit } from '../_shared/amos-rate-limit.ts'
import { PUBLISHERS } from '../_shared/amos-publishers/registry.ts'

// Deploy:  supabase functions deploy amos-publish-dispatcher --no-verify-jwt
// (same reason as amos-research-runner/amos-content-generator: the cron
// path — not scheduled yet, manual-trigger only for now — calls this with
// only x-automation-secret, no apikey/Authorization header.)
//
// AMOS Module 3 — Publishing Control Layer dispatcher.
//
// NO EXTERNAL PLATFORM API CALLS. Every publisher in PUBLISHERS except
// 'manual' is a stub that returns ok:false — this dispatcher hardcodes the
// 'manual' adapter for every claimed row regardless of its real target
// platform, on purpose, per the Module 3 architecture doc. A schedule
// row's `platform` column always reflects the real intended destination
// (Facebook, Instagram, etc.) for display and for a future module to key
// off; only the *publish mechanism* is manual-only right now. Swapping to
// PUBLISHERS[schedule.platform] later is the entire code change needed to
// turn on real per-platform publishing — no schema or dispatcher redesign.
//
// Flow per run:
//   1. Claim due rows: amos_schedule where status='pending' and
//      scheduled_for <= now(), oldest first, capped per run so one
//      invocation can't run unbounded.
//   2. For each claimed row: set status='publishing', call
//      ManualPublisher.publish() (always succeeds — it just means "ready
//      for a human"), then set status='awaiting_manual_publish' and write
//      an amos_publish_audit 'claimed' event.
//   3. A claim failing (row disappeared, DB error) marks that row
//      'failed' with last_error set and increments attempts — never
//      blocks the rest of the batch.
//
// Same dual-auth pattern as every other amos-* function:
//   1. Cron path — x-automation-secret header (not scheduled yet).
//   2. Manual path — admin session JWT, verified server-side, rate
//      limited, audited to admin_audit_logs, heartbeat to job_runs.

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
const MAX_CLAIMS_PER_RUN = 25

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

  // ── Auth: identical dual-path pattern to the other amos-* functions ────
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

    const rate = await checkAmosRateLimit(db, 'amos-publish-dispatcher', userData.user.id, { windowMinutes: 10, maxCalls: 10 })
    if (!rate.allowed) {
      return json({ error: `Too many manual runs — try again in ${rate.retryAfterSeconds}s` }, 429)
    }
  }

  const summary = {
    claimed: 0,
    moved_to_awaiting_manual: 0,
    failed: 0,
    errors: [] as string[],
  }

  const finish = async (ok: boolean) => {
    const finishedAt = Date.now()
    const detail = `${summary.claimed} claimed, ${summary.moved_to_awaiting_manual} awaiting manual publish, ${summary.failed} failed`

    await db.from('job_runs').insert({
      job: 'amos_publish_dispatcher',
      ok,
      detail,
      rows_affected: summary.claimed,
      started_at: new Date(startedAt).toISOString(),
      trigger_type: triggeredBy.actorRole === 'system' ? 'cron' : 'manual',
      meta: { ...summary, triggered_by: triggeredBy.actorRole, duration_ms: finishedAt - startedAt },
    })

    if (triggeredBy.actorRole !== 'system') {
      await db.from('admin_audit_logs').insert({
        actor_id: triggeredBy.actorId,
        actor_email: triggeredBy.actorEmail,
        actor_role: triggeredBy.actorRole,
        action: 'run_amos_publish_dispatcher',
        entity: 'amos_schedule',
        entity_id: null,
        after_state: { ...summary, duration_ms: finishedAt - startedAt },
        reason: 'manual trigger from AMOS Publishing Queue',
      })
    }

    return json({ success: ok, ...summary, duration_ms: finishedAt - startedAt }, ok ? 200 : 207)
  }

  try {
    const { data: due, error: dueError } = await db
      .from('amos_schedule')
      .select('id, draft_id, platform, attempts, amos_content_drafts(channel, draft_type, body, cta, hashtags)')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(MAX_CLAIMS_PER_RUN)
    if (dueError) throw dueError

    summary.claimed = (due || []).length

    for (const row of due || []) {
      try {
        // Claim: mark 'publishing' before doing anything, so a crashed
        // run never leaves a row silently stuck in 'pending' looking
        // untouched — same "claim, then work" pattern as the existing
        // scheduled_notifications dispatch queue elsewhere in this repo.
        await db.from('amos_schedule').update({ status: 'publishing', last_attempt_at: new Date().toISOString() }).eq('id', row.id)
        await db.from('amos_publish_audit').insert({ schedule_id: row.id, event: 'claimed', actor_id: triggeredBy.actorId, actor_email: triggeredBy.actorEmail })

        const draft = row.amos_content_drafts as unknown as { channel: string; draft_type: string; body: string | null; cta: string | null; hashtags: string[] | null } | null
        const publisher = PUBLISHERS.manual // hardcoded on purpose — see file header comment
        const result = await publisher.publish({
          draftId: row.draft_id,
          scheduleId: row.id,
          channel: draft?.channel || row.platform || 'unknown',
          draftType: draft?.draft_type || 'unknown',
          body: draft?.body ?? null,
          cta: draft?.cta ?? null,
          hashtags: draft?.hashtags ?? null,
        })

        if (result.ok && result.status === 'awaiting_manual_publish') {
          await db.from('amos_schedule').update({ status: 'awaiting_manual_publish', publish_method: 'manual', attempts: (row.attempts || 0) + 1 }).eq('id', row.id)
          summary.moved_to_awaiting_manual++
        } else {
          await db.from('amos_schedule').update({ status: 'failed', last_error: result.error || 'Unknown publisher error', attempts: (row.attempts || 0) + 1 }).eq('id', row.id)
          await db.from('amos_publish_audit').insert({ schedule_id: row.id, event: 'failed', detail: result.error || null })
          summary.failed++
        }
      } catch (rowError) {
        const message = rowError instanceof Error ? rowError.message : String(rowError)
        summary.errors.push(`Schedule ${row.id}: ${message}`)
        await db.from('amos_schedule').update({ status: 'failed', last_error: message.slice(0, 2000), attempts: (row.attempts || 0) + 1 }).eq('id', row.id)
        await db.from('amos_publish_audit').insert({ schedule_id: row.id, event: 'failed', detail: message.slice(0, 2000) })
        summary.failed++
      }
    }

    return await finish(summary.errors.length === 0)
  } catch (error) {
    summary.errors.push(error instanceof Error ? error.message : String(error))
    return await finish(false)
  }
})
