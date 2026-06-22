/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const { escHtml, timeAgo, filterListings, renderListCard, renderFeatCard, CATEGORIES, ICONS } = H;

  let searchTimer;
  function debounce(fn, delay) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(fn, delay);
  }

  const CAT_COLORS = {
    vehicles:'#e53935',property:'#1E88E5',electronics:'#8E24AA',
    fashion:'#F06292',furniture:'#6D4C41',services:'#00897B',
    jobs:'#F5A623',rooms:'#00838F',other:'#546E7A',
    agriculture:'#558B2F',pets:'#FB8C00',kids:'#E91E63',
  };

  function renderHCard(l) {
    const photo = (l.photos && l.photos[0]) || '';
    const price = l.price ? ('$' + Number(l.price).toLocaleString()) : 'Free';
    const title = escHtml((l.title || '').slice(0, 36));
    const loc   = escHtml(l.suburb || l.city || l.prov || '');
    return `<div onclick="openListing('${l.id}')" style="background:var(--card);border-radius:12px;overflow:hidden;border:1px solid var(--border);cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,0.07)">
      <div style="aspect-ratio:4/3;overflow:hidden;background:#f0f0f0;position:relative">
        ${photo
          ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.onerror=null;this.style.display='none'">`
          : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#ccc"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>'}
        ${l.negotiable ? '<span style="position:absolute;top:6px;right:6px;background:#F5A623;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:6px">NEG</span>' : ''}
      </div>
      <div style="padding:8px 10px 11px">
        <div style="font-size:14px;font-weight:800;color:#1A3A8F;margin-bottom:2px">${price}</div>
        <div style="font-size:12px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px">${title}</div>
        <div style="font-size:11px;color:var(--sub)">${loc}</div>
      </div>
    </div>`;
  }

  H.pages.Home = function () {
    const u = H.currentUser();
    const unreadNotifs = u ? (H.state.notifs[u.id] || []).filter(n => !n.read).length : 0;
    if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
    const unreadMsgs   = u ? H.state.conversations.filter(cv =>
      Array.isArray(cv.members) && cv.members.includes(u.id) && (cv.messages || []).some(m => m.from !== u.id && !m.read)).length : 0;
    const activeListings = (H.state.listings || []).filter(l => l.status === 'active');
    const filtered       = filterListings(activeListings);

    const catSections = CATEGORIES.map(c => ({
      ...c, items: filtered.filter(l => l.cat === c.id).slice(0, 8)
    })).filter(s => s.items.length > 0);

    return `<div class="page active" style="background:var(--bg)">

      <!-- HEADER -->
      <div style="background:#1A3A8F;padding-bottom:16px;position:sticky;top:0;z-index:100;box-shadow:0 2px 12px rgba(26,58,143,0.3)">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 0">
          <div onclick="H.logoTap&&H.logoTap()" style="cursor:pointer">
            <span style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-1px;font-family:Inter,sans-serif">Pa<em style="font-style:normal;color:#F5A623">Market</em></span>
          </div>
          <div style="display:flex;gap:6px">
            <div onclick="H.openInner('Notifications')"
              style="position:relative;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span data-notif-badge style="position:absolute;top:4px;right:4px;background:#F5A623;color:#1A3A8F;border-radius:50%;min-width:16px;height:16px;font-size:9px;font-weight:900;display:${unreadNotifs ? 'flex' : 'none'};align-items:center;justify-content:center;padding:0 2px">${unreadNotifs > 9 ? '9+' : unreadNotifs}</span>
            </div>
            <div onclick="H.currentUser()?H.openInner('Messages'):H.requireAuth('Sign in to view messages')"
              style="position:relative;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ${unreadMsgs ? `<span style="position:absolute;top:4px;right:4px;background:#F5A623;color:#1A3A8F;border-radius:50%;min-width:16px;height:16px;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;padding:0 2px">${unreadMsgs > 9 ? '9+' : unreadMsgs}</span>` : ''}
            </div>
          </div>
        </div>

        <div onclick="H.toggleCityPicker()" style="display:inline-flex;align-items:center;gap:5px;padding:8px 16px 10px;cursor:pointer">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span style="font-size:13px;color:rgba(255,255,255,0.9);font-weight:600">${escHtml(H.state.cityFilter)}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        <div style="margin:0 16px;background:#fff;border-radius:14px;display:flex;align-items:center;padding:0 12px;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.18)">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#999" stroke-width="2.5" style="flex-shrink:0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input id="searchIn" placeholder="Search cars, houses, jobs..."
            oninput="H.onSearch()" autocomplete="off"
            style="flex:1;border:none;outline:none;padding:14px 0;font-size:15px;font-family:Inter,sans-serif;color:#222;background:transparent">
          <button onclick="document.getElementById('searchIn').value='';H.onSearch()"
            style="background:none;border:none;padding:6px;cursor:pointer;color:#ccc;display:flex;align-items:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- CITY PICKER -->
      <div class="city-picker" id="cityPicker" role="dialog">
        <div class="city-picker-title">Select your city</div>
        <div class="city-grid">
          <div class="city-opt ${H.state.cityFilter === 'All Zimbabwe' ? 'sel' : ''}" onclick="H.pickCity('All Zimbabwe')">All Zimbabwe</div>
          ${['Harare','Bulawayo','Mutare','Gweru','Masvingo','Chinhoyi','Kwekwe','Kadoma'].map(c =>
            `<div class="city-opt ${H.state.cityFilter === c ? 'sel' : ''}" onclick="H.pickCity('${c}')">${c}</div>`
          ).join('')}
        </div>
      </div>

      <div style="padding-bottom:88px">

        <div id="notifEnableBanner"></div>

        <!-- CATEGORIES GRID -->
        <div style="background:var(--card);padding:18px 16px 20px;margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <span style="font-size:15px;font-weight:800;color:var(--text)">Browse Categories</span>
            <span onclick="H.navTo('Browse',null)" style="font-size:13px;font-weight:600;color:#1A3A8F;cursor:pointer">See all</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
            ${CATEGORIES.map(c => {
              const color = CAT_COLORS[c.id] || '#546E7A';
              return `<div onclick="H.filterByCat('${c.id}')" style="display:flex;flex-direction:column;align-items:center;gap:7px;cursor:pointer">
                <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,${color}22,${color}0f);color:${color};display:flex;align-items:center;justify-content:center;border:1.5px solid ${color}22;box-shadow:0 4px 10px -4px ${color}55;transition:transform 0.15s"
                  onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform=''" ontouchstart="this.style.transform='scale(0.9)'" ontouchend="this.style.transform=''">${c.icon}</div>
                <span style="font-size:11px;font-weight:600;color:var(--text);text-align:center;line-height:1.2">${c.name}</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- SPONSORED — swipeable banner carousel (all active ads), right under categories -->
        ${(H.adCarousel && H.activeAds) ? H.adCarousel(H.activeAds(), { title: 'Featured Partners' }) : ''}

        <!-- LOCAL SHOPS — 3-column grid, logo left + thumbnails right -->
        ${(() => {
          const activeShops = (H.state.businesses || []).filter(function(b) { return b.status === 'active'; });
          if (!activeShops.length) return '';
          const cards = activeShops.slice(0, 12).map(function(b) {
            const ini = H.initials ? H.initials(b.name || 'Shop') : (b.name || 'S').charAt(0).toUpperCase();
            const bProds = (H.state.listings || []).filter(function(l) {
              return l.status === 'active' && (String(l.sellerId) === String(b.ownerUserId) || String(l.businessId) === String(b.id));
            });
            const lCount = bProds.length;
            const catName = (H.CATEGORIES && H.CATEGORIES.find(function(c){ return c.id === b.category; }) || {}).name || '';
            const niche = catName || 'Local Shop';
            const featuredIds = b.featuredListingIds || [];
            const featuredProds = featuredIds.length
              ? featuredIds.map(function(id){ return bProds.find(function(l){ return l.id === id; }); }).filter(Boolean)
              : [];
            const thumbProds = (featuredProds.length ? featuredProds : bProds.filter(function(l){ return l.photos && l.photos[0]; })).slice(0, 2);
            const logoHtml = b.logo
              ? '<img src="' + escHtml(b.logo) + '" style="width:100%;height:100%;object-fit:cover">'
              : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-6h15L21 9M3 9h18v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9zm6 0v2a3 3 0 006 0V9"/></svg>';
            var thumbsHtml = '';
            for (var ti = 0; ti < 2; ti++) {
              if (thumbProds[ti]) {
                thumbsHtml += '<div style="flex:1;border-radius:5px;overflow:hidden;background:#EEF2FB">'
                  + '<img src="' + escHtml(thumbProds[ti].photos[0]) + '" style="width:100%;height:100%;object-fit:cover" loading="lazy">'
                  + '</div>';
              } else {
                thumbsHtml += '<div style="flex:1;border-radius:5px;background:#EEF2FB"></div>';
              }
            }
            return '<div onclick="H.openBusinessShop && H.openBusinessShop(\'' + escHtml(String(b.id)) + '\')" '
              + 'style="flex:0 0 150px;width:150px;background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:8px;cursor:pointer">'
              + '<div style="display:flex;gap:4px;height:62px;margin-bottom:7px">'
              + '<div style="width:56px;height:62px;border-radius:8px;overflow:hidden;background:linear-gradient(135deg,#1A3A8F,#2245b8);display:flex;align-items:center;justify-content:center;flex-shrink:0">'
              + logoHtml
              + '</div>'
              + '<div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0;overflow:hidden">'
              + thumbsHtml
              + '</div>'
              + '</div>'
              + '<div style="font-size:11px;font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px">' + escHtml(b.name) + '</div>'
              + '<div style="font-size:10px;color:var(--sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(niche) + ' (' + lCount + (lCount === 1 ? ' item' : ' items') + ')</div>'
              + '</div>';
          }).join('');
          return '<div style="background:var(--card,#fff);padding:18px 0 20px;margin-bottom:8px">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 16px;margin-bottom:12px">'
            + '<span style="font-size:15px;font-weight:800;color:var(--text)">Local Shops</span>'
            + '<span onclick="H._bizSearch&&H._bizSearch.open()" style="font-size:13px;font-weight:600;color:#1A3A8F;cursor:pointer">See all</span>'
            + '</div>'
            + '<div style="display:flex;gap:10px;overflow-x:auto;padding:0 16px 4px;-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none">'
            + cards
            + '</div></div>';
        })()}

        <!-- BANNER -->
        <div style="margin:0 12px 8px;background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 100%);border-radius:18px;padding:20px;display:flex;align-items:center;justify-content:space-between;overflow:hidden;position:relative">
          <div style="position:absolute;right:-24px;top:-24px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,0.07)"></div>
          <div style="position:absolute;right:50px;bottom:-35px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,0.05)"></div>
          <div>
            <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Zimbabwe's Free Marketplace</div>
            <div style="font-size:21px;font-weight:900;color:#fff;line-height:1.1;margin-bottom:4px">Buy. Sell. Hire.</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.7)">Real people. Real deals.</div>
          </div>
          <div style="text-align:center;flex-shrink:0;margin-left:16px">
            <div style="font-size:30px;font-weight:900;color:#F5A623;line-height:1">${activeListings.length}</div>
            <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;margin-top:3px">Active Ads</div>
          </div>
        </div>

        <!-- POST AD BUTTON -->
        <div style="padding:12px 12px 0">
          <button onclick="H.navTo('Post',null)"
            style="width:100%;padding:14px;background:#F5A623;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 14px rgba(245,166,35,0.35)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Post a Free Ad
          </button>
        </div>

        <!-- SEARCH RESULTS (shown when typing) -->
        <div id="searchResults" style="display:none;padding:16px 12px 0">
          <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:12px;padding:0 4px">Search Results</div>
          <div id="searchResultsList" style="display:flex;flex-direction:column;gap:10px"></div>
        </div>

        <!-- CATEGORY SECTIONS (Dubizzle style, shown by default) -->
        <div id="catSections">
          ${catSections.length ? catSections.map(s => `
            <div style="padding:20px 0 0">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:0 16px;margin-bottom:12px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:20px">${s.icon}</span>
                  <span style="font-size:16px;font-weight:800;color:var(--text)">Latest in ${s.name}</span>
                </div>
                <span onclick="H.filterByCat('${s.id}')" style="font-size:13px;font-weight:600;color:#1A3A8F;cursor:pointer">See all</span>
              </div>
              <div style="display:flex;gap:10px;padding:0 16px 4px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none">
                ${s.items.map(l => `<div style="flex:0 0 156px;min-width:156px">${renderHCard(l)}</div>`).join('')}
              </div>
            </div>
          `).join('') : `<div style="padding:32px 16px">${H.emptyState('No listings yet', 'Be the first to post in your area!', 'Post your first ad', "H.navTo('Post',null)")}</div>`}
        </div>

      </div>
    </div>`;
  };

  H.onSearch = function () {
    debounce(() => {
      const q      = document.getElementById('searchIn')?.value || '';
      const catDiv = document.getElementById('catSections');
      const srDiv  = document.getElementById('searchResults');
      const srList = document.getElementById('searchResultsList');
      if (!catDiv || !srDiv || !srList) return;
      if (!q.trim()) {
        catDiv.style.display = '';
        srDiv.style.display  = 'none';
        return;
      }
      catDiv.style.display = 'none';
      srDiv.style.display  = '';
      const active   = (H.state.listings || []).filter(l => l.status === 'active');
      const results  = filterListings(active, q);
      srList.innerHTML = results.length
        ? results.map(l => `<div>${renderListCard(l)}</div>`).join('')
        : H.emptyState('No matches', 'Try different keywords or browse a category', null, null);
    }, 300);
  };

  H.pages.Home_after = function () {
    if (H._initAdCarousels) H._initAdCarousels();
    if (typeof H.maybeShowNotifBanner === 'function') H.maybeShowNotifBanner();
    if (typeof H.maybeShowRatingPrompt === 'function') H.maybeShowRatingPrompt();
    // Always pull fresh listings + shops when Home renders. This guarantees the
    // grid fills even if the one-time boot fetch was slow or failed (cold start /
    // flaky mobile). Background polling on top is handled by H.RM.
    if (H.RM && H.RM._inBgRender) return; // skip during a background re-render
    const _fetches = [];
    if (typeof H.fetchListingsFromSupabase === 'function') _fetches.push(H.fetchListingsFromSupabase().catch(function(){}));
    if (typeof H.fetchAllActiveBusinesses === 'function') _fetches.push(H.fetchAllActiveBusinesses().catch(function(){}));
    if (!_fetches.length) return;
    const _sigBefore = (H.state.listings || []).filter(l => l.status === 'active').length
      + '|' + (H.state.businesses || []).filter(b => b.status === 'active').length;
    Promise.all(_fetches).then(function () {
      if (H.currentPageName !== 'Home') return;
      const _sigAfter = (H.state.listings || []).filter(l => l.status === 'active').length
        + '|' + (H.state.businesses || []).filter(b => b.status === 'active').length;
      if (_sigAfter !== _sigBefore) H.renderPage('Home');
    });
  };

  H.toggleCityPicker = function () {
    const picker = document.getElementById('cityPicker');
    if (picker) picker.classList.toggle('open');
  };

  H.pickCity = function (c) {
    H.state.cityFilter = c;
    H.saveState();
    const picker = document.getElementById('cityPicker');
    if (picker) picker.classList.remove('open');
    H.renderPage('Home');
  };

  

})(window.H);
