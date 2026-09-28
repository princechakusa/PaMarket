import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import {
  listCategories, getCategoryListingCount, updateCategory, setCategoryActive,
  listSafeSpots, saveSafeSpot, deleteSafeSpot,
  type CategoryRow, type SafeSpotRow, type SafeSpotDraft,
} from '../services/taxonomy/query';

function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }

// Artwork bundled in the mobile app (apps/mobile/lib/category-icons.ts).
// A category can use one of these, or an https:// image URL.
const BUNDLED_ICONS = ['property', 'vehicles', 'rooms', 'electronics', 'jobs', 'furniture', 'fashion', 'services', 'agriculture', 'pets', 'kids', 'other'];
const EMPTY_SPOT: SafeSpotDraft = { city: '', name: '', area: '', note: '', is_active: true, sort_order: 100 };

export function TaxonomyPage() {
  const auth = useAuth();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [icon, setIcon] = useState('');
  const [listingCount, setListingCount] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [spots, setSpots] = useState<SafeSpotRow[]>([]);
  const [spotDraft, setSpotDraft] = useState<SafeSpotDraft>(EMPTY_SPOT);
  const [spotMessage, setSpotMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    const result = await listCategories();
    if (result.error) { setError(result.error.message); setPhase('error'); return; }
    setRows(result.data);
    // Safe spots are optional: the table may not exist before its migration.
    const spotResult = await listSafeSpots();
    if (!spotResult.error) setSpots(spotResult.data);
    setPhase('ready');
  }, [auth.mode]);

  useEffect(() => { void load(); }, [load]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  async function select(row: CategoryRow) {
    setSelectedId(row.id); setName(row.name ?? ''); setDescription(row.description ?? ''); setIcon(row.icon ?? ''); setMessage(null);
    setListingCount(null);
    const result = await getCategoryListingCount(row);
    setListingCount(result.data ?? 0);
  }

  async function save() {
    if (!selected || !auth.identity) return;
    const trimmedIcon = icon.trim();
    if (trimmedIcon && !BUNDLED_ICONS.includes(trimmedIcon) && !/^https:\/\//i.test(trimmedIcon)) {
      setMessage('Icon must be one of the listed artwork names or an https:// image URL.');
      return;
    }
    const result = await updateCategory(selected.id, { name, description, icon: trimmedIcon }, auth.identity.id);
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

  async function saveSpot() {
    const result = await saveSafeSpot(spotDraft);
    setSpotMessage(result.error ? `Failed: ${result.error.message}` : 'Saved.');
    if (!result.error) setSpotDraft(EMPTY_SPOT);
    void load();
  }

  async function removeSpot(spot: SafeSpotRow) {
    if (!confirm(`Delete ${spot.name}?`)) return;
    const result = await deleteSafeSpot(spot.id);
    setSpotMessage(result.error ? `Failed: ${result.error.message}` : 'Deleted.');
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
        <div className="directory-table-scroll"><table aria-label="Categories"><thead><tr><th>Name</th><th>Key</th><th>Icon</th><th>Active</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} className={selectedId === row.id ? 'selected' : ''} onClick={() => void select(row)} style={{ cursor: 'pointer' }}><td>{row.name}</td><td><code>{row.legacy_key ?? row.slug}</code></td><td>{row.icon ? <code>{row.icon.length > 24 ? 'image URL' : row.icon}</code> : '—'}</td><td>{row.is_active ? 'Yes' : 'No'}</td></tr>)}</tbody></table></div>
      </section>
      <aside className="directory-inspector" aria-label="Category editor">
        {!selected && <p>Select a category to edit.</p>}
        {selected && <>
          <header><Icon name="category" /><div><small>{selected.legacy_key ?? selected.slug}</small><strong>{selected.name}</strong></div><b>{selected.is_active ? 'ACTIVE' : 'ARCHIVED'}</b></header>
          <label className="policy-field">Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="policy-field">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 60 }} /></label>
          <label className="policy-field">Icon (artwork name or https:// image URL; blank = default for this key)
            <input list="bundled-icons" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="e.g. electronics" />
            <datalist id="bundled-icons">{BUNDLED_ICONS.map((i) => <option key={i} value={i} />)}</datalist>
          </label>
          <p><small>{listingCount === null ? 'Checking listing usage…' : `${listingCount} listing(s) currently use this category.`}</small></p>
          <div className="jobs-actions">
            <button onClick={() => void save()}>Save</button>
            <button onClick={() => void toggleActive()}>{selected.is_active ? 'Archive (deactivate)' : 'Reactivate'}</button>
          </div>
          {message && <p role="status">{message}</p>}
        </>}
      </aside>
    </div>}

    {phase === 'ready' && <section className="policy-panel" style={{ marginTop: 24 }}>
      <header><div><h2><Icon name="shield" />Safe meeting spots</h2><p>Busy public places shown to buyers on listings in the same city ("Meet safely in Harare"). Only active spots appear in the app.</p></div></header>
      <div className="directory-table-scroll"><table aria-label="Safe meeting spots"><thead><tr><th>City</th><th>Place</th><th>Area</th><th>Active</th><th /></tr></thead>
        <tbody>{spots.map((sp) => <tr key={sp.id}>
          <td>{sp.city}</td><td>{sp.name}</td><td>{sp.area ?? ''}</td><td>{sp.is_active ? 'Yes' : 'No'}</td>
          <td>
            <button onClick={() => { setSpotDraft({ id: sp.id, city: sp.city, name: sp.name, area: sp.area ?? '', note: sp.note ?? '', is_active: sp.is_active, sort_order: sp.sort_order }); setSpotMessage(null); }}>Edit</button>{' '}
            <button onClick={() => void removeSpot(sp)}>Delete</button>
          </td>
        </tr>)}</tbody></table></div>
      <div className="policy-controls">
        <label className="policy-field">City<input value={spotDraft.city} onChange={(e) => setSpotDraft({ ...spotDraft, city: e.target.value })} placeholder="Harare" /></label>
        <label className="policy-field">Place name<input value={spotDraft.name} onChange={(e) => setSpotDraft({ ...spotDraft, name: e.target.value })} placeholder="Eastgate Mall" /></label>
        <label className="policy-field">Area / suburb<input value={spotDraft.area} onChange={(e) => setSpotDraft({ ...spotDraft, area: e.target.value })} /></label>
        <label className="policy-field">Tip for buyers<input value={spotDraft.note} onChange={(e) => setSpotDraft({ ...spotDraft, note: e.target.value })} /></label>
        <label className="policy-field">Order<input type="number" value={spotDraft.sort_order} onChange={(e) => setSpotDraft({ ...spotDraft, sort_order: Number(e.target.value) || 100 })} /></label>
        <label className="policy-switch"><span>Active</span><input type="checkbox" role="switch" checked={spotDraft.is_active} onChange={(e) => setSpotDraft({ ...spotDraft, is_active: e.target.checked })} /></label>
      </div>
      <footer><span>{spotDraft.id ? 'Editing an existing spot.' : 'Add a new spot.'}</span>
        <button disabled={!spotDraft.city.trim() || !spotDraft.name.trim()} onClick={() => void saveSpot()}>{spotDraft.id ? 'Save spot' : 'Add spot'}</button>
        {spotDraft.id && <button onClick={() => setSpotDraft(EMPTY_SPOT)}>Cancel</button>}
      </footer>
      {spotMessage && <p role="status">{spotMessage}</p>}
    </section>}
  </div>;
}
