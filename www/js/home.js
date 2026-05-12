'use strict';
(function (H) {
  const { escHtml, timeAgo, emptyState, filterListings, renderListCard, renderFeatCard, CATEGORIES, ICONS } = H;

  // Debounce helper for search
  let searchTimer;
  function debounce(fn, delay) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(fn, delay);
  }

  H.pages.Home = async function () {
    const u = H.currentUser();
    

    const unreadNotifs = u ? (H.state.notifs[u.id] || []).filter(n => !n.read).length : 0;
    const unreadMsgs = u ? (H.state.conversations || []).filter(cv => cv.members.includes(u.id) && cv.messages.some(m => m.from !== u.id && !m.read)).length : 0;
    const activeListings = (H.state.listings || []).filter(l => l.status === 'active');
    const filtered       = filterListings(activeListings);
    const featured       = filtered.filter(l => l.boost && l.boost.until > Date.now()).slice(0, 6);

    return `<div class="page active">
      <!-- Header -->
      <div class="app-header">
        <div class="app-header-row">
          <div class="logo" onclick="H.logoTap()" style="display:flex;align-items:center;gap:10px;cursor:pointer" role="button" tabindex="0" aria-label="Hostly home">
            <img src="img/icon-192.png" alt="" aria-hidden="true" style="width:30px;height:30px;border-radius:8px;">
            <span>Host<em>ly</em></span>
          </div>
          <div class="hdr-icons">
            <div class="hdr-ic" onclick="H.currentUser()?H.openInner('Notifications'):H.requireAuth('Sign in to view notifications')" role="button" tabindex="0" aria-label="Notifications${unreadNotifs ? ', ' + unreadNotifs + ' unread' : ''}">
              <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              ${unreadNotifs ? `<span class="badge" aria-hidden="true">${unreadNotifs > 9 ? '9+' : unreadNotifs}</span>` : ''}
            </div>
            <div class="hdr-ic" onclick="H.currentUser()?H.openInner('Messages'):H.requireAuth('Sign in to view messages')" role="button" tabindex="0" aria-label="Messages${unreadMsgs ? ', ' + unreadMsgs + ' unread' : ''}">
              <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ${unreadMsgs ? `<span class="badge" aria-hidden="true">${unreadMsgs > 9 ? '9+' : unreadMsgs}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Location filter -->
        <div class="loc-wrap" onclick="H.toggleCityPicker()" role="button" tabindex="0" aria-label="Filter by city: ${escHtml(H.state.cityFilter)}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span class="loc-city">${escHtml(H.state.cityFilter)}</span>
          <span class="loc-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </div>

        <!-- Search -->
        <div class="search-box">
          <span aria-hidden="true">${ICONS.search}</span>
          <input id="searchIn" placeholder="Search cars, houses, jobs…" oninput="H.onSearch()" autocomplete="off" aria-label="Search listings">
        </div>
      </div>

      <!-- City picker dropdown -->
      <div class="city-picker" id="cityPicker" role="dialog" aria-label="Select city">
        <div class="city-picker-title">Filter by city</div>
        <div class="city-grid">
          <div class="city-opt ${H.state.cityFilter === 'All Zimbabwe' ? 'sel' : ''}" onclick="H.pickCity('All Zimbabwe')" role="option" aria-selected="${H.state.cityFilter === 'All Zimbabwe'}">
            All Zimbabwe
          </div>
          ${['Harare','Bulawayo','Mutare','Gweru','Masvingo','Chinhoyi','Kwekwe','Kadoma'].map(c =>
            `<div class="city-opt ${H.state.cityFilter === c ? 'sel' : ''}" onclick="H.pickCity('${c}')" role="option" aria-selected="${H.state.cityFilter === c}">${c}</div>`
          ).join('')}
        </div>
      </div>

      <!-- Categories (top 8) -->
      <div class="cats-section">
        <div class="cats-grid">
          ${CATEGORIES.slice(0, 8).map(c => `
            <div class="cat-tile" onclick="H.filterByCat('${c.id}')" role="button" tabindex="0" aria-label="Browse ${c.name}">
              <div class="cat-icon-bg" aria-hidden="true">${c.icon}</div>
              <span class="cat-tile-label">${c.name}</span>
            </div>`).join('')}
        </div>
      </div>

      <!-- Banner -->
      <div class="hostly-banner" aria-label="Hostly marketplace statistics">
        <div>
          <div class="banner-eyebrow">Marketplace</div>
          <div class="banner-title">Zimbabwe's #1<br>Free Platform</div>
          <div class="banner-sub">Real people · Real deals</div>
        </div>
        <div class="banner-count" aria-label="${activeListings.length} active listings">
          <div class="banner-num">${activeListings.length}</div>
          <div class="banner-num-lbl">Active listings</div>
        </div>
      </div>

      <!-- Featured (boosted listings) -->
      ${featured.length ? `
        <div class="sec-head">
          <div class="sec-title">
            <span aria-hidden="true">${ICONS.boost}</span> Featured
          </div>
          <div class="see-all" onclick="H.navTo('Browse',null)">See all</div>
        </div>
        <div style="display:flex;gap:10px;padding:0 12px 14px;overflow-x:auto;-webkit-overflow-scrolling:touch" class="scroll-area" role="list" aria-label="Featured listings">
          ${featured.map(l => `<div role="listitem">${renderFeatCard(l)}</div>`).join('')}
        </div>` : ''}

      <!-- Latest listings -->
      <div class="sec-head">
        <div class="sec-title">
          ${H.state.cityFilter === 'All Zimbabwe' ? 'Latest in Zimbabwe' : 'Latest in ' + escHtml(H.state.cityFilter)}
        </div>
        <div class="see-all" onclick="H.navTo('Browse',null)" role="button" tabindex="0">See all</div>
      </div>
      <div class="listing-list" id="listingList" role="list" aria-label="Listings">
        ${filtered.length
          ? filtered.map(l => `<div role="listitem">${renderListCard(l)}</div>`).join('')
          : emptyState('No listings yet', 'Be the first to post in your area!', 'Post your first ad', "H.navTo('Post',null)")}
      </div>
    </div>`;
  };

  // --- Home interactions --------------------------------
  H.onSearch = function () {
    debounce(() => {
      const q    = document.getElementById('searchIn')?.value || '';
      const area = document.getElementById('listingList');
      if (!area) return;
      const active   = (H.state.listings || []).filter(l => l.status === 'active');
      const filtered = filterListings(active, q);
      area.innerHTML = filtered.length
        ? filtered.map(renderListCard).join('')
        : emptyState('No matches', 'Try different keywords or browse a category', null, null);
    }, 300);
  };

  H.toggleCityPicker = function () {
    const picker = document.getElementById('cityPicker');
    if (picker) picker.classList.toggle('open');
  };

  H.pickCity = function (c) {
    H.state.cityFilter = c; H.saveState();
    const picker = document.getElementById('cityPicker');
    if (picker) picker.classList.remove('open');
    H.renderPage('Home');
  };

  H.filterByCat = function (cid) { H.openInner('CategoryView', { cid }); };

})(window.H);