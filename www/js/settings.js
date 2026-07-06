'use strict';
(function (H) {
  const pages = H.pages;
  const I = {
    palette: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    bell:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    lock:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    globe:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none"/></svg>',
    ban:    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    sun:    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    moon:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    settings:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    phone:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z"/></svg>',
    key:    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
    eye:    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    message:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    heart:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    clock:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    check:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    star:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    alert:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    list:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    smartphone:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
    trash:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>'
  };

  // White sub-page topbar with back button (reused across all sub-pages)
  const _st = (title) => `<div class="profile-topbar">
    <button class="profile-topbar-back" onclick="H.goBack()" aria-label="Go back">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <div class="profile-topbar-title">${H.escHtml(title)}</div>
    <div style="width:44px"></div>
  </div>`;

  const _chevron = `<div class="pinfo-chevron"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>`;

  // --- Settings Page ----------------------------------------
  pages.Settings = function () {
    const u = H.currentUser();
    const cur = u && u.settings && u.settings.theme;
    const themeLabel = cur ? cur.charAt(0).toUpperCase() + cur.slice(1) : 'Light';
    const dataLight = u && u.privacySettings && u.privacySettings.dataLight;
    const showZig   = u && u.privacySettings && u.privacySettings.showZig;
    const fxRate    = Number((H.state && H.state.fxRate) || 36).toLocaleString();
    const fxSub     = (H.state && H.state.fxRateUpdatedAt)
      ? 'Updated ' + new Date(H.state.fxRateUpdatedAt).toLocaleDateString() : 'Set by PaMarket';

    const avatarHtml = u && u.avatar
      ? `<img src="${H.escHtml(u.avatar)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.parentElement.innerHTML=H.initials(H.escHtml('${(u.name||'').replace(/'/g,"\\'")}'))">`
      : (u ? H.initials(u.name) : '?');

    const verifiedBadge = u && u.verified
      ? `<div class="settings-user-badge"><svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Verified</div>` : '';

    return `<div class="page active">
      ${_st('Settings')}

      <div style="height:8px"></div>
      ${u ? `<div class="settings-user-card" onclick="H.openInner('Profile')">
        <div class="settings-user-avatar">${avatarHtml}</div>
        <div style="flex:1">
          <div class="settings-user-name">${H.escHtml(u.name || 'User')}</div>
          <div class="settings-user-email">${H.escHtml(u.email || '')}</div>
          ${verifiedBadge}
        </div>
        ${_chevron}
      </div>` : ''}

      <div class="profile-section-label">Appearance</div>
      <div class="pinfo-card">
        <div class="pinfo-row" style="cursor:pointer" onclick="H.openInner('ThemeSettings')">
          <div class="pinfo-icon pi-blue"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label">Theme</div></div>
          <span class="pinfo-value">${themeLabel}</span>
          ${_chevron}
        </div>
      </div>

      <div class="profile-section-label">Notifications</div>
      <div class="pinfo-card">
        <div class="pinfo-row" style="cursor:pointer" onclick="H.openInner('NotifSettings')">
          <div class="pinfo-icon pi-gold"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label">Notification Preferences</div></div>
          ${_chevron}
        </div>
      </div>

      <div class="profile-section-label">Display &amp; Data</div>
      <div class="pinfo-card">
        <div class="pinfo-row">
          <div class="pinfo-icon pi-gray"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label">Data-light Mode</div><div class="pinfo-value">Load fewer photos to save data</div></div>
          <label class="toggle-switch"><input type="checkbox" ${dataLight ? 'checked' : ''} onchange="H.togglePref('dataLight', this.checked)"><span class="toggle-slider"></span></label>
        </div>
        <div class="pinfo-row">
          <div class="pinfo-icon pi-green"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label">Show Approx. ZiG Value</div><div class="pinfo-value">Estimated ZiG next to USD prices</div></div>
          <label class="toggle-switch"><input type="checkbox" ${showZig ? 'checked' : ''} onchange="H.togglePref('showZig', this.checked)"><span class="toggle-slider"></span></label>
        </div>
        <div class="pinfo-row" style="cursor:default">
          <div class="pinfo-icon pi-green"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label">ZiG Exchange Rate</div><div class="pinfo-value">${fxSub}</div></div>
          <span style="font-size:13px;font-weight:800;color:var(--text-primary)">1 USD = ${fxRate} ZiG</span>
        </div>
      </div>

      <div class="profile-section-label">Account &amp; Privacy</div>
      <div class="pinfo-card">
        <div class="pinfo-row" style="cursor:pointer" onclick="H.openInner('PrivacySettings')">
          <div class="pinfo-icon pi-blue"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label">Privacy Settings</div></div>
          ${_chevron}
        </div>
        <div class="pinfo-row" style="cursor:pointer" onclick="H.openInner('SecuritySettings')">
          <div class="pinfo-icon pi-blue"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label">Security</div></div>
          ${_chevron}
        </div>
        <div class="pinfo-row" style="cursor:pointer" onclick="H.openInner('LanguageSettings')">
          <div class="pinfo-icon pi-gray"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label">Language</div></div>
          <span class="pinfo-value">${H.escHtml(u && u.language || 'English')}</span>
          ${_chevron}
        </div>
      </div>

      <div class="profile-section-label">Actions</div>
      <div class="pinfo-card">
        <div class="pinfo-row" style="cursor:pointer" onclick="H.openInner('BlockedUsers')">
          <div class="pinfo-icon pi-red"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label">Blocked Users</div></div>
          ${_chevron}
        </div>
      </div>

      <div class="profile-section-label">Legal</div>
      <div class="pinfo-card">
        <div class="pinfo-row" style="cursor:pointer" onclick="H.openInner('LegalHub')">
          <div class="pinfo-icon pi-gray"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label">Legal Hub</div></div>
          ${_chevron}
        </div>
        <div class="pinfo-row" style="cursor:pointer" onclick="H.openInner('About')">
          <div class="pinfo-icon pi-gray"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label">About PaMarket</div></div>
          <span class="pinfo-value">v1.8.0</span>
          ${_chevron}
        </div>
      </div>

      ${u ? `<button class="settings-signout" onclick="H.logout()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Sign Out
      </button>` : ''}

      <div style="height:16px"></div>
    </div>`;
  };

  // Global preference handlers (used by the main Settings page) so Data-light and
  // approximate-ZiG are reachable without digging into Privacy Settings.
  H.togglePref = function (key, val) {
    const u = H.currentUser(); if (!u) return;
    if (!u.privacySettings) u.privacySettings = {};
    u.privacySettings[key] = !!val;
    H.saveState();
    const MSG = {
      dataLight: { on: 'Data-light mode on — photos load as icons', off: 'Data-light mode off' },
      showZig:   { on: 'Showing approximate ZiG values',           off: 'ZiG values hidden' }
    };
    if (MSG[key]) H.toast(val ? MSG[key].on : MSG[key].off);
    if (window.supabase && typeof window.supabase.from === 'function') {
      window.supabase.from('profiles').update({ privacy: u.privacySettings }).eq('id', u.id).then(function () {}, function () {});
    }
  };
  H.setFxRate = function (val) {
    const r = parseFloat(val);
    if (!r || r <= 0) { H.toast('Enter a valid rate'); return; }
    H.state.fxRate = r; H.saveState();
    H.toast('ZiG rate updated — used for approximate values');
  };

  // --- Theme Settings ---------------------------------------
  pages.ThemeSettings = function () {
    const u = H.currentUser();
    const cur = (u && u.settings && u.settings.theme) || 'light';
    const row = (id, name, desc, bgStyle, iconSvg) =>
      `<div class="theme-option-row" onclick="H._themeSettings.setTheme('${id}')">
        <div class="theme-radio ${cur === id ? 'on' : ''}"></div>
        <div class="theme-preview" style="${bgStyle}">${iconSvg}</div>
        <div>
          <div class="theme-option-name">${name}</div>
          <div class="theme-option-desc">${desc}</div>
        </div>
      </div>`;
    return `<div class="page active">
      ${_st('Theme')}
      <div style="height:8px"></div>
      <div class="pinfo-card">
        ${row('light', 'Light', 'White background, navy text', 'background:#FAFAFA',
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#F5A623" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>')}
        ${row('dark', 'Dark', 'Dark background, soft text', 'background:#0A0A0B;border-color:#242427',
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#7AA0F0" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>')}
        ${row('system', 'System Default', 'Follows your device setting', '',
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#475569" stroke-width="2"><circle cx="12" cy="12" r="3"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>')}
      </div>
      <div style="height:16px"></div>
    </div>`;
  };

  pages.ThemeSettings_after = function () {
    H._themeSettings = {
      setTheme: (theme) => {
        const u = H.currentUser();
        if (!u.settings) u.settings = {};
        u.settings.theme = theme;
        H.applyTheme();
        H.saveState();
        H.toast('Theme updated');
      }
    };
  };

  // --- Notification Settings --------------------------------
  pages.NotificationSettings = function () {
    const u = H.currentUser();
    const DEFS = { messages: true, listings: true, approvals: true, promotions: true, favorites: true, priceDrops: true, security: true };
    const prefs = Object.assign({}, DEFS, (u && u.notificationPrefs) || {});

    const row = (key, ic, icClass, label, sub, locked) =>
      `<div class="pinfo-row">
        <div class="pinfo-icon ${icClass}">${ic}</div>
        <div class="pinfo-content"><div class="pinfo-label">${label}</div>${sub ? `<div class="pinfo-value">${sub}</div>` : ''}</div>
        <label class="toggle-switch"${locked ? ' style="opacity:.5;pointer-events:none"' : ''}>
          <input type="checkbox" ${prefs[key] ? 'checked' : ''}${locked ? ' disabled' : ` onchange="H._notifSettings.toggle('${key}')"`}>
          <span class="toggle-slider"></span>
        </label>
      </div>`;

    return `<div class="page active">
      ${_st('Notifications')}
      <div style="height:8px"></div>
      <div class="profile-section-label">Alerts</div>
      <div class="pinfo-card">
        ${row('messages',  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', 'pi-blue', 'Messages', '')}
        ${row('listings',  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>', 'pi-gray', 'Listing Updates', '')}
        ${row('approvals', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>', 'pi-green', 'Approval Status', '')}
        ${row('promotions','<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>', 'pi-gold', 'Promotions &amp; Boosts', '')}
        ${row('favorites', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>', 'pi-red', 'Saves on My Listings', '')}
        ${row('priceDrops','<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>', 'pi-purple', 'Price Drop Alerts', '')}
        ${row('security',  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>', 'pi-blue', 'Security Alerts', 'Login attempts &amp; suspicious activity', true)}
      </div>
      <div style="padding:0 16px 16px;font-size:12px;color:var(--text-sub);line-height:1.6">Security Alerts cannot be disabled — they protect your account.</div>
    </div>`;
  };

  pages.NotificationSettings_after = function () {
    const DEFAULTS = { messages: true, listings: true, approvals: true, promotions: true, favorites: true, priceDrops: true, security: true };
    H._notifSettings = {
      toggle: (key) => {
        const u = H.currentUser();
        if (!u.notificationPrefs) u.notificationPrefs = Object.assign({}, DEFAULTS);
        // Seed with default if key was never explicitly set
        if (!(key in u.notificationPrefs)) u.notificationPrefs[key] = DEFAULTS[key] !== false;
        u.notificationPrefs[key] = !u.notificationPrefs[key];
        H.saveState();
        H.toast(u.notificationPrefs[key] ? 'Enabled' : 'Disabled');
      }
    };
  };

  // --- Privacy Settings --------------------------------------
  pages.PrivacySettings = function () {
    const u = H.currentUser();
    const defaults = { profilePublic: true, showPhoneInListings: false, allowMessages: true, showActivity: false };
    const privacy = Object.assign({}, defaults, (u && u.privacySettings) || {});

    const row = (key, ic, icClass, label, sub) =>
      `<div class="pinfo-row">
        <div class="pinfo-icon ${icClass}">${ic}</div>
        <div class="pinfo-content"><div class="pinfo-label">${label}</div><div class="pinfo-value">${sub}</div></div>
        <label class="toggle-switch">
          <input type="checkbox" ${privacy[key] ? 'checked' : ''} onchange="H._privacySettings.toggle('${key}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>`;

    return `<div class="page active">
      ${_st('Privacy Settings')}
      <div style="height:8px"></div>
      <div class="profile-section-label">Profile</div>
      <div class="pinfo-card">
        ${row('profilePublic',       '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',         'pi-blue', 'Public Profile',         'Others can view your profile')}
        ${row('showPhoneInListings', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z"/></svg>', 'pi-gray', 'Show Phone in Listings', 'Buyers see your phone number')}
        ${row('allowMessages',       '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',   'pi-blue', 'Allow Direct Messages',  'Others can message you directly')}
        ${row('showActivity',        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',                         'pi-gray', 'Show Activity Status',   'Others see when you are online')}
      </div>
      <div style="padding:0 16px 16px;font-size:12px;color:var(--text-sub);line-height:1.6">Changes apply immediately. Other users see the updated visibility on their next visit to your profile.</div>
    </div>`;
  };

  pages.PrivacySettings_after = function () {
    const DEFAULTS = { profilePublic: true, showPhoneInListings: false, allowMessages: true, showActivity: false };
    const LABELS = {
      profilePublic:       { on: 'Profile is now public',              off: 'Profile is now private' },
      showPhoneInListings: { on: 'Phone number visible in listings',    off: 'Phone number hidden from listings' },
      allowMessages:       { on: 'Direct messages allowed',            off: 'Direct messages are blocked' },
      showActivity:        { on: 'Activity status is visible',         off: 'Activity status is hidden' }
    };

    H._privacySettings = {
      toggle: function(key, newValue) {
        const u = H.currentUser();
        if (!u) return;
        // Always initialise with full defaults so no key goes missing
        if (!u.privacySettings) u.privacySettings = Object.assign({}, DEFAULTS);
        // Use the checkbox's actual checked state — avoids !undefined mismatch on first toggle
        u.privacySettings[key] = !!newValue;
        H.saveState();

        // Feedback
        const label = LABELS[key];
        if (label) H.toast(newValue ? label.on : label.off);

        // Apply visible effects immediately
        if (key === 'showPhoneInListings') {
          // Update own listings in state so detail pages reflect the change
          const uid = u.id;
          (H.state.listings || []).forEach(function(l) {
            if (l.sellerId === uid) {
              l._hidePhone = !newValue;
            }
          });
          H.saveState();
        }

        // Persist to Supabase profiles table so other devices pick it up
        if (window.supabase && typeof window.supabase.from === 'function') {
          window.supabase.from('profiles')
            .update({ privacy: u.privacySettings })
            .eq('id', u.id)
            .then(function() {})
            .catch(function() {});
        }
      },
      setRate: function(val) {
        const r = parseFloat(val);
        if (!r || r <= 0) { H.toast('Enter a valid rate'); return; }
        H.state.fxRate = r;
        H.saveState();
        H.toast('Rate updated — used for approximate ZiG values');
      }
    };
  };

  // --- Security Settings ------------------------------------
  pages.SecuritySettings = function () {
    return `<div class="page active">
      ${_st('Security')}
      <div style="height:8px"></div>
      <div class="profile-section-label">Account Security</div>
      <div class="pinfo-card">
        <div class="pinfo-row" style="cursor:pointer" onclick="H.openInner('ChangePassword')">
          <div class="pinfo-icon pi-blue"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label">Change Password</div></div>
          ${_chevron}
        </div>
        <div class="pinfo-row" style="cursor:pointer" onclick="H.openInner('TwoFactor')">
          <div class="pinfo-icon pi-blue"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label">Two-Factor Authentication</div><div class="pinfo-value" style="color:#B45309">Not enabled</div></div>
          ${_chevron}
        </div>
        <div class="pinfo-row" style="cursor:pointer" onclick="H.openInner('ActiveSessions')">
          <div class="pinfo-icon pi-gray"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label">Active Sessions</div></div>
          ${_chevron}
        </div>
      </div>
      <div class="profile-section-label" style="color:#DC2626">Danger</div>
      <div class="pinfo-card">
        <div class="pinfo-row" style="cursor:pointer" onclick="H.openInner('DeleteAccount')">
          <div class="pinfo-icon pi-red"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div class="pinfo-content"><div class="pinfo-label" style="color:#DC2626">Delete Account</div></div>
          ${_chevron}
        </div>
      </div>
      <div style="height:16px"></div>
    </div>`;
  };

  // --- Language Settings ------------------------------------
  pages.LanguageSettings = function () {
    const current = H.getLanguage ? H.getLanguage() : ((H.currentUser() && H.currentUser().language) || H.state.language || 'English');
    return `<div class="page active">
      ${_st('Language')}
      <div style="height:8px"></div>
      <div class="pinfo-card">
        <div class="theme-option-row" onclick="H.setLanguage && H.setLanguage('English')">
          <div class="theme-radio ${current === 'English' ? 'on' : ''}"></div>
          <div class="pinfo-content">
            <div class="pinfo-label">English</div>
            <div class="pinfo-value">App display language</div>
          </div>
          ${current === 'English' ? '<svg viewBox="0 0 24 24" fill="none" stroke="#1A3A8F" stroke-width="2.5" width="20" height="20"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>
      </div>
      <div style="padding:0 16px 16px;font-size:12px;color:var(--text-sub);line-height:1.6">PaMarket uses English for all app screens and account communication.</div>
      <div style="height:16px"></div>
    </div>`;
  };

  pages.LanguageSettings_after = function () {};

  // --- Blocked Users ----------------------------------------
  // Blocks are enforced server-side (blocked_users table + RLS + a
  // check_message_block trigger — see add_blocked_users.sql); H._blockedIds
  // is only a client cache of that table, refreshed by BlockedUsers_after.
  pages.BlockedUsers = function () {
    const u = H.currentUser();
    if (!u) return H.requireAuth('Sign in to view blocked users');
    const blocked = H._blockedIds ? [...H._blockedIds] : [];

    return `<div class="page active">
      ${H.innerTopbar('Blocked Users')}
      <div class="form-wrap">
        ${blocked.length
          ? blocked.map(userId => {
              const user = H.state.users.find(us => us.id === userId);
              return `
                <div class="blocked-user-item">
                  <div class="user-info">
                    <div class="user-name">${user ? H.escHtml(user.name) : 'Unknown User'}</div>
                    <div class="user-detail">${user ? H.escHtml(user.phone) : 'N/A'}</div>
                  </div>
                  <button class="btn-unblock" onclick="H._blockedUsers.unblock('${userId}')">Unblock</button>
                </div>
              `;
            }).join('')
          : H.emptyState('No blocked users', 'Users you block won\'t be able to contact you')}
      </div>
    </div>`;
  };

  pages.BlockedUsers_after = function () {
    if (typeof H.ensureBlockedIds === 'function') {
      H.ensureBlockedIds(true).then(function(){ if (H.currentPageName === 'BlockedUsers') H.renderPage('BlockedUsers'); }).catch(function(){});
    }
    H._blockedUsers = {
      unblock: async (userId) => {
        const u = H.currentUser();
        const sb = window.supabase;
        if (!u || !sb) return;
        try {
          const r = await sb.from('blocked_users').delete().eq('blocker_id', u.id).eq('blocked_id', userId);
          if (r.error) throw new Error(r.error.message);
          if (H._blockedIds) H._blockedIds.delete(userId);
          H.toast('User unblocked');
          H.openInner('BlockedUsers');
        } catch (e) {
          console.warn('unblock:', e.message);
          H.toast('Could not unblock. Try again.', 3000, true);
        }
      }
    };
  };

  pages.MyActivity = function () {
    const u = H.currentUser();
    if (!u) return H.requireAuth('Login to view your activity');

    const searches = (u.recentSearches || []);
    const rvIds    = JSON.parse(localStorage.getItem('pamarket_rv') || '[]');
    const viewed   = rvIds.map(id => (H.state.listings || []).find(l => l.id === id)).filter(Boolean);

    const sectionLabel = (text) =>
      `<div style="padding:16px 16px 8px;font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.06em">${text}</div>`;

    const emptyCard = (msg) =>
      `<div style="margin:0 16px 8px;background:var(--card);border-radius:14px;padding:32px 16px;text-align:center">
         <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--sub)" stroke-width="1.5" style="opacity:.5;margin-bottom:10px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
         <div style="font-size:14px;color:var(--sub)">${msg}</div>
       </div>`;

    const searchSection = searches.length
      ? `${sectionLabel('Recent Searches')}
         <div style="margin:0 16px 4px;background:var(--card);border-radius:14px;overflow:hidden">
           ${searches.map((q, i) => `
             <div style="display:flex;align-items:center;gap:12px;padding:13px 16px;${i ? 'border-top:1px solid var(--border)' : ''};cursor:pointer"
                  onclick="H.navTo('Browse');setTimeout(()=>{var el=document.getElementById('searchInput');if(el){el.value=${JSON.stringify(q)};el.dispatchEvent(new Event('input'));}},220)">
               <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--sub)" stroke-width="2" style="flex-shrink:0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
               <span style="flex:1;font-size:14px;color:var(--text)">${H.escHtml(q)}</span>
               <button onclick="event.stopPropagation();var u=H.currentUser();u.recentSearches=(u.recentSearches||[]).filter(s=>s!==${JSON.stringify(q)});H.saveState();H.renderPage('MyActivity')"
                       style="background:none;border:none;color:var(--sub);font-size:20px;padding:0 2px;line-height:1;cursor:pointer">&times;</button>
             </div>`).join('')}
         </div>
         <div style="padding:4px 16px 8px;text-align:right">
           <button onclick="var u=H.currentUser();u.recentSearches=[];H.saveState();H.renderPage('MyActivity')"
                   style="background:none;border:none;font-size:12px;color:#EF4444;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;padding:4px 0">
             Clear all
           </button>
         </div>`
      : `${sectionLabel('Recent Searches')}${emptyCard('No recent searches yet')}`;

    const viewedSection = viewed.length
      ? `${sectionLabel('Recently Viewed')}
         <div style="padding:0 16px 8px;display:flex;flex-direction:column;gap:10px">
           ${viewed.map(l => H.renderListCard(l)).join('')}
         </div>`
      : `${sectionLabel('Recently Viewed')}${emptyCard('No recently viewed listings')}`;

    return `<div class="page active">
      ${H.innerTopbar('My Activity')}
      <div style="padding-top:8px;padding-bottom:32px">
        ${searchSection}
        <div style="margin-top:12px"></div>
        ${viewedSection}
      </div>
    </div>`;
  };

  // Some recently-viewed listings may not be in the local feed cache (older,
  // no longer active, or pruned). Fetch the missing ones by id so "Recently
  // Viewed" shows the full history instead of silently dropping them.
  pages.MyActivity_after = function () {
    if (!H.currentUser()) return;
    let rvIds = [];
    try { rvIds = JSON.parse(localStorage.getItem('pamarket_rv') || '[]'); } catch (e) {}
    const missing = rvIds.filter(id => !(H.state.listings || []).some(l => l.id === id));
    if (!missing.length || typeof H._fetchListingById !== 'function') return;
    Promise.all(missing.map(id => H._fetchListingById(id).catch(() => null))).then(results => {
      if (H.currentPageName !== 'MyActivity') return;
      if (results.some(Boolean)) H.renderPage('MyActivity', H.currentPageParams);
    });
  };

})(window.H = window.H || {});
