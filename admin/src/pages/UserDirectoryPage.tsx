import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../security/auth-context';
import { listSecurityEvents, type SecurityEventRow } from '../services/security-events/query';
import {
  listUsers, getUser, getUserVerification, getUserBusinesses, getBusinessVerifications,
  getUserCommercialCounts, getUserReports, getUserAppeals, getUserAuditActions,
  USER_PAGE_SIZE, type UserRow, type VerificationRow, type BusinessRow, type BusinessVerificationRow,
  type CommercialCounts, type ReportRow, type AppealRow, type AuditActionRow,
} from '../services/users/query';

const roles = ['user', 'admin', 'moderator', 'support', 'finance', 'super_admin'];
const statuses = ['active', 'banned', 'suspended'];
const provinces = ['Harare', 'Bulawayo', 'Manicaland', 'Midlands', 'Masvingo', 'Mashonaland East', 'Mashonaland West', 'Mashonaland Central', 'Matabeleland North', 'Matabeleland South'];

function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }
function initials(name: string | null) { return (name ?? '?').trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?'; }
function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }
function fmtReportDate(value: number | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }

type DetailSnapshot = {
  user: UserRow | null;
  verification: VerificationRow | null;
  businesses: BusinessRow[];
  businessVerifications: BusinessVerificationRow[];
  commercial: CommercialCounts | null;
  reports: ReportRow[];
  appeals: AppealRow[];
  auditActions: AuditActionRow[];
};

function toCsv(rows: UserRow[]): string {
  const header = 'id,name,email,phone,role,status,verified,city,province,company,company_verified,created_at,last_app_activity,2fa_enabled';
  const lines = rows.map((u) => [u.id, u.name, u.email, u.phone, u.role, u.status, u.verified, u.city, u.province, u.company, u.company_verified, u.created_at, u.last_active_at ?? u.last_seen, u.mfa_enabled]
    .map((v) => v === null || v === undefined ? '' : `"${String(v).replaceAll('"', '""')}"`).join(','));
  return [header, ...lines].join('\n');
}

export function UserDirectoryPage() {
  const auth = useAuth();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [province, setProvince] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [listPhase, setListPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailSnapshot | null>(null);
  const [detailPhase, setDetailPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [detailError, setDetailError] = useState<string | null>(null);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventRow[]>([]);
  const [securityState, setSecurityState] = useState<'loading' | 'live' | 'unavailable' | 'unchecked'>('unchecked');

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setListPhase('ready'); return; }
    setListPhase('loading');
    setListError(null);
    const result = await listUsers({ search: search || undefined, role: role || undefined, status: status || undefined, province: province || undefined }, page);
    if (result.error) { setListError(result.error.message); setListPhase('error'); return; }
    setRows(result.data.rows);
    setTotal(result.data.total);
    setListPhase('ready');
  }, [auth.mode, search, role, status, province, page]);

  useEffect(() => { void load(); }, [load]);

  const loadDetail = useCallback(async (userId: string) => {
    setSelectedId(userId);
    setDetailPhase('loading');
    setDetailError(null);
    setSecurityEvents([]);
    setSecurityState('unchecked');

    const userResult = await getUser(userId);
    if (userResult.error) { setDetailError(userResult.error.message); setDetailPhase('error'); return; }
    const businessesResult = await getUserBusinesses(userId);
    const businessIds = (businessesResult.data ?? []).map((b) => b.id);

    const [verification, businessVerifications, commercial, reports, appeals, auditActions] = await Promise.all([
      getUserVerification(userId), getBusinessVerifications(businessIds), getUserCommercialCounts(userId, businessIds),
      getUserReports(userId), getUserAppeals(userId), getUserAuditActions(userId),
    ]);
    const firstError = [businessesResult, verification, businessVerifications, commercial, reports, appeals, auditActions].find((r) => r.error)?.error;
    if (firstError) { setDetailError(firstError.message); setDetailPhase('error'); return; }

    setDetail({
      user: userResult.data, businesses: businessesResult.data ?? [], verification: verification.data,
      businessVerifications: businessVerifications.data ?? [], commercial: commercial.data,
      reports: reports.data ?? [], appeals: appeals.data ?? [], auditActions: auditActions.data ?? [],
    });
    setDetailPhase('ready');
  }, []);

  useEffect(() => {
    const admin = auth.identity;
    const canReadAudit = Boolean(admin?.permissions.includes('audit.view'));
    if (!selectedId || auth.mode !== 'live' || auth.assuranceLevel !== 'aal2' || !canReadAudit) return;
    let active = true;
    setSecurityState('loading');
    void listSecurityEvents({ actorUserId: selectedId }, 1).then((result) => {
      if (!active) return;
      if (result.error) setSecurityState('unavailable');
      else { setSecurityEvents(result.data.rows.slice(0, 5)); setSecurityState('live'); }
    });
    return () => { active = false; };
  }, [selectedId, auth.mode, auth.assuranceLevel, auth.identity]);

  const exportCsv = useCallback(() => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pamarket-users-page-${page}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [rows, page]);

  function resetFilters() { setSearch(''); setRole(''); setStatus(''); setProvince(''); setPage(1); }

  const pageCount = Math.max(1, Math.ceil(total / USER_PAGE_SIZE));
  const selectedUser = useMemo(() => rows.find((r) => r.id === selectedId) ?? detail?.user ?? null, [rows, selectedId, detail]);

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><Icon name="science" /><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment; the User Directory cannot load real data here.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / DIRECTORY & COMMERCE / <b>USER DIRECTORY</b></div>
    <header className="directory-hero"><div><small>PRODUCTION USER DIRECTORY</small><h1>User Directory</h1><p>Search and inspect real PaMarket accounts. Figures shown are read directly from production, filtered by your existing Admin authorization.</p></div><nav aria-label="Directory actions"><button onClick={exportCsv} disabled={rows.length === 0}><Icon name="file_download" />Export page (CSV)</button></nav></header>

    <section className="directory-filters" aria-label="User filters"><div>
      <label className="directory-search"><Icon name="person_search" /><input aria-label="Search users" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, email, phone, or user ID" /></label>
      <select aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">ROLE: ALL</option>{roles.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}</select>
      <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">STATUS: ALL</option>{statuses.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}</select>
      <select aria-label="Province" value={province} onChange={(e) => { setProvince(e.target.value); setPage(1); }}><option value="">PROVINCE: ALL</option>{provinces.map((p) => <option key={p} value={p}>{p}</option>)}</select>
      <button onClick={resetFilters} aria-label="Reset filters"><Icon name="restart_alt" /></button>
    </div></section>

    <div className="directory-workspace">
      <section className="directory-ledger">
        <header><span aria-live="polite">{listPhase === 'loading' ? 'Loading…' : `${total.toLocaleString('en-ZW')} account(s) match`}</span>
          <div><button disabled={page <= 1 || listPhase === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount || listPhase === 'loading'} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
        </header>
        <div className="directory-table-scroll">
          {listPhase === 'error' && <div className="directory-empty" role="alert">Could not load users: {listError}</div>}
          {listPhase !== 'error' && <table aria-label="User directory"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Verified</th><th>Location</th><th>Joined</th><th>Last App Activity</th><th>2FA</th></tr></thead>
            <tbody>{rows.map((user) => <tr key={user.id} className={selectedId === user.id ? 'selected' : ''} onClick={() => void loadDetail(user.id)} style={{ cursor: 'pointer' }}>
              <td><div className="directory-person"><span className="directory-avatar">{initials(user.name)}</span><div><strong>{user.name ?? 'Unnamed'}</strong><small>{user.email ?? '—'}</small><code>{user.id.slice(0, 8)}…</code></div></div></td>
              <td>{user.role ?? '—'}</td>
              <td>{user.status ?? '—'}</td>
              <td>{user.verified ? 'Yes' : 'No'}</td>
              <td>{user.city ?? '—'}{user.province ? `, ${user.province}` : ''}</td>
              <td>{fmtDate(user.created_at)}</td>
              <td>{fmtDate(user.last_active_at ?? user.last_seen)}</td>
              <td>{user.mfa_enabled ? 'Yes' : 'No'}</td>
            </tr>)}</tbody></table>}
          {listPhase === 'ready' && rows.length === 0 && <div className="directory-empty" role="status">No accounts match these filters — or your role does not currently have staff-read access to the profile directory (see Roles &amp; Permissions). <button onClick={resetFilters}>Clear filters</button></div>}
        </div>
      </section>

      <aside className="directory-inspector" aria-label="User detail">
        {!selectedId && <p>Select a user to view real production detail.</p>}
        {selectedId && detailPhase === 'loading' && <p>Loading…</p>}
        {selectedId && detailPhase === 'error' && <p role="alert">Could not load user detail: {detailError}</p>}
        {selectedId && detailPhase === 'ready' && detail && selectedUser && <>
          <header><Icon name="contact_emergency" /><div><small>USER DETAIL</small><strong>{selectedUser.name ?? 'Unnamed'}</strong></div><b>{selectedUser.status?.toUpperCase() ?? '—'}</b></header>

          <section className="directory-identity"><h3>Identity</h3><dl>
            <div><dt>Email</dt><dd>{selectedUser.email ?? '—'}</dd></div>
            <div><dt>Phone</dt><dd>{selectedUser.phone ?? '—'}</dd></div>
            <div><dt>Role</dt><dd>{selectedUser.role ?? '—'}</dd></div>
            <div><dt>Verified</dt><dd>{selectedUser.verified ? 'Yes' : 'No'}</dd></div>
            <div><dt>City / Province</dt><dd>{selectedUser.city ?? '—'}{selectedUser.province ? `, ${selectedUser.province}` : ''}</dd></div>
            <div><dt>Joined</dt><dd>{fmtDate(selectedUser.created_at)}</dd></div>
            <div><dt>Last App Activity</dt><dd>{fmtDate(selectedUser.last_active_at ?? selectedUser.last_seen)}</dd></div>
            <div><dt>2FA Enabled</dt><dd>{selectedUser.mfa_enabled ? 'Yes' : 'No'}</dd></div>
            <div><dt>Company</dt><dd>{selectedUser.company ?? '—'}{selectedUser.company_verified ? ' (verified)' : ''}</dd></div>
          </dl></section>

          <section><h3>Marketplace Activity</h3>{detail.commercial ? <dl>
            <div><dt>Listings</dt><dd>{detail.commercial.listings}</dd></div>
            <div><dt>Job applications</dt><dd>{detail.commercial.applications}</dd></div>
            <div><dt>Businesses owned</dt><dd>{detail.businesses.length}</dd></div>
            <div><dt>Active subscriptions</dt><dd>{detail.commercial.activeSubscriptions}</dd></div>
            <div><dt>Rental listings</dt><dd>{detail.commercial.rentalListings}</dd></div>
          </dl> : <p>No commercial activity data.</p>}</section>

          <section><h3>Individual Verification (KYC)</h3>{detail.verification ? <dl>
            <div><dt>Status</dt><dd>{detail.verification.status ?? '—'}</dd></div>
            <div><dt>Submitted</dt><dd>{fmtDate(detail.verification.submitted_at)}</dd></div>
            <div><dt>Reviewed</dt><dd>{fmtDate(detail.verification.reviewed_at)}</dd></div>
            {detail.verification.admin_note && <div><dt>Reviewer note</dt><dd>{detail.verification.admin_note}</dd></div>}
          </dl> : <p>No verification submitted.</p>}</section>

          {detail.businesses.length > 0 && <section><h3>Business Ownership</h3>{detail.businesses.map((b) => {
            const verification = detail.businessVerifications.find((v) => v.business_id === b.id);
            return <article key={b.id} className="directory-session"><Icon name="storefront" /><div><strong>{b.name ?? b.id}</strong><small>{b.status ?? '—'} · {b.province ?? '—'}</small>
              {verification && <p>Business verification: {verification.status} · submitted {fmtDate(verification.submitted_at)}</p>}
            </div></article>;
          })}</section>}

          <section><h3>Trust &amp; Safety</h3>
            <p><strong>Reports (as target):</strong> {detail.reports.length === 0 ? 'None' : null}</p>
            {detail.reports.length > 0 && <ul>{detail.reports.map((r) => <li key={r.id}>{r.status} · {r.reason ?? 'No reason given'} · {fmtReportDate(r.created_at)}</li>)}</ul>}
            <p><strong>Moderation appeals:</strong> {detail.appeals.length === 0 ? 'None' : null}</p>
            {detail.appeals.length > 0 && <ul>{detail.appeals.map((a) => <li key={a.id}>{a.status} · {a.entity ?? '—'} · {fmtDate(a.created_at)}</li>)}</ul>}
            <p><strong>Admin actions on this account:</strong> {detail.auditActions.length === 0 ? 'None recorded' : null}</p>
            {detail.auditActions.length > 0 && <ul>{detail.auditActions.map((a) => <li key={a.id}>{a.action} · {a.actor_role ?? '—'} · {fmtDate(a.created_at)}</li>)}</ul>}
            <p><strong>Security events:</strong> {securityState === 'live' ? (securityEvents.length === 0 ? 'None' : null) : securityState === 'loading' ? 'Loading…' : securityState === 'unavailable' ? 'Unavailable' : 'Requires audit.view + AAL2'}</p>
            {securityState === 'live' && securityEvents.length > 0 && <ul>{securityEvents.map((e) => <li key={e.id}>{e.action} · {e.outcome} · {fmtDate(e.occurred_at)}</li>)}</ul>}
          </section>
        </>}
      </aside>
    </div>
  </div>;
}
