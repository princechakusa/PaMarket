/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const state = H.state;
  const { escHtml, filterListings, renderListCard, CATEGORIES } = H;

  const I = (window.H && H.ICONS) || {};
  const S = {
    microphone: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    filter: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
  };

  let browseState = {
    showFilters: false,
    priceMin: 0,
    priceMax: 1000000,
    selectedCategory: null,
    condition: 'all',
    sortBy: 'recent',
    currency: 'all',
    location: 'all',
    lastSearch: ''
  };

  function renderListingsWithSponsored(filteredList) {
    if (!filteredList.length) return '';
    return filteredList.map(renderListCard).join('');
  }

  // Apply every Browse control — price range, condition, currency, verified-only and the
  // sort dropdown — on top of the shared text-relevance engine. The global filterListings
  // only reads H.state, which the Browse page never sets, so we drive the filters here.
  function applyBrowseFilters(list, q) {
    const pMinEl = document.getElementById('priceMin');
    const pMaxEl = document.getElementById('priceMax');
    const pMin = (pMinEl && pMinEl.value !== '') ? (parseFloat(pMinEl.value) || 0) : 0;
    const pMax = (pMaxEl && pMaxEl.value !== '') ? (parseFloat(pMaxEl.value) || Infinity) : Infinity;
    const condEl = document.querySelector('input[name="condition"]:checked');
    const cond = condEl ? condEl.value : 'all';
    const verifiedOnly = !!((document.getElementById('verifiedOnly') || {}).checked);
    const cur = browseState.currency || 'all';
    const locEl = document.getElementById('locationFilter');
    const loc = locEl ? locEl.value : (browseState.location || 'all');

    const pool = (list || []).filter(function (l) {
      // Compare in canonical USD so the price range works for any listing
      // (including legacy ones still stored in ZiG).
      const price = (typeof H.toUSD === 'function') ? H.toUSD(l.price, l.currency) : (l.price || 0);
      if (price < pMin || price > pMax) return false;
      if (cond !== 'all' && (l.condition || '') !== cond) return false;
      if (cur !== 'all' && (l.currency || 'USD') !== cur) return false;
      if (loc && loc !== 'all' && (l.city || l.prov || '') !== loc) return false;
      if (verifiedOnly) {
        const seller = (state.users || []).find(function (x) { return x.id === l.sellerId; });
        if (!(seller && seller.verified)) return false;
      }
      return true;
    });

    // Multi-word AND matching + relevance ranking
    const matched = filterListings(pool, q);

    // Honour the sort dropdown. 'recent' keeps relevance/newest order from filterListings.
    const sortBy = browseState.sortBy || 'recent';
    const _usd = function (l) { return (typeof H.toUSD === 'function') ? H.toUSD(l.price, l.currency) : (l.price || 0); };
    if (sortBy === 'price_asc')       matched.sort(function (a, b) { return _usd(a) - _usd(b); });
    else if (sortBy === 'price_desc') matched.sort(function (a, b) { return _usd(b) - _usd(a); });
    else if (sortBy === 'oldest')     matched.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    else if (sortBy === 'views')      matched.sort(function (a, b) { return (b.views || 0) - (a.views || 0); });
    return matched;
  }

  pages.Browse = function () {
    const activeListings = (state.listings || []).filter(l => l.status === 'active');
    const u = H.currentUser();
    const recentSearches = (u && u.recentSearches) || [];

    return `<div class="page active">
      <div class="app-header" style="padding-bottom:16px">
        <div class="app-header-row" style="margin-bottom:10px">
          <div class="logo">Browse <em>All</em></div>
          <div style="font-size:12px;font-weight:600;color:rgba(255,255,255,.6);padding:4px 10px;background:rgba(255,255,255,.1);border-radius:20px">
            ${activeListings.length} ads
          </div>
        </div>
        <div class="search-box">
          <span aria-hidden="true">${S.search}</span>
          <input id="searchIn" placeholder="Search all listings…" oninput="H._browse.onSearch()">
          <button class="voice-btn" onclick="H._browse.saveSearch()" title="Save this search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
          <button class="voice-btn" onclick="H._browse.voiceSearch()" title="Voice search">${S.microphone}</button>
        </div>
      </div>

      <div class="browse-controls">
        <button class="filter-btn" onclick="H._browse.toggleFilters()">
          ${S.filter} Filters
        </button>
        <select class="sort-sel" id="sortBy" onchange="H._browse.onSortChange()">
          <option value="recent">Latest</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
          <option value="trending">Trending</option>
        </select>
      </div>

      ${recentSearches.length > 0 ? `
        <div class="recent-searches">
          <div class="section-title">Recent Searches</div>
          <div class="search-tags">
            ${recentSearches.slice(0, 5).map(s => `
              <button class="search-tag" onclick="H._browse.searchTag('${H.escHtml(s)}')">
                <span>${H.escHtml(s)}</span>
                <span onclick="H._browse.removeSearch('${H.escHtml(s)}'); event.stopPropagation()">${S.close}</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="browse-filters-wrap" id="filterPanel">
        <div class="filter-section">
          <div class="filter-title">Categories</div>
          <div class="filter-options">
            ${CATEGORIES.map(c => `
              <label class="filter-checkbox">
                <input type="checkbox" value="${c.id}" onchange="H._browse.onFilterChange()">
                <span>${c.icon || ''} ${c.name}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-title">Price Range</div>
          <div class="price-inputs">
            <input type="number" class="price-input" id="priceMin" placeholder="Min" value="0">
            <span>to</span>
            <input type="number" class="price-input" id="priceMax" placeholder="Max" value="1000000">
          </div>
          <div class="currency-toggle">
            <button onclick="H._browse.setCurrency('all', event)" class="cur-opt ${browseState.currency === 'all' ? 'active' : ''}">All</button>
            <button onclick="H._browse.setCurrency('USD', event)" class="cur-opt ${browseState.currency === 'USD' ? 'active' : ''}">USD</button>
            <button onclick="H._browse.setCurrency('ZiG', event)" class="cur-opt ${browseState.currency === 'ZiG' ? 'active' : ''}">ZiG</button>
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-title">Location</div>
          <select id="locationFilter" class="sort-sel" style="width:100%" onchange="H._browse.onFilterChange()">
            <option value="all">All locations</option>
            ${[...new Set((state.listings || []).filter(l => l.status === 'active').map(l => l.city || l.prov).filter(Boolean))].sort().map(loc => `<option value="${escHtml(loc)}" ${browseState.location === loc ? 'selected' : ''}>${escHtml(loc)}</option>`).join('')}
          </select>
        </div>

        <div class="filter-section">
          <div class="filter-title">Condition</div>
          <div class="filter-options">
            <label class="filter-radio"><input type="radio" name="condition" value="all" onchange="H._browse.onFilterChange()" checked><span>Any</span></label>
            <label class="filter-radio"><input type="radio" name="condition" value="new" onchange="H._browse.onFilterChange()"><span>New</span></label>
            <label class="filter-radio"><input type="radio" name="condition" value="like-new" onchange="H._browse.onFilterChange()"><span>Like New</span></label>
            <label class="filter-radio"><input type="radio" name="condition" value="used" onchange="H._browse.onFilterChange()"><span>Used</span></label>
            <label class="filter-radio"><input type="radio" name="condition" value="refurbished" onchange="H._browse.onFilterChange()"><span>Refurbished</span></label>
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-title">Other</div>
          <label class="filter-checkbox"><input type="checkbox" id="verifiedOnly" onchange="H._browse.onFilterChange()"><span>Verified Sellers Only</span></label>
        </div>

        <div class="filter-actions">
          <button class="btn-pri" onclick="H._browse.applyFilters()">Apply Filters</button>
          <button class="btn-sec" onclick="H._browse.resetFilters()">Reset</button>
        </div>
      </div>

      <div class="sec-head"><div class="sec-title">Results</div></div>
      <div class="listing-list" id="listingList">
        ${activeListings.length
          ? renderListingsWithSponsored(applyBrowseFilters(activeListings, ''))
          : H.skeletonCards(6)}
      </div>
    </div>`;
  };

  pages.Browse_after = function () {
    if (typeof H.fetchListingsFromSupabase === 'function') {
      H.fetchListingsFromSupabase().then(() => {
        const el = document.getElementById('listingList');
        if (!el || H.currentPageName !== 'Browse') return;
        const q = document.getElementById('searchIn')?.value || '';
        const active = (state.listings || []).filter(l => l.status === 'active');
        el.innerHTML = active.length
          ? renderListingsWithSponsored(applyBrowseFilters(active, q))
          : H.emptyState('No listings yet', 'Listings will appear here once people start posting', null, null);
      }).catch(() => {
        const el = document.getElementById('listingList');
        if (el && !el.querySelector('.list-card-wrap')) {
          el.innerHTML = H.errorState('Could not load listings', 'Check your connection and pull down to retry.', "H.renderPage('Browse')");
        }
      });
    }
    H._browse = {
      toggleFilters: () => {
        const panel = document.getElementById('filterPanel');
        if (panel) panel.classList.toggle('open');
      },
      _searchTimer: null,
      onSearch: () => {
        clearTimeout(H._browse._searchTimer);
        H._browse._searchTimer = setTimeout(() => {
          const q = document.getElementById('searchIn')?.value || '';
          browseState.lastSearch = q;
          const activeListings = (state.listings || []).filter(l => l.status === 'active');
          const filtered = applyBrowseFilters(activeListings, q);
          const el = document.getElementById('listingList');
          if (el) el.innerHTML = filtered.length
            ? renderListingsWithSponsored(filtered)
            : H.emptyState('No matches', 'Try a different search term', null, null);
          if (q.trim()) {
            const u = H.currentUser();
            if (u) {
              if (!u.recentSearches) u.recentSearches = [];
              u.recentSearches = [q, ...u.recentSearches.filter(s => s !== q)].slice(0, 10);
              H.saveState();
            }
          }
        }, 250);
      },
      searchTag: (term) => {
        const inp = document.getElementById('searchIn');
        if (inp) { inp.value = term; H._browse.onSearch(); }
      },
      removeSearch: (term) => {
        const u = H.currentUser();
        if (u) {
          u.recentSearches = (u.recentSearches || []).filter(s => s !== term);
          H.saveState();
          H.renderPage('Browse');
        }
      },
      voiceSearch: () => { H.toast('Voice search is not available on this device'); },
      saveSearch: () => {
        const q = document.getElementById('searchIn')?.value?.trim() || '';
        const u = H.currentUser();
        if (!u) { H.requireAuth('Sign in to save searches'); return; }
        if (!q && !browseState.selectedCategory) { H.toast('Type something to save as a search'); return; }
        state.savedSearches = state.savedSearches || {};
        state.savedSearches[u.id] = state.savedSearches[u.id] || [];
        const already = state.savedSearches[u.id].some(s => s.query === q && s.cat === browseState.selectedCategory);
        if (already) { H.toast('Search already saved'); return; }
        const newId = H.uid();
        state.savedSearches[u.id].unshift({ id: newId, query: q, cat: browseState.selectedCategory, savedAt: Date.now() });
        state.savedSearches[u.id] = state.savedSearches[u.id].slice(0, 10);
        H.saveState();
        var _sb = window.supabase;
        if (_sb && typeof _sb.from === 'function') {
          _sb.from('saved_searches').insert({
            user_id: u.id, query: q || null,
            category: browseState.selectedCategory || null
          }).then(function(res) { if (res && res.error) console.warn('Saved search sync failed:', res.error.message); });
        }
        H.toast('Search saved — we\'ll notify you of new matches');
      },
      removeSavedSearch: (id) => {
        const u = H.currentUser(); if (!u) return;
        state.savedSearches = state.savedSearches || {};
        state.savedSearches[u.id] = (state.savedSearches[u.id] || []).filter(s => s.id !== id);
        H.saveState();
        H.renderPage('Browse');
      },
      runSavedSearch: (id) => {
        const u = H.currentUser(); if (!u) return;
        const s = ((state.savedSearches || {})[u.id] || []).find(x => x.id === id);
        if (!s) return;
        H.navTo('Browse');
        setTimeout(() => {
          try {
            browseState.selectedCategory = s.cat || '';
            const inp = document.getElementById('searchIn');
            if (inp) inp.value = s.query || '';
            if (typeof H._browse.onSearch === 'function') H._browse.onSearch();
          } catch (e) {}
        }, 260);
      },
      deleteSavedSearch: (id) => {
        const u = H.currentUser(); if (!u) return;
        state.savedSearches = state.savedSearches || {};
        state.savedSearches[u.id] = (state.savedSearches[u.id] || []).filter(s => s.id !== id);
        H.saveState();
        H.renderPage('SavedSearches');
      },
      onFilterChange: () => { H._browse.onSearch(); },
      onSortChange: () => {
        const sortVal = document.getElementById('sortBy')?.value;
        browseState.sortBy = sortVal;
        H._browse.onSearch();
      },
      setCurrency: (cur, ev) => {
        browseState.currency = cur;
        if (ev && ev.target) {
          document.querySelectorAll('.cur-opt').forEach(b => b.classList.remove('active'));
          ev.target.classList.add('active');
        }
      },
      applyFilters: () => { H._browse.toggleFilters(); H._browse.onSearch(); },
      resetFilters: () => {
        browseState = { showFilters:false, priceMin:0, priceMax:1000000, selectedCategory:null, condition:'all', sortBy:'recent', currency:'all', location:'all', lastSearch:'' };
        document.querySelectorAll('.filter-checkbox input, .filter-radio input').forEach(input => { input.checked = false; });
        document.querySelectorAll('input[name="condition"]').forEach(input => { if (input.value === 'all') input.checked = true; });
        const _loc = document.getElementById('locationFilter'); if (_loc) _loc.value = 'all';
        document.querySelectorAll('.cur-opt').forEach(b => b.classList.remove('active'));
        const defaultCurBtn = document.querySelector('.cur-opt.all') || document.querySelector('[onclick*="\'all\'"]');
        if (defaultCurBtn) defaultCurBtn.classList.add('active');
        H._browse.onSearch();
      }
    };

    if (browseState.lastSearch) {
      const inp = document.getElementById('searchIn');
      if (inp) { inp.value = browseState.lastSearch; H._browse.onSearch(); }
    }
  };

  // Notify the user when newly-synced listings match any of their saved searches.
  // Called after each listings fetch. First run just sets a baseline (no spam).
  H._checkSavedSearchAlerts = function () {
    const u = H.currentUser();
    if (!u) return;
    const searches = (state.savedSearches && state.savedSearches[u.id]) || [];
    if (!searches.length) return;
    const last = state.savedSearchSeen || 0;
    const now = Date.now();
    if (!last) { state.savedSearchSeen = now; H.saveState(); return; }
    const fresh = (state.listings || []).filter(function (l) {
      return l && l.status === 'active' && (l.createdAt || 0) > last && l.sellerId !== u.id;
    });
    if (fresh.length) {
      searches.forEach(function (s) {
        const words = (s.query || '').toLowerCase().split(/\s+/).filter(Boolean);
        const matches = fresh.filter(function (l) {
          if (s.cat && l.cat !== s.cat) return false;
          if (!words.length) return !!s.cat;
          const hay = ((l.title || '') + ' ' + (l.desc || l.description || '') + ' ' + (l.city || '')).toLowerCase();
          return words.every(function (w) { return hay.indexOf(w) !== -1; });
        });
        if (matches.length && typeof H.pushNotif === 'function') {
          const term = s.query || s.cat || 'your search';
          H.pushNotif(u.id, 'New matches', matches.length + ' new listing' + (matches.length === 1 ? '' : 's') + ' for "' + term + '"');
        }
      });
    }
    state.savedSearchSeen = now;
    H.saveState();
  };

  pages.SavedSearches = function () {
    const u = H.currentUser();
    if (!u) return '<div class="page active">' + H.innerTopbar('Saved Searches') + H.emptyState('Sign in required', 'Sign in to view your saved searches') + '</div>';
    const list = (state.savedSearches && state.savedSearches[u.id]) || [];
    const when = (t) => { try { return H.timeAgo ? H.timeAgo(t) : new Date(t).toLocaleDateString(); } catch (e) { return ''; } };
    return `<div class="page active">${H.innerTopbar('Saved Searches')}
      <div style="padding:14px 14px 90px">
        ${list.length ? list.map(s => `
          <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px 14px;margin-bottom:10px;display:flex;align-items:center;gap:12px">
            <div style="width:40px;height:40px;border-radius:11px;background:rgba(26,58,143,.08);color:#1A3A8F;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
            <div style="flex:1;min-width:0;cursor:pointer" onclick="H._browse.runSavedSearch('${s.id}')">
              <div style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${H.escHtml(s.query || s.cat || 'All listings')}</div>
              <div style="font-size:12px;color:var(--sub);margin-top:1px">${s.cat ? H.escHtml(s.cat) + ' · ' : ''}Saved ${when(s.savedAt)}</div>
            </div>
            <button onclick="H._browse.runSavedSearch('${s.id}')" style="background:#1A3A8F;color:#fff;border:none;border-radius:9px;padding:8px 13px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0">Search</button>
            <button onclick="H._browse.deleteSavedSearch('${s.id}')" aria-label="Delete saved search" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:6px;flex-shrink:0"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </div>`).join('')
          : H.emptyState('No saved searches yet', 'On the Browse screen, search for something and tap the bookmark to save it here for quick access.', 'Browse Listings', "H.navTo('Browse')")}
      </div></div>`;
  };

})(window.H);
