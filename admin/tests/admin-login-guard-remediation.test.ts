import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ADMIN_ALERT_ROLES,
  isRetiredPublicLoginStateAction,
  trustedCloudflareIp,
} from '../../supabase/functions/_shared/admin-login-guard-policy'

const repositoryRoot = resolve(process.cwd(), '..')
const edgeSource = readFileSync(resolve(repositoryRoot, 'supabase/functions/admin-login-guard/index.ts'), 'utf8')
const legacyAdminSource = readFileSync(resolve(repositoryRoot, 'www/admin.html'), 'utf8')
const migrationSource = readFileSync(resolve(repositoryRoot, 'supabase/migrations/20260914120000_retire_untrusted_admin_login_state.sql'), 'utf8')

describe('C2E-3A admin login state boundary', () => {
  it('rejects both anonymous login-state actions regardless of caller-selected identity', () => {
    expect(isRetiredPublicLoginStateAction('check')).toBe(true)
    expect(isRetiredPublicLoginStateAction('record')).toBe(true)
    expect(isRetiredPublicLoginStateAction({ action: 'record', email: 'victim@example.test', ok: false })).toBe(false)
  })

  it('rejects retired actions before a service-role database client is constructed', () => {
    const rejection = edgeSource.indexOf('if (isRetiredPublicLoginStateAction(action))')
    const serviceClient = edgeSource.indexOf("const db = createClient(Deno.env.get('SUPABASE_URL')!")
    expect(rejection).toBeGreaterThan(-1)
    expect(serviceClient).toBeGreaterThan(rejection)
    expect(edgeSource).not.toContain("body['email']")
  })

  it('contains no remaining login-attempt or login-block database path', () => {
    expect(edgeSource).not.toContain(".from('admin_login_attempts')")
    expect(edgeSource).not.toContain(".from('admin_ip_blocks')")
    expect(edgeSource).not.toContain('MAX_FAILS_PER_EMAIL')
    expect(edgeSource).not.toContain('MAX_FAILS_PER_IP')
  })

  it('removes alternate direct browser writes to both login-state tables', () => {
    expect(migrationSource).toContain('drop policy if exists "login_attempts insert"')
    expect(migrationSource).toContain('revoke all privileges on table public.admin_login_attempts from public, anon, authenticated')
    expect(migrationSource).toContain('revoke all privileges on table public.admin_ip_blocks from public, anon, authenticated')
    expect(migrationSource).toContain('grant select on table public.admin_login_attempts to authenticated')
    expect(migrationSource).toContain('grant select on table public.admin_ip_blocks to authenticated')
    expect(migrationSource).not.toMatch(/grant\s+(insert|update|delete|all)/i)
  })

  it('ignores browser-controlled proxy headers and uses only Cloudflare attribution', () => {
    expect(trustedCloudflareIp(new Headers({
      'x-forwarded-for': '203.0.113.10',
      'x-real-ip': '203.0.113.11',
    }))).toBe('unknown')
    expect(trustedCloudflareIp(new Headers({
      'cf-connecting-ip': '198.51.100.8',
      'x-forwarded-for': '203.0.113.10',
    }))).toBe('198.51.100.8')
  })

  it('keeps the real Supabase password attempt and local failure/success lifecycle', () => {
    expect(legacyAdminSource).toContain('sb.auth.signInWithPassword({ email:email, password:pass })')
    expect(legacyAdminSource).toMatch(/if\(res\.error\|\|!res\.data\|\|!res\.data\.user\)\{\s*recordFail\(\)/)
    expect(legacyAdminSource).toContain('clearFails();')
    expect(legacyAdminSource).not.toContain('checkLoginGuard(')
    expect(legacyAdminSource).not.toContain('recordLoginAttempt(')
    expect(legacyAdminSource).toContain("reportLoginSecuritySignal('admin_login_failed')")
    expect(legacyAdminSource).toContain("reportLoginSecuritySignal('admin_login_succeeded',res.data.session&&res.data.session.access_token)")
  })

  it('returns generic login failures without credentials, identity, IP, or internal errors', () => {
    expect(legacyAdminSource).toContain("showErr('That email or password was not accepted.')")
    expect(legacyAdminSource).toContain("showErr('Login could not be completed. Please try again.')")
    expect(legacyAdminSource).not.toContain("showErr('Login error: '+e.message)")
    expect(edgeSource).toContain("return json({ error: 'unsupported_action' }, 410)")
    expect(edgeSource).toContain("return json({ error: 'internal_error' }, 500)")
    expect(edgeSource).not.toContain("error: (err as Error).message")
    const reporterStart = legacyAdminSource.indexOf('async function reportLoginSecuritySignal')
    const reporterEnd = legacyAdminSource.indexOf('// ── Trust / risk', reporterStart)
    const reporter = legacyAdminSource.slice(reporterStart, reporterEnd)
    expect(reporter).not.toContain('email')
    expect(reporter).not.toContain('password')
    expect(reporter).not.toContain('ip')
  })

  it('preserves authenticated mutation throttling and alerts the super-admin role', () => {
    expect(edgeSource).toContain("action === 'mutation-check' || action === 'mutation-record'")
    expect(edgeSource).toContain('db.auth.getUser(jwt)')
    expect(edgeSource).toContain(".from('admin_mutation_log').insert")
    expect(edgeSource).toContain(".from('admin_mutation_blocks').insert")
    expect(ADMIN_ALERT_ROLES).toContain('super_admin')
  })
})
