// Customer "My Rentals" — requests, confirmed, active, completed,
// cancelled. Reads via PMRentals.listMyRentalBookings() (list_my_rental_
// bookings RPC), which is RLS-scoped to the caller and returns the
// vehicle/company display fields in one round trip.
(function () {
  'use strict';
  var root = document.getElementById('accountPage');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function gate() {
    var token = (window.PMServiceTransport && PMServiceTransport.session) ? PMServiceTransport.session() : null;
    if (token && token.access_token) return false;
    root.innerHTML = '<div class="account-empty"><h2>Sign in required</h2><p>This page is private to your PaMarket account.</p><a class="account-primary" href="auth?return=' + encodeURIComponent(location.pathname + location.search) + '">Sign In</a></div>';
    return true;
  }

  var FILTERS = [
    { key: 'requested', label: 'Requests', statuses: ['requested'] },
    { key: 'confirmed', label: 'Confirmed', statuses: ['confirmed'] },
    { key: 'active', label: 'Active', statuses: ['picked_up', 'active'] },
    { key: 'completed', label: 'Completed', statuses: ['returned', 'completed'] },
    { key: 'cancelled', label: 'Cancelled', statuses: ['declined', 'cancelled'] },
  ];
  var STATUS_LABEL = { requested: 'Requested', confirmed: 'Confirmed', picked_up: 'Picked Up', active: 'Active', returned: 'Returned', completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled' };

  function fmtDate(iso) { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }

  var allBookings = [];
  var filter = 'requested';

  function card(b) {
    var vehicleName = [b.vehicle_model, b.vehicle_year].filter(Boolean).join(' ');
    var thumb = b.cover_url ? '<img class="mrb-thumb" src="' + esc(b.cover_url) + '" alt="" loading="lazy">' : '<div class="mrb-thumb"></div>';
    return '<a class="mrb-card" href="rental-booking?id=' + esc(b.id) + '">' + thumb +
      '<div style="flex:1;min-width:0">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">' +
      '<div class="mrb-vehicle">' + esc(vehicleName) + '</div>' +
      '<span class="mrb-status ' + esc(b.status) + '">' + esc(STATUS_LABEL[b.status] || b.status) + '</span>' +
      '</div>' +
      '<div class="mrb-company">' + esc(b.company_name) + '</div>' +
      '<div class="mrb-dates">' + esc(fmtDate(b.pickup_at)) + ' → ' + esc(fmtDate(b.return_at)) + '</div>' +
      '<div class="mrb-total">$' + Number(b.total_amount).toLocaleString() + '</div>' +
      '</div></a>';
  }

  function render() {
    var active = FILTERS.filter(function (f) { return f.key === filter; })[0];
    var visible = allBookings.filter(function (b) { return active.statuses.indexOf(b.status) > -1; });
    var tabsHtml = '<div class="mrb-tabs">' + FILTERS.map(function (f) {
      var count = allBookings.filter(function (b) { return f.statuses.indexOf(b.status) > -1; }).length;
      return '<button type="button" class="mrb-tab' + (f.key === filter ? ' sel' : '') + '" data-filter="' + f.key + '">' + esc(f.label) + (count ? ' (' + count + ')' : '') + '</button>';
    }).join('') + '</div>';
    var listHtml = visible.length
      ? visible.map(card).join('')
      : '<div class="account-empty"><h2>' + (filter === 'requested' ? 'No booking requests yet' : 'Nothing here yet') + '</h2>' +
        '<p>' + (filter === 'requested' ? 'Browse rental vehicles and send a booking request to see it here.' : 'Bookings will show up here once they reach this stage.') + '</p>' +
        (filter === 'requested' ? '<a class="account-primary" href="rentals">Browse Rentals</a>' : '') + '</div>';
    root.innerHTML = tabsHtml + listHtml;
    root.querySelectorAll('[data-filter]').forEach(function (btn) {
      btn.onclick = function () { filter = btn.getAttribute('data-filter'); render(); };
    });
  }

  function load() {
    if (gate()) return;
    var svc = window.PMRentals;
    if (!svc || !svc.listMyRentalBookings) {
      root.innerHTML = '<div class="account-empty"><h2>Could not load your rentals</h2><p>Please refresh and try again.</p></div>';
      return;
    }
    svc.listMyRentalBookings(null).then(function (rows) {
      allBookings = rows || [];
      render();
    }).catch(function (err) {
      if (window.console) console.warn('my rental bookings:', err);
      root.innerHTML = '<div class="account-empty"><h2>Could not load your rentals</h2><p>Please refresh and try again.</p></div>';
    });
  }

  load();
})();
