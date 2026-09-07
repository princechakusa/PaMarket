// Canonical marketplace taxonomy (categories/provinces/cities) — Stage 4 of
// the centralization work. Mirrors js/site-content.js: a plain REST fetch
// with the anon key that resolves to null on any failure, so every caller
// can safely fall back to the static <option> list already in the page's
// HTML. Populating a <select> here only ever REPLACES its options with an
// equivalent (fresher) set — it never removes the select, never blocks
// submission, and never runs before the static options are already visible.
(function (global) {
  var sharedClient = global.PMSupabaseClient && global.PMSupabaseClient.get();
  var SB_URL = sharedClient ? sharedClient.url : global.SUPABASE_URL;
  var SB_KEY = sharedClient ? sharedClient.publishableKey : global.SUPABASE_ANON_KEY;
  var REQUEST_TIMEOUT_MS = 6000;
  var cache = { category: null, province: null, city: null };

  function withTimeout(promise) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('taxonomy request timed out')); }, REQUEST_TIMEOUT_MS);
      promise.then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
    });
  }

  function fetchTable(table, select, order) {
    var path = '/rest/v1/' + table + '?is_active=eq.true&select=' + select + '&order=' + order + '&limit=1000';
    return withTimeout(fetch(SB_URL + path, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
    })).then(function (res) {
      if (!res.ok) throw new Error(table + ' request failed');
      return res.json();
    }).catch(function () { return null; });
  }

  // Each resolves to an array of {value, label} or null (never rejects).
  function fetchCategories() {
    if (cache.category) return Promise.resolve(cache.category);
    return fetchTable('categories', 'legacy_key,name', 'sort_order.asc').then(function (rows) {
      if (!rows) return null;
      var mapped = rows.map(function (r) { return { value: r.legacy_key, label: r.name }; });
      cache.category = mapped;
      return mapped;
    });
  }
  function fetchProvinces() {
    if (cache.province) return Promise.resolve(cache.province);
    return fetchTable('provinces', 'name', 'sort_order.asc').then(function (rows) {
      if (!rows) return null;
      var mapped = rows.map(function (r) { return { value: r.name, label: r.name }; });
      cache.province = mapped;
      return mapped;
    });
  }
  function fetchCities(provinceName) {
    // Cities aren't cached per-province (319 rows total is small enough to
    // fetch once and filter client-side for the few pages that need a
    // province-scoped list).
    var key = 'all';
    if (cache[key]) return Promise.resolve(filterCities(cache[key], provinceName));
    return fetchTable('cities', 'name,province_id,provinces(name)', 'sort_order.asc').then(function (rows) {
      if (!rows) return null;
      var mapped = rows.map(function (r) { return { value: r.name, label: r.name, province: r.provinces && r.provinces.name }; });
      cache[key] = mapped;
      return filterCities(mapped, provinceName);
    });
  }
  function filterCities(all, provinceName) {
    if (!provinceName) return all;
    return all.filter(function (c) { return c.province === provinceName; });
  }

  // Repopulates a <select> with {value,label} options, preserving its
  // current selection when possible and keeping any existing "All ..."/
  // "Choose..." placeholder option (first option with an empty value) plus
  // any option not present in `options` at all (e.g. post-job.html's
  // "Remote" province) — so this only ever ADDS/refreshes recognized
  // entries, never silently removes a domain-specific extra one.
  function populateSelect(select, options) {
    if (!select || !options || !options.length) return;
    var currentValue = select.value;
    var known = {};
    options.forEach(function (o) { known[o.value] = true; });
    var kept = [];
    Array.prototype.forEach.call(select.options, function (opt) {
      if (opt.value === '' || !known[opt.value]) kept.push({ value: opt.value, label: opt.textContent });
    });
    var placeholder = kept.length && kept[0].value === '' ? [kept[0]] : [];
    var extras = kept.filter(function (k) { return k.value !== ''; });
    var all = placeholder.concat(options).concat(extras);
    select.innerHTML = all.map(function (o) {
      return '<option value="' + escapeAttr(o.value) + '">' + escapeHtml(o.label) + '</option>';
    }).join('');
    if (known[currentValue] || currentValue === '') select.value = currentValue;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  // Finds every [data-taxonomy] select on the page and upgrades it in the
  // background. Safe to call multiple times (e.g. after a province change
  // re-scopes a city select) — each call is independent and non-blocking.
  function upgradeAll(root) {
    var scope = root || document;
    var categorySelects = scope.querySelectorAll('[data-taxonomy="category"]');
    var provinceSelects = scope.querySelectorAll('[data-taxonomy="province"]');
    var citySelects = scope.querySelectorAll('[data-taxonomy="city"]');
    if (categorySelects.length) {
      fetchCategories().then(function (opts) {
        if (!opts) return;
        categorySelects.forEach(function (el) { populateSelect(el, opts); });
      });
    }
    if (provinceSelects.length) {
      fetchProvinces().then(function (opts) {
        if (!opts) return;
        provinceSelects.forEach(function (el) { populateSelect(el, opts); });
      });
    }
    if (citySelects.length) {
      fetchCities(null).then(function (opts) {
        if (!opts) return;
        citySelects.forEach(function (el) { populateSelect(el, opts); });
      });
    }
  }

  global.PMTaxonomy = {
    fetchCategories: fetchCategories,
    fetchProvinces: fetchProvinces,
    fetchCities: fetchCities,
    populateSelect: populateSelect,
    upgradeAll: upgradeAll,
  };

  function init() {
    upgradeAll(document);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
