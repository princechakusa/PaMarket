import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import { listRecentNotifications, sendNotification, PLATFORM_PAGE_SIZE, type NotificationRow } from '../services/platform/query';

function fmtDate(value: number | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }
function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }

export function NotificationsPage() {
  const auth = useAuth();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    const result = await listRecentNotifications(page);
    if (result.error) { setError(result.error.message); setPhase('error'); return; }
    setRows(result.data.rows);
    setTotal(result.data.total);
    setPhase('ready');
  }, [auth.mode, page]);

  useEffect(() => { void load(); }, [load]);

  async function send() {
    if (!userId.trim() || !title.trim() || !body.trim()) { setMessage('User ID, title and body are required.'); return; }
    setSending(true);
    const result = await sendNotification(userId.trim(), title.trim(), body.trim());
    setSending(false);
    if (result.error) { setMessage(`Failed: ${result.error.message}`); return; }
    setMessage('Notification sent.');
    setTitle(''); setBody('');
    void load();
  }

  const pageCount = Math.max(1, Math.ceil(total / PLATFORM_PAGE_SIZE));

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><Icon name="science" /><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / SECURITY & PLATFORM / <b>NOTIFICATIONS</b></div>
    <header className="directory-hero"><div><small>PRODUCTION NOTIFICATIONS</small><h1>Notifications</h1><p>Compose real per-user notifications (notifications table) and review recent activity. This is not User Chats — private messages are never shown here.</p></div></header>

    <section className="directory-filters" aria-label="Compose"><div style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <input aria-label="User ID" placeholder="Recipient user ID (UUID)" value={userId} onChange={(e) => setUserId(e.target.value)} />
      <input aria-label="Title" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea aria-label="Body" placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 60 }} />
      <button onClick={() => void send()} disabled={sending || auth.mode !== 'live'}>{sending ? 'Sending…' : 'Send notification'}</button>
      {message && <p role="status">{message}</p>}
    </div></section>

    <section className="directory-ledger" style={{ marginTop: 16 }}>
      <header><span aria-live="polite">{phase === 'loading' ? 'Loading…' : `${total.toLocaleString('en-ZW')} recent notification(s)`}</span>
        <div><button disabled={page <= 1 || phase === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount || phase === 'loading'} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
      </header>
      <div className="directory-table-scroll">
        {phase === 'error' && <div className="directory-empty" role="alert">Could not load notifications: {error}</div>}
        {phase !== 'error' && <table aria-label="Recent notifications"><thead><tr><th>Recipient</th><th>Title</th><th>Type</th><th>Read</th><th>Sent</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td><code>{row.user_id?.slice(0, 8) ?? '—'}…</code></td><td>{row.title ?? '—'}</td><td>{row.type ?? '—'}</td><td>{row.read ? 'Yes' : 'No'}</td><td>{fmtDate(row.created_at)}</td></tr>)}</tbody></table>}
        {phase === 'ready' && rows.length === 0 && <div className="directory-empty" role="status">No notifications yet.</div>}
      </div>
    </section>
  </div>;
}
