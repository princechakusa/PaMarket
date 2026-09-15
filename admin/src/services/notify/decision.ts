// Shared "admin made a decision about this user's record" notification
// helper. Reuses the real notifications table and its "self or admin
// insert" RLS (is_admin()) directly -- no new table/RPC.
//
// This exists so every decision workflow (verifications today; listings,
// businesses, jobs, rentals, appeals as they're wired up later) sends a
// notification the SAME, already-correct way, instead of each call site
// re-deriving its own notification shape. Two things every prior
// notification bug in this codebase came down to (see
// project_notification_deeplinks memory, 2026-09-09):
//   1. The notification was never sent at all (a cross-user insert was
//      silently dropped). Not possible here: this always runs under an
//      authenticated admin session, and RLS's is_admin() branch covers it.
//   2. The notification was sent but had no meta.deepLink, so tapping it
//      took the user to a generic screen or nowhere. DecisionLink below is
//      a closed, typed union of the exact "kind:id" strings both the
//      mobile app's parseDeepLinkString() (apps/mobile/lib/notifications.ts)
//      and the website's _notifNavigate() (www/js/notifications.js)
//      already know how to route -- a call site cannot typo a deep link
//      into an unhandled shape.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

/** Every kind here matches a case parseDeepLinkString() already handles.
 * Add a new kind only after confirming both platforms' resolvers
 * understand it -- see project_notification_deeplinks memory. */
export type DecisionLink =
  | { kind: 'verify' }
  | { kind: 'businessverify'; businessId: string }
  | { kind: 'business'; businessId: string }
  | { kind: 'businessmanage'; businessId: string }
  | { kind: 'listing'; listingId: string }
  | { kind: 'job'; jobId: string }
  /** No confirmed deep-link target for this decision type yet -- omitting
   * meta.deepLink is safer than guessing a "kind:id" string neither
   * platform's resolver recognizes (both fall back to a generic screen
   * for an absent deepLink, same as before this decision type existed;
   * an unrecognized one is no better and invites the exact bug this
   * module exists to prevent). Add a real kind above once a target
   * screen is confirmed on both platforms. */
  | { kind: 'none' };

function deepLinkString(link: DecisionLink): string | null {
  switch (link.kind) {
    case 'verify': return 'verify:me';
    case 'businessverify': return `businessverify:${link.businessId}`;
    case 'business': return `business:${link.businessId}`;
    case 'businessmanage': return `businessmanage:${link.businessId}`;
    case 'listing': return `listing:${link.listingId}`;
    case 'job': return `job:${link.jobId}`;
    case 'none': return null;
  }
}

/** Sends a real, deep-linked notification to the affected user about an
 * admin decision. Never throws -- a failure here is reported back as
 * `error` so the caller can tell the admin the decision saved but the
 * notification didn't send, rather than silently losing it. */
export async function notifyDecision(userId: string, link: DecisionLink, title: string, body: string): Promise<QueryResult<true>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const id = crypto.randomUUID();
  const deepLink = deepLinkString(link);
  const { error } = await client.from('notifications').insert({
    id, user_id: userId, title, body, type: 'admin_decision', meta: deepLink ? { deepLink } : {}, created_at: Date.now(),
  });
  if (error) return { data: null, error: normalizeError(error) };
  return { data: true, error: null };
}
