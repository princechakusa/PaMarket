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
    var listingPath = PMUrls.listingPath(listing);
    return '<article class="account-card" data-listing="' + esc(listing.id) + '">' +
      '<a class="account-photo" href="' + esc(listingPath) + '">' + photo(listing) + '</a>' +
      '<div class="account-card-body"><a class="account-title" href="' + esc(listingPath) + '">' + esc(listing.title) + '</a>' +
      '<div class="account-price">' + esc(PM.money(listing.price, listing.currency)) + '</div>' +
      '<div class="account-meta">' + esc(loc || 'Zimbabwe') + '</div>' +
      '<button class="account-secondary" data-unsave="' + esc(listing.id) + '">Remove</button></div></article>';
  }
  function loadFavourites() {
    if (gate()) return;
    PMSavedContent.listFavourites().then(function (rows) {
      root.innerHTML = rows.length ? '<div class="account-grid">' + rows.map(listingCard).join('') + '</div>' :
        '<div class="account-empty"><h2>No favourites yet</h2><p>Save listings you want to compare or revisit.</p><a class="account-primary" href="browse">Browse Listings</a></div>';
      root.querySelectorAll('[data-unsave]').forEach(function (button) {
        button.addEventListener('click', function () {
          button.disabled = true;
          PMSavedContent.unsaveListing(button.getAttribute('data-unsave')).then(function () { button.closest('.account-card').remove(); if (!root.querySelector('.account-card')) loadFavourites(); }).catch(function () { button.disabled = false; });
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
    PMSavedContent.listSavedSearches().then(function (rows) {
      root.innerHTML = rows.length ? '<div class="account-list"><div data-delete-search-error></div>' + rows.map(function (row) {
        return '<article class="account-row" data-search="' + esc(row.id) + '"><div><h2>' + esc(row.name || row.query || row.category || 'Saved search') + '</h2><p>' + esc(filterSummary(row)) + '</p></div><div class="account-actions"><a class="account-primary" href="' + esc(filtersToUrl(row.filters || { q: row.query, category: row.category })) + '">View Results</a><button class="account-secondary" data-delete-search="' + esc(row.id) + '">Delete</button></div></article>';
      }).join('') + '</div>' : '<div class="account-empty"><h2>No saved searches</h2><p>Choose filters on Browse, then save the search here for later.</p><a class="account-primary" href="browse">Browse Listings</a></div>';
      root.querySelectorAll('[data-delete-search]').forEach(function (button) {
        button.addEventListener('click', function () {
          if (!confirm('Delete this saved search?')) return;
          var error = root.querySelector('[data-delete-search-error]');
          if (error) { error.innerHTML = ''; error.removeAttribute('role'); }
          button.disabled = true;
          return PMSavedContent.deleteSavedSearch(button.getAttribute('data-delete-search')).then(loadSearches).catch(function () {
            button.disabled = false;
            if (error) {
              error.setAttribute('role', 'alert');
              error.innerHTML = PMFeedback.error('Could not delete this saved search. Please try again.', { style: 'margin-bottom:12px' });
            }
          });
        });
      });
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
    // Rental notifications carry a rental_vehicle_listings.id under
    // listing_id — a different table from public.listings. Routing it
    // through the generic detail?id= below 404s (detail.html looks the id
    // up in listings, not rental_vehicle_listings). Send rental_* types to
    // rental-detail instead; company/review notifications carry no listing
    // at all, so send those to the owner's dashboard.
    if (n.type && n.type.indexOf('rental_') === 0) {
      if (m.listing_id || m.listingId) return 'rental-detail?id=' + encodeURIComponent(m.listing_id || m.listingId);
      return 'dashboard';
    }
    if (m.listing_id || m.listingId) return 'detail?id=' + encodeURIComponent(m.listing_id || m.listingId);
    // applications.job_id references public.listings(id) directly (jobs are
    // category='jobs' listings rows), so this is safe to route to detail?id=
    // — unlike the rental listing_id case above.
    if (['job_alert', 'job_shortlisted', 'job_declined'].indexOf(n.type) !== -1 && (m.job_id || m.jobId)) {
      return 'detail?id=' + encodeURIComponent(m.job_id || m.jobId);
    }
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
  var ORDER_STATUS_LABEL = { pending: 'Pending', confirmed: 'Confirmed', declined: 'Declined', preparing: 'Preparing', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled' };
  var ORDER_FULFILLMENT_LABEL = { collection: 'Pickup', delivery: 'Delivery' };

  function orderReference(id) {
    return String(id || '').slice(0, 8).toUpperCase();
  }

  // Private, authenticated, read-only — the WhatsApp handoff's website
  // fallback (Stage 5). No status-change actions live here; that stays the
  // mobile app's owner-order screen. Customer name/phone/note are shown
  // only when the signed-in viewer is verified (via businesses.owner_user_id,
  // read back from the database, not assumed) to own the order's shop —
  // the same isOwner distinction app/owner-order/[id].tsx makes.
  function loadOrder() {
    if (gate()) return;
    var params = new URLSearchParams(location.search);
    var orderId = params.get('id');
    if (!orderId) {
      root.innerHTML = '<div class="account-empty"><h2>Order not found</h2><p>No order was specified.</p></div>';
      return;
    }
    if (!window.PMShopOrders) {
      root.innerHTML = '<div class="account-empty"><h2>Could not load this order</h2><p>Please refresh and try again.</p></div>';
      return;
    }
    root.innerHTML = '<div class="account-empty">Loading order…</div>';
    window.PMShopOrders.getOrderDetail(orderId).then(function (result) {
      var order = result.order;
      if (!order) {
        root.innerHTML = '<div class="account-empty"><h2>Order not found</h2><p>This order does not exist, or you do not have access to it.</p></div>';
        return;
      }
      var business = result.business;
      var items = result.items || [];
      var history = result.history || [];
      var reference = orderReference(order.id);

      var itemsHtml = items.map(function (item) {
        return '<div class="account-row" style="align-items:center">' +
          '<div style="flex:1"><strong>' + esc(item.title_snapshot) + '</strong>' +
          '<p>' + item.quantity + ' × ' + esc(PM.money(item.unit_price_snapshot, item.currency_snapshot)) +
          (item.listing_id ? '' : ' · listing no longer exists') + '</p></div>' +
          '<strong>' + esc(PM.money(item.subtotal_snapshot, item.currency_snapshot)) + '</strong></div>';
      }).join('');

      var historyHtml = history.map(function (h) {
        return '<div class="account-row"><div>' +
          '<strong>' + esc(ORDER_STATUS_LABEL[h.status] || h.status) + '</strong>' +
          (h.note ? '<p>' + esc(h.note) + '</p>' : '') +
          '<time>' + esc(new Date(h.created_at).toLocaleString()) + '</time></div></div>';
      }).join('');

      var customerHtml = result.isOwner
        ? '<section><h2>Customer</h2>' +
          '<p><strong>Name:</strong> ' + esc(order.customer_name || '—') + '</p>' +
          '<p><strong>Phone:</strong> ' + esc(order.customer_phone || '—') + '</p>' +
          (order.customer_note ? '<p><strong>Note:</strong> ' + esc(order.customer_note) + '</p>' : '') +
          '</section>'
        : '';

      var deliveryHtml = order.fulfillment_method === 'delivery' && order.delivery_address
        ? '<p><strong>Delivery address:</strong> ' + esc(order.delivery_address) + '</p>'
        : '';

      root.innerHTML =
        '<section><h2>Order #' + esc(reference) + '</h2>' +
        '<p><strong>Status:</strong> ' + esc(ORDER_STATUS_LABEL[order.status] || order.status) + '</p>' +
        (business ? '<p><strong>Shop:</strong> ' + esc(business.name) + '</p>' : '') +
        '</section>' +
        '<section><h2>Items</h2>' + (itemsHtml || '<p>No items.</p>') +
        '<p style="margin-top:10px"><strong>Total (' + order.item_count + ' item' + (order.item_count === 1 ? '' : 's') + '):</strong> ' +
        esc(PM.money(order.total, order.currency)) + '</p></section>' +
        '<section><h2>Fulfillment</h2>' +
        '<p><strong>Method:</strong> ' + esc(ORDER_FULFILLMENT_LABEL[order.fulfillment_method] || order.fulfillment_method) + '</p>' +
        deliveryHtml +
        '<p><strong>Placed:</strong> ' + esc(new Date(order.created_at).toLocaleString()) + '</p>' +
        '<p><strong>Last updated:</strong> ' + esc(new Date(order.updated_at).toLocaleString()) + '</p>' +
        '</section>' +
        customerHtml +
        '<section><h2>Status history</h2>' + (historyHtml || '<p>No history yet.</p>') + '</section>' +
        '<p class="account-hint">Manage this order (confirm, decline, update status) from the PaMarket app.</p>';
    }).catch(function () {
      root.innerHTML = '<div class="account-empty"><h2>Could not load this order</h2><p>Please refresh and try again.</p></div>';
    });
  }

  if (page === 'favourites') loadFavourites();
  if (page === 'saved-searches') loadSearches();
  if (page === 'notifications') loadNotifications();
  if (page === 'order') loadOrder();
})();
