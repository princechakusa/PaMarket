import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand, GetObjectCommand } from 'npm:@aws-sdk/client-s3'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

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
      ]
      if (!allowed.some(p => key.startsWith(p))) throw new Error('Forbidden path')
      if (!contentType) throw new Error('contentType required for upload')
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
      },
    })

    // Always use the public bucket — verification/ paths get no public URL back
    // so they are effectively private without requiring a separate private bucket.
    const bucket = Deno.env.get('R2_PUBLIC_BUCKET')!

    const cmd = isGet
      ? new GetObjectCommand({ Bucket: bucket, Key: key })
      : new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType })

    const ttl = isGet ? (expiresIn || 300) : 120
    const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: ttl })

    // Public URL only for non-verification objects
    const publicUrl = isVerification
      ? undefined
      : `${Deno.env.get('R2_PUBLIC_URL')}/${key}`

    return new Response(JSON.stringify({ signedUrl, publicUrl }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    const status = msg === 'Unauthorized' || msg === 'Forbidden' || msg === 'Forbidden path' ? 401 : 400
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
