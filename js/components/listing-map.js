/* ============================================================
   js/components/listing-map.js — reusable Leaflet + OpenStreetMap
   component (free, no API key) for plotting real PaMarket listings.

   Matches the Leaflet/OSM convention already used elsewhere in this
   codebase (post-ad.html's location picker, same unpkg CDN + tile
   server, same Harare default center) rather than introducing a new
   mapping approach.

   This module owns ONLY map rendering. It never queries listings
   itself — callers pass in already-fetched, real listing rows.

   Consumers:
   - browse.html's "Split Map & List" view (js/controllers/browse-map.js)
     — many pins, click-to-highlight a list card. First consumer, wired
     up as part of this task.
   - A future detail.html single-listing location map — NOT wired up in
     this task (detail.html hasn't been rebuilt yet). It can call
     PMListingMap.create() with a one-item array via setListings() and
     get sensible single-pin centering for free; no changes needed here.

   Public API:
     PMListingMap.create(containerEl, opts) -> instance | null
       opts:
         center           [lat,lng] fallback view center when there are
                           no pins yet (defaults to Harare)
         zoom              default/fallback zoom (defaults to 12; a
                           single pin instead zooms to 15)
         scrollWheelZoom   boolean, default false (matches post-ad.html's
                           picker so page scroll isn't hijacked)
         onPinClick        function(listing) — called when a pin is
                           clicked, with the full listing object

     instance.setListings(listings)
       Replace all pins. Each item needs {id, title, price, currency,
       latitude, longitude}. Items missing latitude/longitude are
       silently skipped — coordinates are never fabricated. Automatically
       fits bounds to whatever real pins exist (or centers/zooms for a
       single pin). Returns the array of listings that actually got a
       pin (the ones with real coordinates).
     instance.highlight(id)
       Pans to and opens the popup for one listing's pin, if it has one.
     instance.invalidateSize()
       Call after the map's container becomes visible (e.g. was
       display:none). Leaflet sizes itself from its container's
       dimensions at creation time and needs a nudge if that was 0.
     instance.getMap() / instance.getMarker(id)
       Escape hatches to the underlying Leaflet objects.
   ============================================================ */
(function () {
  'use strict';

  var HARARE = [-17.8292, 31.0522];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { n = Number(n) || 0; return n.toLocaleString('en-US', { maximumFractionDigits: 0 }); }

  function create(containerEl, opts) {
    opts = opts || {};
    if (typeof L === 'undefined' || !containerEl) return null;

    var map = L.map(containerEl, { scrollWheelZoom: !!opts.scrollWheelZoom }).setView(opts.center || HARARE, opts.zoom || 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);

    var layer = L.layerGroup().addTo(map);
    var markersById = {};

    function pinIcon(listing) {
      return L.divIcon({
        className: '',
        html: '<div class="pm-map-pin">' + esc(listing.currency || 'USD') + ' ' + money(listing.price) + '</div>',
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });
    }

    function setListings(listings) {
      layer.clearLayers();
      markersById = {};
      var withCoords = (listings || []).filter(function (l) {
        return l && l.latitude != null && l.longitude != null && !isNaN(Number(l.latitude)) && !isNaN(Number(l.longitude));
      });
      if (!withCoords.length) { map.setView(opts.center || HARARE, opts.zoom || 12); return withCoords; }

      var bounds = [];
      withCoords.forEach(function (l) {
        var lat = Number(l.latitude), lng = Number(l.longitude);
        bounds.push([lat, lng]);
        var marker = L.marker([lat, lng], { icon: pinIcon(l) }).addTo(layer);
        marker.bindPopup(
          '<strong>' + esc(l.title || '') + '</strong><br>' +
          esc(l.currency || 'USD') + ' ' + money(l.price) +
          '<br><a href="detail.html?id=' + encodeURIComponent(l.id) + '">View listing &rarr;</a>'
        );
        marker.on('click', function () { if (opts.onPinClick) opts.onPinClick(l); });
        markersById[l.id] = marker;
      });

      if (bounds.length === 1) map.setView(bounds[0], opts.zoom || 15);
      else map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });

      return withCoords;
    }

    function highlight(id) {
      var m = markersById[id];
      if (!m) return;
      map.panTo(m.getLatLng());
      m.openPopup();
    }

    return {
      setListings: setListings,
      highlight: highlight,
      invalidateSize: function () { setTimeout(function () { map.invalidateSize(); }, 50); },
      getMap: function () { return map; },
      getMarker: function (id) { return markersById[id]; }
    };
  }

  window.PMListingMap = { create: create, HARARE: HARARE };
})();
