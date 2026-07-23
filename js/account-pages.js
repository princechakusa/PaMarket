(function () {
  'use strict';
  var page = document.body.getAttribute('data-account-page');
  var root = document.getElementById('accountPage');
  var session = window.PM && PM.getSession ? PM.getSession() : null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function gate() {
    if (session && session.user) return false;
    root.innerHTML = '<div class="account-empty"><h2>Sign in required</h2><p>This page is private to your PaMarket account.</p><a class="account-primary" href="auth?return=' + encodeURIComponent(location.pathname + location.search) + '">Sign In</a></div>';
    return true;
  }
  function photo(listing) {
    var url = listing.photos && listing.photos[0];
    return url ? '<img src="' + esc(url) + '" alt="" loading="lazy">' : '<span>No photo</span>';
  }
  function listingCard(listing) {
    var loc = [listing.suburb, listing.city, listing.province].filter(Boolean).slice(0, 2).join(', ');
    return '<article class="account-card" data-listing="' + esc(listing.id) + '">' +
      '<a class="account-photo" href="detail?id=' + encodeURIComponent(listing.id) + '">' + photo(listing) + '</a>' +
      '<div class="account-card-body"><a class="account-title" href="detail?id=' + encodeURIComponent(listing.id) + '">' + esc(listing.title) + '</a>' +
      '<div class="account-price">' + esc(PM.money(listing.price, listing.currency)) + '</div>' +
      '<div class="account-meta">' + esc(loc || 'Zimbabwe') + '</div>' +
      '<button class="account-secondary" data-unsave="' + esc(listing.id) + '">Remove</button></div></article>';
  }
  function loadFavourites() {
    if (gate()) return;
    PM.listFavourites().then(function (rows) {
      root.innerHTML = rows.length ? '<div class="account-grid">' + rows.map(listingCard).join('') + '</div>' :
        '<div class="account-empty"><h2>No favourites yet</h2><p>Save listings you want to compare or revisit.</p><a class="account-primary" href="browse">Browse Listings</a></div>';
      root.querySelectorAll('[data-unsave]').forEach(function (button) {
        button.addEventListener('click', function () {
          button.disabled = true;
          PM.unsaveListing(button.getAttribute('data-unsave')).then(function () { button.closest('.account-card').remove(); if (!root.querySelector('.account-card')) loadFavourites(); }).catch(function () { button.disabled = false; });
        });
      });
    }).catch(function () { root.innerHTML = '<div class="account-empty"><h2>Could not load favourites</h2><p>Please refresh and try again.</p></div>'; });
  }
  function filtersToUrl(filters) {
    var p = new URLSearchParams();
    var map = { category: 'cat', q: 'q', province: 'prov', city: 'city', subcategory: 'sub', sort: 'sort' };
    Object.keys(map).forEach(function (key) { if (filters && filters[key]) p.set(map[key], filters[key]); });
    return 'browse' + (p.toString() ? '?' + p.toString() : '');
  }
  function filterSummary(row) {
    var f = row.filters || {};
    return [f.category, f.q, f.city, f.province].filter(Boolean).join(' · ') || 'All listings';
  }
  function loadSearches() {
    if (gate()) return;
    PM.listSavedSearches().then(function (rows) {
      root.innerHTML = rows.length ? '<div class="account-list">' + rows.map(function (row) {
        return '<article class="account-row" data-search="' + esc(row.id) + '"><div><h2>' + esc(row.name || row.query || row.category || 'Saved search') + '</h2><p>' + esc(filterSummary(row)) + '</p></div><div class="account-actions"><a class="account-primary" href="' + esc(filtersToUrl(row.filters || { q: row.query, category: row.category })) + '">View Results</a><button class="account-secondary" data-delete-search="' + esc(row.id) + '">Delete</button></div></article>';
      }).join('') + '</div>' : '<div class="account-empty"><h2>No saved searches</h2><p>Choose filters on Browse, then save the search here for later.</p><a class="account-primary" href="browse">Browse Listings</a></div>';
      root.querySelectorAll('[data-delete-search]').forEach(function (button) { button.addEventListener('click', function () { if (!confirm('Delete this saved search?')) return; PM.deleteSavedSearch(button.getAttribute('data-delete-search')).then(loadSearches); }); });
    }).catch(function () { root.innerHTML = '<div class="account-empty"><h2>Could not load saved searches</h2><p>The saved-search database migration may still need to be deployed.</p></div>'; });
  }
  function notifRoute(n) {
    var m = n.meta || {};
    var link = m.deepLink || m.deep_link || m.url || '';
    if (link && /^https?:\/\//i.test(link)) return link;
    if (link && /^Detail\?id=/i.test(link)) return 'detail?' + link.split('?')[1];
    if (link && /^Reviews/i.test(link)) return 'profile';
    if (m.conversationId || m.conversation_id) return 'chats?conv=' + encodeURIComponent(m.conversationId || m.conversation_id);
    if (link && /^Chat\?id=/i.test(link)) return 'chats?conv=' + encodeURIComponent(link.split('=')[1] || '');
    if (n.type === 'message') return 'chats';
    if (m.listing_id || m.listingId) return 'detail?id=' + encodeURIComponent(m.listing_id || m.listingId);
    if (n.type === 'job_alert' && (m.job_id || m.jobId)) return 'detail?id=' + encodeURIComponent(m.job_id || m.jobId);
    if (n.type === 'lead') return 'dashboard';
    if (['sale','boost','review','verify','ban','report'].indexOf(n.type) !== -1) return 'dashboard';
    return '';
  }
  function notifTime(value) {
    var n = Number(value); var d = Number.isFinite(n) ? new Date(n) : new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
  }
  function loadNotifications() {
    if (gate()) return;
    PM.listNotifications().then(function (rows) {
      var unread = rows.filter(function (n) { return !n.read; }).length;
      var bar = unread ? '<div class="account-toolbar"><span>' + unread + ' unread</span><button class="account-secondary" id="markAllRead">Mark all read</button></div>' : '';
      root.innerHTML = bar + (rows.length ? '<div class="account-list">' + rows.map(function (n) {
        var link = notifRoute(n); var inner = '<div class="notif-copy"><div class="notif-top"><strong>' + esc(n.title) + '</strong>' + (!n.read ? '<span class="unread-dot" aria-label="Unread"></span>' : '') + '</div><p>' + esc(n.body || '') + '</p><time>' + esc(notifTime(n.created_at)) + '</time></div>';
        return '<article class="account-row notif-row' + (!n.read ? ' unread' : '') + '" data-notification="' + esc(n.id) + '">' + (link ? '<a href="' + esc(link) + '" data-open-notification="' + esc(n.id) + '">' + inner + '</a>' : inner) + '</article>';
      }).join('') + '</div>' : '<div class="account-empty"><h2>No notifications yet</h2><p>Account and marketplace updates will appear here.</p></div>');
      var mark = document.getElementById('markAllRead'); if (mark) mark.addEventListener('click', function () { mark.disabled = true; PM.markAllNotificationsRead().then(loadNotifications); });
      root.querySelectorAll('[data-open-notification]').forEach(function (a) { a.addEventListener('click', function () { PM.updateNotification(a.getAttribute('data-open-notification'), { read: true }).catch(function () {}); }); });
    }).catch(function () { root.innerHTML = '<div class="account-empty"><h2>Could not load notifications</h2><p>Please refresh and try again.</p></div>'; });
  }
  if (page === 'favourites') loadFavourites();
  if (page === 'saved-searches') loadSearches();
  if (page === 'notifications') loadNotifications();
})();
