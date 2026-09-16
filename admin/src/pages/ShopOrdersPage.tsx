import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import {
  listShopOrders, getShopOrder, getShopOrderItems, getShopOrderHistory, updateShopOrderStatus,
  COMMERCE_PAGE_SIZE, SHOP_ORDER_STATUSES,
  type ShopOrderRow, type ShopOrderDetail, type ShopOrderItemRow, type ShopOrderHistoryRow,
} from '../services/commerce/query';

function fmtDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-ZW', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(new Date(value)) : '—'; }
function fmtMoney(value: number | null, currency: string | null) { return value === null ? '—' : `${currency ?? 'USD'} ${value.toLocaleString('en-ZW')}`; }

export function ShopOrdersPage() {
  const auth = useAuth();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ShopOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ShopOrderDetail | null>(null);
  const [items, setItems] = useState<ShopOrderItemRow[]>([]);
  const [history, setHistory] = useState<ShopOrderHistoryRow[]>([]);
  const [detailPhase, setDetailPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    setError(null);
    const result = await listShopOrders(status || undefined, page);
    if (result.error) { setError(result.error.message); setPhase('error'); return; }
    setRows(result.data.rows);
    setTotal(result.data.total);
    setPhase('ready');
  }, [auth.mode, status, page]);

  useEffect(() => { void load(); }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailPhase('loading');
    setActionMessage(null);
    const orderResult = await getShopOrder(id);
    if (orderResult.error) { setDetailPhase('error'); return; }
    const itemsResult = await getShopOrderItems(id);
    const historyResult = await getShopOrderHistory(id);
    setDetail(orderResult.data);
    setItems(itemsResult.data ?? []);
    setHistory(historyResult.data ?? []);
    setDetailPhase('ready');
  }, []);

  async function applyStatus(newStatus: string) {
    if (!selectedId) return;
    setActionMessage(null);
    const result = await updateShopOrderStatus(selectedId, newStatus);
    if (result.error) { setActionMessage(`Failed: ${result.error.message}`); return; }
    setActionMessage(`Status updated to "${newStatus}".`);
    void loadDetail(selectedId);
    void load();
  }

  const pageCount = Math.max(1, Math.ceil(total / COMMERCE_PAGE_SIZE));

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><span className="material-symbols-outlined">science</span><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / COMMERCE / <b>SHOP ORDERS</b></div>
    <header className="directory-hero"><div><small>PRODUCTION SHOP ORDERS</small><h1>Shop Orders</h1><p>Real order status, buyer/seller context, and history. Status changes use the existing production RPC.</p></div></header>

    <section className="directory-filters" aria-label="Order filters"><div>
      <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">STATUS: ALL</option>{SHOP_ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}</select>
      <button onClick={() => { setStatus(''); setPage(1); void load(); }} aria-label="Reset filters"><span className="material-symbols-outlined">restart_alt</span></button>
    </div></section>

    <div className="directory-workspace">
      <section className="directory-ledger">
        <header><span aria-live="polite">{phase === 'loading' ? 'Loading…' : `${total.toLocaleString('en-ZW')} order(s)`}</span>
          <div><button disabled={page <= 1 || phase === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount || phase === 'loading'} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
        </header>
        <div className="directory-table-scroll">
          {phase === 'error' && <div className="directory-empty" role="alert">Could not load orders: {error}</div>}
          {phase !== 'error' && <table aria-label="Shop orders"><thead><tr><th>Order</th><th>Fulfillment</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} className={selectedId === row.id ? 'selected' : ''} onClick={() => void loadDetail(row.id)} style={{ cursor: 'pointer' }}>
              <td><code>{row.id.slice(0, 8)}…</code></td><td>{row.fulfillment_method ?? '—'}</td><td>{row.customer_name ?? '—'}</td><td>{row.item_count ?? 0}</td><td>{fmtMoney(row.total, row.currency)}</td><td>{row.status ?? '—'}</td><td>{fmtDate(row.created_at)}</td>
            </tr>)}</tbody></table>}
          {phase === 'ready' && rows.length === 0 && <div className="directory-empty" role="status">No orders match these filters.</div>}
        </div>
      </section>

      <aside className="directory-inspector" aria-label="Order detail">
        {!selectedId && <p>Select an order to view real production detail.</p>}
        {selectedId && detailPhase === 'loading' && <p>Loading…</p>}
        {selectedId && detailPhase === 'error' && <p role="alert">Could not load order detail.</p>}
        {selectedId && detailPhase === 'ready' && detail && <>
          <header><span className="material-symbols-outlined">receipt_long</span><div><small>ORDER</small><strong>{detail.id.slice(0, 8)}…</strong></div><b>{detail.status?.toUpperCase() ?? '—'}</b></header>
          <section><h3>Order</h3><dl>
            <div><dt>Fulfillment</dt><dd>{detail.fulfillment_method ?? '—'}</dd></div>
            <div><dt>Delivery address</dt><dd>{detail.delivery_address ?? '—'}</dd></div>
            <div><dt>Total</dt><dd>{fmtMoney(detail.total, detail.currency)}</dd></div>
            <div><dt>Created</dt><dd>{fmtDate(detail.created_at)}</dd></div>
            <div><dt>Updated</dt><dd>{fmtDate(detail.updated_at)}</dd></div>
          </dl></section>
          <section><h3>Customer</h3><dl>
            <div><dt>Name</dt><dd>{detail.customer_name ?? '—'}</dd></div>
            <div><dt>Phone</dt><dd>{detail.customer_phone ?? '—'}</dd></div>
            {detail.customer_note && <div><dt>Note</dt><dd>{detail.customer_note}</dd></div>}
          </dl></section>
          <section><h3>Items ({items.length})</h3>
            {items.length === 0 ? <p>None</p> : <ul>{items.map((it) => <li key={it.id}>{it.title_snapshot ?? 'Item'} × {it.quantity ?? 1} — {fmtMoney(it.subtotal_snapshot, it.currency_snapshot)}</li>)}</ul>}
          </section>
          <section><h3>Status history</h3>
            {history.length === 0 ? <p>None</p> : <ul>{history.map((h) => <li key={h.id}>{h.status} · {fmtDate(h.created_at)}{h.note ? ` · ${h.note}` : ''}</li>)}</ul>}
          </section>
          <section><h3>Admin actions</h3>
            <div className="jobs-actions">
              <button onClick={() => void applyStatus('confirmed')}>Confirm</button>
              <button onClick={() => void applyStatus('preparing')}>Preparing</button>
              <button onClick={() => void applyStatus('ready')}>Ready</button>
              <button onClick={() => void applyStatus('completed')}>Complete</button>
              <button onClick={() => void applyStatus('cancelled')}>Cancel</button>
            </div>
            {actionMessage && <p role="status">{actionMessage}</p>}
            <p><small>Uses the existing update_shop_order_status RPC. AAL2 is required for this admin-override path.</small></p>
          </section>
        </>}
      </aside>
    </div>
  </div>;
}
