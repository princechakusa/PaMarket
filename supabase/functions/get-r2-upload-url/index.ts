import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand, GetObjectCommand } from 'npm:@aws-sdk/client-s3'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner'

// Allowed request origins — tightened from wildcard (*)
const ALLOWED_ORIGINS = new Set([
  'https://pamarket.app',
  'https://www.pamarket.app',
  'com.pamarket.app',       // Capacitor deep-link scheme treated as origin
  'http://127.0.0.1:5500',  // Local dev (Live Server)
  'http://localhost:5500',
  'http://localhost:3000',
])

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://pamarket.app'
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
    const isGet = verb === 'GET'

    if (isGet && isVerification) {
      // Admin can access any verification path; users only their own
      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
      const isAdmin = profile?.role === 'admin'
      if (!isAdmin && !key.startsWith(`verification/${user.id}/`)) throw new Error('Forbidden')
    } else {
      // PUT: user may only write under their own path prefix
      const allowed = [
        `listings/${user.id}/`,
        `chat/${user.id}/`,
        `cv/${user.id}/`,
        `verification/${user.id}/`,
        `profiles/${user.id}/`,
        `rentals/${user.id}/`,
      ]
      if (!allowed.some(p => key.startsWith(p))) throw new Error('Forbidden path')
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
