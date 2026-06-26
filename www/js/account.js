/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;

  pages.Account = function () {
    const u = H.currentUser();
    if (!u) return H.guestAccountPage();
    return pages.AccountHub();
  };

  // ── Account Hub ───────────────────────────────────────────
  pages.AccountHub = function () {
    const u = H.currentUser();
    if (!u) {
      return `<div class="page active">
        <div class="acc-topbar"><div class="acc-topbar-title">Account</div><div></div></div>
        ${H.emptyState('Not signed in', 'Sign in to manage your account.', 'Sign In', 'H.authPage()')}
      </div>`;
    }

    const activeAds = (H.state.listings || []).filter(l => l.sellerId === u.id && l.status === 'active' && !l.businessId).length;
    const savedAds  = ((H.state.saves || {})[u.id] || []).length;
    if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
    const unread    = H.state.conversations.reduce((n, c) =>
      Array.isArray(c.members) && c.members.includes(u.id) ? n + (c.messages || []).filter(m => m.from !== u.id && !m.read).length : n, 0);
    const appCount  = (H.state.applications || []).filter(a => a.applicantId === u.id).length;

    const _chev = `<svg class="pinfo-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
    const row = (iconClass, iconSvg, label, page, fn, count) => `
      <div class="pinfo-row" onclick="${fn || `H.openInner('${page}')`}">
        <div class="pinfo-icon ${iconClass}">${iconSvg}</div>
        <div style="flex:1"><div class="pinfo-label">${label}</div></div>
        ${count ? `<span class="badge-count">${count}</span>` : ''}
        ${_chev}
      </div>`;

    // Business section
    const biz        = (H.state.businesses || []).filter(b => b.ownerUserId === u.id);
    const activeBiz  = biz.find(b => b.status === 'active');
    const pendingBiz = biz.find(b => b.status === 'pending_activation');
    const draftBiz   = biz.find(b => b.status === 'draft');
    let bizCard;
    if (activeBiz) {
      const logo = activeBiz.logo
        ? `<img src="${H.escHtml(activeBiz.logo)}" onerror="this.style.display='none';this.parentElement.innerHTML='${H.initials(activeBiz.name || '')}'">` : H.initials(activeBiz.name || '');
      const products = (H.state.listings || []).filter(l => l.businessId === activeBiz.id && l.status === 'active').length;
      bizCard = `<div class="biz-active-card" onclick="H._bizOnboard.openFromAccount()">
        <div class="biz-active-logo">${logo}</div>
        <div style="flex:1;min-width:0">
          <div class="biz-card-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${H.escHtml(activeBiz.name)}</div>
          <div class="biz-card-sub">${products} product${products === 1 ? '' : 's'} &middot; ${H.escHtml((activeBiz.planId || 'Free').charAt(0).toUpperCase() + (activeBiz.planId || 'Free').slice(1))} plan</div>
        </div>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#94A3B8" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`;
    } else {
      const bizTitle = pendingBiz ? 'Under Review' : (draftBiz ? 'Finish Business Setup' : 'Open a Business');
      const bizSub   = pendingBiz ? 'Submitted for review. You will be notified once approved.' : 'Create your shop and reach more customers';
      bizCard = `<div class="biz-card" onclick="H._bizOnboard.openFromAccount()">
        <div class="biz-card-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 9l2-5h14l2 5"/></svg>
        </div>
        <div style="flex:1"><div class="biz-card-title">${bizTitle}</div><div class="biz-card-sub">${bizSub}</div></div>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#94A3B8" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`;
    }

    const avatarHtml = u.avatar
      ? `<img src="${H.escHtml(u.avatar)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.parentElement.innerHTML='<div style=&quot;font-size:20px;font-weight:800;color:#fff&quot;>${H.initials(u.name || '')}</div>'">`
      : `<div style="font-size:20px;font-weight:800;color:#fff">${H.initials(u.name || '')}</div>`;

    return `<div class="page active">

      <div class="acc-topbar">
        <div class="acc-topbar-title">Account</div>
        <button class="acc-topbar-btn" onclick="H.openInner('Settings')" aria-label="Settings">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>

      <div class="acc-hero">
        <div class="acc-avatar">${avatarHtml}</div>
        <div style="flex:1;min-width:0">
          <div class="acc-name">${H.escHtml(u.name || 'User')}</div>
          <div class="acc-email">${H.escHtml(u.email || '')}</div>
          ${u.phone ? `<div class="acc-phone">${H.escHtml(u.phone)}</div>` : ''}
          ${u.verified
            ? `<div class="acc-badge"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>Verified</div>`
            : `<div class="acc-badge" style="background:#FEF3C7;color:#B45309">Unverified</div>`}
        </div>
      </div>

      <div class="acc-stats">
        <div class="acc-stat" onclick="H.openInner('MyListings')">
          <div class="acc-stat-val">${activeAds}</div>
          <div class="acc-stat-label">Active Ads</div>
        </div>
        <div class="acc-stat" onclick="H.openInner('Favorites')">
          <div class="acc-stat-val">${savedAds}</div>
          <div class="acc-stat-label">Saved</div>
        </div>
        <div class="acc-stat" onclick="H.navTo('Messages')">
          <div class="acc-stat-val">${unread || 0}</div>
          <div class="acc-stat-label">Messages</div>
        </div>
      </div>

      <div style="height:8px"></div>
      <div class="profile-section-label">My Business</div>
      ${bizCard}

      <div style="height:8px"></div>
      <div class="profile-section-label">Selling</div>
      <div class="pinfo-card">
        ${row('pi-blue','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>','My Listings','MyListings','',activeAds||'')}
        ${row('pi-red','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>','Saved &amp; Favorites','Favorites','',savedAds||'')}
        ${row('pi-gold','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>','Advertisements','Ads','','')}
      </div>

      <div style="height:8px"></div>
      <div class="profile-section-label">Jobs</div>
      <div class="pinfo-card">
        ${row('pi-purple','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>','My Applications','AppliedJobs','',appCount||'')}
        ${row('pi-teal','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>','My Job Profile / CV','JobSeekerProfile','','')}
      </div>

      <div style="height:8px"></div>
      <div class="profile-section-label">Account</div>
      <div class="pinfo-card">
        ${row('pi-blue','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>','My Profile','Profile','','')}
        ${row('pi-gray','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>','Edit Profile','EditProfile','','')}
        ${row('pi-gray','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>','My Activity','MyActivity','','')}
        ${H.isAdmin && H.isAdmin() ? row('pi-red','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>','Admin Panel','','H._bizAdmin.open()','') : ''}
      </div>

      <div style="height:8px"></div>
      <div class="profile-section-label">More</div>
      <div class="pinfo-card">
        ${row('pi-gray','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>','Settings','Settings','','')}
        ${row('pi-blue','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>','Security &amp; Password','SecuritySettings','','')}
        ${row('pi-green','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>','Help &amp; Support','Help','','')}
        ${row('pi-gray','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>','Legal Hub','LegalHub','','')}
        ${row('pi-gray','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>','About PaMarket','About','','')}
      </div>

      <div style="height:8px"></div>
      <button class="acc-signout" onclick="H.logout()">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Sign Out
      </button>

      <div class="acc-footer">
        &copy; ${new Date().getFullYear()} PaMarket &middot; Made in Zimbabwe
        <div class="acc-footer-links">
          <span onclick="H.openInner('LegalHub')">Legal Hub</span> &middot;
          <span onclick="H.openInner('HelpTerms')">Terms</span> &middot;
          <span onclick="H.openInner('HelpPrivacy')">Privacy</span>
        </div>
      </div>

    </div>`;
  };

  // Re-fetch the user's own businesses whenever the Account tab opens so that
  // an admin approval (pending_activation → active) is reflected immediately
  // without requiring a full app restart.
  pages.Account_after = async function () {
    if (typeof H.fetchMyBusinesses !== 'function') return;
    const before = (H.state.businesses || []).map(b => b.status).join(',');
    await H.fetchMyBusinesses();
    const after = (H.state.businesses || []).map(b => b.status).join(',');
    if (before !== after && H.currentPageName === 'Account') {
      H.renderPage('Account', H.currentPageParams);
    }
  };

})(window.H = window.H || {});
