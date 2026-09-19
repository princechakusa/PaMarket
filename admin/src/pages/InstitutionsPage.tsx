import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import {
  listInstitutions, listProvinces, listCitiesForProvince, getInstitutionListingCount, listOrganizationsForInstitution,
  createInstitution, updateInstitution, setInstitutionActive, INSTITUTIONS_PAGE_SIZE,
  type InstitutionRow, type ProvinceRow, type CityRow, type InstitutionType, type InstitutionInput, type InstitutionOrganizationRow,
} from '../services/institutions/query';
import { invokeAdminFunction } from '../services/edge/invoke';

function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }

const TYPES: { value: InstitutionType; label: string }[] = [
  { value: 'university', label: 'University' },
  { value: 'high_school', label: 'High School' },
  { value: 'organization', label: 'Organization' },
];

const emptyForm: InstitutionInput = {
  type: 'university', official_name: '', short_name: '', search_aliases: [],
  province_id: '', city_id: '', suburb: '', logo_url: '', cover_image: '', founded_year: null,
  description: '', is_active: true, sort_order: 0,
};

function duplicateFriendlyMessage(message: string): string {
  if (/duplicate key|unique constraint|institutions_official_name_city_unique/i.test(message)) {
    return 'An institution with this name already exists in this city.';
  }
  return `Failed: ${message}`;
}

export function InstitutionsPage() {
  const auth = useAuth();
  const canManage = auth.identity?.permissions.includes('institutions.manage') ?? false;

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<InstitutionType | ''>('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<InstitutionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const [provinces, setProvinces] = useState<ProvinceRow[]>([]);
  const [filterCities, setFilterCities] = useState<CityRow[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<InstitutionInput>(emptyForm);
  const [aliasesText, setAliasesText] = useState('');
  const [formCities, setFormCities] = useState<CityRow[]>([]);
  const [listingCount, setListingCount] = useState<number | null>(null);
  const [organizations, setOrganizations] = useState<InstitutionOrganizationRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading');
    setError(null);
    const result = await listInstitutions({
      search: search || undefined,
      type: typeFilter || undefined,
      provinceId: provinceFilter || undefined,
      cityId: cityFilter || undefined,
      active: activeFilter === '' ? undefined : activeFilter === 'true',
    }, page);
    if (result.error) { setError(result.error.message); setPhase('error'); return; }
    setRows(result.data.rows);
    setTotal(result.data.total);
    setPhase('ready');
  }, [auth.mode, search, typeFilter, provinceFilter, cityFilter, activeFilter, page]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (auth.mode !== 'live') return;
    void listProvinces().then((r) => { if (!r.error) setProvinces(r.data); });
  }, [auth.mode]);

  useEffect(() => {
    if (!provinceFilter) { setFilterCities([]); setCityFilter(''); return; }
    void listCitiesForProvince(provinceFilter).then((r) => { if (!r.error) setFilterCities(r.data); });
  }, [provinceFilter]);

  useEffect(() => {
    if (!form.province_id) { setFormCities([]); return; }
    void listCitiesForProvince(form.province_id).then((r) => { if (!r.error) setFormCities(r.data); });
  }, [form.province_id]);

  function startCreate() {
    setIsCreating(true); setSelectedId(null);
    setForm(emptyForm); setAliasesText(''); setListingCount(null); setOrganizations(null);
    setMessage(null); setValidationError(null);
  }

  async function select(row: InstitutionRow) {
    setIsCreating(false); setSelectedId(row.id);
    setForm({
      type: (row.type as InstitutionType) ?? 'university', official_name: row.official_name ?? '', short_name: row.short_name ?? '',
      search_aliases: row.search_aliases ?? [], province_id: row.province_id ?? '', city_id: row.city_id ?? '',
      suburb: row.suburb ?? '', logo_url: row.logo_url ?? '', cover_image: row.cover_image ?? '',
      founded_year: row.founded_year ?? null, description: row.description ?? '',
      is_active: row.is_active ?? true, sort_order: row.sort_order ?? 0,
    });
    setAliasesText((row.search_aliases ?? []).join(', '));
    setMessage(null); setValidationError(null); setListingCount(null); setOrganizations(null);
    const [listingResult, orgsResult] = await Promise.all([
      getInstitutionListingCount(row.id),
      listOrganizationsForInstitution(row.id),
    ]);
    setListingCount(listingResult.data ?? 0);
    setOrganizations(orgsResult.data ?? []);
  }

  function validate(): string | null {
    if (!form.official_name.trim()) return 'Official name is required.';
    if (!TYPES.some((t) => t.value === form.type)) return 'Type must be a valid institution type.';
    if (!form.province_id) return 'Province is required.';
    if (!form.city_id) return 'City is required.';
    if (!Number.isInteger(form.sort_order ?? 0)) return 'Sort order must be a whole number.';
    return null;
  }

  async function save() {
    const validationMsg = validate();
    setValidationError(validationMsg);
    if (validationMsg || !auth.identity) return;
    setSaving(true); setMessage(null);
    const aliases = aliasesText.split(',').map((a) => a.trim()).filter(Boolean);
    const payload: InstitutionInput = { ...form, official_name: form.official_name.trim(), search_aliases: aliases };
    const result = isCreating
      ? await createInstitution(payload, auth.identity.id)
      : selected ? await updateInstitution(selected.id, payload, auth.identity.id) : { error: null, data: null };
    setSaving(false);
    if (result?.error) { setMessage(duplicateFriendlyMessage(result.error.message)); return; }
    setMessage(isCreating ? 'Institution created.' : 'Saved.');
    setIsCreating(false);
    void load();
  }

  async function toggleActive() {
    if (!selected || !auth.identity) return;
    if (selected.is_active && (listingCount ?? 0) > 0 && !confirm(`${listingCount} listing(s) currently reference this institution. Deactivate anyway? Existing listings keep their institution tag and stay visible everywhere else; only the institution's own public directory/detail pages will hide it.`)) return;
    const result = await setInstitutionActive(selected.id, !selected.is_active, auth.identity.id);
    setMessage(result.error ? `Failed: ${result.error.message}` : `Institution ${selected.is_active ? 'deactivated' : 'activated'}.`);
    void load();
  }

  async function onImageSelected(file: File, target: 'logo_url' | 'cover_image') {
    if (!auth.accessToken) return;
    const label = target === 'logo_url' ? 'Logo' : 'Cover photo';
    const setUploading = target === 'logo_url' ? setLogoUploading : setCoverUploading;
    setUploading(true); setMessage(null);
    const result = await invokeAdminFunction<{ signedUrl?: string; publicUrl?: string; error?: string }>('get-r2-upload-url', auth.accessToken, {
      body: { key: target === 'logo_url' ? 'institutions/logo' : 'institutions/cover', contentType: file.type, verb: 'PUT' },
    });
    if (result.error || !result.data.signedUrl) { setUploading(false); setMessage(`${label} upload failed: ${result.error?.message ?? result.data?.error ?? 'unknown error'}`); return; }
    try {
      const put = await fetch(result.data.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      setForm((f) => ({ ...f, [target]: result.data.publicUrl ?? f[target] }));
      setMessage(`${label} uploaded.`);
    } catch (err) {
      setMessage(`${label} upload failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setUploading(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / INSTITUTIONS_PAGE_SIZE));

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><Icon name="science" /><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / SHARED & ADVANCED / <b>INSTITUTIONS</b></div>
    <header className="directory-hero"><div><small>UNIVERSITIES · HIGH SCHOOLS · ORGANIZATIONS</small><h1>Institutions</h1><p>Admin-managed institution directory. Listings optionally tag themselves to an institution via listings.institution_id — deactivating an institution hides it from public browsing only; tagged listings are never affected.</p></div>
      {canManage && <button onClick={startCreate}><Icon name="add" />Add institution</button>}</header>

    <section className="directory-filters" aria-label="Institution filters"><div>
      <label className="directory-search"><span className="material-symbols-outlined">search</span><input aria-label="Search institutions" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search official name" /></label>
      <select aria-label="Type" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as InstitutionType | ''); setPage(1); }}>
        <option value="">TYPE: ALL</option>
        {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label.toUpperCase()}</option>)}
      </select>
      <select aria-label="Province" value={provinceFilter} onChange={(e) => { setProvinceFilter(e.target.value); setCityFilter(''); setPage(1); }}>
        <option value="">PROVINCE: ALL</option>
        {provinces.map((p) => <option key={p.id} value={p.id}>{(p.name ?? '').toUpperCase()}</option>)}
      </select>
      <select aria-label="City" value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(1); }} disabled={!provinceFilter}>
        <option value="">CITY: ALL</option>
        {filterCities.map((c) => <option key={c.id} value={c.id}>{(c.name ?? '').toUpperCase()}</option>)}
      </select>
      <select aria-label="Active" value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value as '' | 'true' | 'false'); setPage(1); }}>
        <option value="">STATUS: ALL</option>
        <option value="true">ACTIVE</option>
        <option value="false">INACTIVE</option>
      </select>
      <button onClick={() => { setSearch(''); setTypeFilter(''); setProvinceFilter(''); setCityFilter(''); setActiveFilter(''); setPage(1); void load(); }} aria-label="Reset filters"><span className="material-symbols-outlined">restart_alt</span></button>
    </div></section>

    <div className="directory-workspace">
      <section className="directory-ledger">
        <header><span aria-live="polite">{phase === 'loading' ? 'Loading…' : `${total.toLocaleString('en-ZW')} institution(s)`}</span>
          <div><button disabled={page <= 1 || phase === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount || phase === 'loading'} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div>
        </header>
        <div className="directory-table-scroll">
          {phase === 'error' && <div className="directory-empty" role="alert">Could not load institutions: {error}</div>}
          {phase !== 'error' && <table aria-label="Institutions"><thead><tr><th>Official Name</th><th>Type</th><th>Province</th><th>City</th><th>Active</th><th>Sort Order</th><th>Actions</th></tr></thead>
            <tbody>{rows.map((row) => {
              const province = provinces.find((p) => p.id === row.province_id);
              const city = filterCities.find((c) => c.id === row.city_id);
              return <tr key={row.id} className={selectedId === row.id ? 'selected' : ''} onClick={() => void select(row)} style={{ cursor: 'pointer' }}>
                <td>{row.official_name}</td><td>{TYPES.find((t) => t.value === row.type)?.label ?? row.type}</td>
                <td>{province?.name ?? '—'}</td><td>{city?.name ?? '—'}</td><td>{row.is_active ? 'Yes' : 'No'}</td><td>{row.sort_order}</td>
                <td><button onClick={(e) => { e.stopPropagation(); void select(row); }}>{canManage ? 'Edit' : 'View'}</button></td>
              </tr>;
            })}</tbody></table>}
          {phase === 'ready' && rows.length === 0 && <div className="directory-empty" role="status">No institutions match these filters.</div>}
        </div>
      </section>

      <aside className="directory-inspector" aria-label="Institution editor">
        {!selected && !isCreating && <p>Select an institution to view details{canManage ? ', or add a new one' : ''}.</p>}
        {(selected || isCreating) && <>
          <header><Icon name="school" /><div><small>{isCreating ? 'NEW INSTITUTION' : TYPES.find((t) => t.value === selected?.type)?.label}</small><strong>{isCreating ? 'Add institution' : selected?.official_name}</strong></div>{!isCreating && <b>{selected?.is_active ? 'ACTIVE' : 'INACTIVE'}</b>}</header>

          <fieldset disabled={!canManage} style={{ border: 0, padding: 0, margin: 0 }}>
            <label className="policy-field">Official Name<input value={form.official_name} onChange={(e) => setForm({ ...form, official_name: e.target.value })} /></label>
            <label className="policy-field">Short Name<input value={form.short_name ?? ''} onChange={(e) => setForm({ ...form, short_name: e.target.value })} /></label>
            <label className="policy-field">Type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as InstitutionType })}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
            <label className="policy-field">Province<select value={form.province_id} onChange={(e) => setForm({ ...form, province_id: e.target.value, city_id: '' })}><option value="">Select province…</option>{provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="policy-field">City<select value={form.city_id} onChange={(e) => setForm({ ...form, city_id: e.target.value })} disabled={!form.province_id}><option value="">Select city…</option>{formCities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="policy-field">Suburb (optional)<input value={form.suburb ?? ''} onChange={(e) => setForm({ ...form, suburb: e.target.value })} /></label>
            <label className="policy-field">Logo (small badge)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImageSelected(f, 'logo_url'); }} disabled={logoUploading} />{logoUploading && <small>Uploading…</small>}{form.logo_url && <div style={{ marginTop: 6 }}><img src={form.logo_url} alt="Institution logo" style={{ maxWidth: 96, maxHeight: 96, display: 'block' }} /><button type="button" onClick={() => setForm((f) => ({ ...f, logo_url: '' }))} style={{ marginTop: 4 }}>Remove logo</button></div>}</label>
            <label className="policy-field">Cover Photo (full-width banner)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImageSelected(f, 'cover_image'); }} disabled={coverUploading} />{coverUploading && <small>Uploading…</small>}{form.cover_image && <div style={{ marginTop: 6 }}><img src={form.cover_image} alt="Institution cover" style={{ maxWidth: 240, maxHeight: 120, display: 'block' }} /><button type="button" onClick={() => setForm((f) => ({ ...f, cover_image: '' }))} style={{ marginTop: 4 }}>Remove cover photo</button></div>}</label>
            <label className="policy-field">Founded Year (optional)<input type="number" step={1} value={form.founded_year ?? ''} onChange={(e) => setForm({ ...form, founded_year: e.target.value ? Number.parseInt(e.target.value, 10) : null })} /></label>
            <label className="policy-field">Description<textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ minHeight: 60 }} /></label>
            <label className="policy-field">Search Aliases (comma-separated)<input value={aliasesText} onChange={(e) => setAliasesText(e.target.value)} placeholder="e.g. UZ, Uni of Zim" /></label>
            <label className="policy-field">Sort Order<input type="number" step={1} value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number.parseInt(e.target.value, 10) || 0 })} /></label>
            {!isCreating && <label className="policy-switch"><span>Active</span><input type="checkbox" role="switch" checked={form.is_active ?? true} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /></label>}
          </fieldset>

          {validationError && <p role="alert">{validationError}</p>}
          {!isCreating && <p><small>{listingCount === null ? 'Checking listing usage…' : `${listingCount} listing(s) currently reference this institution.`}</small></p>}
          {!isCreating && (
            <section>
              <h3>Organizations</h3>
              {organizations === null && <p><small>Checking organizations…</small></p>}
              {organizations !== null && organizations.length === 0 && <p><small>No businesses are tagged to this institution yet.</small></p>}
              {organizations !== null && organizations.length > 0 && <ul>
                {organizations.map((org) => <li key={org.id}>{org.name ?? 'Unnamed'} <span className={`status-pill ${org.status === 'active' ? 'approved' : 'pending'}`}>{org.status ?? '—'}</span></li>)}
              </ul>}
              <p style={{ fontSize: 12 }}>Set via businesses.institution_id (business owners pick this on their own profile edit screen). Only active organizations appear on this institution's public hub page.</p>
            </section>
          )}

          {canManage && <div className="jobs-actions">
            <button disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : isCreating ? 'Create' : 'Save'}</button>
            {!isCreating && selected && <button onClick={() => void toggleActive()}>{selected.is_active ? 'Deactivate' : 'Activate'}</button>}
            {isCreating && <button onClick={() => { setIsCreating(false); setForm(emptyForm); }}>Cancel</button>}
          </div>}
          {message && <p role="status">{message}</p>}
        </>}
      </aside>
    </div>
  </div>;
}
