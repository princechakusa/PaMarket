/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
// ── Shared filter infrastructure for all category pages ────
(function (H) {

  H._filters = {};
  H._currentTalentSector = 'All';

  function getF(id) { return H._filters[id] || (H._filters[id] = {}); }

  H._setFilter = function (catId, key, val) {
    getF(catId)[key] = val;
    H._applyFilters(catId);
  };

  H._toggleFilters = function (catId) {
    var fp = document.getElementById('fp_' + catId);
    if (fp) fp.style.display = fp.style.display === 'none' ? 'block' : 'none';
  };

  H._clearFilters = function (catId) {
    H._filters[catId] = {};
    var fp = document.getElementById('fp_' + catId);
    if (fp) {
      fp.querySelectorAll('select').forEach(function (s) { s.value = ''; });
      fp.querySelectorAll('input[type=number],input[type=text]').forEach(function (i) { i.value = ''; });
      fp.querySelectorAll('.flt-pill.on').forEach(function (b) { b.classList.remove('on'); });
    }
    H._applyFilters(catId);
  };

  H._applyFilters = function (catId) {
    var el = document.getElementById('cl_' + catId);
    if (!el) return;
    var f = getF(catId);
    var baseCat = catId.replace('_sale', '').replace('_rent', '');
    var all = (H.state.listings || []).filter(function (l) {
      return l.status === 'active' && l.cat === baseCat;
    });
    if (catId === 'property_sale') all = all.filter(function (l) { return !l.rentalType; });
    if (catId === 'property_rent') all = all.filter(function (l) { return !!l.rentalType; });

    var inp = document.getElementById('cs_' + catId);
    var q = inp ? inp.value.toLowerCase().trim() : '';
    if (q) all = all.filter(function (l) {
      return (l.title + ' ' + (l.desc || '') + ' ' + (l.city || '') + ' ' + (l.suburb || '')).toLowerCase().includes(q);
    });

    if (f.priceMin) all = all.filter(function (l) { return (l.price || 0) >= +f.priceMin; });
    if (f.priceMax) all = all.filter(function (l) { return (l.price || 0) <= +f.priceMax; });
    if (f.city && f.city !== 'all') all = all.filter(function (l) { return (l.city + ' ' + (l.prov || '')).toLowerCase().includes(f.city.toLowerCase()); });
    if (f.condition && f.condition !== 'all') all = all.filter(function (l) { return (l.condition || '').toLowerCase() === f.condition; });
    if (f.furnishing && f.furnishing !== 'all') all = all.filter(function (l) { return (l.furnishing || '').toLowerCase() === f.furnishing; });
    if (f.propType && f.propType !== 'all') all = all.filter(function (l) { return (l.propType || '').toLowerCase() === f.propType; });
    if (f.rentalType && f.rentalType !== 'all') all = all.filter(function (l) { return (l.rentalType || '').toLowerCase() === f.rentalType; });
    if (f.beds && f.beds !== 'any') {
      if (f.beds === 'studio') all = all.filter(function (l) { return String(l.beds || '').toLowerCase() === 'studio' || +(l.beds || 0) === 0; });
      else all = all.filter(function (l) { return String(l.beds).toLowerCase() !== 'studio' && +(l.beds || 0) >= +f.beds; });
    }
    if (f.baths && f.baths !== 'any') all = all.filter(function (l) { return +(l.baths || 0) >= +f.baths; });
    if (f.subcat && f.subcat !== 'all') all = all.filter(function (l) { return (l.subcat || l.type || '').toLowerCase() === f.subcat; });
    if (f.brand) all = all.filter(function (l) { return (l.brand || l.make || '').toLowerCase().includes(f.brand.toLowerCase()); });
    if (f.gender && f.gender !== 'all') all = all.filter(function (l) { return (l.gender || '').toLowerCase() === f.gender; });
    if (f.size && f.size !== 'all') all = all.filter(function (l) { return (l.size || '').toLowerCase() === f.size; });
    if (f.sizeMin) all = all.filter(function (l) { return +(l.size || 0) >= +f.sizeMin; });
    if (f.sizeMax) all = all.filter(function (l) { return +(l.size || 0) > 0 && +(l.size || 0) <= +f.sizeMax; });
    if (f.fuelType && f.fuelType !== 'all') all = all.filter(function (l) { return (l.fuel || l.fuelType || '').toLowerCase() === f.fuelType; });
    if (f.yearMin) all = all.filter(function (l) { return +(l.year || 0) >= +f.yearMin; });
    if (f.yearMax) all = all.filter(function (l) { return +(l.year || 9999) <= +f.yearMax; });
    if (Array.isArray(f.amenities) && f.amenities.length) all = all.filter(function (l) {
      var feats = Array.isArray(l.features) ? l.features : ((l.attrs && Array.isArray(l.attrs.features)) ? l.attrs.features : []);
      return f.amenities.every(function (a) { return feats.indexOf(a) !== -1; });
    });

    var sort = f.sort || 'newest';
    all.sort(function (a, b) {
      if (sort === 'price_asc') return (a.price || 0) - (b.price || 0);
      if (sort === 'price_desc') return (b.price || 0) - (a.price || 0);
      if (sort === 'oldest') return a.createdAt - b.createdAt;
      return b.createdAt - a.createdAt;
    });

    // Sponsored carousel — ads targeting this category (banner or spotlight).
    var spotlightHtml = (H.adCarousel && H.activeAds)
      ? H.adCarousel(H.activeAds(baseCat), { heading: false })
      : '';

    el.innerHTML = all.length
      ? spotlightHtml + '<div class="listing-list">' + all.map(H.renderListCard).join('') + '</div>'
      : spotlightHtml + H.emptyState('No listings match', 'Try adjusting your filters', null, null);
    if (H._initAdCarousels) H._initAdCarousels();

    var cnt = document.getElementById('cc_' + catId);
    if (cnt) cnt.textContent = all.length + ' listing' + (all.length !== 1 ? 's' : '');

    // update filter badge
    var n = Object.keys(getF(catId)).filter(function (k) {
      var v = getF(catId)[k]; return v && v !== '' && v !== 'all' && v !== 'any' && v !== 'newest';
    }).length;
    var b = document.getElementById('fb_' + catId);
    if (b) { b.textContent = n || ''; b.style.display = n ? 'flex' : 'none'; }
  };

  // ── UI builder helpers (attached to H so separate files can use them) ──
  var ZW_CITIES = ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Kwekwe', 'Kadoma', 'Masvingo', 'Chinhoyi', 'Bindura', 'Marondera', 'Hwange', 'Victoria Falls', 'Zvishavane'];
  H._ZW_CITIES = ZW_CITIES;

  H._sel = function (id, key, label, opts) {
    var html = '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">' + label + '</div>';
    html += '<select onchange="H._setFilter(\'' + id + '\',\'' + key + '\',this.value)" style="width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:9px;font-size:13px;background:var(--bg);color:var(--text);outline:none">';
    opts.forEach(function (o) {
      var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
      html += '<option value="' + H.escHtml(v) + '">' + H.escHtml(t) + '</option>';
    });
    return html + '</select></div>';
  };

  H._priceRange = function (id) {
    return '<div class="flt-section"><div class="flt-label">Price Range (USD)</div>'
      + '<div class="flt-range">'
      + '<div class="flt-range-in"><span class="pre">$</span><input type="number" min="0" placeholder="Min" oninput="H._setFilter(\'' + id + '\',\'priceMin\',this.value)"></div>'
      + '<span class="flt-range-sep">to</span>'
      + '<div class="flt-range-in"><span class="pre">$</span><input type="number" min="0" placeholder="Max" oninput="H._setFilter(\'' + id + '\',\'priceMax\',this.value)"></div>'
      + '</div></div>';
  };

  // Area / Size range in m² (Zim standard).
  H._sizeRange = function (id) {
    return '<div class="flt-section"><div class="flt-label">Area / Size (m²)</div>'
      + '<div class="flt-range">'
      + '<div class="flt-range-in"><input type="number" min="0" placeholder="Min" oninput="H._setFilter(\'' + id + '\',\'sizeMin\',this.value)"><span class="suf">m²</span></div>'
      + '<span class="flt-range-sep">to</span>'
      + '<div class="flt-range-in"><input type="number" min="0" placeholder="Max" oninput="H._setFilter(\'' + id + '\',\'sizeMax\',this.value)"><span class="suf">m²</span></div>'
      + '</div></div>';
  };

  // Year range (vehicles).
  H._yearRange = function (id) {
    return '<div class="flt-section"><div class="flt-label">Year</div>'
      + '<div class="flt-range">'
      + '<div class="flt-range-in"><input type="number" min="1960" max="2030" placeholder="From" oninput="H._setFilter(\'' + id + '\',\'yearMin\',this.value)"></div>'
      + '<span class="flt-range-sep">to</span>'
      + '<div class="flt-range-in"><input type="number" min="1960" max="2030" placeholder="To" oninput="H._setFilter(\'' + id + '\',\'yearMax\',this.value)"></div>'
      + '</div></div>';
  };

  // Selectable pill row (single-select). opts: array of value or [value,label].
  H._pills = function (id, key, label, opts) {
    return '<div class="flt-section"><div class="flt-label">' + label + '</div><div class="flt-pills" data-pillkey="' + key + '">'
      + opts.map(function (o) {
        var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
        return '<button type="button" class="flt-pill" onclick="H._setPill(\'' + id + '\',\'' + key + '\',\'' + H.escHtml(v) + '\',this)">' + H.escHtml(t) + '</button>';
      }).join('')
      + '</div></div>';
  };

  H._setPill = function (id, key, val, btn) {
    var f = H._filters[id] = H._filters[id] || {};
    var group = btn.parentNode;
    if (f[key] === val) { f[key] = ''; btn.classList.remove('on'); }
    else { f[key] = val; group.querySelectorAll('.flt-pill').forEach(function (b) { b.classList.remove('on'); }); btn.classList.add('on'); }
    H._applyFilters(id);
  };

  // Amenity multi-select chips, drawn from the category's attribute schema.
  H._amenityFilter = function (id, cat) {
    var schema = (H.CATEGORY_ATTRS && H.CATEGORY_ATTRS[cat]) || [];
    var field = schema.filter(function (x) { return x.type === 'chips'; })[0];
    if (!field) return '';
    return '<div class="flt-section"><div class="flt-label">' + H.escHtml(field.label) + '</div><div class="flt-pills flt-amenities">'
      + field.options.map(function (o) {
        return '<button type="button" class="flt-pill" onclick="H._toggleAmenity(\'' + id + '\',\'' + H.escHtml(o) + '\',this)">' + H.escHtml(o) + '</button>';
      }).join('')
      + '</div></div>';
  };

  H._toggleAmenity = function (id, val, btn) {
    var f = H._filters[id] = H._filters[id] || {};
    f.amenities = f.amenities || [];
    var i = f.amenities.indexOf(val);
    if (i >= 0) { f.amenities.splice(i, 1); btn.classList.remove('on'); }
    else { f.amenities.push(val); btn.classList.add('on'); }
    H._applyFilters(id);
  };

  H._citysel = function (id) {
    return H._sel(id, 'city', 'Location', [['all', 'All Zimbabwe']].concat(ZW_CITIES.map(function (c) { return [c, c]; })));
  };

  H._sortsel = function (id) {
    return H._sel(id, 'sort', 'Sort By', [['newest', 'Newest First'], ['oldest', 'Oldest First'], ['price_asc', 'Price: Low → High'], ['price_desc', 'Price: High → Low']]);
  };

  H._txtInput = function (id, key, label, placeholder) {
    return '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">' + label + '</div>'
      + '<input type="text" placeholder="' + H.escHtml(placeholder) + '" oninput="H._setFilter(\'' + id + '\',\'' + key + '\',this.value)" style="width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:9px;font-size:13px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box"></div>';
  };

  H._catHeader = function (id, name, color, filterHtml) {
    var dark = ['#1A3A8F','#e53935','#8E24AA','#00838F','#388E3C','#6D4C41','#FB8C00','#E91E63','#546E7A','#00897B','#F06292'].indexOf(color) > -1;
    var tc = dark ? '#fff' : '#1A3A8F', sc = dark ? 'rgba(255,255,255,.65)' : 'rgba(26,58,143,.7)';
    var sbg = dark ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.9)', sclr = dark ? '#fff' : '#1A3A8F';
    return '<div style="background:' + color + ';padding:0 12px 12px">'
      + '<div style="display:flex;gap:8px;align-items:center">'
      + '<div style="background:' + sbg + ';border-radius:12px;display:flex;align-items:center;padding:0 12px;gap:8px;flex:1">'
      + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="' + (dark ? 'rgba(255,255,255,.7)' : '#999') + '" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + '<input id="cs_' + id + '" placeholder="Search ' + H.escHtml(name) + '…" autocomplete="off" oninput="H._applyFilters(\'' + id + '\')" style="flex:1;border:none;outline:none;padding:12px 0;font-size:14px;background:transparent;color:' + sclr + ';font-family:Inter,sans-serif;caret-color:#F5A623"></div>'
      + '<button onclick="H._toggleFilters(\'' + id + '\')" style="background:rgba(255,255,255,.2);border:none;color:' + tc + ';padding:10px 12px;border-radius:12px;cursor:pointer;position:relative;display:flex;align-items:center;gap:5px;font-size:13px;font-weight:600">'
      + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>Filter'
      + '<span id="fb_' + id + '" style="display:none;background:#F5A623;color:#1A3A8F;font-size:10px;font-weight:800;min-width:16px;height:16px;border-radius:8px;align-items:center;justify-content:center;padding:0 4px"></span></button>'
      + '</div>'
      + '<div style="color:' + sc + ';font-size:12px;font-weight:600;margin-top:8px;padding:0 2px"><span id="cc_' + id + '">…</span></div>'
      + '</div>'
      + '<div id="fp_' + id + '" style="display:none;background:var(--card);border-bottom:2px solid ' + color + ';padding:16px 14px">'
      + filterHtml
      + '<div style="display:flex;gap:8px;margin-top:4px">'
      + '<button onclick="H._clearFilters(\'' + id + '\')" style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;color:var(--sub);cursor:pointer">Clear</button>'
      + '<button onclick="H._toggleFilters(\'' + id + '\')" style="flex:2;padding:10px;background:' + color + ';border:none;border-radius:10px;font-size:13px;font-weight:700;color:' + tc + ';cursor:pointer">Apply Filters</button>'
      + '</div></div>';
  };

  H._catTopbar = function (title, color) {
    return '<div class="det-topbar" style="background:' + (color || '#1A3A8F') + '">'
      + '<button class="back" onclick="H.goBack()" style="color:#fff"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<div class="det-topbar-title" style="color:#fff">' + H.escHtml(title) + '</div>'
      + '<button onclick="H.navTo(\'Post\')" style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer;padding:6px 12px;border-radius:8px;white-space:nowrap">+ Post</button>'
      + '</div>';
  };

  // ── Override filterByCat for all 12 categories ────────────
  var CAT_PAGE = {
    property: 'Property', vehicles: 'Vehicles', rooms: 'Rooms',
    electronics: 'Electronics', furniture: 'Furniture', fashion: 'Fashion',
    services: 'Services', jobs: 'Jobs', agriculture: 'Agriculture',
    pets: 'Pets', kids: 'Kids', other: 'Other'
  };

  // Open the listing page for a category (optionally pre-filtered by subcategory).
  H._openCatPage = function (cid, subKey) {
    function setF(fid) { H._filters[fid] = H._filters[fid] || {}; if (subKey) H._filters[fid].subcat = subKey; else delete H._filters[fid].subcat; }
    setF(cid);
    if (cid === 'property') { setF('property_sale'); setF('property_rent'); }
    var page = CAT_PAGE[cid];
    if (page) H.openInner(page, { cid: cid });
    else H.openInner('CategoryView', { cid: cid });
  };

  // Tapping a category on Home: show its subcategory list first (if it has one),
  // otherwise jump straight to the listing page.
  H.filterByCat = function (cid) {
    if (cid === 'jobs') { H.openInner('JobIntent'); return; }
    if (H.SUBCATEGORIES && H.SUBCATEGORIES[cid] && H.SUBCATEGORIES[cid].length) {
      H.openInner('SubCat', { cid: cid });
    } else {
      H._openCatPage(cid, null);
    }
  };

  H._catColor = function (cid) {
    return ({ property:'#1A3A8F', vehicles:'#e53935', rooms:'#00838F', electronics:'#3949AB',
      furniture:'#6D4C41', fashion:'#E91E63', services:'#00897B', agriculture:'#388E3C',
      pets:'#8E24AA', kids:'#FB8C00', jobs:'#546E7A', other:'#546E7A' }[cid]) || '#1A3A8F';
  };

  // ── Subcategory picker (PaMarket's own drill-down) ──
  H.pages.SubCat = function (params) {
    var cid = params && params.cid;
    var cat = (H.CATEGORIES || []).filter(function (c) { return c.id === cid; })[0];
    var subs = (H.SUBCATEGORIES && H.SUBCATEGORIES[cid]) || [];
    var name = cat ? cat.name : 'Browse';
    var color = H._catColor(cid);
    var chev = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
    var check = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="' + color + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    var rows = '<button class="subcat-row subcat-all" onclick="H._openCatPage(\'' + cid + '\',null)">'
      + '<span>All in ' + H.escHtml(name) + '</span>' + check + '</button>';
    rows += subs.map(function (s) {
      return '<button class="subcat-row" onclick="H._openCatPage(\'' + cid + '\',\'' + H.escHtml(s.key) + '\')">'
        + '<span>' + H.escHtml(s.label) + '</span>' + chev + '</button>';
    }).join('');
    return '<div class="page active">'
      + H.innerTopbar(name)
      + '<div class="subcat-list">' + rows + '</div></div>';
  };

  // legacy compat
  H._catSearch = function (q, catId) { H._applyFilters(catId); };

})(window.H);
