import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Tightened from wildcard (*) — this function is cron/secret-gated and never
// called from a browser page, but a wildcard origin is still inconsistent
// with every other function in this project and worth closing for
// defense-in-depth (found during a pre-launch security audit).
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

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const startedAt = Date.now()
  const configuredSecret = Deno.env.get('AUTOMATION_SECRET') || ''
  const suppliedSecret = req.headers.get('x-automation-secret') || ''
  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return json({ error: 'Unauthorized automation request' }, 401)
  }

  const projectUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const db = createClient(projectUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const summary = {
    notifications_claimed: 0,
    notifications_sent: 0,
    notifications_retried: 0,
    notifications_failed: 0,
    stale_jobs_recovered: 0,
    ads_activated: 0,
    ads_completed: 0,
    listings_expiry_warned: 0,
    listings_stale_prompted: 0,
    listings_milestone_notified: 0,
    users_recommended: 0,
    shops_new_arrivals_notified: 0,
    category_digest_notified: 0,
    listing_view_reminders_sent: 0,
    verification_nudges_sent: 0,
    messages_noreply_reminded: 0,
    business_subscriptions_expired: 0,
    errors: [] as string[],
  }

  try {
    // A worker can die after claiming a row. Release claims older than 15 min.
    const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString()
    const stale = await db.from('scheduled_notifications')
      .update({
        status: 'pending', locked_at: null,
        next_attempt_at: new Date().toISOString(),
        last_error: 'Recovered stale processing lock',
      })
      .eq('status', 'processing')
      .lt('locked_at', staleBefore)
      .select('id')
    if (!stale.error) summary.stale_jobs_recovered = (stale.data || []).length

    const claim = await db.rpc('claim_due_scheduled_notifications', { p_limit: 20 })
    if (claim.error) throw new Error('Notification claim failed: ' + claim.error.message)
    const jobs = claim.data || []
    summary.notifications_claimed = jobs.length

    for (const job of jobs) {
      try {
        const pushResponse = await fetch(projectUrl + '/functions/v1/send-push', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + anonKey,
            'apikey': anonKey,
            'Content-Type': 'application/json',
            'x-automation-secret': configuredSecret,
          },
          body: JSON.stringify({
            target: job.target,
            title: job.title,
            body: job.body,
            type: job.type,
            deepLink: job.deep_link,
            imageUrl: job.image_url,
            provinces: job.provinces,
          }),
        })
        const result = await pushResponse.json().catch(() => ({}))
        if (!pushResponse.ok || result.error) {
          throw new Error(result.error || ('send-push returned ' + pushResponse.status))
        }

        const deliveryCount = Number(result.total_users || 0)
        const failureCount = Number(result.fcm_failed || 0) + Number(result.web_push_failed || 0)
        const completed = await db.from('scheduled_notifications').update({
          status: 'sent', sent_at: new Date().toISOString(), completed_at: new Date().toISOString(),
          locked_at: null, next_attempt_at: null, last_error: null,
          delivery_count: deliveryCount, failure_count: failureCount,
          delivery_result: result,
        }).eq('id', job.id).eq('status', 'processing')
        if (completed.error) throw completed.error
        summary.notifications_sent++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const terminal = Number(job.attempts || 0) >= Number(job.max_attempts || 5)
        const retrySeconds = Math.min(3600, 60 * Math.pow(2, Number(job.attempts || 1)))
        const failed = await db.from('scheduled_notifications').update({
          status: terminal ? 'failed' : 'pending',
          locked_at: null,
          next_attempt_at: terminal ? null : new Date(Date.now() + retrySeconds * 1000).toISOString(),
          completed_at: terminal ? new Date().toISOString() : null,
          last_error: message.slice(0, 2000),
        }).eq('id', job.id).eq('status', 'processing')
        if (failed.error) summary.errors.push('Could not update failed job ' + job.id + ': ' + failed.error.message)
        if (terminal) summary.notifications_failed++
        else summary.notifications_retried++
      }
    }

    const adLifecycle = await db.rpc('run_paid_ads_lifecycle')
    if (adLifecycle.error) summary.errors.push('Ad lifecycle: ' + adLifecycle.error.message)
    else {
      summary.ads_activated = Number(adLifecycle.data?.activated || 0)
      summary.ads_completed = Number(adLifecycle.data?.completed || 0)
    }

    const expiryWarnings = await db.rpc('run_listing_expiry_warnings')
    if (expiryWarnings.error) summary.errors.push('Expiry warnings: ' + expiryWarnings.error.message)
    else summary.listings_expiry_warned = Number(expiryWarnings.data?.warned || 0)

    const staleListings = await db.rpc('run_stale_listing_prompts')
    if (staleListings.error) summary.errors.push('Stale listing prompts: ' + staleListings.error.message)
    else summary.listings_stale_prompted = Number(staleListings.data?.prompted || 0)

    const viewMilestones = await db.rpc('run_view_milestones')
    if (viewMilestones.error) summary.errors.push('View milestones: ' + viewMilestones.error.message)
    else summary.listings_milestone_notified = Number(viewMilestones.data?.notified || 0)

    const recommendations = await db.rpc('run_personalized_recommendations')
    if (recommendations.error) summary.errors.push('Personalized recommendations: ' + recommendations.error.message)
    else summary.users_recommended = Number(recommendations.data?.recommended || 0)

    const shopArrivals = await db.rpc('run_shop_new_arrivals')
    if (shopArrivals.error) summary.errors.push('Shop new arrivals: ' + shopArrivals.error.message)
    else summary.shops_new_arrivals_notified = Number(shopArrivals.data?.notified || 0)

    const categoryDigest = await db.rpc('run_category_digest')
    if (categoryDigest.error) summary.errors.push('Category digest: ' + categoryDigest.error.message)
    else summary.category_digest_notified = Number(categoryDigest.data?.notified || 0)

    const listingViewReminders = await db.rpc('run_listing_view_reminders')
    if (listingViewReminders.error) summary.errors.push('Listing view reminders: ' + listingViewReminders.error.message)
    else summary.listing_view_reminders_sent = Number(listingViewReminders.data?.reminded || 0)

    const verificationNudge = await db.rpc('run_verification_nudge')
    if (verificationNudge.error) summary.errors.push('Verification nudge: ' + verificationNudge.error.message)
    else summary.verification_nudges_sent = Number(verificationNudge.data?.notified || 0)

    const noreplyReminders = await db.rpc('run_message_noreply_reminders')
    if (noreplyReminders.error) summary.errors.push('Message no-reply reminders: ' + noreplyReminders.error.message)
    else summary.messages_noreply_reminded = Number(noreplyReminders.data?.reminded || 0)

    // Automatically reverts admin promotional plan grants (and any regular
    // paid subscription) back to Free once current_period_end passes —
    // previously only a manual "Downgrade overdue" button in admin.html.
    const expiredSubs = await db.rpc('expire_overdue_business_subscriptions')
    if (expiredSubs.error) summary.errors.push('Business subscription expiry: ' + expiredSubs.error.message)
    else summary.business_subscriptions_expired = Number(expiredSubs.data?.expired || 0)

    const ok = summary.errors.length === 0
    await db.from('job_runs').insert({
      job: 'automation_runner', ok,
      detail: ok ? 'scheduled notifications and ads processed' : summary.errors.join('; ').slice(0, 2000),
      rows_affected: summary.notifications_sent + summary.ads_activated + summary.ads_completed,
      meta: { ...summary, duration_ms: Date.now() - startedAt },
    })

    return json({ success: ok, ...summary, duration_ms: Date.now() - startedAt }, ok ? 200 : 207)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await db.from('job_runs').insert({
        job: 'automation_runner', ok: false, detail: message.slice(0, 2000),
        meta: { ...summary, duration_ms: Date.now() - startedAt },
      })
    } catch (_) { /* best effort heartbeat */ }
    return json({ error: message, ...summary, duration_ms: Date.now() - startedAt }, 500)
  }
})

