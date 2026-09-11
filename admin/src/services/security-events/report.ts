// Reports a login-security signal to the record-security-event Edge
// Function. Deliberately fire-and-forget-ish: bounded timeout, never
// throws, never retried automatically. A telemetry failure must never
// trap a legitimate administrator on a loading screen or create a retry
// loop — see admin/docs/c2d-security-evidence-results.md.
import { adminEnvironment } from '../supabase/env';

export type LoginSecurityEventType =
  | 'admin_login_honeypot'
  | 'admin_login_failed'
  | 'admin_login_succeeded'
  | 'admin_mfa_challenge_failed'
  | 'admin_mfa_challenge_succeeded'
  | 'admin_logout';

export type ReportOptions = {
  /** One of the Edge Function's fixed, allowlisted reason codes. */
  reasonCode?: string;
  /** Client-generated correlation id (a random UUID) — never used as identity. */
  correlationId?: string;
  /** Only a small, event-specific allowlist is accepted server-side; anything else is dropped. */
  metadata?: Record<string, string>;
  /** The caller's own access token, for event types that require an authenticated session. */
  accessToken?: string;
  timeoutMs?: number;
};

const REPORT_TIMEOUT_MS = 5_000;

export async function reportLoginSecurityEvent(eventType: LoginSecurityEventType, options: ReportOptions = {}): Promise<void> {
  if (adminEnvironment.mode !== 'live' || !adminEnvironment.supabaseUrl || !adminEnvironment.publishableKey) return;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? REPORT_TIMEOUT_MS);

  try {
    await fetch(`${adminEnvironment.supabaseUrl}/functions/v1/record-security-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: adminEnvironment.publishableKey,
        Authorization: `Bearer ${options.accessToken || adminEnvironment.publishableKey}`,
      },
      body: JSON.stringify({
        eventType,
        reasonCode: options.reasonCode,
        correlationId: options.correlationId,
        metadata: options.metadata,
      }),
      signal: controller.signal,
      keepalive: true,
    });
  } catch {
    // Best-effort only. Never surfaced to the caller, never retried.
  } finally {
    window.clearTimeout(timeout);
  }
}
