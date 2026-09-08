import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand, GetObjectCommand } from 'npm:@aws-sdk/client-s3'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner'
import { checkAmosRateLimit } from '../_shared/amos-rate-limit.ts'

// Migrated to the shared allowlist (Stage 6).
//   - 'com.pamarket.app' removed: it's the Android package identifier, not
//     a valid Origin header value — capacitor.config.json sets
//     androidScheme:"https" with no custom hostname, so Capacitor's WebView
//     actually serves the app from https://localhost (kept below via
//     allowNativeAppOrigins), never from a "com.pamarket.app" origin. That
//     entry could never match a real request; removing it changes nothing.
//   - 'https://pamarket.app' / 'https://www.pamarket.app' kept unchanged:
//     no confirmed live caller was found for this domain (Stage 6 audit),
//     but per instructions this is not removed without explicit approval
//     — see the Stage 6 report.
//   - Local dev origins (127.0.0.1:5500, localhost:5500, localhost:3000)
//     are now only included when the ALLOW_DEV_CORS_ORIGINS secret is
//     explicitly set to "true" — see supabase/functions/_shared/cors.ts.
import { corsHeaders as sharedCorsHeaders } from '../_shared/cors.ts'
function corsHeaders(req: Request) {
  return sharedCorsHeaders(req, {
    allowNativeAppOrigins: true,
    extraOrigins: ['https://pamarket.app', 'https://www.pamarket.app'],
  })
}

// Allowlist for content types users may upload.
// image/heic and image/heif were removed deliberately (Stage 12): HEIC is
// the iPhone camera default, decodes fine on Apple devices, but renders
// blank on Android and in every desktop/mobile browser — see
// project_heic_listing_photos memory. The mobile app's own upload path
// (lib/uploadToR2.ts) now always re-encodes every picked photo to JPEG
// before it ever reaches this function, so no legitimate caller should ever
// request image/heic here; removing it from the allowlist is defense in
// depth against a future or overlooked upload path reintroducing the same
// bug, not a change either the app or the website currently depends on.
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf', // CVs only
])

// AMOS marketing media (admin-only, see isAmos below) additionally
// allows video, since posts can attach a video the admin uploaded
// themselves rather than one AI-generated.
const AMOS_ADDITIONAL_CONTENT_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
])

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_AMOS_VIDEO_SIZE_BYTES = 200 * 1024 * 1024 // 200 MB — video files are much larger than the general 10MB cap

// File extension used for the server-generated object name (see keyPrefix
// below) — keyed off the already-validated contentType, never off whatever
// filename/extension the caller's key happened to end with.
const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

// Signed-URL issuance limits — bounds how much storage an authenticated
// user can cause to be written regardless of whether they ever attach the
// upload to a listing/message/business/rental. Sized generously: 8
// photos/listing x several listings, 5 photos/rental vehicle x a fleet,
// plus business/chat/profile photos in the same day, comfortably fits
// under DAILY_UPLOAD_QUOTA. Reuses the same log-and-count pattern already
// used elsewhere in this codebase (see admin-login-guard's login throttle
// and _shared/amos-rate-limit.ts) rather than inventing new architecture —
// backed by the existing generic amos_manual_trigger_log table, which has
// no AMOS-specific constraint on fn_name.
const BURST_LIMIT = { windowMinutes: 1, maxCalls: 20 }
const DAILY_QUOTA  = { windowMinutes: 24 * 60, maxCalls: 150 }

Deno.serve(async (req) => {
  const cors = corsHeaders(req)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) throw new Error('Unauthorized')

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    )
    // Service-role client, used only for the rate-limit ledger below —
    // amos_manual_trigger_log's RLS denies anon/authenticated entirely (by
    // design, see _shared/amos-rate-limit.ts), so the anon-scoped `sb`
    // above cannot write to it.
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authErr } = await sb.auth.getUser()
    if (authErr || !user) throw new Error('Unauthorized')

    const { key, contentType, verb = 'PUT', expiresIn } = await req.json()
    if (!key || typeof key !== 'string') throw new Error('key required')

    const isVerification = key.startsWith('verification/')
    const isAd = key.startsWith('ads/')
    const isAmos = key.startsWith('amos/manual-media/')
    const isBusiness = key.startsWith('businesses/')
    const isGet = verb === 'GET'

    // Populated below (upload/PUT path only) with whichever prefix the
    // request validated against, so the actual object key written to R2 is
    // always server-generated (prefix + random name), never the caller's
    // literal `key`. This closes the "arbitrary key selection" gap — a
    // caller can no longer choose a filename to collide with/overwrite an
    // existing object, even one of their own from a stale retry.
    let keyPrefix: string | null = null

    if (isGet && isVerification) {
      // Admin can access any verification path; users only their own
      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
      const isAdmin = profile?.role === 'admin'
      if (!isAdmin && !key.startsWith(`verification/${user.id}/`)) throw new Error('Forbidden')
    } else {
      // Ad creatives and AMOS marketing media use shared public
      // namespaces, but only administrators may request upload URLs for
      // either.
      if (isAd || isAmos) {
        const { data: profile, error: profileErr } = await sb
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (profileErr || profile?.role !== 'admin') throw new Error('Forbidden')
      }

      // Business logo/cover uploads are keyed by business ID, not user ID
      // (businesses/{businessId}/...), since the RN app's business-edit
      // screen has no per-user namespace to scope against. Verify the
      // authenticated user actually owns that business instead.
      if (isBusiness) {
        const businessId = key.split('/')[1]
        if (!businessId) throw new Error('Forbidden path')
        const { data: business, error: bizErr } = await sb
          .from('businesses')
          .select('owner_user_id')
          .eq('id', businessId)
          .single()
        if (bizErr || business?.owner_user_id !== user.id) throw new Error('Forbidden')
        keyPrefix = `businesses/${businessId}/`
      }

      // Non-ad, non-amos, non-business PUTs remain scoped to the
      // authenticated user's path prefix.
      const allowed = [
        `listings/${user.id}/`,
        `chat/${user.id}/`,
        `cv/${user.id}/`,
        `verification/${user.id}/`,
        `profiles/${user.id}/`,
        `rentals/${user.id}/`,
      ]
      if (!isAd && !isAmos && !isBusiness) {
        const matched = allowed.find(p => key.startsWith(p))
        if (!matched) throw new Error('Forbidden path')
        keyPrefix = matched
      }
      if (isAd) keyPrefix = 'ads/'
      if (isAmos) keyPrefix = 'amos/manual-media/'
      if (!contentType) throw new Error('contentType required for upload')

      // Validate content type against allowlist (AMOS additionally allows video)
      const contentTypeAllowed = ALLOWED_CONTENT_TYPES.has(contentType) || (isAmos && AMOS_ADDITIONAL_CONTENT_TYPES.has(contentType))
      if (!contentTypeAllowed) {
        throw new Error('Content type not permitted')
      }

      // CVs (application/pdf) may only go under cv/ prefix
      if (contentType === 'application/pdf' && !key.startsWith(`cv/${user.id}/`)) {
        throw new Error('PDF uploads only permitted under cv/ prefix')
      }

      // Enforce upload size limit via Content-Length header (advisory — R2 enforces too)
      const contentLength = Number(req.headers.get('content-length') ?? 0)
      const sizeLimit = isAmos && AMOS_ADDITIONAL_CONTENT_TYPES.has(contentType) ? MAX_AMOS_VIDEO_SIZE_BYTES : MAX_UPLOAD_SIZE_BYTES
      if (contentLength > sizeLimit) {
        throw new Error(`File exceeds maximum size of ${Math.round(sizeLimit / 1024 / 1024)} MB`)
      }

      // Signed-URL issuance rate limit + daily quota (see BURST_LIMIT /
      // DAILY_QUOTA above) — every authenticated caller, regardless of
      // prefix type, so a script can't mint unlimited signed PUT URLs and
      // fill the bucket with never-referenced objects. Checked only for
      // actual uploads (not GET/read requests) since storage cost is
      // created by successful PUTs, not by reads.
      const burst = await checkAmosRateLimit(db, 'r2-upload-burst', user.id, BURST_LIMIT)
      if (!burst.allowed) throw new Error(`Too many upload requests — try again in ${burst.retryAfterSeconds}s`)
      const daily = await checkAmosRateLimit(db, 'r2-upload-daily', user.id, DAILY_QUOTA)
      if (!daily.allowed) throw new Error(`Daily upload limit reached — try again in ${Math.ceil((daily.retryAfterSeconds || 0) / 3600)}h`)
    }

    // For uploads, the object key is always server-generated from the
    // validated prefix — never the caller-supplied `key` (which is only
    // used to route to the right prefix check above). This is what makes
    // "cannot overwrite arbitrary objects" actually true: a caller can no
    // longer pick a filename that collides with an existing object, theirs
    // or anyone else's. GET (read) requests are unaffected — the caller
    // must supply the real, already-existing key to read.
    let finalKey = key
    if (!isGet) {
      if (!keyPrefix) throw new Error('Forbidden path')
      const ext = EXT_BY_CONTENT_TYPE[contentType] ?? 'bin'
      finalKey = `${keyPrefix}${crypto.randomUUID()}.${ext}`
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
      },
    })

    const bucket = Deno.env.get('R2_PUBLIC_BUCKET')!

    const cmd = isGet
      ? new GetObjectCommand({ Bucket: bucket, Key: finalKey })
      : new PutObjectCommand({ Bucket: bucket, Key: finalKey, ContentType: contentType })

    const ttl = isGet ? (expiresIn || 300) : 120
    const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: ttl })

    const publicUrl = isVerification
      ? undefined
      : `${Deno.env.get('R2_PUBLIC_URL')}/${finalKey}`

    return new Response(JSON.stringify({ signedUrl, publicUrl }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    const status =
      msg === 'Unauthorized' ? 401
      : msg === 'Forbidden' || msg === 'Forbidden path' ? 403
      : msg.startsWith('Too many upload requests') || msg.startsWith('Daily upload limit reached') ? 429
      : 400
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
