import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../security/auth-context';
import { listSecurityEvents, type SecurityEvent } from '../services/security-events/query';
import { ZimbabweActivityMap } from '../components/ZimbabweActivityMap';

const metrics = [
  ['Total Users', '148,290', '+12.4% MoM', 'groups'], ['Listings', '42,810', '+8.2% 4 cities', 'sell'],
  ['In Moderation', '384', '-14% queue burn', 'fact_check'], ['Verified Biz', '1,420', '+24 this week', 'verified'],
  ['Pending Verify', '28', '8 past SLA', 'pending_actions'], ['Shop Requests', '892', '+18.7% today', 'receipt_long'],
  ['Open Reports', '67', '19 high risk', 'report'], ['Platform Health', '99.98%', 'All core online', 'vital_signs'],
] as const;

const queues = [
  ['directions_car', 'Vehicle Listings Approval', 'HIGH · CID CHECKS', '15 mins', '42 WAITING', '1h 14m (Toyota GD6)', '/marketplace/listings'],
  ['verified_user', 'ZIMRA Business Tax Certs', 'MERCHANT VERIF', '24 hours', '28 WAITING', '26h 02m (Borrowdale Hardware)', '/marketplace/verifications'],
  ['agriculture', 'High-Value Farm Tractors', 'DEED & SERIALS', '45 mins', '11 WAITING', '38m (John Deere 5075E)', '/marketplace/listings'],
  ['report', 'Reported Counterfeit Electronics', 'FRAUD DISPUTE', '30 mins', '19 WAITING', '54m (iPhone 15 Pro Clone)', '/trust/reports'],
] as const;

function formatEvent(event: SecurityEvent) {
  const time = new Intl.DateTimeFormat('en-ZW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Africa/Harare' }).format(new Date(event.occurred_at));
  return { time, actor: event.actor_role?.replace('_', ' ').toUpperCase() ?? 'SYSTEM', action: event.action.replaceAll('_', ' ').toUpperCase(), detail: `${event.event_type.replaceAll('_', ' ')} · ${event.source}`, result: `${event.assurance_level.toUpperCase()} ${event.outcome.toUpperCase()}`, tone: ['blocked', 'failure', 'suspicious'].includes(event.outcome) ? 'danger' : 'success' };
}

export function OpsDashboardPage() {
  const auth = useAuth();
  const admin = auth.identity;
  const canReadAudit = Boolean(admin?.permissions.includes('audit.view'));
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [auditState, setAuditState] = useState<'fixture' | 'loading' | 'live' | 'unavailable'>('fixture');

  useEffect(() => {
    if (auth.mode !== 'live' || auth.assuranceLevel !== 'aal2' || !canReadAudit) return;
    let active = true;
    setAuditState('loading');
    void listSecurityEvents({}, 1).then((result) => {
      if (!active) return;
      if (result.error) setAuditState('unavailable');
      else { setEvents(result.data.rows.slice(0, 4)); setAuditState('live'); }
    });
    return () => { active = false; };
  }, [auth.mode, auth.assuranceLevel, canReadAudit]);

  if (!admin) return null;
  const today = new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Harare' }).format(new Date());
  const fixtureAudit = [
    { time: '14:48:12', actor: 'RUDO CHIWARA', action: 'APPROVED SHOP', detail: 'Borrowdale Gadgets & Spares · verification review completed.', result: 'AAL2 PASS', tone: 'success' },
    { time: '14:41:05', actor: 'FARAI NCUBE', action: 'SUSPENDED LISTING', detail: 'Vehicle listing held after duplicate chassis signal.', result: 'CID ALERT', tone: 'danger' },
    { time: '14:32:49', actor: 'TINASHE MOYO', action: 'RELEASED ESCROW', detail: 'Consignment receipt evidence reviewed.', result: 'SUPER ADMIN', tone: 'success' },
    { time: '14:19:10', actor: 'SIPHO KHUMALO', action: 'RESET 2FA RECOVERY', detail: 'Manual identity recovery review completed.', result: 'MANUAL KYC', tone: 'neutral' },
  ];
  const auditRows = events.length ? events.map(formatEvent) : fixtureAudit;

  return <div className="ops-dashboard">
    {auth.mode === 'mock' && <div className="preview-notice" role="note"><span className="material-symbols-outlined">science</span><strong>REFERENCE DATA MODE</strong><span>Operational figures and named cases are static UI fixtures. Authentication and permission behavior remain connected to the admin shell.</span></div>}
    <section className="command-bar"><div><span className="command-label">CONTEXT:</span><span className="context-chip"><span className="material-symbols-outlined">calendar_today</span>Today ({today})</span><span className="context-chip muted"><span className="material-symbols-outlined">compare_arrows</span>Comparison: Previous 7 Days</span><span className="edge-chip"><i />EDGE: HRE-SOUTH-NODE-1</span></div><div><button disabled><span className="material-symbols-outlined">download</span>Export KPI (CSV/PDF)</button><button disabled className="primary"><span className="material-symbols-outlined">refresh</span>Emergency Queue Refresh</button></div></section>

    <section className="alert-grid" aria-label="Tactical alerts">
      <article className="alert-card danger"><div><span className="alert-icon material-symbols-outlined">no_crash</span><div><header><strong>CID INTERPOL HOOK</strong><b>14 HITS</b></header><p>14 listings flagged for stolen vehicle VIN match via the review feed. Immediate operator review required.</p></div></div><footer><span>Harare CBD & Southerton</span><Link to="/marketplace/listings">Review Queue</Link></footer></article>
      <article className="alert-card warning"><div><span className="alert-icon material-symbols-outlined">hourglass_top</span><div><header><strong>SLA BREACH ALERT</strong><b>&gt;24H PENDING</b></header><p>8 merchant applications pending business validation beyond the configured review threshold.</p></div></div><footer><span>Tier-1 Retail Applicants</span><Link to="/marketplace/verifications">Expedite (8)</Link></footer></article>
      <article className="alert-card success"><div><span className="alert-icon material-symbols-outlined">shield_person</span><div><header><strong>HONEYPOT MONITOR</strong><b>{auditState === 'live' ? 'LIVE FEED' : 'CONNECTED'}</b></header><p>Server-owned authentication and honeypot evidence is available through the protected security-event review path.</p></div></div><footer><span>RLS + AAL2 boundary</span><Link to="/security/events">Inspect Events</Link></footer></article>
    </section>

    <section className="kpi-grid" aria-label="Core telemetry">{metrics.map(([label, value, change, icon], index) => <article key={label}><header><span>{label}</span><span className="material-symbols-outlined">{icon}</span></header><strong className={index === 2 || index === 4 || index === 6 ? 'attention' : ''}>{value}</strong><small>{change}</small></article>)}</section>

    <section className="analytics-grid">
      <article className="ops-panel influx"><header className="panel-title"><div><span className="material-symbols-outlined">query_stats</span><h2>Listing Influx by Category</h2></div><span>7-DAY WINDOW · STATIC REFERENCE</span></header><div className="chart"><div className="grid-lines" /><svg viewBox="0 0 800 150" preserveAspectRatio="none" aria-label="Reference listing influx chart"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#68dba9" stopOpacity=".34"/><stop offset="1" stopColor="#68dba9" stopOpacity="0"/></linearGradient></defs><path d="M0 128 L75 118 L150 124 L225 82 L300 96 L375 58 L450 72 L525 30 L600 52 L675 18 L750 36 L800 16 L800 150 L0 150Z" fill="url(#area)"/><polyline points="0,128 75,118 150,124 225,82 300,96 375,58 450,72 525,30 600,52 675,18 750,36 800,16" fill="none" stroke="#68dba9" strokeWidth="3"/></svg></div><div className="category-bars">{[['Cars & Bakkies',82,'42%'],['Property & Stands',64,'28%'],['Electronics & Smartphones',51,'17%'],['Farming & Agri Yields',38,'8%'],['Services & Logistics',25,'5%']].map(([label,width,value]) => <div key={label as string}><span>{label}</span><i><b style={{width: `${width}%`}} /></i><strong>{value}</strong></div>)}</div></article>
      <article className="ops-panel geo"><header className="panel-title"><div><span className="material-symbols-outlined">public</span><h2>Provincial Activity Grid</h2></div><span>REAL ZIMBABWE MAP</span></header><ZimbabweActivityMap /></article>
    </section>

    <section className="ops-panel queue-panel"><header className="queue-head"><div><span className="material-symbols-outlined">checklist_rtl</span><h2>Operational Queue Matrix</h2><nav aria-label="Queue filters"><button className="active" disabled>All Queues (4)</button><button disabled>Moderation</button><button disabled>Businesses</button><button disabled>Disputes</button></nav></div><span><i className="warning-dot"/> AUTO-ALLOCATION ACTIVE</span></header><div className="table-scroll"><table className="ops-table"><thead><tr><th>Queue Name</th><th>Priority & Category</th><th>Target SLA</th><th>Pending Count</th><th>Oldest Item Waiting</th><th>Action</th></tr></thead><tbody>{queues.map(([icon,name,category,sla,count,oldest,path], index) => <tr key={name}><td><span className="material-symbols-outlined">{icon}</span><strong>{name}</strong></td><td><b className={index === 3 ? 'danger-text' : 'category'}>{category}</b></td><td>{sla}</td><td><b className={index < 2 || index === 3 ? 'count attention' : 'count'}>{count}</b></td><td className={index === 0 || index === 1 || index === 3 ? 'danger-text' : ''}>{oldest}</td><td><Link to={path}>Launch Triage</Link></td></tr>)}</tbody></table></div><footer><span>SHOWING 4 OF 18 TOTAL SECURITY OPS QUEUES</span><Link to="/trust/moderation">View All Queues →</Link></footer></section>

    <section className="bottom-grid"><article className="ops-panel audit-panel"><header className="panel-title"><div><span className="material-symbols-outlined">history</span><h2>Recent Administrator Audit Timeline</h2></div><span className={auditState === 'unavailable' ? 'danger-text' : 'live-label'}><i />{auditState === 'live' ? 'LIVE REPLICATION LOG' : auditState === 'loading' ? 'CONNECTING' : auditState === 'unavailable' ? 'FEED UNAVAILABLE' : 'REFERENCE EVENTS'}</span></header><div className="audit-list">{auditRows.map((row, index) => <div className="audit-row" key={`${row.time}-${index}`}><time>{row.time}</time><span className={`audit-icon material-symbols-outlined ${row.tone}`}>{row.tone === 'danger' ? 'block' : row.tone === 'success' ? 'check' : 'vpn_key'}</span><div><header><strong>{row.actor}</strong><b>{row.action}</b></header><p>{row.detail}</p></div><span className={row.tone === 'danger' ? 'danger-text' : ''}>{row.result}</span></div>)}</div><footer><span>{events.length ? 'SERVER-RECORDED SECURITY EVENTS · CAT' : 'STATIC REFERENCE EVENTS · CAT'}</span><Link to="/security/events">Open protected audit log</Link></footer></article>
      <article className="ops-panel forensic"><header className="panel-title"><div><span className="material-symbols-outlined">policy</span><h2>Target Forensic Snapshot</h2></div><b>INSPECTION ACTIVE</b></header><div className="forensic-image"><span className="material-symbols-outlined">storefront</span><small>GPS: -17.7548° S, 31.0822° E</small><b>REFERENCE DOSSIER</b></div><dl><div><dt>TARGET ENTITY</dt><dd>Borrowdale Gadgets Ltd</dd></div><div><dt>NATIONAL ID / REG</dt><dd>63-1994820-T-42</dd></div><div><dt>KYC ASSURANCE LEVEL</dt><dd>TIER 3 (REFERENCE)</dd></div><div><dt>DISPUTE PROBABILITY</dt><dd>0.4% (REFERENCE)</dd></div></dl><footer><button disabled>Inspect Docs</button><button disabled className="primary">Approve Badge</button></footer></article>
    </section>
  </div>;
}
