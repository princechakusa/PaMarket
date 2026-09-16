import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import {
  listAdminAuditLogs, listRentalAuditLogs, listRoleAuditLog, AUDIT_PAGE_SIZE,
  type AdminAuditRow, type RentalAuditRow, type RoleAuditRow,
} from '../services/audit/query';

function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }
function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }

type Tab = 'admin' | 'rental' | 'role';

export function AuditCenterPage() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('admin');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [adminRows, setAdminRows] = useState<AdminAuditRow[]>([]);
  const [rentalRows, setRentalRows] = useState<RentalAuditRow[]>([]);
  const [roleRows, setRoleRows] = useState<RoleAuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    setError(null);
    if (tab === 'admin') {
      const result = await listAdminAuditLogs(page, search || undefined);
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setAdminRows(result.data.rows); setTotal(result.data.total);
    } else if (tab === 'rental') {
      const result = await listRentalAuditLogs(page);
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setRentalRows(result.data.rows); setTotal(result.data.total);
    } else {
      const result = await listRoleAuditLog(page);
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setRoleRows(result.data.rows); setTotal(result.data.total);
    }
    setPhase('ready');
  }, [auth.mode, tab, page, search]);

  useEffect(() => { void load(); }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><Icon name="science" /><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / SHARED & ADVANCED / <b>AUDIT CENTER</b></div>
    <header className="directory-hero"><div><small>OPERATIONAL AUDIT</small><h1>Audit Center</h1><p>Three genuinely separate operational audit tables (admin, rentals, role changes) in one place. Evidence-grade security events remain a separate, protected surface at Security &amp; Honeypot — never merged in here.</p></div></header>

    <nav className="listing-tabs" aria-label="Audit source"><div>
      <button className={tab === 'admin' ? 'active' : ''} onClick={() => { setTab('admin'); setPage(1); }}>Admin Actions</button>
      <button className={tab === 'rental' ? 'active' : ''} onClick={() => { setTab('rental'); setPage(1); }}>Rental Actions</button>
      <button className={tab === 'role' ? 'active' : ''} onClick={() => { setTab('role'); setPage(1); }}>Role Changes</button>
    </div></nav>

    {tab === 'admin' && <section className="directory-filters" aria-label="Search"><div>
      <label className="directory-search"><Icon name="search" /><input aria-label="Search audit log" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search action, entity, entity ID" /></label>
      <button onClick={() => { setSearch(''); setPage(1); void load(); }} aria-label="Reset"><Icon name="restart_alt" /></button>
    </div></section>}

    <section className="directory-ledger">
      <header><span aria-live="polite">{phase === 'loading' ? 'Loading…' : `${total.toLocaleString('en-ZW')} record(s)`}</span>
        <div><button disabled={page <= 1 || phase === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount || phase === 'loading'} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
      </header>
      <div className="directory-table-scroll">
        {phase === 'error' && <div className="directory-empty" role="alert">Could not load audit log: {error}</div>}
        {phase !== 'error' && tab === 'admin' && <table aria-label="Admin audit log"><thead><tr><th>Actor</th><th>Action</th><th>Entity</th><th>Reason</th><th>When</th></tr></thead>
          <tbody>{adminRows.map((r) => <tr key={r.id}><td>{r.actor_email ?? r.actor_role ?? '—'}</td><td>{r.action}</td><td>{r.entity}{r.entity_id ? ` · ${r.entity_id.slice(0, 8)}…` : ''}</td><td>{r.reason ?? '—'}</td><td>{fmtDate(r.created_at)}</td></tr>)}</tbody></table>}
        {phase !== 'error' && tab === 'rental' && <table aria-label="Rental audit log"><thead><tr><th>Actor role</th><th>Action</th><th>Target</th><th>When</th></tr></thead>
          <tbody>{rentalRows.map((r) => <tr key={r.id}><td>{r.actor_role ?? '—'}</td><td>{r.action ?? '—'}</td><td>{r.target_table ?? '—'}{r.target_id ? ` · ${r.target_id.slice(0, 8)}…` : ''}</td><td>{fmtDate(r.created_at)}</td></tr>)}</tbody></table>}
        {phase !== 'error' && tab === 'role' && <table aria-label="Role audit log"><thead><tr><th>Target</th><th>Old role</th><th>New role</th><th>When</th></tr></thead>
          <tbody>{roleRows.map((r) => <tr key={r.id}><td><code>{r.target_id?.slice(0, 8) ?? '—'}…</code></td><td>{r.old_role ?? '—'}</td><td>{r.new_role ?? '—'}</td><td>{fmtDate(r.changed_at)}</td></tr>)}</tbody></table>}
        {phase === 'ready' && total === 0 && <div className="directory-empty" role="status">No records in this log.</div>}
      </div>
    </section>
    <p><small>These logs are operational, not evidence-grade, and cannot be edited or deleted from this screen — no such capability exists in the backend.</small></p>
  </div>;
}
