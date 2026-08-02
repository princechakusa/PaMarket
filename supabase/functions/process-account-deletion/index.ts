// process-account-deletion — permanently deletes a user's account and all
// associated data, triggered manually by an admin (never automatically on
// request submission — see account_deletion_requests RLS: only admins can
// even read pending requests).
//
// Call shape: POST { request_id: uuid }
// Auth: caller must be an authenticated admin (profiles.role = 'admin').
// Uses the service-role key internally to perform the actual deletion,
// since RLS would otherwise block cross-user deletes even for an admin
// acting on someone else's data.
//
// Required Edge Function secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (provided automatically)

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

    // ── Authenticate the CALLER as an admin (using their own token, RLS-scoped) ──
    const auth = req.headers.get('Authorization')
    if (!auth) return json({ error: 'Unauthorized' }, 401)

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    )
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser()
    if (authErr || !caller) return json({ error: 'Unauthorized' }, 401)

    const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', caller.id).single()
    if (!callerProfile || callerProfile.role !== 'admin') return json({ error: 'Forbidden — admin only' }, 403)

    const { request_id } = await req.json()
    if (!request_id) return json({ error: 'request_id required' }, 400)

    // ── From here on, use the service-role client (bypasses RLS) to perform
    //    the actual cross-user deletion. ──
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const reqRes = await db.from('account_deletion_requests').select('*').eq('id', request_id).maybeSingle()
    if (reqRes.error) throw reqRes.error
    const request = reqRes.data
    if (!request) return json({ error: 'Deletion request not found' }, 404)

    // Idempotency: re-running on an already-completed request is a safe no-op,
    // not an error — never attempt a second deletion pass.
    if (request.status === 'completed') {
      return json({ success: true, already_completed: true })
    }

    await db.from('account_deletion_requests').update({ status: 'processing' }).eq('id', request_id)

    // ── Resolve the target user ────────────────────────────────────────
    let userId: string | null = request.user_id
    if (!userId) {
      const byEmail = await db.from('profiles').select('id').eq('email', request.email).maybeSingle()
      userId = byEmail.data?.id || null
    }

    const deletedTables: string[] = []
    let authUserDeleted = false

    if (!userId) {
      // No matching account (e.g. already deleted, or the email never had
      // an account). Nothing to delete — log it and mark completed rather
      // than leaving the request stuck in "processing" forever.
      await db.from('account_deletion_requests').update({ status: 'completed' }).eq('id', request_id)
      await db.from('deletion_logs').insert({
        request_id, user_id: null, email: request.email,
        deleted_tables: [], auth_user_deleted: false, performed_by: caller.id,
      })
      return json({ success: true, note: 'No matching account found for this email' })
    }

    // ── conversations.members is a uuid[], not a foreign key — it will NOT
    //    cascade automatically. Remove the user from every conversation they
    //    belong to; delete conversations that would be left with 0 members.
    //    Paginated and processed concurrently per page — a long-lived
    //    business/support account can have thousands of conversations, and
    //    an unbounded select + sequential per-conversation loop risked this
    //    function timing out before finishing. ──
    try {
      const PAGE = 500
      let from = 0
      let any = false
      for (;;) {
        const convRes = await db.from('conversations').select('id, members').contains('members', [userId]).range(from, from + PAGE - 1)
        if (convRes.error) throw convRes.error
        const rows = (convRes.data as any[]) || []
        if (rows.length) any = true
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
      if (any) deletedTables.push('conversations', 'messages')
    } catch (e) {
      console.warn('conversation cleanup failed (continuing):', (e as Error).message)
    }

    // ── R2 objects are not tracked by Postgres — nothing cascades. Every
    //    upload path this app issues signed URLs for is scoped to
    //    `{prefix}/{userId}/...` (see get-r2-upload-url), so listing and
    //    deleting everything under each of those prefixes is complete.
    //    Best-effort — a storage failure must never block the deletion. ──
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
      let anyDeleted = false

      for (const prefix of prefixes) {
        let continuationToken: string | undefined
        for (;;) {
          const listRes = await s3.send(
            new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken })
          )
          const keys = (listRes.Contents || []).map((o) => o.Key).filter((k): k is string => !!k)
          if (keys.length) {
            anyDeleted = true
            await s3.send(
              new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })) } })
            )
          }
          if (!listRes.IsTruncated) break
          continuationToken = listRes.NextContinuationToken
        }
      }
      if (anyDeleted) deletedTables.push('r2_storage')
    } catch (e) {
      console.warn('R2 storage cleanup failed (continuing):', (e as Error).message)
    }

    // ── Everything below cascades automatically via
    //    `references public.profiles(id) on delete cascade` /
    //    `references auth.users(id) on delete cascade` once the profile row
    //    (and then the auth user) is deleted: businesses, listings,
    //    notifications, reviews, rental_favorites, saved_searches, etc.
    //    We still log the categories explicitly for the audit trail. ──
    deletedTables.push('profiles', 'businesses', 'listings', 'notifications', 'favorites', 'analytics_events')

    // Deleting the profile row is enough to cascade the rest; deleting the
    // auth user below also cascades the profile again defensively (in case
    // the profile row was already gone).
    const profDel = await db.from('profiles').delete().eq('id', userId)
    if (profDel.error) console.warn('profile delete warning:', profDel.error.message)

    // ── Delete the Supabase Auth user (this is the final, irreversible step) ──
    const authDel = await db.auth.admin.deleteUser(userId)
    if (authDel.error) {
      // If the auth user is already gone (e.g. re-running after a partial
      // previous run), treat as success rather than failing the whole request.
      if (!/not.?found/i.test(authDel.error.message || '')) throw authDel.error
    } else {
      authUserDeleted = true
    }

    await db.from('account_deletion_requests').update({ status: 'completed' }).eq('id', request_id)

    await db.from('deletion_logs').insert({
      request_id,
      user_id: userId,
      email: request.email,
      deleted_tables: deletedTables,
      auth_user_deleted: authUserDeleted,
      performed_by: caller.id,
    })

    return json({ success: true, user_id: userId, deleted_tables: deletedTables, auth_user_deleted: authUserDeleted })
  } catch (err) {
    console.error('process-account-deletion error:', (err as Error).message)
    return json({ error: (err as Error).message }, 500)
  }
})
