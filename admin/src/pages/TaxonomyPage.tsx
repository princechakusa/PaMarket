import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import { listCategories, getCategoryListingCount, updateCategory, setCategoryActive, type CategoryRow } from '../services/taxonomy/query';

function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }

export function TaxonomyPage() {
  const auth = useAuth();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const [listingCount, setListingCount] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    const result = await listCategories();
    if (result.error) { setError(result.error.message); setPhase('error'); return; }
    setRows(result.data);
    setPhase('ready');
  }, [auth.mode]);

  useEffect(() => { void load(); }, [load]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  async function select(row: CategoryRow) {
    setSelectedId(row.id); setName(row.name ?? ''); setDescription(row.description ?? ''); setMessage(null);
    setListingCount(null);
    const result = await getCategoryListingCount(row);
    setListingCount(result.data ?? 0);
  }

  async function save() {
    if (!selected || !auth.identity) return;
    const result = await updateCategory(selected.id, { name, description }, auth.identity.id);
    setMessage(result.error ? `Failed: ${result.error.message}` : 'Saved.');
    void load();
  }

  async function toggleActive() {
    if (!selected || !auth.identity) return;
    if (selected.is_active && (listingCount ?? 0) > 0 && !confirm(`${listingCount} listing(s) currently use this category. Deactivate anyway? Existing listings keep their category; only new listings will no longer be able to pick it.`)) return;
    const result = await setCategoryActive(selected.id, !selected.is_active, auth.identity.id);
    setMessage(result.error ? `Failed: ${result.error.message}` : `Category ${selected.is_active ? 'deactivated' : 'activated'}.`);
    void load();
  }

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><Icon name="science" /><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / SHARED & ADVANCED / <b>TAXONOMY</b></div>
    <header className="directory-hero"><div><small>MARKETPLACE TAXONOMY</small><h1>Taxonomy</h1><p>Real categories consumed by both the mobile app and website. There is no delete path here by design — categories are archived, never removed, since listings reference them by key.</p></div></header>

    {phase === 'error' && <div className="directory-empty" role="alert">Could not load categories: {error}</div>}

    {phase !== 'error' && <div className="directory-workspace">
      <section className="directory-ledger">
        <header><span>{rows.length} categor{rows.length === 1 ? 'y' : 'ies'}</span></header>
        <div className="directory-table-scroll"><table aria-label="Categories"><thead><tr><th>Name</th><th>Key</th><th>Active</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} className={selectedId === row.id ? 'selected' : ''} onClick={() => void select(row)} style={{ cursor: 'pointer' }}><td>{row.name}</td><td><code>{row.legacy_key ?? row.slug}</code></td><td>{row.is_active ? 'Yes' : 'No'}</td></tr>)}</tbody></table></div>
      </section>
      <aside className="directory-inspector" aria-label="Category editor">
        {!selected && <p>Select a category to edit.</p>}
        {selected && <>
          <header><Icon name="category" /><div><small>{selected.legacy_key ?? selected.slug}</small><strong>{selected.name}</strong></div><b>{selected.is_active ? 'ACTIVE' : 'ARCHIVED'}</b></header>
          <label className="policy-field">Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="policy-field">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 60 }} /></label>
          <p><small>{listingCount === null ? 'Checking listing usage…' : `${listingCount} listing(s) currently use this category.`}</small></p>
          <div className="jobs-actions">
            <button onClick={() => void save()}>Save</button>
            <button onClick={() => void toggleActive()}>{selected.is_active ? 'Archive (deactivate)' : 'Reactivate'}</button>
          </div>
          {message && <p role="status">{message}</p>}
        </>}
      </aside>
    </div>}
  </div>;
}
