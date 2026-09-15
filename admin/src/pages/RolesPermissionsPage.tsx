import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../security/auth-context';
import { adminRoles, rolePermissions, type AdminRole, type Permission } from '../security/permissions';
import { listUsers, type UserRow } from '../services/users/query';

// Reality audit fix: this page previously showed a hardcoded roster of six
// fictional staff members (names, IDs, "YubiKey" credentials, fake session
// states) under a REFERENCE banner. It now lists real profiles filtered by
// admin role, reusing listUsers() (C2E-10) exactly as UserDirectoryPage
// does -- no new query architecture. There is no real "terminal"/hardware-
// token/session-tracking infrastructure, so those fields are gone rather
// than simulated; mfa_enabled (real) is shown in their place.
const roleMeta: Record<AdminRole, { label: string; tier: string }> = {
  super_admin: { label: 'Super Admin', tier: 'TIER 0 · ROOT' },
  admin: { label: 'Operations Admin', tier: 'TIER 1 · OPERATIONS' },
  moderator: { label: 'Trust & Moderation', tier: 'TIER 2 · MODERATION' },
  support: { label: 'Support Agent', tier: 'TIER 3 · SUPPORT' },
  finance: { label: 'Finance & Escrow', tier: 'TIER 1 · FINANCE' },
};
const domains: [string, string, Permission[]][] = [
  ['fact_check', 'Trust & Moderation', ['listings.view', 'listings.moderate', 'verifications.manage', 'reports.view', 'reports.manage', 'moderation.manage', 'reviews.moderate']],
  ['account_balance', 'Commerce & Revenue', ['orders.view', 'orders.manage', 'monetization.view', 'revenue.view', 'ads.view', 'ads.manage', 'billing.view']],
  ['security', 'Platform Governance', ['audit.view', 'audit.export', 'errors.view', 'errors.resolve', 'operations.view', 'security.view', 'security.manage', 'admins.manage', 'mfa_policy.manage', 'settings.manage']],
  ['domain', 'Marketplace Operations', ['users.view', 'users.assist', 'businesses.view', 'rentals.view', 'rentals.moderate', 'rentals.manage', 'taxonomy.view', 'taxonomy.manage']],
];
function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }
function formatPermission(permission: Permission) { return permission.split('.').map((x) => x[0].toUpperCase() + x.slice(1)).join(' · '); }

export function RolesPermissionsPage() {
  const auth = useAuth();
  const [role, setRole] = useState<AdminRole>('super_admin');
  const [query, setQuery] = useState('');
  const [staff, setStaff] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading'); setError(null);
    const result = await listUsers({ role, search: query || undefined }, 1, 50);
    if (result.error) { setError(result.error.message); setPhase('error'); return; }
    setStaff(result.data.rows);
    setSelectedId(result.data.rows[0]?.id ?? null);
    setPhase('ready');
  }, [auth.mode, role, query]);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => staff.find((s) => s.id === selectedId) ?? null, [staff, selectedId]);
  const allowed = new Set(rolePermissions[role]);

  return <div className="rbac-page">
    {auth.mode === 'mock' && <div className="rbac-reference" role="note"><Icon name="science" /><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="rbac-breadcrumb">PAMARKET OPS / SECURITY & PLATFORM / <b>ROLES & PERMISSIONS</b></div>
    <header className="rbac-hero"><div><small>SERVER-ENFORCED ROLE MATRIX</small><h1>Roles & Permissions</h1><p>The permission matrix below is the application's real permission map. Staff shown are real profiles.role records — there is no hardware-credential or session-tracking system, so none is shown.</p></div></header>

    <nav className="listing-tabs" aria-label="Role"><div>{adminRoles.map((r) => <button key={r} className={role === r ? 'active' : ''} onClick={() => setRole(r)}>{roleMeta[r].label}</button>)}</div></nav>

    {phase === 'error' && <div className="rbac-reference" role="alert"><Icon name="error" /><b>Could not load staff</b><span>{error}</span></div>}

    <div className="rbac-workspace">
      <section className="rbac-staff">
        <header><h2>{roleMeta[role].label.toUpperCase()} — {roleMeta[role].tier}</h2><label><Icon name="search" /><input aria-label="Search staff" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or ID" /></label></header>
        <div className="rbac-table-scroll"><table aria-label="Staff with this role"><thead><tr><th>Name</th><th>Email</th><th>MFA</th><th>Status</th></tr></thead>
          <tbody>{staff.map((person) => <tr key={person.id} className={selectedId === person.id ? 'selected' : ''} onClick={() => setSelectedId(person.id)} style={{ cursor: 'pointer' }}>
            <td><span className="rbac-avatar">{(person.name ?? '?').slice(0, 2).toUpperCase()}</span><strong>{person.name ?? 'Unnamed'}</strong><small>{person.id.slice(0, 8)}…</small></td>
            <td>{person.email ?? '—'}</td><td>{person.mfa_enabled ? 'Enabled' : 'Not enabled'}</td><td>{person.status ?? '—'}</td>
          </tr>)}</tbody></table>
          {phase === 'ready' && staff.length === 0 && <p role="status">No staff currently assigned the {roleMeta[role].label} role.</p>}
        </div>
      </section>
      <aside className="rbac-operator" aria-label="Selected staff member">
        {!selected && <p>Select a staff member to view detail.</p>}
        {selected && <>
          <header><span className="rbac-avatar">{(selected.name ?? '?').slice(0, 2).toUpperCase()}</span><div><small>PROFILE</small><h2>{selected.name ?? 'Unnamed'}</h2><p>{selected.email ?? '—'}</p></div></header>
          <dl>
            <div><dt>Assigned role</dt><dd>{roleMeta[role].label}</dd></div>
            <div><dt>MFA enrolled</dt><dd>{selected.mfa_enabled ? 'Yes' : 'No'}</dd></div>
            <div><dt>Status</dt><dd>{selected.status ?? '—'}</dd></div>
            <div><dt>Province</dt><dd>{selected.province ?? '—'}</dd></div>
          </dl>
        </>}
      </aside>
    </div>

    <section className="rbac-permissions" aria-label="Permission matrix"><header><h2>PERMISSION MATRIX — {roleMeta[role].label.toUpperCase()}</h2></header>
      <div className="rbac-domains">{domains.map(([icon, label, perms]) => <article key={label}><header><Icon name={icon} /><h3>{label}</h3></header><ul>{perms.map((p) => <li key={p} className={allowed.has(p) ? 'granted' : 'denied'}>{formatPermission(p)}</li>)}</ul></article>)}</div>
      <p><small>This matrix mirrors admin/src/security/permissions.ts — the client-side guard only. Server-side RLS/grants are the actual authorization boundary and may be narrower than this display for any given table or RPC.</small></p>
    </section>
  </div>;
}
