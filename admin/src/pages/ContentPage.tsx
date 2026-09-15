import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../security/auth-context';
import {
  listContentPages, getContentPage, updateContentPage,
  listBlogVideos, setBlogVideoPublished, createBlogVideo,
  getContactSocialLinks, updateContactSocialLinks,
  type ContentPageRow, type ContentPageDetail, type BlogVideoRow, type ContactSocialLinks,
} from '../services/content/query';

function Icon({ name }: { name: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>; }

type Tab = 'legal' | 'faq' | 'videos' | 'contact';

export function ContentPage() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('legal');

  const [pages, setPages] = useState<ContentPageRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContentPageDetail | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftShort, setDraftShort] = useState('');
  const [draftStatus, setDraftStatus] = useState('draft');
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [videos, setVideos] = useState<BlogVideoRow[]>([]);
  const [newTitle, setNewTitle] = useState(''); const [newProvider, setNewProvider] = useState('youtube'); const [newEmbed, setNewEmbed] = useState(''); const [newUrl, setNewUrl] = useState(''); const [newDesc, setNewDesc] = useState('');

  const [links, setLinks] = useState<ContactSocialLinks | null>(null);

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
    const result = await getContentPage(id);
    if (result.error || !result.data) return;
    setDetail(result.data);
    setDraftTitle(result.data.title ?? ''); setDraftShort(result.data.short_description ?? ''); setDraftStatus(result.data.status ?? 'draft');
  }

  async function savePage() {
    if (!detail || !auth.identity) return;
    setSaving(true);
    const result = await updateContentPage({ ...detail, title: draftTitle, short_description: draftShort, status: draftStatus }, auth.identity.id);
    setSaving(false);
    setMessage(result.error ? `Save failed: ${result.error.message}` : 'Saved as a new version. Live production content updated.');
    void load();
  }

  async function toggleVideo(id: string, published: boolean) {
    const result = await setBlogVideoPublished(id, published);
    setMessage(result.error ? `Failed: ${result.error.message}` : 'Updated.');
    void load();
  }
  async function addVideo() {
    if (!newTitle.trim() || !newEmbed.trim() || !newUrl.trim()) { setMessage('Title, embed ID and video URL are required.'); return; }
    const result = await createBlogVideo(newTitle.trim(), newProvider, newEmbed.trim(), newUrl.trim(), newDesc.trim());
    setMessage(result.error ? `Failed: ${result.error.message}` : 'Video added (unpublished).');
    setNewTitle(''); setNewEmbed(''); setNewUrl(''); setNewDesc('');
    void load();
  }

  async function saveLinks() {
    if (!links) return;
    setSaving(true);
    const result = await updateContactSocialLinks(links);
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
          <header><Icon name="description" /><div><small>{detail.slug}</small><strong>v{detail.version}</strong></div></header>
          <label className="policy-field">Title<input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} /></label>
          <label className="policy-field">Short description<textarea value={draftShort} onChange={(e) => setDraftShort(e.target.value)} style={{ minHeight: 60 }} /></label>
          <label className="policy-field">Status<select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}><option value="draft">Draft</option><option value="published">Published</option></select></label>
          <p><small>Full body editing (rich legal text) is not exposed here — this covers title, summary and publish status only, the fields most frequently changed. Body edits should go through a reviewed content workflow.</small></p>
          <button disabled={saving} onClick={() => void savePage()}>{saving ? 'Saving…' : 'Save as new version'}</button>
          {message && <p role="status">{message}</p>}
        </>}
      </aside>
    </div>}

    {tab === 'videos' && phase !== 'error' && <>
      <section className="directory-filters" aria-label="Add video"><div style={{ flexWrap: 'wrap', gap: 8 }}>
        <input aria-label="Title" placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        <select aria-label="Provider" value={newProvider} onChange={(e) => setNewProvider(e.target.value)}><option value="youtube">YouTube</option><option value="tiktok">TikTok</option><option value="vimeo">Vimeo</option></select>
        <input aria-label="Embed ID" placeholder="Embed/video ID" value={newEmbed} onChange={(e) => setNewEmbed(e.target.value)} />
        <input aria-label="Video URL" placeholder="Full video URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
        <input aria-label="Description" placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
        <button onClick={() => void addVideo()}>Add video (unpublished)</button>
      </div></section>
      <section className="directory-ledger">
        <div className="directory-table-scroll"><table aria-label="Blog videos"><thead><tr><th>Title</th><th>Provider</th><th>Published</th><th>Action</th></tr></thead>
          <tbody>{videos.map((v) => <tr key={v.id}><td>{v.title}</td><td>{v.provider ?? '—'}</td><td>{v.is_published ? 'Yes' : 'No'}</td><td><button onClick={() => void toggleVideo(v.id, !v.is_published)}>{v.is_published ? 'Unpublish' : 'Publish'}</button></td></tr>)}</tbody></table>
          {videos.length === 0 && <div className="directory-empty" role="status">No blog videos yet.</div>}
        </div>
      </section>
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
  </div>;
}
