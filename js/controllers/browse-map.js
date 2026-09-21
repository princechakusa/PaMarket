/* ============================================================
   js/controllers/browse-map.js — wires the reusable
   js/components/listing-map.js (Leaflet + OpenStreetMap, no API key)
   into browse.html's "Split Map & List" view mode.

   This file owns NO listing data/query logic of its own. Every row it
   plots or lists comes straight from js/controllers/browse-page.js's
   existing real Supabase-backed fetch (the same one that drives the
   grid/list views) — browse-page.js calls window.PMBrowseMap.render(rows)
   with its already-fetched page of listings, and re-uses its own
   listingCard() renderer (exposed as window.PMBrowse.renderCard) for the
   split view's list column, so there is exactly one query path and one
   card markup, not a duplicated second copy.
   ============================================================ */
(function () {
  'use strict';

  var instance = null;

  function ensureMap() {
    if (instance) return instance;
    var el = document.getElementById('browseMapEl');
    if (!el || typeof window.PMListingMap === 'undefined') return null;
    instance = window.PMListingMap.create(el, {
      onPinClick: function (listing) { highlightCard(listing.id); }
    });
    return instance;
  }

  function highlightCard(id) {
    var card = document.getElementById('pm-map-card-' + id);
    if (!card) return;
    var prev = document.querySelectorAll('#mapListingsList .pm-map-active');
    for (var i = 0; i < prev.length; i++) prev[i].classList.remove('pm-map-active', 'ring-2', 'ring-primary');
    card.classList.add('pm-map-active', 'ring-2', 'ring-primary');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function wireHover(listEl) {
    if (listEl.__pmWired) return;
    listEl.__pmWired = true;
    // Hovering a card in the list pans/opens the matching pin — the
    // reverse of pin-click-highlights-card. Cheap because it's plain DOM
    // delegation, no extra network calls.
    listEl.addEventListener('mouseover', function (e) {
      var card = e.target.closest ? e.target.closest('[data-listing-id]') : null;
      if (!card || !instance) return;
      instance.highlight(card.getAttribute('data-listing-id'));
    });
  }

  function render(rows, cardFn) {
    rows = rows || [];
    var listEl = document.getElementById('mapListingsList');
    var noteEl = document.getElementById('mapNoCoordsNote');

    if (listEl) {
      listEl.innerHTML = rows.length
        ? rows.map(function (l) { return cardFn(l, true); }).join('')
        : '<div class="text-center text-body-sm text-on-surface-variant py-space-lg">No listings match these filters yet.</div>';
      wireHover(listEl);
    }

    var withCoords = rows.filter(function (l) { return l.latitude != null && l.longitude != null; });
    if (noteEl) {
      if (!rows.length) noteEl.textContent = '';
      else if (!withCoords.length) noteEl.textContent = 'None of the listings on this page have a saved map location yet — they still appear in the list.';
      else noteEl.textContent = withCoords.length + ' of ' + rows.length + ' listing' + (rows.length === 1 ? '' : 's') + ' on this page ' + (withCoords.length === 1 ? 'has' : 'have') + ' a saved map location.';
    }

    var map = ensureMap();
    if (map) map.setListings(rows);
  }

  window.PMBrowseMap = {
    render: render,
    highlight: highlightCard,
    invalidateSize: function () { if (instance) instance.invalidateSize(); }
  };
})();
