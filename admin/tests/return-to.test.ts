import { describe, expect, it } from 'vitest';
import { sanitizeReturnTo } from '../src/security/return-to';

describe('sanitizeReturnTo', () => {
  it('accepts a normal internal path', () => {
    expect(sanitizeReturnTo('/settings/security')).toBe('/settings/security');
    expect(sanitizeReturnTo('/marketplace/users?tab=verified')).toBe('/marketplace/users?tab=verified');
  });

  it('falls back for missing input', () => {
    expect(sanitizeReturnTo(null)).toBe('/');
    expect(sanitizeReturnTo(undefined)).toBe('/');
    expect(sanitizeReturnTo('')).toBe('/');
  });

  it('rejects absolute URLs (open redirect)', () => {
    expect(sanitizeReturnTo('https://evil.example/steal')).toBe('/');
    expect(sanitizeReturnTo('http://evil.example')).toBe('/');
  });

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeReturnTo('//evil.example/steal')).toBe('/');
  });

  it('rejects a scheme hidden after a leading slash', () => {
    expect(sanitizeReturnTo('/javascript:alert(1)')).toBe('/');
    expect(sanitizeReturnTo('/data:text/html,x')).toBe('/');
  });

  it('rejects a path that does not start with a slash', () => {
    expect(sanitizeReturnTo('settings/security')).toBe('/');
  });

  it('falls back on unparsable percent-encoding', () => {
    expect(sanitizeReturnTo('%E0%A4%A')).toBe('/');
  });

  it('honors a custom fallback', () => {
    expect(sanitizeReturnTo(null, '/settings/security')).toBe('/settings/security');
  });
});
