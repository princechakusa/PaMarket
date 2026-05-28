'use strict';
(function (H) {
  const pages = H.pages;
  const state = H.state;
  const { currentUser, escHtml, timeAgo, uid, toast, modal,
          innerTopbar, emptyState, openInner, goBack, renderPage,
          saveState, fmtPrice, initials, renderListCard, navTo,
          pushNotif, CATEGORIES } = H;

  pages.Saved = function () {
    const u    = currentUser();
    const ids  = state.saves[u.id] || [];

    // Map each saved ID to either the listing object or null (deleted/not found)
    const resolved = ids.map(id => ({ id, listing: state.listings.find(l => l.id === id) || null }));

    // Helper: render a status pill for non-active listings
    function statusPillFor(listing) {
      if (!listing || listing.status === 'active') return '';
      if (listing.status === 'sold')
        return `<span style="display:inline-block;font-size:11px;font-weight:700;color:#fff;background:#ef4444;border-radius:20px;padding:2px 8px;margin-left:6px;vertical-align:middle">Sold</span>`;
      if (listing.status === 'expired')
        return `<span style="display:inline-block;font-size:11px;font-weight:700;color:#fff;background:#f59e0b;border-radius:20px;padding:2px 8px;margin-left:6px;vertical-align:middle">Expired</span>`;
      // inactive or any other status
      return `<span style="display:inline-block;font-size:11px;font-weight:700;color:#fff;background:#6b7280;border-radius:20px;padding:2px 8px;margin-left:6px;vertical-align:middle">Unavailable</span>`;
    }

    // Render a single saved entry
    function renderEntry({ id, listing }) {
      // Deleted listing — ghost card
      if (!listing) {
        return `<div style="padding:14px 16px;background:var(--card);border-radius:14px;margin:8px 16px;opacity:.5;border:1px dashed var(--border)">
  <div style="font-size:13px;color:var(--sub)">This listing is no longer available</div>
</div>`;
      }
      // Unavailable listing — greyed-out card with status pill injected
      const isUnavailable = listing.status !== 'active';
      const card = renderListCard(listing);
      if (!isUnavailable) return card;
      // Wrap with opacity and inject the status pill right after the card opens
      const pill = statusPillFor(listing);
      // Insert pill into the rendered card by appending it into the title line if possible,
      // otherwise wrap the whole card with a relative-positioned overlay container
      return `<div style="opacity:0.65;position:relative">${card}${
        pill ? `<div style="position:absolute;top:10px;left:10px;pointer-events:none">${pill}</div>` : ''
      }</div>`;
    }

    const hasAny = resolved.length > 0;

    return `<div class="page active">
      <div class="app-header" style="padding-bottom:16px">
        <div class="app-header-row">
          <div class="logo">Saved <em>Ads</em></div>
          <div style="font-size:12px;font-weight:600;color:rgba(255,255,255,.6);padding:4px 10px;background:rgba(255,255,255,.1);border-radius:20px">
            ${ids.length} saved
          </div>
        </div>
      </div>
      <div class="listing-list">
        ${hasAny
          ? resolved.map(renderEntry).join('')
          : emptyState('Nothing saved yet', 'Tap the ♡ on any listing to save it for later', 'Browse Listings', "H.navTo('Browse',document.querySelector('[data-nav=Browse]'))")}
      </div>
    </div>`;
  };

  pages.Profile = function () {
    const u         = currentUser();
    const myListings = (state.listings || []).filter(l => l.sellerId === u.id);
    const active    = myListings.filter(l => l.status === 'active').length;
    const saves     = (state.saves[u.id] || []).length;
    const txns      = (state.txns || []).filter(t => t.userId === u.id);

    return `<div class="page active">
      <div class="prof-top">
        <div class="prof-av">${u.avatar ? `<img src="${u.avatar}">` : initials(u.name)}</div>
        <div class="prof-name">${escHtml(u.name)}</div>
        <div class="prof-phone-display">${escHtml(u.phone)}</div>
        <div class="prof-badges">
          ${u.verified ? `<span class="pbadge pbadge-verified">
            <span class="blue-check" style="width:12px;height:12px;margin-right:2px">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </span>ID Verified</span>` : ''}
          ${u.role === 'admin' ? '<span class="pbadge pbadge-admin">Admin</span>' : ''}
        </div>
      </div>

      <div class="stats">
        <div class="stat"><div class="stat-n">${active}</div><div class="stat-l">Active Ads</div></div>
        <div class="stat"><div class="stat-n">${saves}</div><div class="stat-l">Saved</div></div>
      </div>

      <div class="menu-group-label">My Account</div>
      <div class="menu-items">
        <div class="mi" onclick="H.openInner('MyListings')">
          <div class="mi-icon blue-ic"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/></svg></div>
          <div class="mi-label">My Listings</div>
          <span class="mi-badge-green">${active}</span>
          <div class="mi-arrow">›</div>
        </div>
        <div class="mi" onclick="H.openInner('Ads')">
          <div class="mi-icon blue-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg></div>
          <div class="mi-label">Advertisements</div>
          <div class="mi-arrow">›</div>
        </div>
        <div class="mi" onclick="H.openInner('Verify')">
          <div class="mi-icon ${u.verified ? 'blue-ic' : 'green-ic'}">
            <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="mi-label">${u.verified ? 'Verified ✓' : 'Get Verified'}</div>
          ${!u.verified ? '<span style="font-size:11px;color:var(--o);font-weight:700">Boost trust</span>' : ''}
          <div class="mi-arrow">›</div>
        </div>
      </div>

      <div class="menu-group-label">Preferences</div>
      <div class="menu-items">
        <div class="mi" onclick="H.openInner('NotifSettings')">
          <div class="mi-icon"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
          <div class="mi-label">Notifications</div>
          <div class="mi-arrow">›</div>
        </div>
        <div class="mi" onclick="H.openInner('LanguageSettings')">
          <div class="mi-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
          <div class="mi-label">Language</div>
          <div class="mi-arrow">›</div>
        </div>
        <div class="mi" onclick="H.openInner('PrivacySettings')">
          <div class="mi-icon"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
          <div class="mi-label">Privacy Policy</div>
          <div class="mi-arrow">›</div>
        </div>
        <div class="mi" onclick="H.openInner('HelpTerms')">
          <div class="mi-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
          <div class="mi-label">Terms of Service</div>
          <div class="mi-arrow">›</div>
        </div>
        <div class="mi" onclick="H.openInner('About')">
          <div class="mi-icon green-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
          <div class="mi-label">About PaMarket</div>
          <div class="mi-arrow">›</div>
        </div>
        ${u.role === 'admin' ? `
        <div class="mi" onclick="H.navTo('Admin',null)">
          <div class="mi-icon amber-ic"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
          <div class="mi-label">Admin Panel</div>
          <div class="mi-arrow">›</div>
        </div>` : ''}
      </div>

      <div class="menu-group-label">Danger Zone</div>
      <div class="menu-items" style="padding-bottom:90px">
        <div class="mi" onclick="H.logOut()">
          <div class="mi-icon red-ic"><svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></div>
          <div class="mi-label red-lbl">Sign Out</div>
        </div>
        <div class="mi" onclick="H.openInner('DeleteAccount')">
          <div class="mi-icon red-ic"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></div>
          <div class="mi-label red-lbl">Delete Account</div>
        </div>
      </div>
    </div>`;
  };

  pages.MyListings = function () {
    const u    = currentUser();
    const list = (state.listings || []).filter(l => l.sellerId === u.id).sort((a, b) => b.createdAt - a.createdAt);
    const now  = Date.now();
    const TWENTY_FIVE_DAYS = 25 * 24 * 60 * 60 * 1000;
    const THIRTY_DAYS      = 30 * 24 * 60 * 60 * 1000;

    return `<div class="page active">${innerTopbar('My Listings')}
      <div style="padding-bottom:90px">
        ${list.length ? list.map(l => {
          const age = now - (l.createdAt || now);
          const isExpired     = age > THIRTY_DAYS;
          const isExpiringSoon = !isExpired && age > TWENTY_FIVE_DAYS;

          // Saves count: number of userIds who have this listing in their saves array
          const savesCount = Object.values(state.saves || {}).filter(arr => Array.isArray(arr) && arr.includes(l.id)).length;

          // Enquiries count: conversations referencing this listing
          const enquiriesCount = (state.conversations || []).filter(conv => conv.listingId === l.id).length;

          // Status pill / expiry logic
          let statusPill;
          if (isExpired) {
            statusPill = `<span class="status-pill status-banned">Expired</span>`;
          } else {
            const statusClass = l.status === 'active' ? 'status-active' : l.status === 'banned' ? 'status-banned' : 'status-pending';
            statusPill = `<span class="status-pill ${statusClass}">${l.status}</span>`;
          }

          const expiryWarning = isExpiringSoon
            ? `<span style="font-size:11px;font-weight:700;color:#b45309;background:#fef3c7;border-radius:8px;padding:1px 7px;margin-left:4px">Expiring soon</span>`
            : '';

          const renewBtn = (isExpired || isExpiringSoon)
            ? `<button class="ml-act-btn" onclick="(function(){var l=H.state.listings.find(function(x){return x.id==='${l.id}';});if(l){l.createdAt=Date.now();if(l.status==='expired')l.status='active';H.saveState();H.openInner('MyListings');}})()">Renew</button>`
            : '';

          return `<div class="my-listing-card">
            <div class="ml-thumb">
              ${l.photos && l.photos[0] ? `<img src="${l.photos[0]}">` : ((CATEGORIES.find(c => c.id === l.cat) || {}).icon || '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#ccc"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>')}
            </div>
            <div class="ml-body">
              <div class="ml-title">${escHtml(l.title)}</div>
              <div class="ml-price">${escHtml(fmtPrice(l.price, l.currency))}</div>
              <div class="ml-meta">
                ${statusPill}${expiryWarning}
                <span style="color:var(--sub)"> · ${l.views || 0} views · ${timeAgo(l.createdAt)}</span>
              </div>
              <div style="display:inline-flex;gap:10px;align-items:center;font-size:11px;color:var(--sub);margin-top:4px;flex-wrap:wrap">
                <span>&#128065; ${l.views || 0} views</span>
                <span>&#9825; ${savesCount} saves</span>
                <span>&#128172; ${enquiriesCount} enquiries</span>
              </div>
              <div class="ml-actions">
                <button class="ml-act-btn" onclick="H.openListing('${l.id}')">View</button>
                ${renewBtn}
                ${!isExpired && l.status === 'active'
                  ? `<button class="ml-act-btn red" onclick="H.deleteListing('${l.id}')">Delete</button>`
                  : ''}
              </div>
            </div>
          </div>`;
        }).join('') : emptyState('No listings yet', 'Your posted ads will appear here.', 'Post an Ad', "H.navTo('Post',null)")}
      </div>
    </div>`;
  };

  H.logOut = function () {
    H.logout();
  };

})(window.H);
