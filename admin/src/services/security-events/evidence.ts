import type { SecurityEventDetail } from './query';

export function deviceDescription(userAgent: string | null): string {
  if (!userAgent) return 'Not available';
  const device = /iPad/i.test(userAgent) ? 'tablet' : /Mobile|iPhone|Android/i.test(userAgent) ? 'mobile device' : 'desktop or laptop';
  const system = /Windows NT/i.test(userAgent) ? 'Windows' : /Mac OS X/i.test(userAgent) ? 'macOS or iOS' : /Android/i.test(userAgent) ? 'Android' : /Linux/i.test(userAgent) ? 'Linux' : 'unknown operating system';
  const browser = /Edg\//i.test(userAgent) ? 'Edge' : /Firefox\//i.test(userAgent) ? 'Firefox' : /Chrome\//i.test(userAgent) ? 'Chrome-family browser' : /Safari\//i.test(userAgent) ? 'Safari-family browser' : 'unknown browser';
  return `${device}; ${system}; ${browser} (inferred from user-agent)`;
}

export function eventEvidenceStatus(eventType: string): string {
  if (eventType === 'admin_login_failed' || eventType === 'admin_login_honeypot') {
    return 'Browser-reported signal. The server observed the request and network headers, but did not independently verify the attempted password or the hidden-field state.';
  }
  if (eventType === 'admin_login_succeeded') {
    return 'Authenticated browser-reported signal. The server verified a session token, but this is not a complete Supabase Auth login ledger.';
  }
  return 'Server-recorded event. Review the source and event-specific metadata before drawing conclusions.';
}

function escapeHtml(value: unknown): string {
  return String(value ?? 'Not available').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export async function buildSecurityEvidenceHtml(event: SecurityEventDetail, receiptId: string): Promise<string> {
  const generatedAt = new Date().toISOString();
  const canonical = JSON.stringify(event);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const fields: [string, unknown][] = [
    ['Export receipt ID', receiptId], ['Event ID', event.id], ['Event type', event.event_type], ['Occurred (UTC)', event.occurred_at],
    ['Received (UTC)', event.received_at], ['Source', event.source], ['Severity', event.severity],
    ['Action', event.action], ['Outcome', event.outcome], ['Reason code', event.reason_code],
    ['Actor user ID', event.actor_user_id], ['Actor role', event.actor_role],
    ['Actor authenticated', event.actor_authenticated], ['Assurance level', event.assurance_level],
    ['Correlation ID', event.correlation_id], ['Request method', event.request_method],
    ['Request path', event.request_path], ['IP address', event.ip_address], ['IP source', event.ip_source],
    ['User agent', event.user_agent], ['Inferred device', deviceDescription(event.user_agent)],
    ['Network location', 'Not recorded; an IP address does not establish a physical position'],
    ['Retention until', event.retention_until], ['Legal hold', event.hold_status],
  ];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PaMarket security evidence ${escapeHtml(event.id)}</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:900px;margin:40px auto;color:#17212b}h1{margin-bottom:0}small{color:#52606d}table{border-collapse:collapse;width:100%;margin:24px 0}th,td{padding:9px;border-bottom:1px solid #ccd3da;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{width:220px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f4f6;padding:16px}@media print{body{margin:15mm}button{display:none}}</style></head><body><h1>PaMarket Security Evidence</h1><small>Generated ${escapeHtml(generatedAt)} · Source: public.security_events via get_security_event() · Event count: 1</small><p><strong>Evidence status:</strong> ${escapeHtml(eventEvidenceStatus(event.event_type))}</p><p>IP-based location and user-agent details can be inaccurate or spoofed. This report does not identify a person or prove a physical location. Preserve provider logs and document chain of custody for legal use.</p><table>${fields.map(([name, value]) => `<tr><th>${escapeHtml(name)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table><h2>Recorded metadata</h2><pre>${escapeHtml(JSON.stringify(event.metadata, null, 2))}</pre><h2>Integrity reference</h2><p>SHA-256 of the JSON event returned to this browser: <code>${sha256}</code>. This checksum detects later changes to this downloaded snapshot; it does not prove the database or browser was tamper-free.</p><pre>${escapeHtml(canonical)}</pre></body></html>`;
}
