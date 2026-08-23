(function (root, factory) {
  var api = factory(root, root.PMServiceTransport, root.PMSupabaseClient);
  if (typeof module !== 'undefined' && module.exports) module.exports = factory;
  if (root) root.PMSavedContent = api;
})(typeof self !== 'undefined' ? self : this, function (root, transport, clientProvider) {
  'use strict';
  var client = clientProvider && clientProvider.get();
  var url = client ? client.url : root.SUPABASE_URL;
  var key = client ? client.publishableKey : root.SUPABASE_ANON_KEY;
  var esc = transport && transport.escape ? transport.escape : encodeURIComponent;

  function session() {
    return transport && transport.session ? transport.session() :
      (root.PMSession && typeof root.PMSession.getSession === 'function' ? root.PMSession.getSession() : null);
  }

  function favouriteRpc(name, listingId) {
    var s = session();
    if (!s || !s.access_token) return Promise.reject(new Error('not-authenticated'));
    return root.fetch(url + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_listing_id: String(listingId) }),
    }).then(function (res) {
      if (res.ok) return { ok: true };
      return res.text().then(function (text) { throw new Error(text || (name + ' failed: ' + res.status)); });
    });
  }

  function saveListing(listingId) {
    return favouriteRpc('save_listing', listingId);
  }
  function unsaveListing(listingId) {
    return favouriteRpc('unsave_listing', listingId);
  }

  function listFavouriteIds() {
    var s = session();
    if (!s || !s.access_token || !s.user) return Promise.resolve([]);
    return root.fetch(url + '/rest/v1/user_saves?user_id=eq.' + esc(s.user.id) + '&select=listing_id,saved_at&order=saved_at.desc&limit=500', {
      headers: { apikey: key, Authorization: 'Bearer ' + s.access_token },
    }).then(function (res) { if (!res.ok) throw new Error('favourites-read-failed'); return res.json(); });
  }

  function listFavourites() {
    return listFavouriteIds().then(function (saves) {
      if (!saves.length) return [];
      var ids = saves.map(function (item) { return String(item.listing_id).replace(/[^a-zA-Z0-9_-]/g, ''); }).filter(Boolean);
      if (!ids.length) return [];
      var path = 'listings?id=in.(' + ids.join(',') + ')&status=eq.active&expires_at=gt.' + esc(new Date().toISOString()) + '&select=*';
      var rowsPromise = transport && transport.fetchJson ? transport.fetchJson(path) : root.fetch(url + '/rest/v1/' + path, {
        headers: { apikey: key, Authorization: 'Bearer ' + key },
      }).then(function (res) { if (!res.ok) throw new Error('Supabase request failed: ' + res.status); return res.json(); });
      return rowsPromise.then(function (rows) {
        var byId = {}; rows.forEach(function (row) { byId[String(row.id)] = row; });
        return saves.map(function (save) {
          var row = byId[String(save.listing_id)];
          if (row) row.saved_at = save.saved_at;
          return row;
        }).filter(Boolean);
      });
    });
  }

  function isListingSaved(listingId) {
    return listFavouriteIds().then(function (rows) {
      return rows.some(function (item) {
        return String(item.listing_id) === String(listingId);
      });
    });
  }

  function listSavedSearches() {
    var s = session();
    if (!s || !s.access_token || !s.user) return Promise.resolve([]);
    return root.fetch(url + '/rest/v1/saved_searches?user_id=eq.' + esc(s.user.id) + '&select=*&order=saved_at.desc&limit=200', {
      headers: { apikey: key, Authorization: 'Bearer ' + s.access_token },
    }).then(function (res) { if (!res.ok) throw new Error('saved-searches-read-failed'); return res.json(); });
  }

  function saveSearch(name, filters) {
    var s = session();
    if (!s || !s.access_token || !s.user) return Promise.reject(new Error('not-authenticated'));
    var clean = filters || {};
    var row = { user_id: s.user.id, name: String(name || clean.q || clean.category || 'Saved search').slice(0, 80), query: clean.q || null, category: clean.category || null, filters: clean };
    return root.fetch(url + '/rest/v1/saved_searches', {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(row),
    }).then(function (res) { if (res.ok) return res.json().then(function (rows) { return rows[0] || row; }); return res.text().then(function (text) { throw new Error(text || 'save-search-failed'); }); });
  }

  function deleteSavedSearch(id) {
    var s = session();
    if (!s || !s.access_token || !s.user) return Promise.reject(new Error('not-authenticated'));
    return root.fetch(url + '/rest/v1/saved_searches?id=eq.' + esc(id) + '&user_id=eq.' + esc(s.user.id), {
      method: 'DELETE', headers: { apikey: key, Authorization: 'Bearer ' + s.access_token },
    }).then(function (res) { if (res.ok) return { ok: true }; return res.text().then(function (text) { throw new Error(text || 'delete-search-failed'); }); });
  }

  return Object.freeze({
    saveListing: saveListing,
    unsaveListing: unsaveListing,
    listFavouriteIds: listFavouriteIds,
    listFavourites: listFavourites,
    isListingSaved: isListingSaved,
    listSavedSearches: listSavedSearches,
    saveSearch: saveSearch,
    deleteSavedSearch: deleteSavedSearch,
  });
});
