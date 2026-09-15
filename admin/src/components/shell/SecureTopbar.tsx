import { useCallback, useEffect, useState } from 'react';
import { EnvironmentBadge } from './EnvironmentBadge';
import { useAuth } from '../../security/auth-context';
import { getActiveAnnouncement, publishAnnouncement, deactivateAnnouncement, getOperationalSettings, updateOperationalSettings, type SiteAnnouncementRow } from '../../services/platform/query';

export function SecureTopbar({ onMenu }: { onMenu: () => void }) {
  const auth = useAuth();
  const admin = auth.identity;
  const initials = admin?.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() ?? 'PA';
  const canAnnounce = admin?.permissions.includes('content.publish') ?? false;
  const canFreeze = admin?.permissions.includes('settings.manage') ?? false;
  const live = auth.mode === 'live';

  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<SiteAnnouncementRow | null>(null);
  const [announceMessage, setAnnounceMessage] = useState('');
  const [announceLinkUrl, setAnnounceLinkUrl] = useState('');
  const [announceLinkLabel, setAnnounceLinkLabel] = useState('');
  const [announceBusy, setAnnounceBusy] = useState(false);
  const [announceStatus, setAnnounceStatus] = useState<string | null>(null);

  const [signupPaused, setSignupPaused] = useState(false);
  const [freezeBusy, setFreezeBusy] = useState(false);
  const [freezeLoaded, setFreezeLoaded] = useState(false);

  useEffect(() => {
    if (!live) return;
    if (canAnnounce) void getActiveAnnouncement().then((result) => { if (!result.error) setAnnouncement(result.data); });
    if (canFreeze) void getOperationalSettings().then((result) => { if (!result.error) { setSignupPaused(result.data.signupPaused); setFreezeLoaded(true); } });
  }, [live, canAnnounce, canFreeze]);

  const publish = useCallback(async () => {
    if (!announceMessage.trim()) return;
    setAnnounceBusy(true);
    setAnnounceStatus(null);
    const result = await publishAnnouncement(announceMessage.trim(), announceLinkUrl.trim(), announceLinkLabel.trim());
    setAnnounceBusy(false);
    if (result.error) { setAnnounceStatus(`Failed: ${result.error.message}`); return; }
    setAnnouncement({ id: result.data.id, message: announceMessage.trim(), link_url: announceLinkUrl.trim() || null, link_label: announceLinkLabel.trim() || null, is_active: true, created_at: new Date().toISOString() });
    setAnnounceMessage(''); setAnnounceLinkUrl(''); setAnnounceLinkLabel('');
    setAnnounceStatus('Published to the live site.');
  }, [announceMessage, announceLinkUrl, announceLinkLabel]);

  const takeDown = useCallback(async () => {
    if (!announcement) return;
    if (!confirm('Take down the current site announcement?')) return;
    setAnnounceBusy(true);
    const result = await deactivateAnnouncement(announcement.id);
    setAnnounceBusy(false);
    if (result.error) { setAnnounceStatus(`Failed: ${result.error.message}`); return; }
    setAnnouncement(null);
    setAnnounceStatus('Announcement taken down.');
  }, [announcement]);

  const toggleFreeze = useCallback(async () => {
    const next = !signupPaused;
    if (!confirm(next
      ? 'Pause all new account signups platform-wide? This affects the mobile app and website immediately.'
      : 'Resume new account signups platform-wide?')) return;
    setFreezeBusy(true);
    const result = await updateOperationalSettings({ signupPaused: next });
    setFreezeBusy(false);
    if (result.error) { alert(`Failed: ${result.error.message}`); return; }
    setSignupPaused(next);
  }, [signupPaused]);

  return <header className="topbar">
    <button className="menu-button material-symbols-outlined" type="button" onClick={onMenu} aria-label="Open navigation">menu</button>
    <div className="topbar-left"><EnvironmentBadge /><div className="search-shell" role="search"><label className="sr-only" htmlFor="admin-search">Search PaMarket administration</label><span className="material-symbols-outlined" aria-hidden="true">search</span><input id="admin-search" type="search" placeholder="Not yet available — use each workspace's own search" disabled title="No cross-entity global search backend exists yet. Use the search box on Users, Listings, Businesses, etc." /></div></div>
    <div className="topbar-meta">
      <div className={`assurance-badge ${auth.assuranceLevel === 'aal2' ? 'verified' : ''}`}><span className="material-symbols-outlined" aria-hidden="true">lock</span><span>{auth.assuranceLevel?.toUpperCase() ?? 'NO AAL'} · {auth.assuranceLevel === 'aal2' ? 'MFA VERIFIED' : 'SESSION'}</span></div>
      <div className="topbar-actions" style={{ position: 'relative' }}>
        <button type="button" disabled={!live || !canAnnounce} title={!canAnnounce ? 'Requires content.publish permission' : announcement ? `Live: "${announcement.message.slice(0, 60)}"` : 'No announcement currently live'} onClick={() => setAnnounceOpen((open) => !open)}><span className="material-symbols-outlined">campaign</span>{announcement ? 'Announce ●' : '+ Announce'}</button>
        {announceOpen && <div className="panel" role="dialog" aria-label="Site announcement" style={{ position: 'absolute', top: '110%', left: 0, width: 320, zIndex: 20, padding: 12 }}>
          <h3 style={{ marginBottom: 8 }}>Site announcement</h3>
          {announcement && <p style={{ marginBottom: 8 }}><small>Currently live: "{announcement.message}"</small></p>}
          <textarea placeholder="Announcement message" value={announceMessage} onChange={(e) => setAnnounceMessage(e.target.value)} style={{ width: '100%', minHeight: 60, marginBottom: 6 }} />
          <input placeholder="Link URL (optional)" value={announceLinkUrl} onChange={(e) => setAnnounceLinkUrl(e.target.value)} style={{ width: '100%', marginBottom: 6 }} />
          <input placeholder="Link label (optional)" value={announceLinkLabel} onChange={(e) => setAnnounceLinkLabel(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={announceBusy || !announceMessage.trim()} onClick={() => void publish()}>{announceBusy ? 'Publishing…' : 'Publish'}</button>
            {announcement && <button type="button" disabled={announceBusy} onClick={() => void takeDown()}>Take down live one</button>}
            <button type="button" onClick={() => setAnnounceOpen(false)}>Close</button>
          </div>
          {announceStatus && <p role="status" style={{ marginTop: 8 }}><small>{announceStatus}</small></p>}
        </div>}
        <button type="button" disabled title="Export requires per-workspace implementation — not yet available from the header"><span className="material-symbols-outlined">download</span>Export</button>
        <button type="button" className={`freeze ${signupPaused ? 'active' : ''}`} disabled={!live || !canFreeze || !freezeLoaded || freezeBusy} title={!canFreeze ? 'Requires settings.manage permission' : signupPaused ? 'New signups are currently PAUSED platform-wide — click to resume' : 'Pauses new account signups platform-wide (app_settings.signupPaused)'} onClick={() => void toggleFreeze()}><span className="material-symbols-outlined">lock_reset</span>{signupPaused ? 'Signups Paused' : 'Emergency Freeze'}</button>
      </div>
      <div className="operator"><span><strong>{admin?.name ?? 'Administrator'}</strong><small>{(admin?.role ?? 'unverified').replace('_', ' ').toUpperCase()}</small></span><span className="avatar" aria-hidden="true">{initials}</span><button type="button" className="signout material-symbols-outlined" aria-label="Sign out session" onClick={() => void auth.signOut()} disabled={auth.mode !== 'live'} title={auth.mode === 'live' ? 'Sign out session' : 'Sign-out is inactive in preview mode'}>power_settings_new</button></div>
    </div>
  </header>;
}
