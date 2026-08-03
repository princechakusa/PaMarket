import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand, GetObjectCommand } from 'npm:@aws-sdk/client-s3'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner'

// Allowed request origins — tightened from wildcard (*)
const ALLOWED_ORIGINS = new Set([
  'https://pamarketzw.com',      // public website (image upload when posting)
  'https://www.pamarketzw.com',
  'https://admin.pamarketzw.com',
  'https://pamarket.chakusaprince.workers.dev',
  'https://pamarket.app',
  'https://www.pamarket.app',
  'com.pamarket.app',       // Capacitor deep-link scheme, sent by some WebViews
  // capacitor.config.json sets androidScheme:"https" with no custom hostname,
  // so Capacitor's local WebView server actually serves the app from
  // https://localhost — NOT com.pamarket.app. A request from that real origin
  // was falling through to FALLBACK_ORIGIN below, whose Access-Control-Allow-
  // Origin (the website's) didn't match the WebView's actual origin, so the
  // browser/WebView silently rejected the response as a CORS violation —
  // surfacing in-app only as a generic "Failed to fetch", never reaching this
  // function's own logic (confirmed: it happened on the very first network
  // call, before any response could be read).
  'https://localhost',
  'capacitor://localhost', // iOS Capacitor WebView origin (same root cause)
  'http://127.0.0.1:5500',  // Local dev (Live Server)
  'http://localhost:5500',
  'http://localhost:3000',
])

// The fallback ACAO when an origin isn't in the set. The website is the
// primary browser client, so fall back to its origin rather than any app
// scheme — but every real client this function serves must be listed above;
// this fallback existing is not a substitute for an accurate allowlist.
const FALLBACK_ORIGIN = 'https://pamarketzw.com'

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : FALLBACK_ORIGIN
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

// Allowlist for content types users may upload
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf', // CVs only
])

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

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

    const { data: { user }, error: authErr } = await sb.auth.getUser()
    if (authErr || !user) throw new Error('Unauthorized')

    const { key, contentType, verb = 'PUT', expiresIn } = await req.json()
    if (!key || typeof key !== 'string') throw new Error('key required')

    const isVerification = key.startsWith('verification/')
    const isAd = key.startsWith('ads/')
    const isGet = verb === 'GET'

    if (isGet && isVerification) {
      // Admin can access any verification path; users only their own
      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
      const isAdmin = profile?.role === 'admin'
      if (!isAdmin && !key.startsWith(`verification/${user.id}/`)) throw new Error('Forbidden')
    } else {
      // Ad creatives use a shared public namespace, but only administrators
      // may request upload URLs for that namespace.
      if (isAd) {
        const { data: profile, error: profileErr } = await sb
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (profileErr || profile?.role !== 'admin') throw new Error('Forbidden')
      }

      // Non-ad PUTs remain scoped to the authenticated user's path prefix.
      const allowed = [
        `listings/${user.id}/`,
        `chat/${user.id}/`,
        `cv/${user.id}/`,
        `verification/${user.id}/`,
        `profiles/${user.id}/`,
        `rentals/${user.id}/`,
      ]
      if (!isAd && !allowed.some(p => key.startsWith(p))) throw new Error('Forbidden path')
      if (!contentType) throw new Error('contentType required for upload')

      // Validate content type against allowlist
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        throw new Error('Content type not permitted')
      }

      // CVs (application/pdf) may only go under cv/ prefix
      if (contentType === 'application/pdf' && !key.startsWith(`cv/${user.id}/`)) {
        throw new Error('PDF uploads only permitted under cv/ prefix')
      }

      // Enforce upload size limit via Content-Length header (advisory — R2 enforces too)
      const contentLength = Number(req.headers.get('content-length') ?? 0)
      if (contentLength > MAX_UPLOAD_SIZE_BYTES) {
        throw new Error('File exceeds maximum size of 10 MB')
      }
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
      ? new GetObjectCommand({ Bucket: bucket, Key: key })
      : new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType })

    const ttl = isGet ? (expiresIn || 300) : 120
    const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: ttl })

    const publicUrl = isVerification
      ? undefined
      : `${Deno.env.get('R2_PUBLIC_URL')}/${key}`

    return new Response(JSON.stringify({ signedUrl, publicUrl }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    const status =
      msg === 'Unauthorized' ? 401
      : msg === 'Forbidden' || msg === 'Forbidden path' ? 403
      : 400
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
