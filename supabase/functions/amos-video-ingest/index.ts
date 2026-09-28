// AMOS — video hand-off endpoint.
//
// Called by the GitHub Actions workflow (.github/workflows/amos-video-
// ingest.yml) whenever the "PaMarket Video Studio" cloud routine
// (motion-studio/VIDEO_AGENT.md) pushes a finished video to the
// amos-video-queue branch. Creates a content item + one draft per
// channel (facebook, instagram), status='draft' — i.e. it lands in the
// existing Approval Queue exactly like any other AMOS-generated draft.
// It does NOT schedule or publish anything itself; a human still has to
// approve in the admin panel (AMOS_MODULE_18_APPROVE_CREATES_SCHEDULE.sql
// is what turns an approval into an actual amos_schedule row).
//
// Low-privilege by design: the only thing this endpoint can do is create
// a *pending-review* row a human will see and can reject — it has no
// path to publish anything directly, unlike the Meta Page token (which
// lives in Vault and is never touched here). Gated by its own dedicated
// secret (AMOS_VIDEO_INGEST_SECRET), separate from AUTOMATION_SECRET, so
// it can be rotated independently without touching the cron-facing
// functions.
//
// Deploy:  supabase functions deploy amos-video-ingest --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders as sharedCorsHeaders } from '../_shared/cors.ts'

function corsHeaders(req: Request) {
  return sharedCorsHeaders(req, { extraHeaders: ['x-video-ingest-secret'] })
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const configuredSecret = Deno.env.get('AMOS_VIDEO_INGEST_SECRET') || ''
  const suppliedSecret = req.headers.get('x-video-ingest-secret') || ''
  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let body: {
    topic?: string
    caption?: string
    videoUrl16x9?: string
    videoUrl9x16?: string
    notes?: string
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { topic, caption, videoUrl16x9, videoUrl9x16 } = body
  if (!topic || !caption || !(videoUrl16x9 || videoUrl9x16)) {
    return json({ error: 'topic, caption and at least one of videoUrl16x9/videoUrl9x16 are required' }, 400)
  }

  const projectUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: item, error: itemError } = await db
    .from('amos_content_items')
    .insert({ country_code: 'ZW', title: topic, category: 'brand', status: 'drafted', created_by: null })
    .select('id')
    .single()
  if (itemError || !item) return json({ error: `Failed to create content item: ${itemError?.message}` }, 500)

  // Facebook /videos wants the widescreen cut; Instagram Reels wants the
  // vertical one. Fall back to whichever single URL was supplied so a
  // partial upload still produces something reviewable.
  const channels: { channel: 'facebook' | 'instagram'; url: string }[] = [
    { channel: 'facebook', url: videoUrl16x9 || videoUrl9x16! },
    { channel: 'instagram', url: videoUrl9x16 || videoUrl16x9! },
  ]

  const created: { channel: string; draftId: string }[] = []
  for (const { channel, url } of channels) {
    const { data: asset, error: assetError } = await db
      .from('amos_media_assets')
      .insert({
        content_item_id: item.id,
        asset_type: 'video',
        placement: channel,
        format: channel === 'instagram' ? 'portrait' : 'landscape',
        prompt: `PaMarket marketing video — ${topic}`,
        provider: 'motion-studio',
        model: 'claude-opus-5-5',
        url,
        status: 'ready',
      })
      .select('id')
      .single()
    if (assetError || !asset) return json({ error: `Failed to create media asset (${channel}): ${assetError?.message}` }, 500)

    const { data: draft, error: draftError } = await db
      .from('amos_content_drafts')
      .insert({
        content_item_id: item.id,
        channel,
        draft_type: 'post',
        body: caption,
        media_asset_id: asset.id,
        ai_provider: 'anthropic',
        ai_model: 'claude-opus-5-5',
        performance_rationale: body.notes || null,
        status: 'draft',
      })
      .select('id')
      .single()
    if (draftError || !draft) return json({ error: `Failed to create draft (${channel}): ${draftError?.message}` }, 500)

    created.push({ channel, draftId: draft.id })
  }

  await db.from('job_runs').insert({
    job: 'amos_video_ingest',
    ok: true,
    detail: `video ingested: "${topic}" — ${created.length} draft(s) awaiting approval`,
    rows_affected: created.length,
    started_at: new Date().toISOString(),
    trigger_type: 'cron',
    meta: { topic, created },
  })

  return json({ success: true, contentItemId: item.id, drafts: created })
})
