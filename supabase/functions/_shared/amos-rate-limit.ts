// Rate limiting for manual (admin JWT) triggers of AMOS edge functions.
// Never applied to the cron path — a scheduled job isn't a human who can
// be spammy, and the cron secret is already the higher-trust path.
//
// Backed by amos_manual_trigger_log (AMOS_MODULE_2_QUALITY_LAYER.sql),
// service-role only. Uses a service-role Supabase client (RLS denies
// anon/authenticated entirely) so this can only ever be called from
// server-side edge function code, never the browser.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function checkAmosRateLimit(
  db: SupabaseClient,
  fnName: string,
  actorId: string,
  opts: { windowMinutes: number; maxCalls: number }
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const since = new Date(Date.now() - opts.windowMinutes * 60_000).toISOString()
  const { data, error } = await db
    .from('amos_manual_trigger_log')
    .select('created_at')
    .eq('fn_name', fnName)
    .eq('actor_id', actorId)
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  // Fail open: a rate-limit table hiccup should never be the reason a
  // legitimate admin action is blocked. It's a spam guard, not a security
  // boundary — the real authorization check already happened before this.
  if (error) return { allowed: true }

  const calls = data || []
  if (calls.length < opts.maxCalls) {
    await db.from('amos_manual_trigger_log').insert({ fn_name: fnName, actor_id: actorId })
    return { allowed: true }
  }

  const oldestInWindow = new Date(calls[0].created_at).getTime()
  const retryAfterMs = oldestInWindow + opts.windowMinutes * 60_000 - Date.now()
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) }
}
