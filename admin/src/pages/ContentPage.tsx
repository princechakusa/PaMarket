import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../security/auth-context';
import {
  listContentPages, getContentPage, updateContentPage, listContentPageVersions,
  listBlogVideos, setBlogVideoPublished, createBlogVideo, updateBlogVideo,
  getContactSocialLinks, updateContactSocialLinks,
  getCompanySettings, updateCompanySettings,
  type ContentPageRow, type ContentPageDetail, type ContentPageVersionRow, type BlogVideoRow, type ContactSocialLinks, type CompanySettings,
} from '../services/content/query';

function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }

type Tab = 'legal' | 'faq' | 'videos' | 'contact' | 'company';
const tabFromPath: Record<string, Tab> = { '/content/legal': 'legal', '/content/faq': 'faq', '/content/videos': 'videos', '/content/contact': 'contact', '/content/company': 'company' };

type LegalSection = { heading: string; body: string };
type FaqItem = { q: string; a: string; group: string };

function asSections(body: unknown): LegalSection[] {
  const raw = (body as { sections?: unknown } | null)?.sections;
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => ({ heading: typeof (s as LegalSection)?.heading === 'string' ? (s as LegalSection).heading : '', body: typeof (s as LegalSection)?.body === 'string' ? (s as LegalSection).body : '' }));
}
function asItems(body: unknown): FaqItem[] {
  const raw = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => ({ q: typeof (i as FaqItem)?.q === 'string' ? (i as FaqItem).q : '', a: typeof (i as FaqItem)?.a === 'string' ? (i as FaqItem).a : '', group: typeof (i as FaqItem)?.group === 'string' ? (i as FaqItem).group : '' }));
}
function move<T>(arr: T[], from: number, to: number): T[] { if (to < 0 || to >= arr.length) return arr; const next = arr.slice(); const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }

/** Mirrors blog.html's safeBlogVideoEmbed() exactly -- the website only
 * knows how to embed youtube/vimeo; any other provider's embedUrl comes
 * back empty and blog.html silently drops the row from the page (filters
 * out anything with no embedUrl). A "tiktok" option existed in this form
 * before this fix even though the website could never render it -- an
 * admin publishing one would see it saved successfully here and never
 * know it doesn't actually appear on the site. Keep this in sync with
 * blog.html if that function ever changes. */
function validEmbedId(provider: string, embedId: string): boolean {
  if (provider === 'youtube') return /^[A-Za-z0-9_-]{6,20}$/.test(embedId);
  if (provider === 'vimeo') return /^[0-9]{5,15}$/.test(embedId);
  return false;
}

export function ContentPage() {
  const auth = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(tabFromPath[location.pathname] ?? 'legal');

  const [pages, setPages] = useState<ContentPageRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContentPageDetail | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftShort, setDraftShort] = useState('');
  const [draftStatus, setDraftStatus] = useState('draft');
  const [draftSections, setDraftSections] = useState<LegalSection[]>([]);
  const [draftItems, setDraftItems] = useState<FaqItem[]>([]);
  const [rawMode, setRawMode] = useState(false);
  const [rawJson, setRawJson] = useState('');
  const [versions, setVersions] = useState<ContentPageVersionRow[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [videos, setVideos] = useState<BlogVideoRow[]>([]);
  const [newTitle, setNewTitle] = useState(''); const [newProvider, setNewProvider] = useState('youtube'); const [newEmbed, setNewEmbed] = useState(''); const [newUrl, setNewUrl] = useState(''); const [newDesc, setNewDesc] = useState('');
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState(''); const [editDesc, setEditDesc] = useState(''); const [editProvider, setEditProvider] = useState('youtube'); const [editEmbed, setEditEmbed] = useState(''); const [editOrder, setEditOrder] = useState(0);

  const [links, setLinks] = useState<ContactSocialLinks | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);

  const load = useCallback(async () => {
    if (auth.mode !== 'live') { setPhase('ready'); return; }
    setPhase('loading'); setError(null); setMessage(null); setSelectedId(null); setDetail(null);
    if (tab === 'legal' || tab === 'faq') {
      const result = await listContentPages(tab);
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setPages(result.data);
    } else if (tab === 'videos') {
      const result = await listBlogVideos();
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setVideos(result.data);
    } else if (tab === 'company') {
      const result = await getCompanySettings();
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setCompany(result.data);
    } else {
      const result = await getContactSocialLinks();
      if (result.error) { setError(result.error.message); setPhase('error'); return; }
      setLinks(result.data);
    }
    setPhase('ready');
  }, [auth.mode, tab]);

  useEffect(() => { void load(); }, [load]);

  async function selectPage(id: string) {
    setSelectedId(id);
    setRawMode(false);
    setMessage(null);
    const [result, versionsResult] = await Promise.all([getContentPage(id), listContentPageVersions(id)]);
    if (result.error || !result.data) return;
    setDetail(result.data);
    setDraftTitle(result.data.title ?? '');
    setDraftShort(result.data.short_description ?? '');
    setDraftStatus(result.data.status ?? 'draft');
    setDraftSections(asSections(result.data.body));
    setDraftItems(asItems(result.data.body));
    setRawJson(JSON.stringify(result.data.body ?? {}, null, 2));
    setVersions(versionsResult.data ?? []);
  }

  function buildBody(): unknown {
    if (rawMode) { try { return JSON.parse(rawJson); } catch { return detail?.body ?? {}; } }
    return tab === 'legal' ? { sections: draftSections } : { items: draftItems };
  }

  async function savePage() {
    if (!detail || !auth.identity) return;
    if (rawMode) { try { JSON.parse(rawJson); } catch { setMessage('Save failed: raw JSON is not valid.'); return; } }
    setSaving(true);
    const result = await updateContentPage({ ...detail, title: draftTitle, short_description: draftShort, status: draftStatus, body: buildBody() }, auth.identity.id);
    setSaving(false);
    setMessage(result.error ? `Save failed: ${result.error.message}` : 'Saved as a new version. Live production content updated.');
    if (!result.error) void selectPage(detail.id);
    void load();
  }

  async function toggleVideo(id: string, published: boolean) {
    const result = await setBlogVideoPublished(id, published);
    setMessage(result.error ? `Failed: ${result.error.message}` : 'Updated.');
    void load();
  }
  async function addVideo() {
    if (!newTitle.trim() || !newEmbed.trim() || !newUrl.trim()) { setMessage('Title, embed ID and video URL are required.'); return; }
    if (!validEmbedId(newProvider, newEmbed.trim())) { setMessage(`That embed ID doesn't match ${newProvider}'s expected format — the website would silently fail to show this video. Check the ID and try again.`); return; }
    const result = await createBlogVideo(newTitle.trim(), newProvider, newEmbed.trim(), newUrl.trim(), newDesc.trim());
    setMessage(result.error ? `Failed: ${result.error.message}` : 'Video added (unpublished).');
    setNewTitle(''); setNewEmbed(''); setNewUrl(''); setNewDesc('');
    void load();
  }
  function startEditVideo(v: BlogVideoRow) {
    setEditingVideoId(v.id); setEditTitle(v.title ?? ''); setEditDesc(v.description ?? ''); setEditProvider(v.provider ?? 'youtube'); setEditEmbed(v.embed_id ?? ''); setEditOrder(v.sort_order ?? 0);
  }
  async function saveVideoEdit() {
    if (!editingVideoId) return;
    if (!validEmbedId(editProvider, editEmbed.trim())) { setMessage(`That embed ID doesn't match ${editProvider}'s expected format — the website would silently fail to show this video.`); return; }
    const result = await updateBlogVideo(editingVideoId, { title: editTitle, description: editDesc, provider: editProvider, embed_id: editEmbed, sort_order: editOrder });
    setMessage(result.error ? `Failed: ${result.error.message}` : 'Video updated.');
    setEditingVideoId(null);
    void load();
  }

  async function saveLinks() {
    if (!links) return;
    setSaving(true);
    const result = await updateContactSocialLinks(links);
    setSaving(false);
    setMessage(result.error ? `Save failed: ${result.error.message}` : 'Saved.');
  }

  async function saveCompany() {
    if (!company) return;
    setSaving(true);
    const result = await updateCompanySettings(company);
    setSaving(false);
    setMessage(result.error ? `Save failed: ${result.error.message}` : 'Saved.');
  }

  return <div className="directory-page">
    {auth.mode === 'mock' && <div className="directory-reference" role="note"><Icon name="science" /><b>REFERENCE DATA MODE</b><span>Live Supabase is not configured in this environment.</span></div>}
    <div className="directory-breadcrumb">PAMARKET OPS / SHARED & ADVANCED / <b>CONTENT</b></div>
    <header className="directory-hero"><div><small>PRODUCTION CONTENT</small><h1>Content</h1><p>Real, already-live legal/policy pages, FAQ, blog videos and contact/social links — the same records the website and mobile app read. Edits here are real production edits with full version history, not a draft sandbox.</p></div></header>

    <nav className="listing-tabs" aria-label="Content section"><div>
      <button className={tab === 'legal' ? 'active' : ''} onClick={() => setTab('legal')}>Legal & Policies</button>
      <button className={tab === 'faq' ? 'active' : ''} onClick={() => setTab('faq')}>Help & FAQ</button>
      <button className={tab === 'videos' ? 'active' : ''} onClick={() => setTab('videos')}>Blog Videos</button>
      <button className={tab === 'contact' ? 'active' : ''} onClick={() => setTab('contact')}>Contact & Social</button>
      <button className={tab === 'company' ? 'active' : ''} onClick={() => setTab('company')}>Company & Legal</button>
    </div></nav>

    {phase === 'error' && <div className="directory-empty" role="alert">Could not load: {error}</div>}

    {(tab === 'legal' || tab === 'faq') && phase !== 'error' && <div className="directory-workspace">
      <section className="directory-ledger">
        <header><span>{pages.length} page(s)</span></header>
        <div className="directory-table-scroll"><table aria-label="Content pages"><thead><tr><th>Slug</th><th>Title</th><th>Status</th><th>Version</th></tr></thead>
          <tbody>{pages.map((p) => <tr key={p.id} className={selectedId === p.id ? 'selected' : ''} onClick={() => void selectPage(p.id)} style={{ cursor: 'pointer' }}><td>{p.slug}</td><td>{p.title ?? '—'}</td><td>{p.status}</td><td>{p.version}</td></tr>)}</tbody></table>
          {pages.length === 0 && <div className="directory-empty" role="status">No {tab} pages found.</div>}
        </div>
      </section>
      <aside className="directory-inspector" aria-label="Page editor">
        {!selectedId && <p>Select a page to edit its live content.</p>}
        {selectedId && detail && <>
          <header><Icon name="description" /><div><small>{detail.slug}</small><strong>v{detail.version}</strong></div><label style={{ fontSize: '0.7em' }}><input type="checkbox" checked={rawMode} onChange={(e) => setRawMode(e.target.checked)} /> Raw JSON</label></header>
          <label className="policy-field">Title<input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} /></label>
          <label className="policy-field">Short description<textarea value={draftShort} onChange={(e) => setDraftShort(e.target.value)} style={{ minHeight: 60 }} /></label>
          <label className="policy-field">Status<select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}><option value="draft">Draft</option><option value="published">Published</option></select></label>

          {rawMode ? (
            <label className="policy-field">Body (raw JSON)<textarea value={rawJson} onChange={(e) => setRawJson(e.target.value)} style={{ minHeight: 260, fontFamily: 'monospace', fontSize: '0.85em' }} /></label>
          ) : tab === 'legal' ? (
            <section><h3>Sections ({draftSections.length})</h3>
              {draftSections.map((s, i) => <div key={i} style={{ border: '1px solid var(--ops-border)', padding: 8, marginBottom: 8 }}>
                <input placeholder="Heading (optional)" value={s.heading} onChange={(e) => setDraftSections(draftSections.map((x, j) => j === i ? { ...x, heading: e.target.value } : x))} style={{ width: '100%', marginBottom: 6 }} />
                <textarea placeholder="Section body" value={s.body} onChange={(e) => setDraftSections(draftSections.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} style={{ width: '100%', minHeight: 80 }} />
                <div className="jobs-actions">
                  <button onClick={() => setDraftSections(move(draftSections, i, i - 1))} disabled={i === 0}>Move up</button>
                  <button onClick={() => setDraftSections(move(draftSections, i, i + 1))} disabled={i === draftSections.length - 1}>Move down</button>
                  <button onClick={() => setDraftSections(draftSections.filter((_, j) => j !== i))}>Remove</button>
                </div>
              </div>)}
              <button onClick={() => setDraftSections([...draftSections, { heading: '', body: '' }])}>Add section</button>
            </section>
          ) : (
            <section><h3>FAQ items ({draftItems.length})</h3>
              {draftItems.map((it, i) => <div key={i} style={{ border: '1px solid var(--ops-border)', padding: 8, marginBottom: 8 }}>
                <input placeholder="Group (e.g. Getting started)" value={it.group} onChange={(e) => setDraftItems(draftItems.map((x, j) => j === i ? { ...x, group: e.target.value } : x))} style={{ width: '100%', marginBottom: 6 }} />
                <input placeholder="Question" value={it.q} onChange={(e) => setDraftItems(draftItems.map((x, j) => j === i ? { ...x, q: e.target.value } : x))} style={{ width: '100%', marginBottom: 6 }} />
                <textarea placeholder="Answer" value={it.a} onChange={(e) => setDraftItems(draftItems.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} style={{ width: '100%', minHeight: 60 }} />
                <div className="jobs-actions">
                  <button onClick={() => setDraftItems(move(draftItems, i, i - 1))} disabled={i === 0}>Move up</button>
                  <button onClick={() => setDraftItems(move(draftItems, i, i + 1))} disabled={i === draftItems.length - 1}>Move down</button>
                  <button onClick={() => setDraftItems(draftItems.filter((_, j) => j !== i))}>Remove</button>
                </div>
              </div>)}
              <button onClick={() => setDraftItems([...draftItems, { q: '', a: '', group: '' }])}>Add item</button>
            </section>
          )}

          <button disabled={saving} onClick={() => void savePage()}>{saving ? 'Saving…' : 'Save as new version'}</button>
          {message && <p role="status">{message}</p>}

          {versions.length > 0 && <section><h3>Version history</h3><ul>{versions.map((v) => <li key={v.id}>v{v.version} — {v.status} — {v.title}</li>)}</ul></section>}
        </>}
      </aside>
    </div>}

    {tab === 'videos' && phase !== 'error' && <>
      <section className="directory-filters" aria-label="Add video"><div style={{ flexWrap: 'wrap', gap: 8 }}>
        <input aria-label="Title" placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        <select aria-label="Provider" value={newProvider} onChange={(e) => setNewProvider(e.target.value)}><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option></select>
        <input aria-label="Embed ID" placeholder="Embed/video ID" value={newEmbed} onChange={(e) => setNewEmbed(e.target.value)} />
        <input aria-label="Video URL" placeholder="Full video URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
        <input aria-label="Description" placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
        <button onClick={() => void addVideo()}>Add video (unpublished)</button>
      </div></section>
      <section className="directory-ledger">
        <div className="directory-table-scroll"><table aria-label="Blog videos"><thead><tr><th>Order</th><th>Title</th><th>Provider</th><th>Published</th><th>Action</th></tr></thead>
          <tbody>{videos.map((v) => {
            const broken = !validEmbedId(v.provider ?? '', v.embed_id ?? '');
            return <tr key={v.id}><td>{v.sort_order ?? 0}</td><td>{v.title}</td><td>{v.provider ?? '—'}{broken && <b style={{ color: 'var(--ops-red)', marginLeft: 6 }} title="This embed ID/provider won't render on the website">⚠ won't show on site</b>}</td><td>{v.is_published ? 'Yes' : 'No'}</td><td><div className="jobs-actions"><button onClick={() => void toggleVideo(v.id, !v.is_published)} disabled={!v.is_published && broken} title={!v.is_published && broken ? 'Fix the embed ID before publishing' : undefined}>{v.is_published ? 'Unpublish' : 'Publish'}</button><button onClick={() => startEditVideo(v)}>Edit</button></div></td></tr>;
          })}</tbody></table>
          {videos.length === 0 && <div className="directory-empty" role="status">No blog videos yet.</div>}
        </div>
      </section>
      {editingVideoId && <section className="policy-panel">
        <header><h2>Edit video</h2></header>
        <div className="policy-controls">
          <label className="policy-field">Title<input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></label>
          <label className="policy-field">Description<textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} /></label>
          <label className="policy-field">Provider<select value={editProvider} onChange={(e) => setEditProvider(e.target.value)}><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option></select></label>
          <label className="policy-field">Embed/video ID<input value={editEmbed} onChange={(e) => setEditEmbed(e.target.value)} /></label>
          <label className="policy-field">Sort order<input type="number" value={editOrder} onChange={(e) => setEditOrder(Number(e.target.value))} /></label>
        </div>
        <footer><button onClick={() => void saveVideoEdit()}>Save</button><button onClick={() => setEditingVideoId(null)}>Cancel</button></footer>
      </section>}
      {message && <p role="status">{message}</p>}
    </>}

    {tab === 'contact' && phase !== 'error' && links && <section className="policy-panel">
      <header><h2><Icon name="contact_mail" />Contact & Social Links</h2><p>Stored in app_settings.settings.content — the same record the website reads. Not a new table.</p></header>
      <div className="policy-controls">
        <label className="policy-field">Support email<input value={links.supportEmail} onChange={(e) => setLinks({ ...links, supportEmail: e.target.value })} /></label>
        <label className="policy-field">WhatsApp number<input value={links.whatsappNumber} onChange={(e) => setLinks({ ...links, whatsappNumber: e.target.value })} /></label>
        <label className="policy-field">Website URL<input value={links.websiteUrl} onChange={(e) => setLinks({ ...links, websiteUrl: e.target.value })} /></label>
        <label className="policy-field">App Store URL<input value={links.appStoreUrl} onChange={(e) => setLinks({ ...links, appStoreUrl: e.target.value })} /></label>
        <label className="policy-field">Play Store URL<input value={links.playStoreUrl} onChange={(e) => setLinks({ ...links, playStoreUrl: e.target.value })} /></label>
      </div>
      <footer><button disabled={saving} onClick={() => void saveLinks()}>{saving ? 'Saving…' : 'Save'}</button></footer>
      {message && <p role="status">{message}</p>}
    </section>}

    {tab === 'company' && phase !== 'error' && company && <section className="policy-panel">
      <header><h2><Icon name="apartment" />Company & Legal</h2><p>Stored in app_settings.settings.content.company — read by the website footer and the mobile app's About screen. Public read, admin-only write (same RLS as Contact & Social).</p></header>
      <div className="policy-controls">
        <label className="policy-field">Legal / trading name<input value={company.legalName} onChange={(e) => setCompany({ ...company, legalName: e.target.value })} placeholder="PaMarket Zimbabwe (Pvt) Ltd." /></label>
        <label className="policy-field">Registration number<input value={company.registrationNumber} onChange={(e) => setCompany({ ...company, registrationNumber: e.target.value })} placeholder="e.g. 12345/2024" /></label>
        <label className="policy-field">Registered address<textarea value={company.registeredAddress} onChange={(e) => setCompany({ ...company, registeredAddress: e.target.value })} style={{ minHeight: 60 }} /></label>
        <label className="policy-field">Regulatory / government info<textarea value={company.regulatoryInfo} onChange={(e) => setCompany({ ...company, regulatoryInfo: e.target.value })} style={{ minHeight: 60 }} placeholder="e.g. licensing/regulatory body statement" /></label>
        <label className="policy-field">Legal notice<textarea value={company.legalNotice} onChange={(e) => setCompany({ ...company, legalNotice: e.target.value })} style={{ minHeight: 60 }} /></label>
        <label className="policy-field">Copyright holder name<input value={company.copyrightHolder} onChange={(e) => setCompany({ ...company, copyrightHolder: e.target.value })} placeholder="Defaults to legal name if left blank" /></label>
        <label className="policy-field">Copyright start year<input type="number" value={company.copyrightStartYear} onChange={(e) => setCompany({ ...company, copyrightStartYear: Number(e.target.value) })} /></label>
        <p style={{ fontSize: '0.85em', opacity: 0.8 }}>
          Preview: &copy; {company.copyrightStartYear === new Date().getFullYear() ? company.copyrightStartYear : `${company.copyrightStartYear}–${new Date().getFullYear()}`} {company.copyrightHolder || company.legalName || 'PaMarket'}. All rights reserved.
          <br />No code change is ever needed to advance the year — it's computed at runtime from this start year.
        </p>
      </div>
      <footer><button disabled={saving} onClick={() => void saveCompany()}>{saving ? 'Saving…' : 'Save'}</button></footer>
      {message && <p role="status">{message}</p>}
    </section>}
  </div>;
}
