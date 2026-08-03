import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkAmosRateLimit } from '../_shared/amos-rate-limit.ts'
import { buildPublisherRegistry } from '../_shared/amos-publishers/registry.ts'

// Deploy:  supabase functions deploy amos-publish-dispatcher --no-verify-jwt
// (same reason as amos-research-runner/amos-content-generator: the cron
// path — not scheduled yet, manual-trigger only for now — calls this with
// only x-automation-secret, no apikey/Authorization header.)
//
// AMOS Module 3 (queue/manual workflow) + Module 4/5 (real Facebook,
// Instagram, Push, Email publishing, added without changing the
// queue/schema design).
//
// Per-row routing (see the readiness checks below the due-rows query):
// credential-gated platforms (facebook, instagram) need a 'connected' row
// in amos_integrations; secret-gated platforms (push, email) need their
// project-wide provider secret to already be set. Anything not ready, or
// with no real adapter at all yet (linkedin/tiktok/x), falls back to
// ManualPublisher. This is the one-line-per-platform change the Module 3
// doc predicted: no schema or queue redesign needed to add a channel.
//
// Flow per run:
//   1. Claim due rows: amos_schedule where status='pending' and
//      scheduled_for <= now(), oldest first, capped per run so one
//      invocation can't run unbounded.
//   2. For each claimed row: set status='publishing', resolve the
//      adapter (real platform adapter if connected, else manual), call
//      publish(). Manual always returns 'awaiting_manual_publish' (a
//      human still has to act). A real adapter returns 'published'
//      immediately on success, with external_post_id/external_url
//      recorded straight into amos_publish_log — no human step needed.
//   3. A claim or publish failure marks that row 'failed' with
//      last_error set and increments attempts — never blocks the batch.
//
// Same dual-auth pattern as every other amos-* function:
//   1. Cron path — x-automation-secret header (not scheduled yet).
//   2. Manual path — admin session JWT, verified server-side, rate
//      limited, audited to admin_audit_logs, heartbeat to job_runs.

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
    auto_published: 0,
    failed: 0,
    errors: [] as string[],
  }

  const finish = async (ok: boolean) => {
    const finishedAt = Date.now()
    const detail = `${summary.claimed} claimed, ${summary.auto_published} auto-published, ${summary.moved_to_awaiting_manual} awaiting manual publish, ${summary.failed} failed`

    console.log(`[amos-publish-dispatcher] run finished ok=${ok} ${detail}`)
    if (summary.errors.length) console.error('[amos-publish-dispatcher] errors:', summary.errors)

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
    // Release any row stuck in 'publishing' from a prior run that never
    // resolved (crash, platform kill) before claiming new work — same
    // stale-lock-release-then-claim order automation-runner uses.
    await db.rpc('release_stale_amos_schedule_locks')

    // Atomic claim: claim_due_amos_schedule uses FOR UPDATE SKIP LOCKED
    // inside the RPC, so two overlapping dispatcher invocations (manual
    // click + cron, or two admins) can never claim the same row — each
    // row is atomically owned by exactly one caller the moment the
    // UPDATE commits. Fixes the prior select-then-separately-update race
    // (Production Readiness Audit, Critical #1).
    const { data: claimedRows, error: claimError } = await db.rpc('claim_due_amos_schedule', { p_limit: MAX_CLAIMS_PER_RUN })
    if (claimError) throw claimError

    // The RPC returns amos_schedule rows without the joined draft — fetch
    // drafts for the claimed batch in one query rather than one join per
    // claim attempt (the RPC itself can't easily express a cross-table
    // select and stay a simple, auditable SQL function).
    const claimedIds = (claimedRows || []).map((r: { id: string }) => r.id)
    const draftIds = (claimedRows || []).map((r: { draft_id: string }) => r.draft_id)
    const { data: draftRows } = draftIds.length
      ? await db.from('amos_content_drafts').select('id, channel, draft_type, body, cta, hashtags').in('id', draftIds)
      : { data: [] as { id: string; channel: string; draft_type: string; body: string | null; cta: string | null; hashtags: string[] | null }[] }
    const draftById = new Map((draftRows || []).map((d) => [d.id, d]))
    const due = (claimedRows || []).map((r: { id: string; draft_id: string; platform: string | null; attempts: number }) => ({
      id: r.id, draft_id: r.draft_id, platform: r.platform, attempts: r.attempts,
      amos_content_drafts: draftById.get(r.draft_id) || null,
    }))

    summary.claimed = claimedIds.length

    // Which platforms have a real (non-stub) adapter, and how each one's
    // readiness is determined — checked once per run, not once per row.
    // Two different gating mechanisms, because they're genuinely
    // different kinds of "connected":
    //   - facebook/instagram: gated by amos_integrations.status, since
    //     they need a specific admin-supplied credential (a Page token).
    //   - push/email: gated by a project-wide secret already being set
    //     (FIREBASE_SERVICE_ACCOUNT+VAPID / RESEND_API_KEY) — there's no
    //     per-provider "connect" step for these, they either have the
    //     secret or they don't, so amos_integrations doesn't apply.
    // linkedin/tiktok/x remain stubs — not in either set — until their
    // own modules ship real adapters.
    const CREDENTIAL_GATED_PLATFORMS = new Set(['facebook', 'instagram'])
    const { data: connectedIntegrations } = await db.from('amos_integrations').select('provider, status').eq('status', 'connected')
    const connectedPlatforms = new Set((connectedIntegrations || []).map((i) => i.provider).filter((p) => CREDENTIAL_GATED_PLATFORMS.has(p)))
    // Instagram shares Facebook's connection (see instagram.ts) — if
    // Facebook is connected, route Instagram to its real adapter too, and
    // let InstagramPublisher itself decide pass/fail from there (today it
    // always fails cleanly on the no-media-support limitation, which is
    // still more accurate than silently treating it as unconnected).
    if (connectedPlatforms.has('facebook')) connectedPlatforms.add('instagram')

    const secretGatedReady = new Set<string>()
    if (Deno.env.get('FIREBASE_SERVICE_ACCOUNT') && Deno.env.get('VAPID_PRIVATE_KEY')) secretGatedReady.add('push')
    if (Deno.env.get('RESEND_API_KEY')) secretGatedReady.add('email')

    const realAdapterReady = new Set([...connectedPlatforms, ...secretGatedReady])
    const publishers = buildPublisherRegistry(db)

    for (const row of due || []) {
      try {
        // Already atomically claimed (status='publishing', locked_at set)
        // by claim_due_amos_schedule above — no separate claim UPDATE
        // needed here, just the audit trail entry.
        await db.from('amos_publish_audit').insert({ schedule_id: row.id, event: 'claimed', actor_id: triggeredBy.actorId, actor_email: triggeredBy.actorEmail })

        const draft = row.amos_content_drafts as unknown as { channel: string; draft_type: string; body: string | null; cta: string | null; hashtags: string[] | null } | null
        const platform = draft?.channel || row.platform || 'unknown'
        const useReal = realAdapterReady.has(platform)
        const publisher = useReal ? publishers[platform] : publishers.manual
        const result = await publisher.publish({
          draftId: row.draft_id,
          scheduleId: row.id,
          channel: platform,
          draftType: draft?.draft_type || 'unknown',
          body: draft?.body ?? null,
          cta: draft?.cta ?? null,
          hashtags: draft?.hashtags ?? null,
        })

        if (result.ok && result.status === 'awaiting_manual_publish') {
          await db.from('amos_schedule').update({ status: 'awaiting_manual_publish', publish_method: 'manual', locked_at: null }).eq('id', row.id)
          summary.moved_to_awaiting_manual++
        } else if (result.ok && result.status === 'published') {
          // Real adapter succeeded — no human step needed. Write the
          // publish log immediately (external_post_id/external_url come
          // straight from the platform's own API response).
          await db.from('amos_schedule').update({ status: 'published', publish_method: 'api', locked_at: null }).eq('id', row.id)
          await db.from('amos_publish_log').insert({
            schedule_id: row.id, channel: platform,
            external_post_id: result.externalPostId || null,
            external_url: result.externalUrl || null,
            raw_response: (result.rawResponse ?? null) as never,
          })
          await db.from('amos_publish_audit').insert({ schedule_id: row.id, event: 'manual_confirmed', detail: `auto-published via ${platform} API` })
          summary.auto_published++
        } else {
          await db.from('amos_schedule').update({ status: 'failed', last_error: result.error || 'Unknown publisher error', locked_at: null }).eq('id', row.id)
          await db.from('amos_publish_audit').insert({ schedule_id: row.id, event: 'failed', detail: result.error || null })
          summary.failed++
        }
      } catch (rowError) {
        const message = rowError instanceof Error ? rowError.message : String(rowError)
        summary.errors.push(`Schedule ${row.id}: ${message}`)
        await db.from('amos_schedule').update({ status: 'failed', last_error: message.slice(0, 2000), locked_at: null }).eq('id', row.id)
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
