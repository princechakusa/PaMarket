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

  // ── SELECT cols used in every category fetch ──────────────────────────────
  var LISTING_COLS = 'id,seller_id,seller_name,seller_phone,title,description,price,currency,category,province,city,suburb,photos,status,boost,views,business_id,created_at,updated_at,attributes';

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
      fp.querySelectorAll('select').forEach(function (s) { s.value = s.options[0] ? s.options[0].value : ''; });
      fp.querySelectorAll('input[type=number],input[type=text]').forEach(function (i) { i.value = ''; });
      fp.querySelectorAll('.flt-pill.on').forEach(function (b) { b.classList.remove('on'); });
      var sortSel = fp.querySelector('.flt-sort-sel');
      if (sortSel) sortSel.value = 'newest';
      // Reset main carousel
      var mainCar = document.getElementById('fc_' + catId);
      if (mainCar) mainCar.scrollTo({ left: 0, behavior: 'smooth' });
      document.querySelectorAll('#fd_' + catId + ' .flt-dot').forEach(function (d, i) { d.classList.toggle('on', i === 0); });
      // Reset amenity carousel
      var amenCar = document.getElementById('fca_' + catId);
      if (amenCar) amenCar.scrollTo({ left: 0, behavior: 'smooth' });
      document.querySelectorAll('#fda_' + catId + ' .flt-dot').forEach(function (d, i) { d.classList.toggle('on', i === 0); });
    }
    H._applyFilters(catId);
  };

  // ── ENTRY POINT — debounces and dispatches to server or local ─────────────
  H._applyFilters = function (catId) {
    var el = document.getElementById('cl_' + catId);
    if (!el) return;

    // Immediately show local results for instant feedback
    H._localFilter(catId);

    // Debounce the server round-trip so rapid filter changes only fire once
    clearTimeout(H._fltTimer);
    H._fltTimer = setTimeout(function () {
      if (window.supabase && typeof window.supabase.from === 'function') {
        H._serverFilter(catId).catch(function () { /* local results already shown */ });
      }
    }, 250);
  };

  // ── SERVER-SIDE FILTER — pushes heavy predicates into Supabase ───────────
  H._serverFilter = async function (catId) {
    var el = document.getElementById('cl_' + catId);
    if (!el) return;

    var f = getF(catId);
    var baseCat = catId.replace('_sale', '').replace('_rent', '');

    var q = window.supabase.from('listings')
      .select(LISTING_COLS)
      .eq('status', 'active')
      .eq('category', baseCat);

    // Price (top-level column — indexed)
    if (f.priceMin && +f.priceMin > 0) q = q.gte('price', +f.priceMin);
    if (f.priceMax && +f.priceMax > 0) q = q.lte('price', +f.priceMax);

    // City / Location (uses pg_trgm GIN index for leading-wildcard ILIKE)
    if (f.city && f.city !== 'all') {
      q = q.or('city.ilike.%' + f.city + '%,province.ilike.%' + f.city + '%');
    }

    // Sort at the DB level (top-level columns only; JSONB sorts stay client-side)
    var sort = f.sort || 'newest';
    if (sort === 'price_asc')  q = q.order('price',      { ascending: true  });
    else if (sort === 'price_desc') q = q.order('price', { ascending: false });
    else if (sort === 'oldest')     q = q.order('created_at', { ascending: true });
    else                            q = q.order('created_at', { ascending: false });

    // Cap at 200 — enough headroom for client-side JSONB attribute filters
    q = q.limit(200);

    var res = await q;
    if (res.error) throw res.error;

    var listings = (res.data || []).map(H._mapCloudListing);

    // Merge fresh rows into local state without displacing existing entries
    var seen = new Set((H.state.listings || []).map(function (l) { return l.id; }));
    var toAdd = listings.filter(function (l) { return !seen.has(l.id); });
    if (toAdd.length) H.state.listings = (H.state.listings || []).concat(toAdd);

    // Apply remaining filters that require attribute inspection
    var result = H._clientFilter(catId, listings);
    H._renderCatResults(catId, result, baseCat);
  };

  // ── LOCAL FILTER — runs against H.state.listings cache ───────────────────
  H._localFilter = function (catId) {
    var baseCat = catId.replace('_sale', '').replace('_rent', '');
    var pool = (H.state.listings || []).filter(function (l) {
      return l.status === 'active' && l.cat === baseCat;
    });
    var result = H._clientFilter(catId, pool);
    H._renderCatResults(catId, result, baseCat);
  };

  // ── CLIENT-SIDE FILTER — applies all predicates using AND logic ──────────
  // Operates on an already-fetched array; server pre-filtered by category,
  // price and city. This layer handles text search and JSONB attribute fields.
  H._clientFilter = function (catId, listings) {
    var f = getF(catId);
    var all = listings.slice(); // never mutate the source array

    // ── Property tab split ────────────────────────────────────────────────
    if (catId === 'property_sale') {
      all = all.filter(function (l) {
        var rt = _attr(l, 'rentalType');
        return rt === '' || rt === 'For Sale';
      });
    }
    if (catId === 'property_rent') {
      all = all.filter(function (l) {
        return _attr(l, 'rentalType') === 'For Rent';
      });
    }

    // ── Full-text search (AND logic — every word must appear) ─────────────
    var inp = document.getElementById('cs_' + catId);
    var q   = inp ? inp.value.toLowerCase().trim() : '';
    if (q) {
      var words = q.split(/\s+/).filter(Boolean);
      all = all.filter(function (l) {
        var hay = ((l.title || '') + ' ' + (l.desc || '') + ' ' + (l.city || '') + ' ' + (l.suburb || '')).toLowerCase();
        return words.every(function (w) { return hay.indexOf(w) !== -1; });
      });
    }

    // ── Price (covers local-only mode where server wasn't called) ─────────
    if (f.priceMin && +f.priceMin > 0) all = all.filter(function (l) { return (l.price || 0) >= +f.priceMin; });
    if (f.priceMax && +f.priceMax > 0) all = all.filter(function (l) { return (l.price || 0) <= +f.priceMax; });

    // ── City (covers local-only mode) ─────────────────────────────────────
    if (f.city && f.city !== 'all') {
      var cityLc = f.city.toLowerCase();
      all = all.filter(function (l) {
        return ((l.city || '') + ' ' + (l.prov || '')).toLowerCase().indexOf(cityLc) !== -1;
      });
    }

    // ── Condition — prefer attrs.condition, fall back to top-level column ──
    if (f.condition && f.condition !== 'all') {
      var condLc = f.condition.toLowerCase();
      all = all.filter(function (l) {
        return (_attr(l, 'condition') || l.condition || '').toLowerCase() === condLc;
      });
    }

    // ── Furnishing ────────────────────────────────────────────────────────
    if (f.furnishing && f.furnishing !== 'all') {
      var furnLc = f.furnishing.toLowerCase();
      all = all.filter(function (l) { return _attr(l, 'furnishing').toLowerCase() === furnLc; });
    }

    // ── Property type ─────────────────────────────────────────────────────
    if (f.propType && f.propType !== 'all') {
      var ptLc = f.propType.toLowerCase();
      all = all.filter(function (l) { return _attr(l, 'propType').toLowerCase() === ptLc; });
    }

    // ── Bedrooms ──────────────────────────────────────────────────────────
    if (f.beds && f.beds !== 'any') {
      all = all.filter(function (l) {
        var b = String(_attr(l, 'beds') || '');
        if (f.beds === 'studio') return b.toLowerCase() === 'studio' || b === '0';
        return b.toLowerCase() !== 'studio' && +b >= +f.beds;
      });
    }

    // ── Bathrooms ─────────────────────────────────────────────────────────
    if (f.baths && f.baths !== 'any') {
      all = all.filter(function (l) { return +(_attr(l, 'baths') || 0) >= +f.baths; });
    }

    // ── Subcategory (exact match on the stored subcat key) ────────────────
    if (f.subcat && f.subcat !== 'all') {
      var subLc = f.subcat.toLowerCase();
      all = all.filter(function (l) {
        return (_attr(l, 'subcat') || l.subcat || '').toLowerCase() === subLc;
      });
    }

    // ── Brand / Make / Material (partial match) ───────────────────────────
    if (f.brand && f.brand.trim()) {
      var brandLc = f.brand.toLowerCase();
      all = all.filter(function (l) {
        var val = (_attr(l, 'brand') || _attr(l, 'make') || _attr(l, 'material') || l.brand || l.make || '').toLowerCase();
        return val.indexOf(brandLc) !== -1;
      });
    }

    // ── Gender ────────────────────────────────────────────────────────────
    if (f.gender && f.gender !== 'all') {
      var genLc = f.gender.toLowerCase();
      all = all.filter(function (l) { return (_attr(l, 'gender') || '').toLowerCase() === genLc; });
    }

    // ── Size — exact match for fashion; numeric range for property ─────────
    if (f.size && f.size !== 'all') {
      var sizeLc = f.size.toLowerCase();
      all = all.filter(function (l) { return (_attr(l, 'size') || '').toLowerCase() === sizeLc; });
    }
    if (f.sizeMin) {
      all = all.filter(function (l) { return +(_attr(l, 'size') || 0) >= +f.sizeMin; });
    }
    if (f.sizeMax) {
      all = all.filter(function (l) {
        var s = +(_attr(l, 'size') || 0);
        return s > 0 && s <= +f.sizeMax;
      });
    }

    // ── Fuel type ─────────────────────────────────────────────────────────
    if (f.fuelType && f.fuelType !== 'all') {
      var fuelLc = f.fuelType.toLowerCase();
      all = all.filter(function (l) {
        return (_attr(l, 'fuel') || _attr(l, 'fuelType') || '').toLowerCase() === fuelLc;
      });
    }

    // ── Year range ────────────────────────────────────────────────────────
    if (f.yearMin) all = all.filter(function (l) { return +(_attr(l, 'year') || 0) >= +f.yearMin; });
    if (f.yearMax) all = all.filter(function (l) { return +(_attr(l, 'year') || 9999) <= +f.yearMax; });

    // ── Amenities / features — AND logic (every selected feature must exist) ─
    if (Array.isArray(f.amenities) && f.amenities.length) {
      all = all.filter(function (l) {
        var feats = (l.attrs && Array.isArray(l.attrs.features)) ? l.attrs.features
          : (Array.isArray(l.features) ? l.features : []);
        return f.amenities.every(function (a) { return feats.indexOf(a) !== -1; });
      });
    }

    // ── Sort ──────────────────────────────────────────────────────────────
    var sort = f.sort || 'newest';
    if      (sort === 'price_asc')  all.sort(function (a, b) { return (a.price || 0) - (b.price || 0); });
    else if (sort === 'price_desc') all.sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
    else if (sort === 'oldest')     all.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    else                            all.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

    return all;
  };

  // ── RENDER — writes results into the category container ──────────────────
  H._renderCatResults = function (catId, all, baseCat) {
    var el = document.getElementById('cl_' + catId);
    if (!el) return;

    var spotlightHtml = (H.adCarousel && H.activeAds)
      ? H.adCarousel(H.activeAds(baseCat), { heading: false })
      : '';

    el.innerHTML = all.length
      ? spotlightHtml + '<div class="listing-list">' + all.map(H.renderListCard).join('') + '</div>'
      : spotlightHtml + H.emptyState('No listings match', 'Try adjusting your filters', null, null);

    if (H._initAdCarousels) H._initAdCarousels();

    // Result count label
    var cnt = document.getElementById('cc_' + catId);
    if (cnt) cnt.textContent = all.length + ' listing' + (all.length !== 1 ? 's' : '');

    // Filter badge (count of active non-default filters)
    var f = getF(catId);
    var n = Object.keys(f).filter(function (k) {
      var v = f[k];
      return v && v !== '' && v !== 'all' && v !== 'any' && v !== 'newest'
        && !(Array.isArray(v) && !v.length);
    }).length;
    var badge = document.getElementById('fb_' + catId);
    if (badge) { badge.textContent = n || ''; badge.style.display = n ? 'flex' : 'none'; }
  };

  // ── HELPER — read an attribute, preferring l.attrs over top-level ─────────
  function _attr(l, key) {
    if (l.attrs && l.attrs[key] != null) return l.attrs[key];
    if (l[key] != null) return l[key];
    return '';
  }

  // ── FILTER CAROUSEL BUILDER ───────────────────────────────────────────────
  // mainCards: [{ title, tag, html }] — one swipeable card per filter group
  // amenityCat: optional key into H.CATEGORY_ATTRS whose chips field becomes
  //             a separate paginated mini-carousel below the main one
  H._filterCarouselHtml = function (catId, mainCards, amenityCat) {
    var scrollId = 'fc_' + catId;
    var dotsId   = 'fd_' + catId;
    var SVG_L = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>';
    var SVG_R = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>';

    var cardsHtml = mainCards.map(function (c) {
      return '<div class="flt-card">'
        + '<div class="flt-card-head">'
          + '<span class="flt-card-num">' + H.escHtml(c.title) + '</span>'
          + (c.tag ? '<span class="flt-card-tag">' + H.escHtml(c.tag) + '</span>' : '')
        + '</div>'
        + c.html
      + '</div>';
    }).join('');

    var dotsHtml = mainCards.map(function (_, i) {
      return '<button class="flt-dot' + (i === 0 ? ' on' : '') + '" aria-label="Slide ' + (i + 1) + '"'
        + ' onclick="H._carouselTo(\'' + scrollId + '\',\'' + dotsId + '\',' + i + ')"></button>';
    }).join('');

    var html = '<div class="flt-carousel-row">'
      + '<button class="flt-nav-btn flt-nav-l" onclick="H._carouselPrev(\'' + scrollId + '\',\'' + dotsId + '\')" aria-label="Previous">' + SVG_L + '</button>'
      + '<div class="flt-carousel" id="' + scrollId + '" onscroll="H._carouselSync(\'' + scrollId + '\',\'' + dotsId + '\')">'
        + cardsHtml
      + '</div>'
      + '<button class="flt-nav-btn flt-nav-r" onclick="H._carouselNext(\'' + scrollId + '\',\'' + dotsId + '\')" aria-label="Next">' + SVG_R + '</button>'
    + '</div>'
    + '<div class="flt-dots" id="' + dotsId + '">' + dotsHtml + '</div>';

    if (amenityCat) {
      html += H._amenityCarouselSection(catId, amenityCat, mainCards.length + 1);
    }

    html += '<div class="flt-sort-row">'
      + '<div class="flt-sort-lbl">Sort By</div>'
      + '<select class="flt-sort-sel" onchange="H._setFilter(\'' + catId + '\',\'sort\',this.value)">'
        + '<option value="newest">Newest First</option>'
        + '<option value="oldest">Oldest First</option>'
        + '<option value="price_asc">Price: Low → High</option>'
        + '<option value="price_desc">Price: High → Low</option>'
      + '</select>'
    + '</div>'
    + '<div class="flt-btns">'
      + '<button class="flt-btn-clear" onclick="H._clearFilters(\'' + catId + '\')">Clear</button>'
      + '<button class="flt-btn-apply" onclick="H._toggleFilters(\'' + catId + '\')">Apply Filters</button>'
    + '</div>';

    return html;
  };

  // Builds a paginated amenity mini-carousel (6 chips per slide) with its own
  // section separator, header, nav arrows and dots
  H._amenityCarouselSection = function (catId, amenityCat, sectionNum) {
    var schema = (H.CATEGORY_ATTRS && H.CATEGORY_ATTRS[amenityCat]) || [];
    var field = schema.filter(function (x) { return x.type === 'chips'; })[0];
    if (!field || !field.options || !field.options.length) return '';

    var scrollId = 'fca_' + catId;
    var dotsId   = 'fda_' + catId;
    var SVG_L = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>';
    var SVG_R = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>';

    var PAGE = 6;
    var pages = [];
    for (var i = 0; i < field.options.length; i += PAGE) {
      pages.push(field.options.slice(i, i + PAGE));
    }

    var cardsHtml = pages.map(function (page) {
      return '<div class="flt-card">'
        + '<div class="flt-pills flt-amenities">'
        + page.map(function (o) {
          return '<button type="button" class="flt-pill" onclick="H._toggleAmenity(\'' + catId + '\',\'' + H.escHtml(o) + '\',this)">' + H.escHtml(o) + '</button>';
        }).join('')
        + '</div></div>';
    }).join('');

    var dotsHtml = pages.map(function (_, i) {
      return '<button class="flt-dot' + (i === 0 ? ' on' : '') + '" aria-label="Amenities slide ' + (i + 1) + '"'
        + ' onclick="H._carouselTo(\'' + scrollId + '\',\'' + dotsId + '\',' + i + ')"></button>';
    }).join('');

    return '<div class="fp-section-sep">'
      + '<div class="fp-sec-head">'
        + '<span class="fp-sec-num">' + sectionNum + '. ' + H.escHtml(field.label) + '</span>'
        + '<span class="fp-sec-tag">OTHER ATTRIBUTES</span>'
      + '</div>'
      + '<div class="flt-carousel-row">'
        + '<button class="flt-nav-btn flt-nav-l" onclick="H._carouselPrev(\'' + scrollId + '\',\'' + dotsId + '\')" aria-label="Previous">' + SVG_L + '</button>'
        + '<div class="flt-carousel" id="' + scrollId + '" onscroll="H._carouselSync(\'' + scrollId + '\',\'' + dotsId + '\')">'
          + cardsHtml
        + '</div>'
        + '<button class="flt-nav-btn flt-nav-r" onclick="H._carouselNext(\'' + scrollId + '\',\'' + dotsId + '\')" aria-label="Next">' + SVG_R + '</button>'
      + '</div>'
      + '<div class="flt-dots" id="' + dotsId + '">' + dotsHtml + '</div>'
    + '</div>';
  };

  // ── Carousel helpers ──────────────────────────────────────────────────────
  function _carouselStep(el) {
    var card = el.querySelector('.flt-card');
    return card ? (card.offsetWidth + 10) : el.offsetWidth;
  }

  H._carouselSync = function (scrollId, dotsId) {
    var el = document.getElementById(scrollId);
    if (!el) return;
    var idx = Math.round(el.scrollLeft / (_carouselStep(el) || 1));
    document.querySelectorAll('#' + dotsId + ' .flt-dot').forEach(function (d, i) {
      d.classList.toggle('on', i === idx);
    });
  };

  H._carouselTo = function (scrollId, dotsId, idx) {
    var el = document.getElementById(scrollId);
    if (!el) return;
    el.scrollTo({ left: idx * _carouselStep(el), behavior: 'smooth' });
    document.querySelectorAll('#' + dotsId + ' .flt-dot').forEach(function (d, i) {
      d.classList.toggle('on', i === idx);
    });
  };

  H._carouselPrev = function (scrollId, dotsId) {
    var el = document.getElementById(scrollId);
    if (!el) return;
    var idx = Math.max(0, Math.round(el.scrollLeft / (_carouselStep(el) || 1)) - 1);
    H._carouselTo(scrollId, dotsId, idx);
  };

  H._carouselNext = function (scrollId, dotsId) {
    var el = document.getElementById(scrollId);
    if (!el) return;
    var total = el.querySelectorAll('.flt-card').length;
    var idx = Math.min(total - 1, Math.round(el.scrollLeft / (_carouselStep(el) || 1)) + 1);
    H._carouselTo(scrollId, dotsId, idx);
  };

  // ── UI builder helpers ────────────────────────────────────────────────────
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

  H._sizeRange = function (id) {
    return '<div class="flt-section"><div class="flt-label">Area / Size (m²)</div>'
      + '<div class="flt-range">'
      + '<div class="flt-range-in"><input type="number" min="0" placeholder="Min" oninput="H._setFilter(\'' + id + '\',\'sizeMin\',this.value)"><span class="suf">m²</span></div>'
      + '<span class="flt-range-sep">to</span>'
      + '<div class="flt-range-in"><input type="number" min="0" placeholder="Max" oninput="H._setFilter(\'' + id + '\',\'sizeMax\',this.value)"><span class="suf">m²</span></div>'
      + '</div></div>';
  };

  H._yearRange = function (id) {
    return '<div class="flt-section"><div class="flt-label">Year</div>'
      + '<div class="flt-range">'
      + '<div class="flt-range-in"><input type="number" min="1960" max="2030" placeholder="From" oninput="H._setFilter(\'' + id + '\',\'yearMin\',this.value)"></div>'
      + '<span class="flt-range-sep">to</span>'
      + '<div class="flt-range-in"><input type="number" min="1960" max="2030" placeholder="To" oninput="H._setFilter(\'' + id + '\',\'yearMax\',this.value)"></div>'
      + '</div></div>';
  };

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
    // Sort is now embedded inside the carousel footer; this is kept for safety.
    return '';
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
      + '<div id="fp_' + id + '" style="display:none;background:var(--card);border-bottom:2px solid ' + color + '">'
      + '<div class="flt-cr-header"><span class="flt-cr-title">Filter ' + H.escHtml(name) + '</span>'
      + '<button class="flt-cr-close" onclick="H._toggleFilters(\'' + id + '\')">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      + '</button></div>'
      + filterHtml
      + '</div>';
  };

  H._catTopbar = function (title, color) {
    return '<div class="det-topbar" style="background:' + (color || '#1A3A8F') + '">'
      + '<button class="back" onclick="H.goBack()" style="color:#fff"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<div class="det-topbar-title" style="color:#fff">' + H.escHtml(title) + '</div>'
      + '<button onclick="H.navTo(\'Post\')" style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer;padding:6px 12px;border-radius:8px;white-space:nowrap">+ Post</button>'
      + '</div>';
  };

  // ── Category page routing ─────────────────────────────────────────────────
  var CAT_PAGE = {
    property: 'Property', vehicles: 'Vehicles', rooms: 'Rooms',
    electronics: 'Electronics', furniture: 'Furniture', fashion: 'Fashion',
    services: 'Services', jobs: 'Jobs', agriculture: 'Agriculture',
    pets: 'Pets', kids: 'Kids', other: 'Other'
  };

  H._openCatPage = function (cid, subKey) {
    function setF(fid) { H._filters[fid] = H._filters[fid] || {}; if (subKey) H._filters[fid].subcat = subKey; else delete H._filters[fid].subcat; }
    setF(cid);
    if (cid === 'property') { setF('property_sale'); setF('property_rent'); }
    var page = CAT_PAGE[cid];
    if (page) H.openInner(page, { cid: cid });
    else H.openInner('CategoryView', { cid: cid });
  };

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

  // ── Subcategory picker ────────────────────────────────────────────────────
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
