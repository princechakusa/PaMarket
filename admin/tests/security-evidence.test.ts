import { describe, expect, it } from 'vitest';
import { buildSecurityEvidenceHtml, deviceDescription, eventEvidenceStatus } from '../src/services/security-events/evidence';
import type { SecurityEventDetail } from '../src/services/security-events/query';

describe('security evidence snapshot', () => {
  it('labels browser signals and avoids claiming an exact device or location', () => {
    expect(eventEvidenceStatus('admin_login_failed')).toContain('Browser-reported');
    expect(deviceDescription('Mozilla/5.0 (Windows NT 10.0) Chrome/130.0')).toContain('desktop or laptop');
  });

  it('escapes event content and includes an integrity reference and export receipt', async () => {
    const event = {
      id: 'event-1', event_type: 'admin_login_honeypot', occurred_at: '2026-09-20T10:00:00Z',
      received_at: '2026-09-20T10:00:01Z', source: 'edge_function', severity: 'high',
      action: 'login', outcome: 'blocked', ip_address: '192.0.2.1', ip_source: 'cf-connecting-ip',
      user_agent: '<script>alert(1)</script>', metadata: {}, hold_status: 'none',
    } as SecurityEventDetail;
    const html = await buildSecurityEvidenceHtml(event, 'receipt-1');
    expect(html).toContain('receipt-1');
    expect(html).toContain('SHA-256');
    expect(html).toContain('192.0.2.1');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('physical location');
  });
});
