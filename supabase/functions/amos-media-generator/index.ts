import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3'
import { checkAmosRateLimit } from '../_shared/amos-rate-limit.ts'

// Deploy:  supabase functions deploy amos-media-generator --no-verify-jwt
// (same reason as every other AMOS function — the cron path sends only
// x-automation-secret, no apikey/Authorization header.)
//
// AMOS Module 10 — AI Media Generation (images).
//
// Generates one marketing image for a single amos_content_drafts row via
// Hugging Face's Inference API running FLUX.1-schnell — free (a
// registered access token, no billing/credit card), and generally more
// consistent quality than the earlier Pollinations.ai attempt while
// still being free. OpenAI's gpt-image-1 and Google's Gemini image
// models were tried first and both require a funded billing account for
// image generation even at zero usage. Rate-limited (~300 req/hour on
// the free tier) rather than truly unlimited — swap HF_MODEL below or
// switch providers entirely if that becomes a real constraint; the rest
// of this file (R2 upload, media_assets bookkeeping, publisher
// integration) does not need to change.
//
// This is the AI-generation path only — the separate "Attach My Own"
// flow in the admin UI (paste a URL or upload a file) is unaffected and
// remains the recommended path when AI quality isn't good enough for a
// given post.
//
// Uploads the result to the R2 public bucket (same bucket/credentials as
// get-r2-upload-url, direct SDK write since this runs server-side and
// already holds the R2 secrets — no signed-URL round trip needed), and
// records the result in amos_media_assets + amos_content_drafts.media_asset_id.
//
// DRAFT-ONLY, same posture as amos-content-generator: this function only
// ever attaches an image to an existing draft. It never publishes
// anything — that stays gated by the existing Approval Queue and
// amos-publish-dispatcher, both unchanged by this module.

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
const HF_MODEL = 'black-forest-labs/FLUX.1-schnell'

// Placement -> target pixel dimensions, passed directly as the model's
// width/height parameters.
const PLACEMENT_SIZE: Record<string, { width: number; height: number; format: string }> = {
  facebook:        { width: 1536, height: 1024, format: 'landscape' },
  instagram:        { width: 1024, height: 1024, format: 'square' },
  linkedin:         { width: 1536, height: 1024, format: 'landscape' },
  x:                { width: 1536, height: 1024, format: 'landscape' },
  blog_header:      { width: 1536, height: 1024, format: 'landscape' },
  website_banner:   { width: 1536, height: 1024, format: 'landscape' },
  story:            { width: 1024, height: 1536, format: 'portrait' },
  square:           { width: 1024, height: 1024, format: 'square' },
  landscape:        { width: 1536, height: 1024, format: 'landscape' },
  portrait:         { width: 1024, height: 1536, format: 'portrait' },
}

const VALID_STYLES = new Set([
  'product_showcase', 'promotional_banner', 'hiring_announcement',
  'marketplace_advertisement', 'quote_card', 'infographic',
  'event_announcement', 'feature_announcement',
])

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

  // ── Auth: identical dual-path pattern to every other AMOS function ──
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

    const rate = await checkAmosRateLimit(db, 'amos-media-generator', userData.user.id, { windowMinutes: 15, maxCalls: 10 })
    if (!rate.allowed) {
      return json({ error: `Too many manual runs — try again in ${rate.retryAfterSeconds}s` }, 429)
    }
  }

  let body: { draftId?: string; style?: string; placement?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { draftId } = body
  if (!draftId) return json({ error: 'draftId is required' }, 400)

  const style = body.style && VALID_STYLES.has(body.style) ? body.style : 'marketplace_advertisement'

  const summary = {
    draft_id: draftId,
    media_asset_id: null as string | null,
    status: 'failed' as 'ready' | 'failed',
    error: null as string | null,
  }

  const jobStart = async () => {
    console.log(`[amos-media-generator] run started for draft ${draftId}, trigger=${cronAuthOk ? 'cron' : 'manual'}`)
  }
  await jobStart()

  const finish = async (ok: boolean) => {
    const finishedAt = Date.now()
    console.log(`[amos-media-generator] run finished ok=${ok} draft=${draftId} asset=${summary.media_asset_id ?? 'none'}`)
    if (summary.error) console.error(`[amos-media-generator] error:`, summary.error)

    await db.from('job_runs').insert({
      job: 'amos_media_generator',
      ok,
      detail: ok ? `image generated for draft ${draftId}` : summary.error?.slice(0, 2000),
      rows_affected: ok ? 1 : 0,
      started_at: new Date(startedAt).toISOString(),
      trigger_type: triggeredBy.actorRole === 'system' ? 'cron' : 'manual',
      meta: { ...summary, triggered_by: triggeredBy.actorRole, duration_ms: finishedAt - startedAt },
    })

    if (triggeredBy.actorRole !== 'system') {
      await db.from('admin_audit_logs').insert({
        actor_id: triggeredBy.actorId,
        actor_email: triggeredBy.actorEmail,
        actor_role: triggeredBy.actorRole,
        action: 'run_amos_media_generator',
        entity: 'amos_media_assets',
        entity_id: summary.media_asset_id,
        after_state: { ...summary, duration_ms: finishedAt - startedAt },
        reason: 'manual image generation from AMOS Approval Queue',
      })
    }

    return json({ success: ok, ...summary, duration_ms: finishedAt - startedAt }, ok ? 200 : 502)
  }

  const hfToken = Deno.env.get('HUGGINGFACE_API_TOKEN') || ''
  if (!hfToken) {
    summary.error = 'HUGGINGFACE_API_TOKEN not configured — set it under Supabase → Edge Functions → amos-media-generator → Secrets.'
    return await finish(false)
  }

  try {
    // ── 1. Load the draft + its content item + brand kit ──────────────
    const { data: draft, error: draftError } = await db
      .from('amos_content_drafts')
      .select('id, channel, body, content_item_id')
      .eq('id', draftId)
      .maybeSingle()
    if (draftError) throw draftError
    if (!draft) {
      summary.error = 'Draft not found'
      return await finish(false)
    }

    const placementKey = body.placement || draft.channel
    const sizeConfig = PLACEMENT_SIZE[placementKey] || PLACEMENT_SIZE.square

    const { data: item } = await db
      .from('amos_content_items')
      .select('title, country_code')
      .eq('id', draft.content_item_id)
      .maybeSingle()

    const { data: brandKit } = await db
      .from('amos_brand_kit')
      .select('*')
      .eq('country_code', item?.country_code || 'ZW')
      .maybeSingle()

    // Hugging Face's free tier is free — no per-image spend to record.
    // The budget RPC call is skipped entirely rather than called with 0
    // cents, since its purpose is capping real API spend and there is
    // none here. Reinstate this check (with a real estimated cost) if
    // this file is switched back to a billed provider.
    const ESTIMATED_CENTS_PER_IMAGE = 0

    // ── 3. Build the prompt from brand kit + draft copy ────────────────
    const prompt = buildImagePrompt({
      title: item?.title || 'PaMarket',
      draftBody: draft.body || '',
      style,
      placement: placementKey,
      brandKit,
    })

    // ── 4. Create the pending media_assets row before calling the API ──
    const { data: mediaRow, error: mediaInsertError } = await db
      .from('amos_media_assets')
      .insert({
        draft_id: draft.id,
        content_item_id: draft.content_item_id,
        asset_type: 'image',
        style,
        placement: placementKey,
        format: sizeConfig.format,
        prompt,
        provider: 'huggingface',
        model: HF_MODEL,
        status: 'generating',
        created_by: triggeredBy.actorId,
      })
      .select('id')
      .single()
    if (mediaInsertError) throw mediaInsertError
    summary.media_asset_id = mediaRow.id

    // ── 5. Call Hugging Face ────────────────────────────────────────
    const imageBytes = await generateImage(hfToken, prompt, sizeConfig.width, sizeConfig.height)

    // ── 6. Upload to R2 ──────────────────────────────────────────────
    const key = `amos/media/${draft.content_item_id}/${mediaRow.id}.jpg`
    const publicUrl = await uploadToR2(imageBytes, key)

    // ── 7. Mark ready, link to the draft ────────────────────────────
    await db.from('amos_media_assets').update({
      status: 'ready',
      storage_key: key,
      url: publicUrl,
      width: sizeConfig.width,
      height: sizeConfig.height,
      generation_cost_cents: ESTIMATED_CENTS_PER_IMAGE,
      updated_at: new Date().toISOString(),
    }).eq('id', mediaRow.id)

    await db.from('amos_content_drafts').update({ media_asset_id: mediaRow.id }).eq('id', draft.id)

    summary.status = 'ready'
    return await finish(true)
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error)
    if (summary.media_asset_id) {
      await db.from('amos_media_assets').update({
        status: 'failed', error: summary.error, updated_at: new Date().toISOString(),
      }).eq('id', summary.media_asset_id)
    }
    return await finish(false)
  }
})

function buildImagePrompt(args: {
  title: string
  draftBody: string
  style: string
  placement: string
  brandKit: Record<string, unknown> | null
}): string {
  const { title, draftBody, style, placement, brandKit } = args
  const primary = (brandKit?.color_primary as string) || '#1A3A8F'
  const secondary = (brandKit?.color_secondary as string) || '#D4AF37'
  const notes = (brandKit?.design_notes as string) || ''

  const styleDescriptions: Record<string, string> = {
    product_showcase: 'a clean product showcase layout with generous negative space around the subject',
    promotional_banner: 'a bold promotional banner layout with a clear headline area',
    hiring_announcement: 'a professional hiring/recruitment announcement layout',
    marketplace_advertisement: 'a vibrant marketplace advertisement layout',
    quote_card: 'a minimal quote-card layout with large readable typography space',
    infographic: 'a structured infographic layout with clear visual hierarchy',
    event_announcement: 'an eye-catching event announcement layout',
    feature_announcement: 'a modern app-feature announcement layout',
  }

  return [
    `Professional marketing graphic for "${title}", a Zimbabwean marketplace app (PaMarket).`,
    `Layout style: ${styleDescriptions[style] || styleDescriptions.marketplace_advertisement}, designed for ${placement}.`,
    `Brand colors: navy blue (${primary}) and gold (${secondary}) as the dominant palette.`,
    `Modern, professional typography style with clean layouts. High-resolution, polished, photo-realistic or high-quality flat-illustration style (not cartoonish, not low-effort clipart).`,
    `Where people or scenes are shown, reflect Zimbabwean/Southern African context authentically.`,
    notes ? `Additional brand guidance: ${notes}.` : '',
    `Content context (do not render this text literally on the image unless it reads as a short headline naturally): ${draftBody.slice(0, 300)}`,
    `No watermarks, no placeholder text, no lorem ipsum, no misspelled text.`,
  ].filter(Boolean).join(' ')
}

// Serverless HF inference endpoints can return 503 "model is loading"
// on a cold start rather than the image itself — a real, common
// condition (not an error case to just fail on), so it's retried with a
// short wait rather than surfaced as a failure on the first attempt. An
// explicit per-attempt timeout keeps a hung request from running until
// the platform kills the whole function with no useful error message.
const HF_REQUEST_TIMEOUT_MS = 45_000
const HF_COLD_START_MAX_RETRIES = 3
const HF_COLD_START_RETRY_DELAY_MS = 8_000

async function generateImage(token: string, prompt: string, width: number, height: number): Promise<Uint8Array> {
  const url = `https://api-inference.huggingface.co/models/${HF_MODEL}`

  for (let attempt = 0; attempt <= HF_COLD_START_MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), HF_REQUEST_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ inputs: prompt, parameters: { width, height } }),
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Hugging Face image generation timed out after ${HF_REQUEST_TIMEOUT_MS / 1000}s`)
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }

    if (res.status === 503 && attempt < HF_COLD_START_MAX_RETRIES) {
      console.warn(`[amos-media-generator] Hugging Face model loading (503), retrying in ${HF_COLD_START_RETRY_DELAY_MS}ms (attempt ${attempt + 1}/${HF_COLD_START_MAX_RETRIES})`)
      await new Promise((resolve) => setTimeout(resolve, HF_COLD_START_RETRY_DELAY_MS))
      continue
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`Hugging Face image API error ${res.status}: ${errBody.slice(0, 300)}`)
    }

    const buf = await res.arrayBuffer()
    if (!buf.byteLength) throw new Error('Hugging Face returned an empty image response')
    return new Uint8Array(buf)
  }

  throw new Error('Hugging Face model did not finish loading after retries — try again shortly.')
}

async function uploadToR2(imageBytes: Uint8Array, key: string): Promise<string> {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
      secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
    },
  })

  const bucket = Deno.env.get('R2_PUBLIC_BUCKET')!

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: imageBytes,
    ContentType: 'image/jpeg',
  }))

  return `${Deno.env.get('R2_PUBLIC_URL')}/${key}`
}
