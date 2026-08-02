// delete-my-account — self-service, immediate, permanent account deletion
// triggered by the account's own owner (both web and mobile "Delete
// Account" screens call `supabase.rpc('delete_my_account')`, which has
// never actually existed — the client-side fallback that ran instead only
// deleted a handful of tables and never touched the real auth.users row,
// so a "deleted" account's email/password/OAuth identity kept working
// forever. This is the real fix, reusing the same proven deletion logic as
// process-account-deletion (the admin-triggered path used for
// email-initiated requests), just scoped to "delete myself" so there's no
// admin-approval step for the case Apple's Guideline 5.1.1(v) actually
// requires: the account owner deleting their own account in-app.
//
// Call shape: POST {} (no body needed — the target is always the caller)
// Auth: caller must be a signed-in user (their own JWT).
//
// Required Edge Function secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// SUPABASE_ANON_KEY (provided automatically)

const ALLOWED_ORIGINS = new Set([
  'https://pamarketzw.com',
  'https://www.pamarketzw.com',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
])

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://pamarketzw.com'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (d: unknown, s?: number) =>
    new Response(JSON.stringify(d), { status: s || 200, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')

    // ── Authenticate the caller (using their own token, RLS-scoped) ──
    const auth = req.headers.get('Authorization')
    if (!auth) return json({ error: 'Unauthorized' }, 401)

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    )
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser()
    if (authErr || !caller) return json({ error: 'Unauthorized' }, 401)

    const userId = caller.id

    // ── From here on, use the service-role client (bypasses RLS) — needed
    //    both for auth.admin.deleteUser and because a user deleting their
    //    OWN data still shouldn't depend on every table having a
    //    self-delete RLS policy. ──
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // ── conversations.members is a uuid[], not a foreign key — it will NOT
    //    cascade automatically. Remove the user from every conversation they
    //    belong to; delete conversations that would be left with 0 members.
    //    Paginated (a long-lived business/support account can have
    //    thousands of conversations — an unbounded select here risked
    //    missing some, and processing them one at a time in a sequential
    //    for-of loop risked this function timing out before finishing) and
    //    each page's conversations are cleaned up concurrently rather than
    //    one at a time. ──
    try {
      const PAGE = 500
      let from = 0
      for (;;) {
        const convRes = await db.from('conversations').select('id, members').contains('members', [userId]).range(from, from + PAGE - 1)
        if (convRes.error) throw convRes.error
        const rows = (convRes.data as any[]) || []
        await Promise.all(rows.map(async (conv) => {
          const remaining = (conv.members || []).filter((m: string) => m !== userId)
          if (remaining.length === 0) {
            await db.from('messages').delete().eq('conversation_id', conv.id)
            await db.from('conversations').delete().eq('id', conv.id)
          } else {
            await db.from('conversations').update({ members: remaining }).eq('id', conv.id)
          }
        }))
        if (rows.length < PAGE) break
        from += PAGE
      }
    } catch (e) {
      console.warn('conversation cleanup failed (continuing):', (e as Error).message)
    }

    // ── R2 objects are not tracked by Postgres at all — nothing here
    //    cascades. Every upload path this app issues signed URLs for is
    //    scoped to `{prefix}/{userId}/...` (see get-r2-upload-url), so listing
    //    and deleting everything under each of those prefixes is complete:
    //    avatars, listing photos, chat images, verification docs, CVs,
    //    rental photos. Best-effort — a storage failure here must never
    //    block the actual account deletion. ──
    try {
      const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = await import('npm:@aws-sdk/client-s3')
      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
          secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
        },
      })
      const bucket = Deno.env.get('R2_PUBLIC_BUCKET')!
      const prefixes = ['listings', 'chat', 'cv', 'verification', 'profiles', 'rentals'].map((p) => `${p}/${userId}/`)

      for (const prefix of prefixes) {
        let continuationToken: string | undefined
        for (;;) {
          const listRes = await s3.send(
            new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken })
          )
          const keys = (listRes.Contents || []).map((o) => o.Key).filter((k): k is string => !!k)
          if (keys.length) {
            // DeleteObjectsCommand caps at 1000 keys per call — R2 listing
            // pages at 1000 too, so this is always within limits.
            await s3.send(
              new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })) } })
            )
          }
          if (!listRes.IsTruncated) break
          continuationToken = listRes.NextContinuationToken
        }
      }
    } catch (e) {
      console.warn('R2 storage cleanup failed (continuing):', (e as Error).message)
    }

    // ── Everything below cascades automatically via
    //    `references auth.users(id) on delete cascade` once the profile row
    //    (and then the auth user) is deleted: businesses, listings,
    //    notifications, reviews, rental_favorites, saved_searches, push
    //    tokens, blocked_users, etc. ──
    const profDel = await db.from('profiles').delete().eq('id', userId)
    if (profDel.error) console.warn('profile delete warning:', profDel.error.message)

    // ── Delete the Supabase Auth user (this is the final, irreversible
    //    step — the actual account, not just its data) ──
    const authDel = await db.auth.admin.deleteUser(userId)
    if (authDel.error && !/not.?found/i.test(authDel.error.message || '')) {
      throw authDel.error
    }

    await db.from('deletion_logs').insert({
      request_id: null,
      user_id: userId,
      email: caller.email,
      deleted_tables: ['profiles', 'businesses', 'listings', 'conversations', 'messages', 'notifications', 'reviews'],
      auth_user_deleted: true,
      performed_by: userId,
    }).then(() => {}, () => {}) // best-effort audit log — never block the actual deletion on this

    return json({ success: true })
  } catch (err) {
    console.error('delete-my-account error:', (err as Error).message)
    return json({ error: (err as Error).message }, 500)
  }
})
