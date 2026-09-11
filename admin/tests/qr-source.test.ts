import { describe, expect, it } from 'vitest';
import { normalizeQrSource } from '../src/security/qr-source';

// Fake, non-functional SVG fixtures only — never a real Supabase QR value.
const ALREADY_PREFIXED = 'data:image/svg+xml;utf-8,<svg data-fake="not-a-real-qr"></svg>';
const RAW_SVG = '<svg data-fake="not-a-real-qr"><rect/></svg>';

describe('normalizeQrSource', () => {
  it('leaves an already-prefixed SVG data URI unchanged (installed auth-js shape)', () => {
    expect(normalizeQrSource(ALREADY_PREFIXED)).toBe(ALREADY_PREFIXED);
  });

  it('never double-prefixes an already-prefixed value', () => {
    const result = normalizeQrSource(ALREADY_PREFIXED);
    expect(result?.startsWith('data:image/svg+xml;utf-8,data:image/svg+xml')).toBe(false);
    expect(result?.indexOf('data:image/svg+xml')).toBe(result?.lastIndexOf('data:image/svg+xml'));
  });

  it('encodes raw SVG markup into a valid data URI', () => {
    const result = normalizeQrSource(RAW_SVG);
    expect(result).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(RAW_SVG)}`);
  });

  it('tolerates leading/trailing whitespace around raw SVG', () => {
    const result = normalizeQrSource(`\n  ${RAW_SVG}  \n`);
    expect(result).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(RAW_SVG)}`);
  });

  it('rejects empty, null, and undefined values', () => {
    expect(normalizeQrSource('')).toBeNull();
    expect(normalizeQrSource('   ')).toBeNull();
    expect(normalizeQrSource(null)).toBeNull();
    expect(normalizeQrSource(undefined)).toBeNull();
  });

  it('rejects javascript: URLs', () => {
    expect(normalizeQrSource('javascript:alert(document.cookie)')).toBeNull();
  });

  it('rejects http: and https: URLs', () => {
    expect(normalizeQrSource('https://evil.example/x.svg')).toBeNull();
    expect(normalizeQrSource('http://evil.example/x.svg')).toBeNull();
  });

  it('rejects file: and blob: URLs', () => {
    expect(normalizeQrSource('file:///etc/passwd')).toBeNull();
    expect(normalizeQrSource('blob:https://example.com/uuid')).toBeNull();
  });

  it('rejects an unrelated data: MIME type', () => {
    expect(normalizeQrSource('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(normalizeQrSource('data:image/png;base64,AAAA')).toBeNull();
  });

  it('rejects plain text that is not SVG markup', () => {
    expect(normalizeQrSource('not an svg at all')).toBeNull();
  });
});
