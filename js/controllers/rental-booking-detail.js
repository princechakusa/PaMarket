// Booking detail (web) — customer or provider viewer, RLS-scoped. Mirrors
// apps/mobile/app/rentals/booking/[id].tsx. Cancel is the only mutation
// this page performs (for the customer, on a cancellable booking) —
// provider actions (accept/decline/pickup/return/complete) live in the
// rental-fleet bookings inbox, not here.
(function () {
  'use strict';
  var root = document.getElementById('accountPage');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var id = new URLSearchParams(location.search).get('id');

  var STATUS_LABEL = { requested: 'Requested', confirmed: 'Confirmed', picked_up: 'Picked Up', active: 'Active', returned: 'Returned', completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled' };
  var CUSTOMER_CANCELLABLE = ['requested', 'confirmed'];
  var BRAND_LABELS = { toyota: 'Toyota', honda: 'Honda', nissan: 'Nissan', mercedes: 'Mercedes-Benz', bmw: 'BMW', ford: 'Ford', isuzu: 'Isuzu', hyundai: 'Hyundai', kia: 'Kia', vw: 'Volkswagen', mitsubishi: 'Mitsubishi', suzuki: 'Suzuki', mazda: 'Mazda', other: 'Other' };

  function gate() {
    var token = (window.PMServiceTransport && PMServiceTransport.session) ? PMServiceTransport.session() : null;
    if (token && token.access_token) return token;
    root.innerHTML = '<div class="account-empty"><h2>Sign in required</h2><p>This page is private to your PaMarket account.</p><a class="account-primary" href="auth?return=' + encodeURIComponent(location.pathname + location.search) + '">Sign In</a></div>';
    return null;
  }

  function fmtDateTime(iso) { return new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }

  function render(b, viewerId) {
    var listing = b.rental_vehicle_listings || {};
    var company = b.rental_companies || {};
    var biz = company.businesses || {};
    var media = (listing.rental_vehicle_media || []).filter(function (m) { return m.is_cover; })[0] || (listing.rental_vehicle_media || [])[0];
    var brandSlug = listing.rental_brands && listing.rental_brands.slug;
    var brandLabel = BRAND_LABELS[brandSlug] || '';
    var vehicleTitle = (brandLabel + ' ' + (listing.model || '')).trim() + (listing.year ? ' ' + listing.year : '');
    var isCustomer = viewerId === b.customer_id;
    var canCancel = isCustomer && CUSTOMER_CANCELLABLE.indexOf(b.status) > -1;

    var html = media ? '<img class="rbd-cover" src="' + esc(media.url) + '" alt="">' : '';
    html += '<div class="rbd-title-row"><div><div class="rbd-title">' + esc(vehicleTitle || 'Rental vehicle') + '</div></div><span class="rbd-status ' + esc(b.status) + '">' + esc(STATUS_LABEL[b.status] || b.status) + '</span></div>';
    html += '<div class="rbd-company">' + esc(company.trading_name || biz.name || 'Rental company') + '</div>';

    if (b.status === 'declined' && b.decline_reason) {
      html += '<div class="rbd-note"><b>Declined</b>' + esc(b.decline_reason) + '</div>';
    }
    if (b.status === 'cancelled' && b.cancellation_reason) {
      html += '<div class="rbd-note info"><b>Cancellation note</b>' + esc(b.cancellation_reason) + '</div>';
    }

    html += '<div class="rbd-section"><h3>Rental Period</h3>' +
      '<div class="rbd-row"><span class="l">Pick-up</span><span class="v">' + esc(fmtDateTime(b.pickup_at)) + '</span></div>' +
      '<div class="rbd-row"><span class="l">Return</span><span class="v">' + esc(fmtDateTime(b.return_at)) + '</span></div>' +
      '<div class="rbd-row"><span class="l">Duration</span><span class="v">' + b.rental_days + ' day' + (b.rental_days === 1 ? '' : 's') + '</span></div>' +
      '</div>';

    html += '<div class="rbd-section"><h3>' + (b.fulfillment === 'delivery' ? 'Delivery' : 'Pick-up') + ' Information</h3>';
    html += b.fulfillment === 'delivery'
      ? '<div class="rbd-row"><span class="l">Address</span><span class="v">' + esc(b.delivery_address || '—') + '</span></div>'
      : '<div class="rbd-row"><span class="l">Location</span><span class="v">' + esc(listing.pickup_suburb || 'Arranged with provider') + '</span></div>';
    if (b.with_driver) html += '<div class="rbd-row"><span class="l">Driver</span><span class="v">Included</span></div>';
    if (b.customer_note) html += '<div class="rbd-row"><span class="l">Your note</span><span class="v">' + esc(b.customer_note) + '</span></div>';
    html += '</div>';

    html += '<div class="rbd-section"><h3>Price Breakdown</h3>' +
      '<div class="rbd-row"><span class="l">$' + b.daily_rate + '/day × ' + b.rental_days + ' days</span><span class="v">$' + Number(b.rate_subtotal).toLocaleString() + '</span></div>';
    if (b.driver_fee > 0) html += '<div class="rbd-row"><span class="l">Driver</span><span class="v">$' + Number(b.driver_fee).toLocaleString() + '</span></div>';
    if (b.extras_fee > 0) html += '<div class="rbd-row"><span class="l">Extras</span><span class="v">$' + Number(b.extras_fee).toLocaleString() + '</span></div>';
    if (b.deposit > 0) html += '<div class="rbd-row"><span class="l">Security deposit</span><span class="v">$' + Number(b.deposit).toLocaleString() + '</span></div>';
    html += '<div class="rbd-row total"><span class="l">Total</span><span class="v">$' + Number(b.total_amount).toLocaleString() + '</span></div></div>';

    if (isCustomer) {
      html += '<div class="account-actions">';
      if (biz.phone) html += '<a class="account-secondary" href="tel:' + esc(biz.phone) + '">Call Provider</a>';
      if (biz.whatsapp) html += '<a class="account-secondary" href="https://wa.me/' + esc(String(biz.whatsapp).replace(/[^\d+]/g, '').replace('+', '')) + '" target="_blank" rel="noopener">WhatsApp</a>';
      if (canCancel) html += '<button type="button" class="account-secondary" id="rbdCancel" style="border-color:#FCA5A5;color:#991B1B">Cancel Booking</button>';
      html += '</div>';
    }

    root.innerHTML = html;

    var cancelBtn = document.getElementById('rbdCancel');
    if (cancelBtn) {
      cancelBtn.onclick = function () {
        if (!confirm('Cancel this booking? The provider will be notified. This cannot be undone.')) return;
        cancelBtn.disabled = true;
        cancelBtn.textContent = 'Cancelling…';
        window.PMRentals.cancelRentalBooking(b.id).then(function () {
          load();
        }).catch(function (err) {
          alert((err && err.message) || 'Could not cancel this booking.');
          cancelBtn.disabled = false;
          cancelBtn.textContent = 'Cancel Booking';
        });
      };
    }
  }

  function load() {
    var token = gate();
    if (!token || !id) {
      if (token && !id) root.innerHTML = '<div class="account-empty"><h2>Booking not found</h2><p>No booking was specified.</p></div>';
      return;
    }
    var svc = window.PMRentals;
    if (!svc || !svc.fetchRentalBookingDetail) {
      root.innerHTML = '<div class="account-empty"><h2>Could not load this booking</h2><p>Please refresh and try again.</p></div>';
      return;
    }
    svc.fetchRentalBookingDetail(id).then(function (b) {
      if (!b) {
        root.innerHTML = '<div class="account-empty"><h2>Booking not found</h2><p>This booking may have been removed, or you may not have access to it.</p></div>';
        return;
      }
      render(b, token.user && token.user.id);
    }).catch(function (err) {
      if (window.console) console.warn('rental booking detail:', err);
      root.innerHTML = '<div class="account-empty"><h2>Could not load this booking</h2><p>Please refresh and try again.</p></div>';
    });
  }

  load();
})();
