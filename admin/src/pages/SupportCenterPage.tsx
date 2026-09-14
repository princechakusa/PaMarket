import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import {
  listTickets, getTicket, listTicketMessages, sendTicketMessage, updateTicketStatus,
  listContactRequests, decideContactRequest, SUPPORT_PAGE_SIZE,
  type TicketRow, type TicketDetail, type TicketMessageRow, type ContactRequestRow,
} from '../services/support/query';

function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }

type Tab = 'tickets' | 'contacts';

export function SupportCenterPage() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('tickets');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [contacts, setContacts] = useState<ContactRequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<TicketMessageRow[]>([]);
  const [reply, setReply] = useState('');
  const [detailPhase, setDetailPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    setError(null);
    if (tab === 'tickets') {
      const result = await listTickets(status || undefined, page);
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setTickets(result.data.rows);
      setTotal(result.data.total);
    } else {
      const result = await listContactRequests(status || undefined, page);
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setContacts(result.data.rows);
      setTotal(result.data.total);
    }
    setPhase('ready');
  }, [auth.mode, tab, status, page]);

  useEffect(() => { void load(); }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailPhase('loading');
    setMessage(null);
    const ticketResult = await getTicket(id);
    if (ticketResult.error) { setDetailPhase('error'); return; }
    const messagesResult = await listTicketMessages(id);
    setDetail(ticketResult.data);
    setMessages(messagesResult.data ?? []);
    setDetailPhase('ready');
  }, []);

  async function reply_() {
    if (!selectedId || !reply.trim() || !auth.identity) return;
    const result = await sendTicketMessage(selectedId, auth.identity.id, reply, false);
    if (result.error) { setMessage(`Failed: ${result.error.message}`); return; }
    setReply('');
    void loadDetail(selectedId);
  }
  async function setTicketStatus(next: string) {
    if (!selectedId) return;
    const result = await updateTicketStatus(selectedId, next);
    setMessage(result.error ? `Failed: ${result.error.message}` : `Ticket ${next}.`);
    void loadDetail(selectedId);
    void load();
  }
  async function decideContact(id: string, status_: string) {
    if (!auth.identity) return;
    const result = await decideContactRequest(id, status_, auth.identity.id);
    setMessage(result.error ? `Failed: ${result.error.message}` : `Request ${status_}.`);
    void load();
  }

  const pageCount = Math.max(1, Math.ceil(total / SUPPORT_PAGE_SIZE));

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><span className="material-symbols-outlined">science</span><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / ENTERPRISE / <b>SUPPORT CENTER</b></div>
    <header className="directory-hero"><div><small>PRODUCTION SUPPORT</small><h1>Support Center</h1><p>Real support tickets and recruiter contact requests. Contact Requests are recruiter-candidate approvals (a distinct workflow), not general tickets.</p></div></header>

    <nav className="listing-tabs" aria-label="Support section"><div>
      <button className={tab === 'tickets' ? 'active' : ''} onClick={() => { setTab('tickets'); setPage(1); setSelectedId(null); setMessage(null); }}>Tickets</button>
      <button className={tab === 'contacts' ? 'active' : ''} onClick={() => { setTab('contacts'); setPage(1); setSelectedId(null); setMessage(null); }}>Contact Requests</button>
    </div></nav>
    {tab === 'contacts' && <p><small>Contact Requests require admin/super_admin server-side, regardless of the support.manage permission shown in navigation — a pre-existing mismatch, not fixed in this batch.</small></p>}

    <section className="directory-filters" aria-label="Filters"><div>
      <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">STATUS: ALL</option>
        {tab === 'tickets' ? <><option value="open">OPEN</option><option value="pending">PENDING</option><option value="resolved">RESOLVED</option><option value="closed">CLOSED</option></> : <><option value="pending">PENDING</option><option value="approved">APPROVED</option><option value="declined">DECLINED</option></>}
      </select>
      <button onClick={() => { setStatus(''); setPage(1); }} aria-label="Reset filters"><span className="material-symbols-outlined">restart_alt</span></button>
    </div></section>

    <div className="directory-workspace">
      <section className="directory-ledger">
        <header><span aria-live="polite">{phase === 'loading' ? 'Loading…' : `${total.toLocaleString('en-ZW')} record(s)`}</span>
          <div><button disabled={page <= 1 || phase === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount || phase === 'loading'} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
        </header>
        <div className="directory-table-scroll">
          {phase === 'error' && <div className="directory-empty" role="alert">Could not load: {error}</div>}
          {phase !== 'error' && tab === 'tickets' && <table aria-label="Support tickets"><thead><tr><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>{tickets.map((t) => <tr key={t.id} className={selectedId === t.id ? 'selected' : ''} onClick={() => void loadDetail(t.id)} style={{ cursor: 'pointer' }}>
              <td>{t.subject ?? '—'}</td><td>{t.category ?? '—'}</td><td>{t.priority ?? '—'}</td><td>{t.status ?? '—'}</td><td>{fmtDate(t.created_at)}</td>
            </tr>)}</tbody></table>}
          {phase !== 'error' && tab === 'contacts' && <table aria-label="Contact requests"><thead><tr><th>Requester</th><th>Candidate</th><th>Company</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>{contacts.map((c) => <tr key={c.id}><td>{c.requester_name ?? '—'}</td><td>{c.candidate_name ?? '—'}</td><td>{c.company ?? '—'}</td><td>{c.status ?? '—'}</td><td>{fmtDate(c.created_at)}</td>
              <td><div className="jobs-actions"><button onClick={() => void decideContact(c.id, 'approved')}>Approve</button><button onClick={() => void decideContact(c.id, 'declined')}>Decline</button></div></td>
            </tr>)}</tbody></table>}
          {phase === 'ready' && ((tab === 'tickets' && tickets.length === 0) || (tab === 'contacts' && contacts.length === 0)) && <div className="directory-empty" role="status">No records match these filters.</div>}
        </div>
      </section>

      {tab === 'tickets' && <aside className="directory-inspector" aria-label="Ticket detail">
        {!selectedId && <p>Select a ticket to view real production detail.</p>}
        {selectedId && detailPhase === 'loading' && <p>Loading…</p>}
        {selectedId && detailPhase === 'error' && <p role="alert">Could not load ticket detail.</p>}
        {selectedId && detailPhase === 'ready' && detail && <>
          <header><span className="material-symbols-outlined">support_agent</span><div><small>TICKET</small><strong>{detail.subject ?? '—'}</strong></div><b>{detail.status?.toUpperCase() ?? '—'}</b></header>
          <section><h3>Details</h3><dl>
            <div><dt>Category</dt><dd>{detail.category ?? '—'}</dd></div>
            <div><dt>Priority</dt><dd>{detail.priority ?? '—'}</dd></div>
            <div><dt>Source</dt><dd>{detail.source ?? '—'}</dd></div>
            <div><dt>Created</dt><dd>{fmtDate(detail.created_at)}</dd></div>
            <div><dt>First response</dt><dd>{fmtDate(detail.first_response_at)}</dd></div>
            <div><dt>Resolved</dt><dd>{fmtDate(detail.resolved_at)}</dd></div>
          </dl></section>
          <section><h3>Conversation ({messages.length})</h3>
            {messages.length === 0 ? <p>None</p> : <ul>{messages.map((m) => <li key={m.id}>{m.author_kind}{m.internal ? ' (internal)' : ''}: {m.body} · {fmtDate(m.created_at)}</li>)}</ul>}
            <textarea placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} style={{ width: '100%', minHeight: 60 }} />
            <button onClick={() => void reply_()}>Send reply</button>
          </section>
          <section><h3>Status</h3>
            <div className="jobs-actions"><button onClick={() => void setTicketStatus('pending')}>Pending</button><button onClick={() => void setTicketStatus('resolved')}>Resolve</button><button onClick={() => void setTicketStatus('closed')}>Close</button></div>
            {message && <p role="status">{message}</p>}
          </section>
        </>}
      </aside>}
    </div>
  </div>;
}
